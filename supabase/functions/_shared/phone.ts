export function normalizePhoneNumber(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}
