const BLOCKED_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'base',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'option',
  'meta',
  'link',
]);

const URL_ATTRS = new Set(['href', 'src', 'xlink:href', 'formaction']);
const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:|blob:|data:image\/|#|\/)/i;

export function sanitizeHtml(html: string) {
  if (!html || typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return html || '';
  }

  const document = new DOMParser().parseFromString(html, 'text/html');
  const elements = Array.from(document.body.querySelectorAll('*'));

  elements.forEach((element) => {
    const tagName = element.tagName.toLowerCase();
    if (BLOCKED_TAGS.has(tagName)) {
      element.remove();
      return;
    }

    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (URL_ATTRS.has(name) && value && !SAFE_URL_PATTERN.test(value)) {
        element.removeAttribute(attribute.name);
        return;
      }

      if (name === 'style' && /expression\s*\(|url\s*\(\s*['"]?\s*(javascript:|data:text\/html)/i.test(value)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  return document.body.innerHTML;
}
