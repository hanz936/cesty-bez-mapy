import type {
  FakturoidInvoicePayload, FakturoidInvoiceResponse, FakturoidToken,
} from "./types.ts";

interface FakturoidConfig {
  clientId: string;
  clientSecret: string;
  slug: string;
  userAgent: string;
}

interface ClientOptions {
  now?: () => Date;
  maxRetries?: number;
  baseDelayMs?: number;
}

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface CachedToken {
  token: string;
  expiresAt: Date;
}

export class FakturoidClient {
  #cfg: FakturoidConfig;
  #fetch: FetchLike;
  #now: () => Date;
  #maxRetries: number;
  #baseDelayMs: number;
  #cached: CachedToken | null = null;

  constructor(cfg: FakturoidConfig, fetchImpl: FetchLike = fetch, opts: ClientOptions = {}) {
    this.#cfg = cfg;
    this.#fetch = fetchImpl;
    this.#now = opts.now ?? (() => new Date());
    this.#maxRetries = opts.maxRetries ?? 3;
    this.#baseDelayMs = opts.baseDelayMs ?? 1000;
  }

  async getToken(forceRefresh = false): Promise<string> {
    const now = this.#now();
    if (
      !forceRefresh && this.#cached &&
      this.#cached.expiresAt.getTime() - now.getTime() > TOKEN_REFRESH_BUFFER_MS
    ) {
      return this.#cached.token;
    }
    const auth = btoa(`${this.#cfg.clientId}:${this.#cfg.clientSecret}`);
    const res = await this.#fetch("https://app.fakturoid.cz/api/v3/oauth/token", {
      method: "POST",
      headers: {
        "User-Agent": this.#cfg.userAgent,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify({ grant_type: "client_credentials" }),
    });
    if (!res.ok) {
      throw new Error(`Fakturoid OAuth failed: ${res.status}`);
    }
    const data = await res.json() as FakturoidToken;
    this.#cached = {
      token: data.access_token,
      expiresAt: new Date(now.getTime() + data.expires_in * 1000),
    };
    return data.access_token;
  }

  async #request<T>(path: string, init: RequestInit, expectJson = true): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= this.#maxRetries; attempt++) {
      const token = await this.getToken();
      const res = await this.#fetch(`https://app.fakturoid.cz/api/v3/accounts/${this.#cfg.slug}${path}`, {
        ...init,
        headers: {
          "User-Agent": this.#cfg.userAgent,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
          ...(init.headers ?? {}),
        },
      });
      if (res.ok) {
        return (expectJson ? await res.json() : (undefined as T));
      }
      if (res.status === 401) {
        await this.getToken(true);
        if (attempt === this.#maxRetries) {
          throw new Error(`Fakturoid 401 after token refresh: ${path}`);
        }
        continue;
      }
      const body = await res.text();
      if (RETRY_STATUSES.has(res.status) && attempt < this.#maxRetries) {
        lastError = new Error(`Fakturoid ${res.status}: ${body}`);
        await new Promise((r) => setTimeout(r, this.#baseDelayMs * Math.pow(4, attempt - 1)));
        continue;
      }
      throw new Error(`Fakturoid ${res.status}: ${body}`);
    }
    throw lastError ?? new Error("Fakturoid request failed without specific error");
  }

  async createInvoice(payload: FakturoidInvoicePayload): Promise<FakturoidInvoiceResponse> {
    return await this.#request<FakturoidInvoiceResponse>("/invoices.json", {
      method: "POST",
      body: JSON.stringify({ invoice: payload }),
    });
  }

  async createCreditNote(invoiceId: number): Promise<FakturoidInvoiceResponse> {
    return await this.#request<FakturoidInvoiceResponse>(
      `/invoices/${invoiceId}/credit_notes.json`,
      { method: "POST", body: JSON.stringify({ invoice: {} }) },
    );
  }

  async cancelInvoice(invoiceId: number): Promise<void> {
    await this.#request<void>(`/invoices/${invoiceId}/cancel.json`, { method: "POST" }, false);
  }

  async sendInvoiceEmail(invoiceId: number, email: string): Promise<void> {
    await this.#request<void>(
      `/invoices/${invoiceId}/message.json`,
      {
        method: "POST",
        body: JSON.stringify({ email, subject: "Faktura", message: "Faktura v příloze." }),
      },
      false,
    );
  }

  async downloadPdf(invoiceId: number): Promise<Uint8Array> {
    const token = await this.getToken();
    const res = await this.#fetch(
      `https://app.fakturoid.cz/api/v3/accounts/${this.#cfg.slug}/invoices/${invoiceId}/download.pdf`,
      {
        headers: {
          "User-Agent": this.#cfg.userAgent,
          "Authorization": `Bearer ${token}`,
        },
      },
    );
    if (!res.ok) throw new Error(`Fakturoid PDF download failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  }
}
