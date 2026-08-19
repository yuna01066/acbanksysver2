const ANONYMOUS_QUOTE_DRAFT_DECISION_PREFIX = 'acbank_anonymous_quote_draft_decision_v1';

/**
 * A small deterministic fingerprint used only to recognize whether a user has
 * already declined this exact browser-local payload. It is not a security hash
 * and never stores the quote contents in the account-scoped decision key.
 */
export const buildAnonymousQuoteDraftFingerprint = (raw: string | null): string | null => {
  if (!raw) return null;

  let fingerprintSource = raw;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    fingerprintSource = JSON.stringify({
      quotes: parsed.quotes ?? [],
      recipient: parsed.recipient ?? null,
      quoteNumber: parsed.quoteNumber ?? '',
    });
  } catch {
    // Invalid payloads are not imported, but retain deterministic behavior for
    // callers that need to compare or clean up a malformed local value.
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < fingerprintSource.length; index += 1) {
    hash ^= fingerprintSource.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `${fingerprintSource.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

export const getAnonymousQuoteDraftDecisionKey = (userId: string) => (
  `${ANONYMOUS_QUOTE_DRAFT_DECISION_PREFIX}:${encodeURIComponent(userId)}`
);

export const userDeclinedAnonymousQuoteDraft = (
  raw: string | null,
  storedFingerprint: string | null,
) => {
  const fingerprint = buildAnonymousQuoteDraftFingerprint(raw);
  return Boolean(fingerprint && storedFingerprint === fingerprint);
};
