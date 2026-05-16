// Tests for vocativeFirstName helper
// Run: deno test --allow-env --allow-net supabase/functions/_shared/email/vocative.test.ts

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { vocativeFirstName } from "./vocative.ts";

Deno.test("Czech feminine name 'Jana' → 'Jano'", () => {
  assertEquals(vocativeFirstName("Jana"), "Jano");
});

Deno.test("Czech masculine name 'Jan' → 'Jane'", () => {
  assertEquals(vocativeFirstName("Jan"), "Jane");
});

Deno.test("Consonant-cluster masculine 'Petr' → 'Petře'", () => {
  assertEquals(vocativeFirstName("Petr"), "Petře");
});

Deno.test("Short name 'Tom' → 'Tome'", () => {
  assertEquals(vocativeFirstName("Tom"), "Tome");
});

Deno.test("Full name uses first word only: 'Jana Nováková' → 'Jano'", () => {
  assertEquals(vocativeFirstName("Jana Nováková"), "Jano");
});

Deno.test("Whitespace is trimmed: '  Jana  ' → 'Jano'", () => {
  assertEquals(vocativeFirstName("  Jana  "), "Jano");
});

Deno.test("Empty string returns empty string (graceful no-op)", () => {
  assertEquals(vocativeFirstName(""), "");
});
