// Czech vocative case helper.
// Customer-facing greetings need 5. pád ("Děkujeme, Jano!" not "Děkujeme, Jana!").
// vokativ() returns lowercase; we capitalize the first letter.

import { vokativ } from "vokativ";

export function vocativeFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  const firstName = trimmed.split(/\s+/)[0];
  const lower = vokativ(firstName);
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
