import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isValidIco } from "./ares.ts";

Deno.test("isValidIco — valid IČO with correct checksum", () => {
  assertEquals(isValidIco("27082440"), true); // Seznam.cz
  assertEquals(isValidIco("00006947"), true); // ministerstvo financí
});

Deno.test("isValidIco — invalid checksums", () => {
  assertEquals(isValidIco("12345678"), false);
  assertEquals(isValidIco("00000000"), false);
});

Deno.test("isValidIco — wrong format", () => {
  assertEquals(isValidIco("1234567"), false);   // 7 digits
  assertEquals(isValidIco("123456789"), false); // 9 digits
  assertEquals(isValidIco("abcdefgh"), false);
  assertEquals(isValidIco(""), false);
  assertEquals(isValidIco("12 345 67"), false);
});
