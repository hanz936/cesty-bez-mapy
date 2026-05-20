import type {
  FakturoidInvoicePayload, FakturoidInvoiceResponse,
  FakturoidSubjectPayload, FakturoidSubjectResponse, FakturoidToken,
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
  persister?: TokenPersister;
}

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const RETRY_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

interface CachedToken {
  token: string;
  expiresAt: Date;
}

export interface TokenPersister {
  load(): Promise<CachedToken | null>;
  save(token: CachedToken): Promise<void>;
}

export class FakturoidClient {
  #cfg: FakturoidConfig;
  #fetch: FetchLike;
  #now: () => Date;
  #maxRetries: number;
  #baseDelayMs: number;
  #cached: CachedToken | null = null;
  #persister: TokenPersister | undefined;

  constructor(cfg: FakturoidConfig, fetchImpl: FetchLike = fetch, opts: ClientOptions = {}) {
    this.#cfg = cfg;
    this.#fetch = fetchImpl;
    this.#now = opts.now ?? (() => new Date());
    this.#maxRetries = opts.maxRetries ?? 3;
    this.#baseDelayMs = opts.baseDelayMs ?? 1000;
    this.#persister = opts.persister;
  }

  async getToken(forceRefresh = false): Promise<string> {
    const now = this.#now();

    // 1. In-memory cache hit
    if (
      !forceRefresh && this.#cached &&
      this.#cached.expiresAt.getTime() - now.getTime() > TOKEN_REFRESH_BUFFER_MS
    ) {
      return this.#cached.token;
    }

    // 2. Persister cache hit (cross-invocation)
    if (!forceRefresh && this.#persister) {
      const loaded = await this.#persister.load();
      if (loaded && loaded.expiresAt.getTime() - now.getTime() > TOKEN_REFRESH_BUFFER_MS) {
        this.#cached = loaded;
        return loaded.token;
      }
    }

    // 3. Fetch fresh
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
    if (this.#persister) await this.#persister.save(this.#cached);
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

  async createSubject(payload: FakturoidSubjectPayload): Promise<FakturoidSubjectResponse> {
    return await this.#request<FakturoidSubjectResponse>("/subjects.json", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async findOrCreateSubject(payload: FakturoidSubjectPayload): Promise<FakturoidSubjectResponse> {
    if (payload.custom_id) {
      // Try to find existing subject by custom_id (= customer email).
      const existing = await this.#request<FakturoidSubjectResponse[]>(
        `/subjects.json?custom_id=${encodeURIComponent(payload.custom_id)}`,
        { method: "GET" },
      );
      if (Array.isArray(existing) && existing.length > 0) {
        return existing[0];
      }
    }
    return await this.createSubject(payload);
  }

  async createInvoice(payload: FakturoidInvoicePayload): Promise<FakturoidInvoiceResponse> {
    return await this.#request<FakturoidInvoiceResponse>("/invoices.json", {
      method: "POST",
      body: JSON.stringify({ invoice: payload }),
    });
  }

  async recordPayment(invoiceId: number, paidOn: string): Promise<void> {
    await this.#request<void>(
      `/invoices/${invoiceId}/payments.json`,
      {
        method: "POST",
        body: JSON.stringify({ paid_on: paidOn, mark_document_as_paid: true }),
      },
      false,
    );
  }

  async cancelInvoice(invoiceId: number): Promise<void> {
    // Direct fetch: Fakturoid returns 422 on neplátce-DPH accounts because
    // `cancelled` status is plátce-only. Intercept that case with a clearer error
    // instead of leaking the raw "Fakturoid 422: ..." string through #request.
    const token = await this.getToken();
    const res = await this.#fetch(
      `https://app.fakturoid.cz/api/v3/accounts/${this.#cfg.slug}/invoices/${invoiceId}/fire.json?event=cancel`,
      {
        method: "POST",
        headers: {
          "User-Agent": this.#cfg.userAgent,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      },
    );
    if (res.ok) return;
    if (res.status === 422) {
      throw new Error(
        "Fakturoid: nelze stornovat fakturu na účtu neplátce DPH. Použijte refund workflow (vystaví storno fakturu) nebo upravte fakturu ručně ve Fakturoid UI.",
      );
    }
    const body = await res.text();
    throw new Error(`Fakturoid ${res.status}: ${body}`);
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

  // Fakturoid v3 generates invoice PDFs asynchronously and returns 204 until ready; retry briefly.
  async downloadPdf(invoiceId: number, delayMs = 1500): Promise<Uint8Array> {
    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
      if (res.status === 204) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw new Error(`Fakturoid PDF not ready after ${maxAttempts} retries`);
      }
      if (!res.ok) throw new Error(`Fakturoid PDF download failed: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length === 0) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, delayMs));
          continue;
        }
        throw new Error(`Fakturoid PDF not ready after ${maxAttempts} retries`);
      }
      return bytes;
    }
    throw new Error(`Fakturoid PDF not ready after ${maxAttempts} retries`);
  }
}
