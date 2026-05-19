interface QuoteProjectTitleInput {
  projectName?: string | null;
  companyName?: string | null;
  fallbackTitle?: string;
}

interface QuotePrintFileNameInput extends QuoteProjectTitleInput {
  quoteNumber?: string | null;
}

const normalizeText = (value?: string | null) =>
  (value || '').trim().replace(/\s+/g, ' ');

export const formatQuoteProjectTitle = ({
  projectName,
  companyName,
  fallbackTitle = '견적서',
}: QuoteProjectTitleInput) => {
  const title = normalizeText(projectName) || fallbackTitle;
  const company = normalizeText(companyName);

  if (!company) return title;
  if (/^\[[^\]]+\]\s*/.test(title)) return title;

  return `[${company}] ${title}`;
};

const cleanFileNamePart = (value?: string | null, fallback = '미지정') => {
  const cleaned = normalizeText(value || fallback)
    .replace(/[\\/:*?"|#%{}~&]/g, '_')
    .replace(/[<>]/g, '')
    .replace(/_+/g, '_')
    .slice(0, 120)
    .trim();

  return cleaned || fallback;
};

export const formatQuotePrintFileName = ({
  quoteNumber,
  projectName,
  companyName,
}: QuotePrintFileNameInput) => {
  const safeQuoteNumber = cleanFileNamePart(quoteNumber, '견적번호미정');
  const projectTitle = formatQuoteProjectTitle({ projectName, companyName, fallbackTitle: '프로젝트명 없음' });
  const safeProjectTitle = cleanFileNamePart(projectTitle, '프로젝트명 없음');

  return `<아크뱅크 견적서> ${safeQuoteNumber}_${safeProjectTitle}`;
};
