// Strukturované logování pro edge funkce. JSON na stdout/stderr s polem `event`
// (stejný styl jako _shared/email/sendEmail.ts). E-maily logovat přes maskEmail.

type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, event: string, fields: Record<string, unknown>): void {
  const line = JSON.stringify({ level, event, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  emit("info", event, fields);
}
export function logWarn(event: string, fields: Record<string, unknown> = {}): void {
  emit("warn", event, fields);
}
export function logError(event: string, fields: Record<string, unknown> = {}): void {
  emit("error", event, fields);
}

export function maskEmail(email: string): string {
  return email.split("@")[1] || "unknown";
}
