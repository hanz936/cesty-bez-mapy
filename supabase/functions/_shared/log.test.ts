import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { logInfo, logError, maskEmail } from "./log.ts";

Deno.test("logInfo: JSON s level/event/ts + fields", () => {
  const orig = console.log;
  let captured = "";
  console.log = (s: string) => { captured = s; };
  try {
    logInfo("thing_happened", { order_id: "o1" });
  } finally {
    console.log = orig;
  }
  const parsed = JSON.parse(captured);
  assertEquals(parsed.level, "info");
  assertEquals(parsed.event, "thing_happened");
  assertEquals(parsed.order_id, "o1");
  assertStringIncludes(parsed.ts, "T"); // ISO timestamp
});

Deno.test("logError jde na console.error", () => {
  const orig = console.error;
  let captured = "";
  console.error = (s: string) => { captured = s; };
  try {
    logError("boom", {});
  } finally {
    console.error = orig;
  }
  assertEquals(JSON.parse(captured).level, "error");
});

Deno.test("maskEmail: vrací doménu", () => {
  assertEquals(maskEmail("Jan.Novak@Example.com"), "Example.com");
});

Deno.test("maskEmail: malformed → unknown", () => {
  assertEquals(maskEmail("neplatny"), "unknown");
});
