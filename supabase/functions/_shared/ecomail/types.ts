// Ecomail API v2 — typy. Zdroj: https://docs.ecomail.cz/api-reference
export interface EcomailSubscriberData {
  email: string;
  name?: string;
  surname?: string;
  source?: string;
  tags?: string[];
  custom_fields?: Record<string, unknown>;
}

export interface EcomailSubscribeOptions {
  update_existing?: boolean;
  skip_confirmation?: boolean;
  resubscribe?: boolean;
  trigger_autoresponders?: boolean;
}

// POST /lists/{id}/subscribe response
export interface EcomailSubscribeResponse {
  id?: number;
  already_subscribed?: boolean;
  [key: string]: unknown;
}

// GET /lists/{id}/subscriber/{email} response (úspěch)
export interface EcomailSubscriber {
  id: number;
  email: string;
  tags: string[];
  status: number; // 1 subscribed, 2 unsub, 3 soft, 4 hard, 5 spam, 6 unconfirmed
}
