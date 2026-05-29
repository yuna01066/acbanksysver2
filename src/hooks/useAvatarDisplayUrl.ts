import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const AVATAR_BUCKET = 'avatars';
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const SIGNED_URL_REFRESH_BUFFER_MS = 5 * 60 * 1000;

type CachedAvatarUrl = {
  url: string;
  expiresAt: number;
};

const signedUrlCache = new Map<string, CachedAvatarUrl>();

function stripQueryAndHash(value: string) {
  return value.split('?')[0].split('#')[0];
}

function normalizeAvatarPath(path: string) {
  const cleanPath = decodeURIComponent(stripQueryAndHash(path)).replace(/^\/+/, '');
  return cleanPath.startsWith(`${AVATAR_BUCKET}/`) ? cleanPath.slice(AVATAR_BUCKET.length + 1) : cleanPath;
}

export function getAvatarStoragePath(avatarUrl?: string | null) {
  if (!avatarUrl) return null;

  const rawValue = avatarUrl.trim();
  if (!rawValue || rawValue.startsWith('data:') || rawValue.startsWith('blob:')) return null;

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const url = new URL(rawValue);
      const path = decodeURIComponent(url.pathname);
      const storagePathPrefixes = [
        `/storage/v1/object/public/${AVATAR_BUCKET}/`,
        `/storage/v1/object/sign/${AVATAR_BUCKET}/`,
        `/storage/v1/object/authenticated/${AVATAR_BUCKET}/`,
      ];
      const matchedPrefix = storagePathPrefixes.find((prefix) => path.includes(prefix));
      if (!matchedPrefix) return null;
      return normalizeAvatarPath(path.slice(path.indexOf(matchedPrefix) + matchedPrefix.length));
    } catch {
      return null;
    }
  }

  const cleanValue = normalizeAvatarPath(rawValue);
  return cleanValue.includes('/') ? cleanValue : null;
}

function getCachedSignedUrl(path: string) {
  const cached = signedUrlCache.get(path);
  if (!cached || cached.expiresAt <= Date.now() + SIGNED_URL_REFRESH_BUFFER_MS) return null;
  return cached.url;
}

export function useAvatarDisplayUrl(avatarUrl?: string | null) {
  const storagePath = useMemo(() => getAvatarStoragePath(avatarUrl), [avatarUrl]);
  const [displayUrl, setDisplayUrl] = useState<string | null>(() => {
    if (!avatarUrl) return null;
    if (!storagePath) return avatarUrl;
    return getCachedSignedUrl(storagePath);
  });

  useEffect(() => {
    let mounted = true;

    if (!avatarUrl) {
      setDisplayUrl(null);
      return () => {
        mounted = false;
      };
    }

    if (!storagePath) {
      setDisplayUrl(avatarUrl);
      return () => {
        mounted = false;
      };
    }

    const cachedUrl = getCachedSignedUrl(storagePath);
    if (cachedUrl) {
      setDisplayUrl(cachedUrl);
      return () => {
        mounted = false;
      };
    }

    setDisplayUrl(null);
    void supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error || !data?.signedUrl) {
          setDisplayUrl(null);
          return;
        }

        signedUrlCache.set(storagePath, {
          url: data.signedUrl,
          expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
        });
        setDisplayUrl(data.signedUrl);
      });

    return () => {
      mounted = false;
    };
  }, [avatarUrl, storagePath]);

  return displayUrl;
}
