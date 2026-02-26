export function log(msg: string, data?: Record<string, unknown>) {
  if (data) console.log(`[دعاء] ${msg}`, data);
  else console.log(`[دعاء] ${msg}`);
}
