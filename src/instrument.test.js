import { describe, it, expect } from "vitest";
import { scrubPii } from "./instrument.js";

describe("scrubPii", () => {
  it("removes email and ip from event.user", () => {
    const event = { user: { id: "abc", email: "a@b.cz", ip_address: "1.2.3.4" } };
    const result = scrubPii(event);
    expect(result.user.email).toBeUndefined();
    expect(result.user.ip_address).toBeUndefined();
    expect(result.user.id).toBe("abc");
    expect(result).toBe(event); // beforeSend contract: mutate-and-return the same object
  });

  it("is a no-op when there is no user", () => {
    const event = { message: "hi" };
    expect(scrubPii(event)).toEqual({ message: "hi" });
  });
});
