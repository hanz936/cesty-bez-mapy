// SEC-07: klient (admin UI) dostane generickou hlášku; surový detail integrace
// se NIKDY nevrací v HTTP odpovědi — zůstává jen server-side (orders.invoice_error,
// logIntegration, sendAlertEmail, console.error).
export const CLIENT_FAIL_MESSAGE = "Zpracování faktury se nezdařilo";

export function clientFail(status: string): { status: string; error: string } {
  return { status, error: CLIENT_FAIL_MESSAGE };
}
