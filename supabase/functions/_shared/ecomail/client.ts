import type {
  EcomailSubscriberData, EcomailSubscribeOptions,
  EcomailSubscribeResponse, EcomailSubscriber,
} from "./types.ts";

interface EcomailConfig { apiKey: string; baseUrl?: string }
interface ClientOptions { maxRetries?: number; baseDelayMs?: number }
type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

const DEFAULT_BASE_URL = "https://api2.ecomailapp.cz";

export class EcomailError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`Ecomail ${status}: ${body}`);
    this.name = "EcomailError";
    this.status = status;
    this.body = body;
  }
}

export class EcomailClient {
  #apiKey: string;
  #baseUrl: string;
  #fetch: FetchLike;
  #maxRetries: number;
  #baseDelayMs: number;

  constructor(cfg: EcomailConfig, fetchImpl: FetchLike = fetch, opts: ClientOptions = {}) {
    this.#apiKey = cfg.apiKey;
    this.#baseUrl = cfg.baseUrl ?? DEFAULT_BASE_URL;
    this.#fetch = fetchImpl;
    this.#maxRetries = opts.maxRetries ?? 2;
    this.#baseDelayMs = opts.baseDelayMs ?? 1000;
  }

  #headers(): Record<string, string> {
    return { "key": this.#apiKey, "Content-Type": "application/json", "Accept": "application/json" };
  }

  async #request<T>(path: string, init: RequestInit): Promise<T> {
    for (let attempt = 1; attempt <= this.#maxRetries; attempt++) {
      const res = await this.#fetch(`${this.#baseUrl}${path}`, {
        ...init,
        headers: { ...this.#headers(), ...(init.headers ?? {}) },
      });
      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return await res.json() as T;
      }
      if (res.status === 429 && attempt < this.#maxRetries) {
        const retryAfter = Number(res.headers.get("Retry-After")) || 0;
        await new Promise((r) => setTimeout(r, retryAfter * 1000 || this.#baseDelayMs));
        continue;
      }
      throw new EcomailError(res.status, await res.text());
    }
    throw new EcomailError(0, "request failed without response");
  }

  /** POST /lists/{listId}/subscribe */
  async subscribe(
    listId: number,
    data: EcomailSubscriberData,
    opts: EcomailSubscribeOptions = {},
  ): Promise<EcomailSubscribeResponse> {
    return await this.#request<EcomailSubscribeResponse>(`/lists/${listId}/subscribe`, {
      method: "POST",
      body: JSON.stringify({ subscriber_data: data, ...opts }),
    });
  }

  /** GET /lists/{listId}/subscriber/{email} — null pokud neexistuje. */
  async getSubscriber(listId: number, email: string): Promise<EcomailSubscriber | null> {
    const res = await this.#fetch(
      `${this.#baseUrl}/lists/${listId}/subscriber/${encodeURIComponent(email)}`,
      { method: "GET", headers: this.#headers() },
    );
    if (res.status === 404) return null;
    if (!res.ok) throw new EcomailError(res.status, await res.text());
    const data = await res.json() as Record<string, unknown>;
    if (data.errors) return null;
    return {
      id: data.id as number,
      email: data.email as string,
      tags: (data.tags as string[]) ?? [],
      status: data.status as number,
    };
  }

  /** DELETE /lists/{listId}/unsubscribe — pro úplnost; core flow ji nevolá. */
  async unsubscribe(listId: number, email: string): Promise<void> {
    await this.#request<void>(`/lists/${listId}/unsubscribe`, {
      method: "DELETE",
      body: JSON.stringify({ email }),
    });
  }
}
