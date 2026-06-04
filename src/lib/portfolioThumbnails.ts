import { supabase } from '@/integrations/supabase/client';

export const PORTFOLIO_THUMBNAIL_BUCKET = 'portfolio-thumbnails';

type PortfolioThumbnailRecord = {
  thumbnail_bucket?: string | null;
  thumbnail_path?: string | null;
  thumbnail_url?: string | null;
};

const thumbnailSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

export async function hydratePortfolioThumbnailUrls<T extends PortfolioThumbnailRecord>(
  images: T[],
  expiresInSeconds = 60 * 60,
): Promise<T[]> {
  const nextImages = images.map(image => ({ ...image }));
  const pathsByBucket = new Map<string, Map<string, number[]>>();

  nextImages.forEach((image, index) => {
    if (!image.thumbnail_path) return;

    const bucket = image.thumbnail_bucket || PORTFOLIO_THUMBNAIL_BUCKET;
    const cacheKey = `${bucket}/${image.thumbnail_path}`;
    const cached = thumbnailSignedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      nextImages[index].thumbnail_url = cached.url;
      return;
    }

    const pathsByIndex = pathsByBucket.get(bucket) || new Map<string, number[]>();
    const indexes = pathsByIndex.get(image.thumbnail_path) || [];
    indexes.push(index);
    pathsByIndex.set(image.thumbnail_path, indexes);
    pathsByBucket.set(bucket, pathsByIndex);
  });

  await Promise.all(Array.from(pathsByBucket.entries()).map(async ([bucket, pathsByIndex]) => {
    const paths = Array.from(pathsByIndex.keys());
    const { data: signedUrls, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, expiresInSeconds);
    if (error || !signedUrls) return;

    signedUrls.forEach((signedUrlResult) => {
      if (!signedUrlResult.path || !signedUrlResult.signedUrl) return;
      const indexes = pathsByIndex.get(signedUrlResult.path) || [];
      indexes.forEach((index) => {
        nextImages[index].thumbnail_url = signedUrlResult.signedUrl;
      });
      thumbnailSignedUrlCache.set(`${bucket}/${signedUrlResult.path}`, {
        url: signedUrlResult.signedUrl,
        expiresAt: Date.now() + Math.max(1, expiresInSeconds - 300) * 1000,
      });
    });
  }));

  return nextImages;
}
