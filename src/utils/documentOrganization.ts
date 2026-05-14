const DRIVE_ROOT = 'ACBANK_SYS';

const cleanSegment = (value?: string | null, fallback = '미지정') => {
  const cleaned = (value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .slice(0, 80);

  return cleaned || fallback;
};

const getYearMonth = (date = new Date()) => ({
  year: String(date.getFullYear()),
  month: String(date.getMonth() + 1).padStart(2, '0'),
});

export const buildQuoteFolderName = ({
  quoteNumber,
  recipientCompany,
  projectName,
}: {
  quoteNumber?: string | null;
  recipientCompany?: string | null;
  projectName?: string | null;
}) => {
  const parts = [
    cleanSegment(quoteNumber, '견적번호미정'),
    cleanSegment(recipientCompany, '거래처미정'),
    cleanSegment(projectName, '프로젝트미정'),
  ];
  return parts.join('_');
};

export const buildIssuedQuoteDrivePath = ({
  quoteNumber,
  recipientCompany,
  projectName,
  section = '01_고객첨부',
  date = new Date(),
}: {
  quoteNumber?: string | null;
  recipientCompany?: string | null;
  projectName?: string | null;
  section?: string;
  date?: Date;
}) => {
  const { year, month } = getYearMonth(date);
  return [
    DRIVE_ROOT,
    '01_발행견적서',
    year,
    month,
    buildQuoteFolderName({ quoteNumber, recipientCompany, projectName }),
    section,
  ];
};

export const buildProjectDrivePath = ({
  projectName,
  section,
}: {
  projectName?: string | null;
  section: string;
}) => [
  DRIVE_ROOT,
  '02_프로젝트',
  cleanSegment(projectName, '프로젝트미정'),
  section,
];

export const buildUnsortedDrivePath = (section: string) => [
  DRIVE_ROOT,
  '99_미분류',
  cleanSegment(section),
];

export const toDrivePathText = (segments: string[]) => segments.join('/');
