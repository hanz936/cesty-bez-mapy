import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { CLIENT_FAIL_MESSAGE, clientFail } from "./clientFail.ts";

Deno.test("clientFail vrací generickou zprávu (žádný surový detail integrace)", () => {
  const rawDetail = "Fakturoid 401 Unauthorized: token xyz expired at https://app.fakturoid.cz";
  const result = clientFail("error");
  assertEquals(result.error, CLIENT_FAIL_MESSAGE);
  assertEquals(result.error.includes(rawDetail), false);
  assertEquals(result.error.includes("Fakturoid"), false);
});

Deno.test("clientFail zachová předaný status key (větvení admin UI)", () => {
  assertEquals(clientFail("error").status, "error");
  assertEquals(clientFail("cancel_failed").status, "cancel_failed");
});
