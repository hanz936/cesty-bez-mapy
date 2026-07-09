import { describe, it, expect } from "vitest";
import type * as Sentry from "@sentry/react";
import { scrubPii } from "./instrument.js";

describe("scrubPii", () => {
  it("removes email and ip from event.user", () => {
    const event = { user: { id: "abc", email: "a@b.cz", ip_address: "1.2.3.4" } } as unknown as Sentry.ErrorEvent;
    const result = scrubPii(event);
    expect(result.user!.email).toBeUndefined();
    expect(result.user!.ip_address).toBeUndefined();
    expect(result.user!.id).toBe("abc");
    expect(result).toBe(event); // beforeSend contract: mutate-and-return the same object
  });

  it("is a no-op when there is no user", () => {
    const event = { message: "hi" } as unknown as Sentry.ErrorEvent;
    expect(scrubPii(event)).toEqual({ message: "hi" });
  });

  it("strips query strings from request url and removes query_string", () => {
    const event = {
      request: {
        url: "https://cestybezmapy.cz/dekujeme?session_id=cs_test_abc&foo=1",
        query_string: "session_id=cs_test_abc&foo=1",
      },
    } as unknown as Sentry.ErrorEvent;
    const result = scrubPii(event);
    expect(result.request!.url).toBe("https://cestybezmapy.cz/dekujeme");
    expect(result.request!.query_string).toBeUndefined();
  });

  it("strips query strings from navigation and fetch breadcrumbs", () => {
    const event = {
      breadcrumbs: [
        { category: "navigation", data: { from: "/a?preview_token=x", to: "/b?session_id=y" } },
        { category: "fetch", data: { url: "https://api/x?token=secret" } },
        { category: "ui.click" }, // no data — must not throw
      ],
    } as unknown as Sentry.ErrorEvent;
    const result = scrubPii(event);
    expect(result.breadcrumbs![0].data!.from as string).toBe("/a");
    expect(result.breadcrumbs![0].data!.to as string).toBe("/b");
    expect(result.breadcrumbs![1].data!.url as string).toBe("https://api/x");
  });

  it("leaves urls without a query string untouched", () => {
    const event = { request: { url: "https://cestybezmapy.cz/o-nas" } } as unknown as Sentry.ErrorEvent;
    expect(scrubPii(event).request!.url).toBe("https://cestybezmapy.cz/o-nas");
  });
});
