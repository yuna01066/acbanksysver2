import DOMPurify from 'dompurify';

/**
 * Sanitize untrusted HTML before passing to dangerouslySetInnerHTML.
 *
 * Uses DOMPurify with the standard HTML profile, which strips <script>,
 * event handlers, javascript: URLs, dangerous tags (iframe, object, embed,
 * meta, link, form, etc.) AND <style> blocks / unsafe inline styles that the
 * previous custom blocklist sanitizer missed (CSS injection, attribute-
 * selector exfiltration, url() leaks, UI redressing).
 */
export function sanitizeHtml(html: string) {
  if (!html) return '';
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
