export const COMPANY_MASTER_EMAIL = 'acbank@acbank.co.kr';
export const COMPANY_SETTINGS_REAUTH_TTL_MS = 15 * 60 * 1000;

export function normalizeEmail(email?: string | null) {
  return (email || '').trim().toLowerCase();
}

export function isCompanyMasterEmail(email?: string | null) {
  return normalizeEmail(email) === COMPANY_MASTER_EMAIL;
}

export function companySettingsReauthKey(userId?: string | null) {
  return userId ? `company-settings-reauth:${userId}` : 'company-settings-reauth';
}
