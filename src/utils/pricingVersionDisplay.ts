type PricingVersionDisplayInput = {
  versionName?: string | null;
  supplierName?: string | null;
  effectiveFrom?: string | null;
  capturedAt?: string | null;
};

const FALLBACK_PRICING_VERSION_NAME = '기준 단가표';

const toYearMonth = (year: string, month: string) => {
  const parsedMonth = Number(month);
  if (!Number.isFinite(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) return null;
  return `${year}-${String(parsedMonth).padStart(2, '0')}`;
};

const extractYearMonthFromText = (value?: string | null) => {
  if (!value) return null;
  const text = value.trim();

  const separated = text.match(/((?:19|20)\d{2})\s*(?:[-./년]|\s)\s*(1[0-2]|0?[1-9])\s*(?:월)?/);
  if (separated) return toYearMonth(separated[1], separated[2]);

  const compact = text.match(/\b((?:19|20)\d{2})(0[1-9]|1[0-2])(?:\d{2})?\b/);
  if (compact) return toYearMonth(compact[1], compact[2]);

  return null;
};

const extractYearMonthFromDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return extractYearMonthFromText(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const formatPricingVersionDisplayName = ({
  versionName,
  effectiveFrom,
  capturedAt,
}: PricingVersionDisplayInput) => {
  const yearMonth = extractYearMonthFromText(versionName)
    || extractYearMonthFromDate(effectiveFrom)
    || extractYearMonthFromDate(capturedAt);

  return yearMonth ? `${yearMonth} 단가표` : FALLBACK_PRICING_VERSION_NAME;
};
