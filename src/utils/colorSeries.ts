export type ColorSeriesTab = 'A' | 'B';

export interface ColorSeriesLike {
  color_name: string;
  series_key?: string | null;
}

const SERIES_A_SUFFIX = '_A';
const SERIES_B_SUFFIX = '_B';

export const getColorSeriesTab = (color: ColorSeriesLike): ColorSeriesTab | null => {
  const seriesKey = color.series_key?.trim().toUpperCase();

  if (seriesKey?.endsWith(SERIES_A_SUFFIX)) return 'A';
  if (seriesKey?.endsWith(SERIES_B_SUFFIX)) return 'B';

  const acCode = color.color_name.split(' ')[0] || '';
  const lastDigit = acCode.charAt(acCode.length - 1);

  if (['1', '2', '3', '4'].includes(lastDigit)) return 'A';
  if (['6', '7', '8', '9'].includes(lastDigit)) return 'B';

  return null;
};

export const hasExplicitSeriesTabs = (colors: ColorSeriesLike[] = []) =>
  colors.some((color) => {
    const seriesKey = color.series_key?.trim().toUpperCase();
    return Boolean(seriesKey?.endsWith(SERIES_A_SUFFIX) || seriesKey?.endsWith(SERIES_B_SUFFIX));
  });

export const getColorSeriesLabel = (seriesKey?: string | null) => {
  if (!seriesKey) return null;
  return seriesKey.replace(/_/g, ' ');
};
