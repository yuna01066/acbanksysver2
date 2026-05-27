import React, { useState, useRef, useCallback, useMemo, useEffect, useDeferredValue } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload, Trash2, Image as ImageIcon, Loader2, Plus,
  ChevronLeft, ChevronRight, Search, RefreshCw, Eye, X, Hash, Clock, TrendingUp, Pencil,
  ZoomIn, ZoomOut, Maximize2, FolderOpen, CheckSquare, Square, Link as LinkIcon, ArrowUp, ArrowDown,
  Star, BookmarkPlus, BookmarkCheck, Columns2, Monitor, ShieldCheck, GripVertical, Minimize2,
  Save, RotateCcw, SlidersHorizontal, Layers, StarOff
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PortfolioPost {
  id: string;
  title: string;
  category: string | null;
  client_name: string | null;
  project_year: number | null;
  location: string | null;
  materials: string[] | null;
  processes: string[] | null;
  visibility: string | null;
  archived_at: string | null;
  cover_image_id: string | null;
  keywords: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  image_count: number;
  images: PortfolioImage[];
}

interface PortfolioImage {
  id: string;
  post_id: string;
  drive_file_id: string;
  drive_folder_id: string | null;
  drive_path: string | null;
  file_name: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  dominant_color: string | null;
  taken_at: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
  thumbnail_bucket: string | null;
  thumbnail_path: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  display_order: number;
  is_main: boolean;
  file_size: number | null;
  mime_type: string | null;
  storage_provider: string | null;
  uploaded_by: string | null;
  access_level: string;
  delete_status: string;
  delete_error: string | null;
}

interface PortfolioSearchRow {
  id: string;
  title: string;
  category: string | null;
  client_name: string | null;
  project_year: number | null;
  location: string | null;
  materials: string[] | null;
  processes: string[] | null;
  visibility: string | null;
  archived_at: string | null;
  cover_image_id: string | null;
  keywords: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  image_count?: number | string | null;
  total_count?: number | string | null;
}

interface PortfolioListImageRow extends PortfolioImage {
  image_count?: number | string | null;
}

interface PortfolioQueryResult {
  posts: PortfolioPost[];
  hasMore: boolean;
  totalMatches: number;
}

interface PortfolioUploadResult {
  fileId: string;
  fileName: string;
  folderId: string | null;
  drivePath: string | null;
  thumbnailUrl: string;
  imageUrl: string;
  mimeType: string;
  fileSize: number;
}

interface PortfolioThumbnailResult {
  file: File;
  width: number;
  height: number;
  bucket: string;
  path: string;
}

interface DriveFolderFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string | null;
  modifiedTime: string | null;
  thumbnailUrl: string | null;
  webViewLink: string | null;
}

interface DriveFolderResult {
  folder: {
    id: string;
    name: string;
    webViewLink: string | null;
  };
  files: DriveFolderFile[];
  unsupportedCount: number;
  serviceAccountEmail: string | null;
}

type PendingPortfolioImage =
  | { id: string; source: 'local'; file: File }
  | { id: string; source: 'drive'; file: DriveFolderFile; folderId: string; folderName: string };

interface CopiedPortfolioDriveFile {
  sourceFileId: string;
  fileId: string;
  fileName: string;
  folderId: string | null;
  drivePath: string | null;
  mimeType: string;
  fileSize: number;
}

interface PortfolioDriveCopyResult {
  folderId: string | null;
  drivePath: string | null;
  copiedFiles: CopiedPortfolioDriveFile[];
  failures: Array<{ sourceFileId: string; fileName: string; error: string }>;
}

interface RecentPortfolioPost {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  viewedAt: number;
}

interface SavedPortfolioFilter {
  id: string;
  label: string;
  searchQuery: string;
  categoryFilter: string;
  keywordFilter: string | null;
}

const LEGACY_PORTFOLIO_FOLDER = ['포트폴리오'];
const PORTFOLIO_THUMBNAIL_BUCKET = 'portfolio-thumbnails';
const RECENT_KEYWORDS_KEY = 'portfolio-recent-keywords';
const RECENT_POSTS_KEY = 'portfolio-recent-posts';
const FAVORITE_POSTS_KEY = 'portfolio-favorite-posts';
const CONSULTING_COLLECTION_KEY = 'portfolio-consulting-collection';
const SAVED_FILTERS_KEY = 'portfolio-saved-filters';
const MAX_RECENT = 10;
const PAGE_SIZE = 24;
const MAX_UPLOAD_FILES = 20;
const MAX_UPLOAD_IMAGE_BYTES = 25 * 1024 * 1024;
const MAX_OPTIMIZED_EDGE = 3200;
const OPTIMIZED_JPEG_QUALITY = 0.88;
const THUMBNAIL_EDGE = 600;
const THUMBNAIL_WEBP_QUALITY = 0.82;
const EMPTY_PORTFOLIO_RESULT: PortfolioQueryResult = { posts: [], hasMore: false, totalMatches: 0 };
const DEFAULT_PORTFOLIO_CATEGORY = '제작가공';
const PORTFOLIO_UPLOAD_CATEGORIES = ['인테리어', '제작가공', '디테일', '사인/디스플레이', '기타'] as const;
const PORTFOLIO_SEARCH_SYNONYM_GROUPS = [
  ['사인', '사인물', '간판', '디스플레이', '진열', '진열대', '전시'],
  ['빅더미', '더미', '대형모형', '모형', '오브제'],
  ['화장품', '코스메틱', '뷰티', '브링그린', '올리브영'],
  ['집기', '제품', '진열대', '가구', '받침대'],
  ['제작가공', '제작', '가공', '레이저', 'cnc', '절곡', '접합'],
  ['인테리어', '공간', '쇼룸', '로비', '매장', '팝업'],
] as const;
const HANGUL_INITIALS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const PORTFOLIO_CATEGORY_FILTERS = [
  { key: 'all', label: '전체', keywords: [] },
  { key: 'interior', label: '인테리어', keywords: ['인테리어', '공간', '로비', '매장', '쇼룸', '오피스', '팝업'] },
  { key: 'fabrication', label: '제작가공', keywords: ['제작가공', '제작', '가공', '레이저', 'cnc', '절곡', '접합'] },
  { key: 'detail', label: '디테일', keywords: ['디테일', '마감', '코너', '접착', '모서리'] },
  { key: 'signage', label: '사인/디스플레이', keywords: ['사인', '디스플레이', '진열', '전시', '팝업'] },
] as const;

const thumbnailSignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function readJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getRecentKeywords(): string[] {
  return readJsonStorage<string[]>(RECENT_KEYWORDS_KEY, []);
}

function saveRecentKeyword(keyword: string) {
  const recent = getRecentKeywords().filter(k => k !== keyword);
  recent.unshift(keyword);
  writeJsonStorage(RECENT_KEYWORDS_KEY, recent.slice(0, MAX_RECENT));
}

function getStringSetFromStorage(key: string): Set<string> {
  return new Set(readJsonStorage<string[]>(key, []));
}

function saveStringSetToStorage(key: string, values: Set<string>) {
  writeJsonStorage(key, Array.from(values));
}

function parseListInput(value: string): string[] {
  return Array.from(new Set(
    value
      .split(/[,\n]/)
      .map(item => item.trim().replace(/^#/, ''))
      .filter(Boolean)
  ));
}

function joinListInput(values: string[] | null | undefined): string {
  return (values || []).join(', ');
}

function parseProjectYear(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const year = Number(trimmed);
  if (!Number.isInteger(year) || year < 1990 || year > 2100) return null;
  return year;
}

function removeLeadingHash(value: string): string {
  return value.trim().replace(/^#/, '');
}

function toHangulInitials(value: string): string {
  return Array.from(value).map((char) => {
    const code = char.charCodeAt(0);
    if (code < 0xac00 || code > 0xd7a3) return char;
    const index = Math.floor((code - 0xac00) / 588);
    return HANGUL_INITIALS[index] || char;
  }).join('');
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/[\s#/_-]+/g, '');
}

function expandPortfolioSearchTerms(value: string): string[] {
  const cleaned = removeLeadingHash(value);
  if (!cleaned) return [];
  const tokens = cleaned.split(/[\s,]+/).map(removeLeadingHash).filter(Boolean);
  const expanded = new Set<string>([cleaned, ...tokens]);

  tokens.forEach((token) => {
    PORTFOLIO_SEARCH_SYNONYM_GROUPS.forEach((group) => {
      if (group.some(term => normalizeSearchText(term).includes(normalizeSearchText(token)) || normalizeSearchText(token).includes(normalizeSearchText(term)))) {
        group.forEach(term => expanded.add(term));
      }
    });
  });

  return Array.from(expanded);
}

function portfolioSearchBlob(post: PortfolioPost): string {
  const imageText = post.images.map(image => [image.file_name, image.caption].filter(Boolean).join(' ')).join(' ');
  const values = [
    post.title,
    post.category,
    post.client_name,
    post.location,
    String(post.project_year || ''),
    ...(post.keywords || []),
    ...(post.materials || []),
    ...(post.processes || []),
    imageText,
  ].filter(Boolean).join(' ');
  return `${normalizeSearchText(values)} ${normalizeSearchText(toHangulInitials(values))}`;
}

function matchesPortfolioSearch(post: PortfolioPost, searchText: string): boolean {
  const terms = expandPortfolioSearchTerms(searchText);
  if (terms.length === 0) return true;
  const blob = portfolioSearchBlob(post);
  return terms.some(term => {
    const normalized = normalizeSearchText(term);
    const initials = normalizeSearchText(toHangulInitials(term));
    return blob.includes(normalized) || (initials && blob.includes(initials));
  });
}

function shouldUseClientPortfolioSearch(value: string): boolean {
  const cleaned = removeLeadingHash(value);
  if (!cleaned) return false;
  const expanded = expandPortfolioSearchTerms(cleaned);
  return /[ㄱ-ㅎ]/.test(cleaned) || expanded.length > 1;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '알 수 없는 오류가 발생했습니다.';
}

function isComposingText(event: React.KeyboardEvent): boolean {
  const nativeEvent = event.nativeEvent as KeyboardEvent & { isComposing?: boolean };
  return Boolean(nativeEvent.isComposing) || event.keyCode === 229;
}

function getCategoryKeywords(categoryKey: string): string[] {
  return [...(PORTFOLIO_CATEGORY_FILTERS.find(filter => filter.key === categoryKey)?.keywords || [])];
}

function makeDriveFileName(file: File): string {
  const dotIndex = file.name.lastIndexOf('.');
  const rawBase = dotIndex > 0 ? file.name.slice(0, dotIndex) : file.name;
  const rawExt = dotIndex > 0 ? file.name.slice(dotIndex + 1) : '';
  const safeBase = rawBase.replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'portfolio';
  const ext = rawExt || (file.type === 'image/png' ? 'png' : 'jpg');
  return `${Date.now()}-${crypto.randomUUID()}-${safeBase}.${ext}`;
}

function makeStorageSafeName(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'portfolio';
}

async function optimizePortfolioImage(file: File): Promise<File> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (!('createImageBitmap' in window)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_OPTIMIZED_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= 2 * 1024 * 1024) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', OPTIMIZED_JPEG_QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '');
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file;
  }
}

async function createPortfolioThumbnail(
  file: File,
  postId: string,
  displayOrder: number,
): Promise<PortfolioThumbnailResult> {
  if (!('createImageBitmap' in window)) {
    throw new Error('이 브라우저에서는 썸네일 생성이 지원되지 않습니다.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, THUMBNAIL_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('썸네일 캔버스를 생성할 수 없습니다.');

    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/webp', THUMBNAIL_WEBP_QUALITY);
    });
    if (!blob) throw new Error('썸네일 파일을 생성할 수 없습니다.');

    const safeName = makeStorageSafeName(file.name);
    const path = `${postId}/${displayOrder}-${crypto.randomUUID()}-${safeName}.webp`;
    return {
      file: new File([blob], `${safeName}.webp`, { type: 'image/webp', lastModified: Date.now() }),
      width,
      height,
      bucket: PORTFOLIO_THUMBNAIL_BUCKET,
      path,
    };
  } finally {
    bitmap.close();
  }
}

async function fetchPortfolioDriveThumbnailFile(file: DriveFolderFile, folderId?: string | null): Promise<File> {
  const { data, error, response } = await supabase.functions.invoke('google-drive', {
    body: {
      action: 'get-portfolio-drive-thumbnail',
      fileId: file.id,
      folderId: folderId || undefined,
    },
  });

  if (error || !(data instanceof Blob)) {
    throw new Error(error?.message || 'Drive 썸네일을 불러오지 못했습니다.');
  }

  const contentType = response?.headers.get('X-Thumbnail-Mime-Type') || data.type || 'image/jpeg';
  const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
  const blob = new Blob([data], { type: contentType });
  return new File([blob], `${makeStorageSafeName(file.name)}-drive-thumb.${extension}`, {
    type: contentType,
    lastModified: Date.now(),
  });
}

async function hydratePortfolioImages(data: PortfolioImage[]): Promise<PortfolioImage[]> {
  const nextImages = data.map(image => ({ ...image }));
  const pendingByBucket = new Map<string, Map<string, number[]>>();

  nextImages.forEach((image, index) => {
    if (!image.thumbnail_path) {
      image.thumbnail_url = image.thumbnail_url || null;
      return;
    }

    const bucket = image.thumbnail_bucket || PORTFOLIO_THUMBNAIL_BUCKET;
    const cacheKey = `${bucket}/${image.thumbnail_path}`;
    const cached = thumbnailSignedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      image.thumbnail_url = cached.url;
      return;
    }

    const pathsByIndex = pendingByBucket.get(bucket) || new Map<string, number[]>();
    const indexes = pathsByIndex.get(image.thumbnail_path) || [];
    indexes.push(index);
    pathsByIndex.set(image.thumbnail_path, indexes);
    pendingByBucket.set(bucket, pathsByIndex);
  });

  await Promise.all(Array.from(pendingByBucket.entries()).map(async ([bucket, pathsByIndex]) => {
    const paths = Array.from(pathsByIndex.keys());
    const { data: signedUrls, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, 60 * 60);
    if (error || !signedUrls) return;

    signedUrls.forEach((signedUrlResult) => {
      if (!signedUrlResult.path || !signedUrlResult.signedUrl) return;
      const indexes = pathsByIndex.get(signedUrlResult.path) || [];
      indexes.forEach((index) => {
        nextImages[index].thumbnail_url = signedUrlResult.signedUrl;
      });
      thumbnailSignedUrlCache.set(`${bucket}/${signedUrlResult.path}`, {
        url: signedUrlResult.signedUrl,
        expiresAt: Date.now() + 55 * 60 * 1000,
      });
    });
  }));

  return nextImages;
}

async function fetchPortfolioListImages(postIds: string[]): Promise<Map<string, { image: PortfolioImage | null; imageCount: number }>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await (supabase.rpc as any)('get_portfolio_post_main_images', {
    p_post_ids: postIds,
  });
  if (error) {
    const fallbackImagesByPostId = await fetchImagesForPosts(postIds);
    const fallbackListImages = new Map<string, { image: PortfolioImage | null; imageCount: number }>();
    postIds.forEach((postId) => {
      const images = fallbackImagesByPostId.get(postId) || [];
      fallbackListImages.set(postId, {
        image: images.find(image => image.is_main) || images[0] || null,
        imageCount: images.length,
      });
    });
    return fallbackListImages;
  }

  const rows = (data || []) as PortfolioListImageRow[];
  const hydratedRows = await hydratePortfolioImages(rows);
  const imagesByPostId = new Map<string, { image: PortfolioImage | null; imageCount: number }>();
  hydratedRows.forEach((image) => {
    imagesByPostId.set(image.post_id, {
      image,
      imageCount: Number((image as any).image_count || 0),
    });
  });
  return imagesByPostId;
}

async function fetchImagesForPosts(postIds: string[]): Promise<Map<string, PortfolioImage[]>> {
  if (postIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('portfolio_images')
    .select('*')
    .in('post_id', postIds)
    .neq('delete_status', 'deleted')
    .order('display_order', { ascending: true });
  if (error) throw error;

  const imagesByPostId = new Map<string, PortfolioImage[]>();
  const hydratedImages = await hydratePortfolioImages((data || []) as PortfolioImage[]);
  hydratedImages.forEach((image) => {
    const images = imagesByPostId.get(image.post_id) || [];
    images.push(image);
    imagesByPostId.set(image.post_id, images);
  });
  return imagesByPostId;
}

async function fetchPortfolioPosts(params: {
  searchText: string;
  categoryKeywords: string[];
  exactKeyword: string | null;
  limit: number;
}): Promise<PortfolioQueryResult> {
  const useClientSearch = shouldUseClientPortfolioSearch(params.searchText);
  const rpcLimit = useClientSearch ? 500 : params.limit + 1;
  const rpc = await supabase.rpc('search_portfolio_posts', {
    p_search_text: useClientSearch ? null : params.searchText || null,
    p_category_keywords: params.categoryKeywords.length > 0 ? params.categoryKeywords : null,
    p_exact_keyword: params.exactKeyword,
    p_limit: rpcLimit,
    p_offset: 0,
  });

  if (rpc.error) throw rpc.error;

  const rows = (rpc.data || []) as PortfolioSearchRow[];
  const matchedRows = useClientSearch
    ? rows.filter(row => matchesPortfolioSearch({
      id: row.id,
      title: row.title,
      category: row.category || null,
      client_name: row.client_name || null,
      project_year: row.project_year || null,
      location: row.location || null,
      materials: row.materials || [],
      processes: row.processes || [],
      visibility: row.visibility || null,
      archived_at: row.archived_at || null,
      cover_image_id: row.cover_image_id || null,
      keywords: row.keywords || [],
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      image_count: Number(row.image_count || 0),
      images: [],
    }, params.searchText))
    : rows;
  const visibleRows = matchedRows.slice(0, params.limit);
  const listImagesByPostId = await fetchPortfolioListImages(visibleRows.map(row => row.id));
  const posts = visibleRows.map(row => {
    const listImage = listImagesByPostId.get(row.id);
    const imageCount = Number(row.image_count || listImage?.imageCount || 0);
    return {
      id: row.id,
      title: row.title,
      category: row.category || null,
      client_name: row.client_name || null,
      project_year: row.project_year || null,
      location: row.location || null,
      materials: row.materials || [],
      processes: row.processes || [],
      visibility: row.visibility || null,
      archived_at: row.archived_at || null,
      cover_image_id: row.cover_image_id || null,
      keywords: row.keywords || [],
      created_by: row.created_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      image_count: imageCount,
      images: listImage?.image ? [listImage.image] : [],
    };
  });
  const totalMatches = useClientSearch
    ? matchedRows.length
    : Number(rows[0]?.total_count || rows.length || 0);

  return {
    posts,
    hasMore: matchedRows.length > params.limit || totalMatches > params.limit,
    totalMatches,
  };
}

async function fetchPortfolioImagesForPost(postId: string): Promise<PortfolioImage[]> {
  const imagesByPostId = await fetchImagesForPosts([postId]);
  return imagesByPostId.get(postId) || [];
}

async function deletePortfolioDriveFile(fileId: string, folderId?: string | null): Promise<void> {
  const { data, error } = await supabase.functions.invoke('google-drive', {
    body: {
      action: 'delete-portfolio-file',
      fileId,
      folderId: folderId || undefined,
      folderPath: folderId ? undefined : LEGACY_PORTFOLIO_FOLDER,
    },
  });

  if (error || !data?.success) {
    throw new Error(error?.message || data?.error || 'Drive 파일 삭제에 실패했습니다.');
  }
}

async function deletePortfolioThumbnail(bucket: string | null | undefined, path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage
    .from(bucket || PORTFOLIO_THUMBNAIL_BUCKET)
    .remove([path]);
  if (error) throw error;
}

async function readFileAsBase64(file: File): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadPortfolioFile(
  file: File,
  params: { category: string; postTitle: string },
): Promise<PortfolioUploadResult> {
  const uploadFileName = makeDriveFileName(file);
  const fileBase64 = await readFileAsBase64(file);
  const { data, error } = await supabase.functions.invoke('google-drive', {
    body: {
      action: 'upload-portfolio-image',
      category: params.category,
      postTitle: params.postTitle,
      fileName: uploadFileName,
      fileBase64,
      contentType: file.type || 'application/octet-stream',
    },
  });

  if (error || !data?.success || !data?.fileId) {
    throw new Error(error?.message || data?.error || 'Drive 업로드에 실패했습니다.');
  }

  return {
    fileId: data.fileId,
    fileName: data.fileName || uploadFileName,
    folderId: data.folderId || null,
    drivePath: data.drivePath || null,
    thumbnailUrl: '',
    imageUrl: '',
    mimeType: file.type || 'application/octet-stream',
    fileSize: file.size,
  };
}

async function uploadPortfolioThumbnail(thumbnail: PortfolioThumbnailResult): Promise<void> {
  const { error } = await supabase.storage
    .from(thumbnail.bucket)
    .upload(thumbnail.path, thumbnail.file, {
      contentType: thumbnail.file.type,
      upsert: false,
    });
  if (error) throw error;
}

async function listPortfolioDriveFolder(folderUrl: string): Promise<DriveFolderResult> {
  const { data, error } = await supabase.functions.invoke('google-drive', {
    body: {
      action: 'list-portfolio-drive-folder',
      folderUrl,
    },
  });

  if (error || !data?.success) {
    const serviceAccount = data?.serviceAccountEmail ? ` 공유 대상: ${data.serviceAccountEmail}` : '';
    throw new Error(error?.message || `${data?.error || 'Drive 폴더를 불러오지 못했습니다.'}${serviceAccount}`);
  }

  const files = ((data.files || []) as DriveFolderFile[]).map((file) => ({
    ...file,
    size: Number(file.size || 0),
  }));

  return {
    folder: data.folder,
    files,
    unsupportedCount: Number(data.unsupportedCount || 0),
    serviceAccountEmail: data.serviceAccountEmail || null,
  };
}

async function copyPortfolioDriveFiles(params: {
  sourceFolderId: string;
  files: DriveFolderFile[];
  category: string;
  postTitle: string;
}): Promise<PortfolioDriveCopyResult> {
  if (params.files.length === 0) {
    return { folderId: null, drivePath: null, copiedFiles: [], failures: [] };
  }

  const { data, error } = await supabase.functions.invoke('google-drive', {
    body: {
      action: 'copy-portfolio-drive-files',
      sourceFolderId: params.sourceFolderId,
      category: params.category,
      postTitle: params.postTitle,
      files: params.files.map(file => ({ id: file.id, name: file.name })),
    },
  });

  if (error || !data?.success) {
    throw new Error(error?.message || data?.error || 'Drive 사진 복제에 실패했습니다.');
  }

  return {
    folderId: data.folderId || null,
    drivePath: data.drivePath || null,
    copiedFiles: ((data.copiedFiles || []) as CopiedPortfolioDriveFile[]).map(file => ({
      ...file,
      fileSize: Number(file.fileSize || 0),
    })),
    failures: data.failures || [],
  };
}

async function fetchPortfolioOriginalImage(image: PortfolioImage): Promise<string> {
  if (image.image_url) return image.image_url;

  const { data, error, response } = await supabase.functions.invoke('google-drive', {
    body: {
      action: 'get-portfolio-image',
      fileId: image.drive_file_id,
      folderId: image.drive_folder_id || undefined,
    },
  });

  if (error || !(data instanceof Blob)) {
    throw new Error(error?.message || '원본 이미지를 불러오지 못했습니다.');
  }

  const contentType = response?.headers.get('X-Image-Mime-Type') || image.mime_type || data.type || 'image/jpeg';
  const blob = new Blob([data], { type: contentType });
  return URL.createObjectURL(blob);
}

function DriveFolderImagePreview({
  file,
  folderId,
  enabled = true,
}: {
  file: DriveFolderFile;
  folderId: string;
  enabled?: boolean;
}) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!enabled) {
      setPreviewUrl('');
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;

    fetchPortfolioDriveThumbnailFile(file, folderId)
      .then((thumbnailFile) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(thumbnailFile);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPreviewUrl('');
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, file, folderId]);

  if (!previewUrl) {
    return <ImageIcon className="h-5 w-5 text-muted-foreground" />;
  }

  return <img src={previewUrl} alt="" className="h-full w-full object-cover" />;
}

function PendingImagePreview({
  item,
  isMain,
  onRemove,
}: {
  item: PendingPortfolioImage;
  isMain: boolean;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState('');
  const fileName = item.source === 'local' ? item.file.name : item.file.name;
  const fileSize = item.source === 'local' ? item.file.size : item.file.size;

  useEffect(() => {
    if (item.source !== 'local') {
      setPreviewUrl('');
      return;
    }

    const url = URL.createObjectURL(item.file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [item]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted/30">
      {item.source === 'local'
        ? previewUrl && <img src={previewUrl} alt="" className="h-full w-full object-cover" />
        : <div className="grid h-full w-full place-items-center"><DriveFolderImagePreview file={item.file} folderId={item.folderId} /></div>}
      {isMain && <Badge className="absolute left-1 top-1 px-1 py-0 text-[10px]">대표</Badge>}
      {item.source === 'drive' && (
        <Badge className="absolute left-1 top-6 rounded bg-blue-600 px-1 py-0 text-[10px] text-white">Drive</Badge>
      )}
      <button
        type="button"
        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white transition-colors hover:bg-destructive"
        onClick={onRemove}
        aria-label={`${fileName} 제거`}
      >
        <Trash2 className="h-3 w-3" />
      </button>
      <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {formatBytes(fileSize)}
      </span>
    </div>
  );
}

function PortfolioCardThumbnail({ src, alt }: { src: string | null | undefined; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <span className="relative block aspect-[4/3] overflow-hidden border-b border-black/5 bg-[#f5f5f5]">
      {!loaded && <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-[#f5f5f5] via-[#ededed] to-[#fafafa]" />}
      {src ? (
        <img
          src={src}
          alt={alt}
          className={`h-full w-full object-cover transition duration-200 group-hover:scale-[1.025] ${loaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <ImageIcon className="h-8 w-8 text-[#9e9ea0]" />
        </span>
      )}
    </span>
  );
}

function getPostCategoryLabel(post: PortfolioPost): string {
  return post.category || post.keywords.find(keyword => PORTFOLIO_UPLOAD_CATEGORIES.includes(keyword as typeof PORTFOLIO_UPLOAD_CATEGORIES[number])) || '기타';
}

function getPostMetaLine(post: PortfolioPost): string {
  return [post.client_name, post.location, post.project_year ? `${post.project_year}` : null]
    .filter(Boolean)
    .join(' · ');
}

function SortableEditImageRow({
  image,
  index,
  total,
  editing,
  onMove,
  onMakeMain,
  onCaptionChange,
  onRemove,
}: {
  image: PortfolioImage;
  index: number;
  total: number;
  editing: boolean;
  onMove: (fromIndex: number, direction: -1 | 1) => void;
  onMakeMain: (index: number) => void;
  onCaptionChange: (imageId: string, caption: string) => void;
  onRemove: (image: PortfolioImage) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id, disabled: editing });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-[#e5e5e5] bg-white p-2 ${isDragging ? 'z-10 shadow-lg ring-2 ring-[#111111]/15' : ''}`}
    >
      <button
        type="button"
        className="grid h-10 w-10 touch-none place-items-center rounded-full border border-[#e5e5e5] bg-[#fafafa] text-[#707072] hover:border-[#111111] hover:text-[#111111]"
        aria-label={`${image.file_name} 순서 드래그`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="relative h-16 w-24 overflow-hidden rounded-md bg-muted">
        <img
          src={image.thumbnail_url || image.image_url || ''}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {index === 0 && (
          <Badge className="absolute left-1 top-1 h-5 rounded-full px-1.5 text-[10px]">대표</Badge>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#111111] text-[11px] font-black text-white">
            {index + 1}
          </span>
          <p className="truncate text-sm font-black text-[#111111]">{image.file_name}</p>
        </div>
        <p className="text-xs font-semibold text-[#707072]">
          {formatBytes(image.file_size)} · {image.mime_type || 'image'}
        </p>
        <Input
          value={image.caption || ''}
          onChange={event => onCaptionChange(image.id, event.target.value)}
          placeholder="사진 캡션/메모"
          className="h-9 rounded-md text-xs"
          disabled={editing}
        />
      </div>
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-full px-3 text-xs"
          onClick={() => onMakeMain(index)}
          disabled={index === 0 || editing}
        >
          대표
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => onMove(index, -1)}
          disabled={index === 0 || editing}
          aria-label={`${image.file_name} 앞으로 이동`}
          title="앞으로 이동"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1 || editing}
          aria-label={`${image.file_name} 뒤로 이동`}
          title="뒤로 이동"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(image)}
          disabled={total <= 1 || editing}
          aria-label={`${image.file_name} 삭제`}
          title="삭제"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

const PortfolioGallery = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const lightboxStageRef = useRef<HTMLDivElement>(null);
  const detailImagesRequestRef = useRef(0);
  const dragStateRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });
  const touchStateRef = useRef({
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    pinchDistance: 0,
    startZoom: 1,
    mode: 'idle' as 'idle' | 'swipe' | 'pinch',
  });
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PortfolioPost | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKeywordFilter, setActiveKeywordFilter] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [isConsultingMode, setIsConsultingMode] = useState(true);
  const [favoritePostIds, setFavoritePostIds] = useState<Set<string>>(() => getStringSetFromStorage(FAVORITE_POSTS_KEY));
  const [collectionPostIds, setCollectionPostIds] = useState<Set<string>>(() => getStringSetFromStorage(CONSULTING_COLLECTION_KEY));
  const [comparePostIds, setComparePostIds] = useState<string[]>([]);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [recentPosts, setRecentPosts] = useState<RecentPortfolioPost[]>(() => readJsonStorage<RecentPortfolioPost[]>(RECENT_POSTS_KEY, []));
  const [savedFilters, setSavedFilters] = useState<SavedPortfolioFilter[]>(() => readJsonStorage<SavedPortfolioFilter[]>(SAVED_FILTERS_KEY, []));
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<string>(DEFAULT_PORTFOLIO_CATEGORY);
  const [editClientName, setEditClientName] = useState('');
  const [editProjectYear, setEditProjectYear] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editMaterialsInput, setEditMaterialsInput] = useState('');
  const [editProcessesInput, setEditProcessesInput] = useState('');
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [editKeywordInput, setEditKeywordInput] = useState('');
  const [editImages, setEditImages] = useState<PortfolioImage[]>([]);
  const [editRemovedImages, setEditRemovedImages] = useState<PortfolioImage[]>([]);
  const [editPendingImages, setEditPendingImages] = useState<PendingPortfolioImage[]>([]);
  const [editing, setEditing] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<string>(DEFAULT_PORTFOLIO_CATEGORY);
  const [newClientName, setNewClientName] = useState('');
  const [newProjectYear, setNewProjectYear] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newMaterialsInput, setNewMaterialsInput] = useState('');
  const [newProcessesInput, setNewProcessesInput] = useState('');
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingPortfolioImage[]>([]);
  const [driveFolderUrl, setDriveFolderUrl] = useState('');
  const [driveFolderResult, setDriveFolderResult] = useState<DriveFolderResult | null>(null);
  const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<string[]>([]);
  const [loadingDriveFolder, setLoadingDriveFolder] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [currentOriginalImageUrl, setCurrentOriginalImageUrl] = useState<string | null>(null);
  const [loadingOriginalImage, setLoadingOriginalImage] = useState(false);
  const [loadingDetailImages, setLoadingDetailImages] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const normalizedSearchQuery = deferredSearchQuery.trim();
  const activeCategoryKeywords = useMemo(() => getCategoryKeywords(activeCategoryFilter), [activeCategoryFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [normalizedSearchQuery, activeKeywordFilter, activeCategoryFilter]);

  useEffect(() => {
    const currentImage = selectedPost?.images[currentImageIndex];
    let objectUrl: string | null = null;
    let cancelled = false;

    setCurrentOriginalImageUrl(null);
    if (!currentImage) {
      setLoadingOriginalImage(false);
      return;
    }

    if (currentImage.image_url) {
      setCurrentOriginalImageUrl(currentImage.image_url);
      setLoadingOriginalImage(false);
      return;
    }

    setLoadingOriginalImage(true);
    fetchPortfolioOriginalImage(currentImage)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setCurrentOriginalImageUrl(url);
      })
      .catch((error) => {
        if (!cancelled) toast.error('원본 이미지 로딩 실패: ' + getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoadingOriginalImage(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedPost, currentImageIndex]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const post = selectedPost;
    if (!post || post.images.length <= 1) return;
    const adjacentImages = [post.images[currentImageIndex - 1], post.images[currentImageIndex + 1]].filter(Boolean);
    adjacentImages.forEach((image) => {
      if (image.thumbnail_url) {
        const preload = new Image();
        preload.src = image.thumbnail_url;
      }
    });
  }, [selectedPost, currentImageIndex]);

  // Fetch posts with images
  const { data: portfolioData = EMPTY_PORTFOLIO_RESULT, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['portfolio-posts', normalizedSearchQuery, activeKeywordFilter, activeCategoryFilter, visibleCount],
    queryFn: () => fetchPortfolioPosts({
      searchText: normalizedSearchQuery,
      categoryKeywords: activeCategoryKeywords,
      exactKeyword: activeKeywordFilter,
      limit: visibleCount,
    }),
  });
  const posts = portfolioData.posts;
  const visiblePosts = useMemo(() => (
    showFavoritesOnly ? posts.filter(post => favoritePostIds.has(post.id)) : posts
  ), [posts, showFavoritesOnly, favoritePostIds]);
  const collectionPosts = useMemo(() => (
    posts.filter(post => collectionPostIds.has(post.id))
  ), [posts, collectionPostIds]);
  const comparePosts = useMemo(() => (
    comparePostIds
      .map(id => posts.find(post => post.id === id))
      .filter((post): post is PortfolioPost => Boolean(post))
  ), [posts, comparePostIds]);
  const portfolioStats = useMemo(() => {
    const imageCount = posts.reduce((sum, post) => sum + post.image_count, 0);
    const fileBytes = posts.reduce((sum, post) => sum + post.images.reduce((imageSum, image) => imageSum + (image.file_size || 0), 0), 0);
    const failedDeletes = posts.reduce((sum, post) => sum + post.images.filter(image => image.delete_status === 'failed').length, 0);
    return { imageCount, fileBytes, failedDeletes };
  }, [posts]);

  // Compute popular keywords (sorted by frequency)
  const { data: popularKeywords = [] } = useQuery({
    queryKey: ['portfolio-popular-keywords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('portfolio_posts')
        .select('keywords')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const freq: Record<string, number> = {};
      (data || []).forEach((post) => {
        (post.keywords || []).forEach((keyword: string) => {
          freq[keyword] = (freq[keyword] || 0) + 1;
        });
      });
      return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([keyword]) => keyword);
    },
    staleTime: 5 * 60 * 1000,
  });

  const recentKeywords = getRecentKeywords();

  const resetImageView = useCallback(() => {
    setImageZoom(1);
    setImageOffset({ x: 0, y: 0 });
    setIsImageDragging(false);
  }, []);

  const rememberRecentPost = useCallback((post: PortfolioPost) => {
    const mainImage = post.images.find(image => image.is_main) || post.images[0];
    setRecentPosts(prev => {
      const next = [
        {
          id: post.id,
          title: post.title,
          thumbnailUrl: mainImage?.thumbnail_url || mainImage?.image_url || null,
          viewedAt: Date.now(),
        },
        ...prev.filter(item => item.id !== post.id),
      ].slice(0, MAX_RECENT);
      writeJsonStorage(RECENT_POSTS_KEY, next);
      return next;
    });
  }, []);

  const toggleFavoritePost = useCallback((postId: string) => {
    setFavoritePostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      saveStringSetToStorage(FAVORITE_POSTS_KEY, next);
      return next;
    });
  }, []);

  const toggleCollectionPost = useCallback((postId: string) => {
    setCollectionPostIds(prev => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      saveStringSetToStorage(CONSULTING_COLLECTION_KEY, next);
      return next;
    });
  }, []);

  const toggleComparePost = useCallback((postId: string) => {
    setComparePostIds(prev => {
      if (prev.includes(postId)) return prev.filter(id => id !== postId);
      return [...prev.slice(-1), postId];
    });
  }, []);

  const saveCurrentFilter = useCallback(() => {
    if (!normalizedSearchQuery && activeCategoryFilter === 'all' && !activeKeywordFilter) {
      toast.error('저장할 검색어나 필터가 없습니다.');
      return;
    }
    const labelParts = [
      normalizedSearchQuery || null,
      activeCategoryFilter !== 'all' ? PORTFOLIO_CATEGORY_FILTERS.find(filter => filter.key === activeCategoryFilter)?.label : null,
      activeKeywordFilter ? `#${activeKeywordFilter}` : null,
    ].filter(Boolean);
    const nextFilter: SavedPortfolioFilter = {
      id: crypto.randomUUID(),
      label: labelParts.join(' · ') || '필터',
      searchQuery: normalizedSearchQuery,
      categoryFilter: activeCategoryFilter,
      keywordFilter: activeKeywordFilter,
    };
    setSavedFilters(prev => {
      const next = [nextFilter, ...prev.filter(filter => filter.label !== nextFilter.label)].slice(0, 8);
      writeJsonStorage(SAVED_FILTERS_KEY, next);
      return next;
    });
    toast.success('필터가 저장되었습니다.');
  }, [normalizedSearchQuery, activeCategoryFilter, activeKeywordFilter]);

  const applySavedFilter = useCallback((filter: SavedPortfolioFilter) => {
    setSearchQuery(filter.searchQuery);
    setActiveCategoryFilter(filter.categoryFilter);
    setActiveKeywordFilter(filter.keywordFilter);
  }, []);

  const clearPortfolioFilters = useCallback(() => {
    setSearchQuery('');
    setActiveKeywordFilter(null);
    setActiveCategoryFilter('all');
    setShowFavoritesOnly(false);
  }, []);

  const setBoundedZoom = useCallback((nextZoom: number) => {
    const bounded = Math.max(1, Math.min(4, Number(nextZoom.toFixed(2))));
    setImageZoom(bounded);
    if (bounded === 1) {
      setImageOffset({ x: 0, y: 0 });
      setIsImageDragging(false);
    }
  }, []);

  const openPostDetail = useCallback((post: PortfolioPost) => {
    const requestId = ++detailImagesRequestRef.current;
    const initialImageId = post.images[0]?.id;
    setSelectedPost(post);
    setCurrentImageIndex(0);
    resetImageView();
    rememberRecentPost(post);

    if (post.image_count <= post.images.length) {
      setLoadingDetailImages(false);
      return;
    }

    setLoadingDetailImages(true);
    fetchPortfolioImagesForPost(post.id)
      .then((images) => {
        if (detailImagesRequestRef.current !== requestId) return;
        setSelectedPost(prev => {
          if (!prev || prev.id !== post.id) return prev;
          return {
            ...prev,
            image_count: Math.max(prev.image_count, images.length),
            images: images.length > 0 ? images : prev.images,
          };
        });
        if (initialImageId) {
          const nextIndex = images.findIndex(image => image.id === initialImageId);
          setCurrentImageIndex(nextIndex >= 0 ? nextIndex : 0);
        }
      })
      .catch((error) => {
        if (detailImagesRequestRef.current === requestId) {
          toast.error('상세 사진 로딩 실패: ' + getErrorMessage(error));
        }
      })
      .finally(() => {
        if (detailImagesRequestRef.current === requestId) setLoadingDetailImages(false);
      });
  }, [resetImageView, rememberRecentPost]);

  const closePostDetail = useCallback(() => {
    detailImagesRequestRef.current++;
    setLoadingDetailImages(false);
    setSelectedPost(null);
    resetImageView();
  }, [resetImageView]);

  const showImageAt = useCallback((index: number) => {
    if (!selectedPost?.images.length) return;
    const length = selectedPost.images.length;
    setCurrentImageIndex(((index % length) + length) % length);
    resetImageView();
  }, [selectedPost, resetImageView]);

  const toggleLightboxFullscreen = useCallback(async () => {
    const node = lightboxStageRef.current;
    if (!node || !document.fullscreenEnabled) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await node.requestFullscreen();
  }, []);

  const handleLightboxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (imageZoom <= 1 || (e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: imageOffset.x,
      originY: imageOffset.y,
    };
    setIsImageDragging(true);
  };

  const handleLightboxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isImageDragging) return;
    setImageOffset({
      x: dragStateRef.current.originX + e.clientX - dragStateRef.current.startX,
      y: dragStateRef.current.originY + e.clientY - dragStateRef.current.startY,
    });
  };

  const handleLightboxPointerEnd = () => {
    setIsImageDragging(false);
  };

  const getTouchDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0;
    const [first, second] = [touches[0], touches[1]];
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  };

  const handleLightboxTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.touches.length === 2) {
      touchStateRef.current = {
        ...touchStateRef.current,
        pinchDistance: getTouchDistance(e.touches),
        startZoom: imageZoom,
        mode: 'pinch',
      };
      return;
    }
    if (e.touches.length === 1 && imageZoom <= 1) {
      const touch = e.touches[0];
      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        pinchDistance: 0,
        startZoom: imageZoom,
        mode: 'swipe',
      };
    }
  };

  const handleLightboxTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStateRef.current.mode === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const nextDistance = getTouchDistance(e.touches);
      if (touchStateRef.current.pinchDistance > 0) {
        setBoundedZoom(touchStateRef.current.startZoom * (nextDistance / touchStateRef.current.pinchDistance));
      }
      return;
    }
    if (touchStateRef.current.mode === 'swipe' && e.touches.length === 1) {
      const touch = e.touches[0];
      touchStateRef.current.lastX = touch.clientX;
      touchStateRef.current.lastY = touch.clientY;
    }
  };

  const handleLightboxTouchEnd = () => {
    if (touchStateRef.current.mode === 'swipe' && imageZoom <= 1 && selectedPost?.images.length && selectedPost.images.length > 1) {
      const dx = touchStateRef.current.lastX - touchStateRef.current.startX;
      const dy = touchStateRef.current.lastY - touchStateRef.current.startY;
      if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        showImageAt(currentImageIndex + (dx < 0 ? 1 : -1));
      }
    }
    touchStateRef.current.mode = 'idle';
  };

  // Keyword input handling
  const addKeyword = (keyword: string) => {
    const cleaned = keyword.trim().replace(/^#/, '');
    if (!cleaned) return;
    if (!newKeywords.includes(cleaned)) {
      setNewKeywords(prev => [...prev, cleaned]);
    }
    setKeywordInput('');
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (isComposingText(e)) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(keywordInput);
    }
  };

  const removeKeyword = (keyword: string) => {
    setNewKeywords(prev => prev.filter(k => k !== keyword));
  };

  const selectedDriveFileIdSet = useMemo(() => new Set(selectedDriveFileIds), [selectedDriveFileIds]);
  const pendingDriveFileIdSet = useMemo(() => {
    return new Set(
      pendingImages
        .filter((item): item is Extract<PendingPortfolioImage, { source: 'drive' }> => item.source === 'drive')
        .map(item => item.file.id)
    );
  }, [pendingImages]);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) { toast.error('이미지 파일만 업로드 가능합니다.'); return; }
    const validFiles = imageFiles.filter(file => {
      if (file.size === 0) {
        toast.error(`${file.name} 파일이 비어 있습니다.`);
        return false;
      }
      if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
        toast.error(`${file.name}은 ${formatBytes(MAX_UPLOAD_IMAGE_BYTES)}를 초과합니다.`);
        return false;
      }
      return true;
    });
    setPendingImages(prev => {
      const availableSlots = Math.max(0, MAX_UPLOAD_FILES - prev.length);
      if (validFiles.length > availableSlots) {
        toast.error(`한 번에 최대 ${MAX_UPLOAD_FILES}장까지 등록할 수 있습니다.`);
      }
      return [
        ...prev,
        ...validFiles.slice(0, availableSlots).map(file => ({
          id: `local-${crypto.randomUUID()}`,
          source: 'local' as const,
          file,
        })),
      ];
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingImage = (index: number) => {
    setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleLoadDriveFolder = useCallback(async () => {
    if (!driveFolderUrl.trim()) {
      toast.error('Drive 폴더 URL을 입력해주세요.');
      return;
    }

    setLoadingDriveFolder(true);
    try {
      const result = await listPortfolioDriveFolder(driveFolderUrl.trim());
      setDriveFolderResult(result);
      if (!newTitle.trim()) setNewTitle(result.folder.name);

      const availableSlots = Math.max(0, MAX_UPLOAD_FILES - pendingImages.length);
      const selectableFiles = result.files
        .filter(file => !pendingDriveFileIdSet.has(file.id))
        .slice(0, availableSlots);
      setSelectedDriveFileIds(selectableFiles.map(file => file.id));

      if (result.files.length === 0) {
        toast.warning('가져올 수 있는 이미지가 없습니다.');
      } else {
        toast.success(`Drive 사진 ${result.files.length}개를 불러왔습니다.`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error));
      setDriveFolderResult(null);
      setSelectedDriveFileIds([]);
    } finally {
      setLoadingDriveFolder(false);
    }
  }, [driveFolderUrl, newTitle, pendingImages.length, pendingDriveFileIdSet]);

  const toggleDriveFileSelection = (fileId: string) => {
    setSelectedDriveFileIds(prev => (
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    ));
  };

  const selectAllDriveFiles = () => {
    if (!driveFolderResult) return;
    const availableSlots = Math.max(0, MAX_UPLOAD_FILES - pendingImages.length);
    const ids = driveFolderResult.files
      .filter(file => !pendingDriveFileIdSet.has(file.id))
      .slice(0, availableSlots)
      .map(file => file.id);
    setSelectedDriveFileIds(ids);
  };

  const addSelectedDriveFiles = () => {
    if (!driveFolderResult) return;

    setPendingImages(prev => {
      const availableSlots = Math.max(0, MAX_UPLOAD_FILES - prev.length);
      const nextDriveFiles = driveFolderResult.files
        .filter(file => selectedDriveFileIdSet.has(file.id))
        .filter(file => !prev.some(item => item.source === 'drive' && item.file.id === file.id))
        .slice(0, availableSlots);

      if (nextDriveFiles.length === 0) {
        toast.error('추가할 Drive 사진을 선택해주세요.');
        return prev;
      }
      if (selectedDriveFileIds.length > availableSlots) {
        toast.error(`한 번에 최대 ${MAX_UPLOAD_FILES}장까지 등록할 수 있습니다.`);
      }

      return [
        ...prev,
        ...nextDriveFiles.map(file => ({
          id: `drive-${file.id}`,
          source: 'drive' as const,
          file,
          folderId: driveFolderResult.folder.id,
          folderName: driveFolderResult.folder.name,
        })),
      ];
    });
    setSelectedDriveFileIds([]);
  };

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) { toast.error('제목을 입력해주세요.'); return; }
    if (pendingImages.length === 0) { toast.error('이미지를 최소 1개 추가해주세요.'); return; }
    const projectYear = parseProjectYear(newProjectYear);
    if (newProjectYear.trim() && !projectYear) { toast.error('연도는 1990~2100 사이 숫자로 입력해주세요.'); return; }

    setCreating(true);
    setUploadStatus('등록 정보를 생성하는 중...');
    const uploadedDriveFiles: Array<{ fileId: string; folderId: string | null }> = [];
    const uploadedThumbnails: Array<{ bucket: string; path: string }> = [];
    let createdPostId: string | null = null;
    try {
      const postTitle = newTitle.trim();
      const { data: post, error: postError } = await supabase
        .from('portfolio_posts')
        .insert({
          title: postTitle,
          category: newCategory,
          client_name: newClientName.trim() || null,
          project_year: projectYear,
          location: newLocation.trim() || null,
          materials: parseListInput(newMaterialsInput),
          processes: parseListInput(newProcessesInput),
          visibility: 'published',
          keywords: Array.from(new Set(newKeywords.map(removeLeadingHash).filter(Boolean))),
          created_by: user?.email || 'unknown',
        })
        .select()
        .single();
      if (postError) throw postError;
      createdPostId = post.id;

      const driveItems = pendingImages.filter((item): item is Extract<PendingPortfolioImage, { source: 'drive' }> => item.source === 'drive');
      const copiedFilesBySourceId = new Map<string, CopiedPortfolioDriveFile>();
      const copyFailures: PortfolioDriveCopyResult['failures'] = [];

      if (driveItems.length > 0) {
        setUploadStatus(`Drive 사진 ${driveItems.length}개 복제 중...`);
        const driveItemsByFolder = new Map<string, Extract<PendingPortfolioImage, { source: 'drive' }>[]>();
        driveItems.forEach((item) => {
          const items = driveItemsByFolder.get(item.folderId) || [];
          items.push(item);
          driveItemsByFolder.set(item.folderId, items);
        });

        for (const [sourceFolderId, items] of driveItemsByFolder) {
          const copyResult = await copyPortfolioDriveFiles({
            sourceFolderId,
            files: items.map(item => item.file),
            category: newCategory,
            postTitle,
          });

          copyResult.copiedFiles.forEach((file) => {
            copiedFilesBySourceId.set(file.sourceFileId, file);
            uploadedDriveFiles.push({ fileId: file.fileId, folderId: file.folderId });
          });
          copyFailures.push(...copyResult.failures);
        }
      }

      if (copiedFilesBySourceId.size === 0 && pendingImages.every(item => item.source === 'drive')) {
        throw new Error(copyFailures.length > 0 ? `Drive 사진 복제 실패: ${copyFailures.map(f => f.fileName).join(', ')}` : '복제된 Drive 사진이 없습니다.');
      }

      let displayOrder = 0;
      for (let i = 0; i < pendingImages.length; i++) {
        const pendingImage = pendingImages[i];
        const total = pendingImages.length;
        let driveFileId: string;
        let driveFolderId: string | null;
        let drivePath: string | null;
        let fileName: string;
        let fileSize: number;
        let mimeType: string;
        let thumbnailSourceFile: File;

        if (pendingImage.source === 'local') {
          const originalFile = pendingImage.file;
          setUploadStatus(`${i + 1}/${total} 이미지 최적화 중...`);
          const uploadFile = await optimizePortfolioImage(originalFile);
          setUploadStatus(`${i + 1}/${total} Drive 업로드 중...`);
          const uploadData = await uploadPortfolioFile(uploadFile, { category: newCategory, postTitle });
          uploadedDriveFiles.push({ fileId: uploadData.fileId, folderId: uploadData.folderId });

          driveFileId = uploadData.fileId;
          driveFolderId = uploadData.folderId;
          drivePath = uploadData.drivePath;
          fileName = originalFile.name;
          fileSize = uploadData.fileSize;
          mimeType = uploadData.mimeType;
          thumbnailSourceFile = originalFile;
        } else {
          const copiedFile = copiedFilesBySourceId.get(pendingImage.file.id);
          if (!copiedFile) continue;

          const copiedPreviewFile: DriveFolderFile = {
            id: copiedFile.fileId,
            name: copiedFile.fileName,
            mimeType: copiedFile.mimeType,
            size: copiedFile.fileSize,
            createdTime: null,
            modifiedTime: null,
            thumbnailUrl: null,
            webViewLink: null,
          };
          setUploadStatus(`${i + 1}/${total} 복제본 썸네일 불러오는 중...`);
          thumbnailSourceFile = await fetchPortfolioDriveThumbnailFile(copiedPreviewFile, copiedFile.folderId);

          driveFileId = copiedFile.fileId;
          driveFolderId = copiedFile.folderId;
          drivePath = copiedFile.drivePath;
          fileName = pendingImage.file.name;
          fileSize = copiedFile.fileSize;
          mimeType = copiedFile.mimeType || pendingImage.file.mimeType || 'image/jpeg';
        }

        setUploadStatus(`${i + 1}/${total} 썸네일 생성 중...`);
        const thumbnail = await createPortfolioThumbnail(thumbnailSourceFile, post.id, displayOrder);
        setUploadStatus(`${i + 1}/${total} 썸네일 저장 중...`);
        await uploadPortfolioThumbnail(thumbnail);
        uploadedThumbnails.push({ bucket: thumbnail.bucket, path: thumbnail.path });

        const { error: imageError } = await supabase.from('portfolio_images').insert({
          post_id: post.id,
          drive_file_id: driveFileId,
          drive_folder_id: driveFolderId,
          drive_path: drivePath,
          file_name: fileName,
          thumbnail_url: null,
          image_url: null,
          thumbnail_bucket: thumbnail.bucket,
          thumbnail_path: thumbnail.path,
          thumbnail_width: thumbnail.width,
          thumbnail_height: thumbnail.height,
          display_order: displayOrder,
          is_main: displayOrder === 0,
          file_size: fileSize,
          mime_type: mimeType,
          storage_provider: 'google_drive',
          uploaded_by: user?.email || user?.id || null,
          access_level: 'internal',
          delete_status: 'active',
        });
        if (imageError) throw imageError;
        displayOrder++;
      }

      if (displayOrder === 0) {
        throw new Error('등록할 수 있는 이미지가 없습니다.');
      }

      if (copyFailures.length > 0) {
        toast.warning(`포트폴리오 등록 완료. Drive 사진 ${copyFailures.length}개는 복제 실패로 제외되었습니다.`);
      } else {
        toast.success('포트폴리오가 등록되었습니다.');
      }
      setShowCreateDialog(false);
      setNewTitle('');
      setNewCategory(DEFAULT_PORTFOLIO_CATEGORY);
      setNewClientName('');
      setNewProjectYear('');
      setNewLocation('');
      setNewMaterialsInput('');
      setNewProcessesInput('');
      setNewKeywords([]);
      setPendingImages([]);
      setDriveFolderUrl('');
      setDriveFolderResult(null);
      setSelectedDriveFileIds([]);
      setVisibleCount(PAGE_SIZE);
      qc.invalidateQueries({ queryKey: ['portfolio-posts'] });
      qc.invalidateQueries({ queryKey: ['portfolio-popular-keywords'] });
    } catch (err) {
      setUploadStatus('실패 항목을 정리하는 중...');
      await Promise.allSettled(uploadedDriveFiles.map(file => deletePortfolioDriveFile(file.fileId, file.folderId)));
      await Promise.allSettled(uploadedThumbnails.map(file => deletePortfolioThumbnail(file.bucket, file.path)));
      if (createdPostId) {
        await supabase.from('portfolio_posts').delete().eq('id', createdPostId);
      }
      toast.error('등록 실패: ' + getErrorMessage(err));
    } finally {
      setCreating(false);
      setUploadStatus(null);
    }
  }, [newTitle, newCategory, newClientName, newProjectYear, newLocation, newMaterialsInput, newProcessesInput, newKeywords, pendingImages, user, qc]);

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const post = posts.find(p => p.id === postId);
      if (post) {
        const imagesToDelete = post.images.length >= post.image_count
          ? post.images
          : await fetchPortfolioImagesForPost(postId);
        await supabase
          .from('portfolio_images')
          .update({ delete_status: 'pending', delete_error: null })
          .eq('post_id', postId);

        const deleteFailures: string[] = [];
        for (const img of imagesToDelete) {
          try {
            await deletePortfolioDriveFile(img.drive_file_id, img.drive_folder_id);
            await deletePortfolioThumbnail(img.thumbnail_bucket, img.thumbnail_path);
          } catch (error) {
            const message = getErrorMessage(error);
            deleteFailures.push(`${img.file_name}: ${message}`);
            await supabase
              .from('portfolio_images')
              .update({ delete_status: 'failed', delete_error: message })
              .eq('id', img.id);
          }
        }

        if (deleteFailures.length > 0) {
          throw new Error(deleteFailures.join('\n'));
        }
      }
      const { error } = await supabase.from('portfolio_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-posts'] });
      qc.invalidateQueries({ queryKey: ['portfolio-popular-keywords'] });
      setSelectedPost(null);
      toast.success('삭제되었습니다.');
    },
    onError: (error) => toast.error('삭제 실패: ' + getErrorMessage(error)),
  });

  // Edit handlers
  const openEditDialog = async (post: PortfolioPost) => {
    let images = post.images;
    if (post.images.length < post.image_count) {
      setLoadingDetailImages(true);
      try {
        images = await fetchPortfolioImagesForPost(post.id);
        setSelectedPost(prev => prev?.id === post.id ? {
          ...prev,
          image_count: Math.max(prev.image_count, images.length),
          images: images.length > 0 ? images : prev.images,
        } : prev);
      } catch (error) {
        toast.error('수정용 사진 로딩 실패: ' + getErrorMessage(error));
        return;
      } finally {
        setLoadingDetailImages(false);
      }
    }

    setEditTitle(post.title);
    setEditCategory(getPostCategoryLabel(post));
    setEditClientName(post.client_name || '');
    setEditProjectYear(post.project_year ? String(post.project_year) : '');
    setEditLocation(post.location || '');
    setEditMaterialsInput(joinListInput(post.materials));
    setEditProcessesInput(joinListInput(post.processes));
    setEditKeywords([...post.keywords]);
    setEditKeywordInput('');
    setEditImages([...images].sort((a, b) => a.display_order - b.display_order));
    setEditRemovedImages([]);
    setEditPendingImages([]);
    setShowEditDialog(true);
  };

  const addEditKeyword = (keyword: string) => {
    const cleaned = keyword.trim().replace(/^#/, '');
    if (!cleaned) return;
    if (!editKeywords.includes(cleaned)) {
      setEditKeywords(prev => [...prev, cleaned]);
    }
    setEditKeywordInput('');
  };

  const handleEditKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (isComposingText(e)) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEditKeyword(editKeywordInput);
    }
  };

  const moveEditImage = useCallback((fromIndex: number, direction: -1 | 1) => {
    setEditImages(prev => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= prev.length) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const makeEditImageMain = useCallback((index: number) => {
    setEditImages(prev => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [main] = next.splice(index, 1);
      next.unshift(main);
      return next;
    });
  }, []);

  const handleEditImageDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEditImages(prev => {
      const oldIndex = prev.findIndex(image => image.id === active.id);
      const newIndex = prev.findIndex(image => image.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const updateEditImageCaption = useCallback((imageId: string, caption: string) => {
    setEditImages(prev => prev.map(image => (
      image.id === imageId ? { ...image, caption } : image
    )));
  }, []);

  const removeEditImage = useCallback((image: PortfolioImage) => {
    setEditImages(prev => {
      if (prev.length <= 1 && editPendingImages.length === 0) {
        toast.error('이미지는 최소 1장 필요합니다.');
        return prev;
      }
      setEditRemovedImages(removed => [...removed, image]);
      return prev.filter(item => item.id !== image.id);
    });
  }, [editPendingImages.length]);

  const handleEditFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) { toast.error('이미지 파일만 추가할 수 있습니다.'); return; }
    const validFiles = imageFiles.filter(file => {
      if (file.size === 0) {
        toast.error(`${file.name} 파일이 비어 있습니다.`);
        return false;
      }
      if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
        toast.error(`${file.name}은 ${formatBytes(MAX_UPLOAD_IMAGE_BYTES)}를 초과합니다.`);
        return false;
      }
      return true;
    });
    setEditPendingImages(prev => {
      const availableSlots = Math.max(0, MAX_UPLOAD_FILES - editImages.length - prev.length);
      if (validFiles.length > availableSlots) {
        toast.error(`포트폴리오당 최대 ${MAX_UPLOAD_FILES}장까지 등록할 수 있습니다.`);
      }
      return [
        ...prev,
        ...validFiles.slice(0, availableSlots).map(file => ({
          id: `edit-local-${crypto.randomUUID()}`,
          source: 'local' as const,
          file,
        })),
      ];
    });
    if (editFileInputRef.current) editFileInputRef.current.value = '';
  };

  const handleEdit = useCallback(async () => {
    if (!selectedPost || !editTitle.trim()) { toast.error('제목을 입력해주세요.'); return; }
    if (editImages.length + editPendingImages.length === 0) { toast.error('이미지는 최소 1장 필요합니다.'); return; }
    const projectYear = parseProjectYear(editProjectYear);
    if (editProjectYear.trim() && !projectYear) { toast.error('연도는 1990~2100 사이 숫자로 입력해주세요.'); return; }
    setEditing(true);
    const uploadedDriveFiles: Array<{ fileId: string; folderId: string | null }> = [];
    const uploadedThumbnails: Array<{ bucket: string; path: string }> = [];
    const insertedImages: PortfolioImage[] = [];
    try {
      const normalizedKeywords = Array.from(new Set(
        editKeywords
          .map(removeLeadingHash)
          .filter(Boolean)
      ));
      const orderedImages = editImages.map((image, index) => ({
        ...image,
        caption: image.caption?.trim() || null,
        display_order: index,
        is_main: index === 0,
      }));

      const { error } = await supabase
        .from('portfolio_posts')
        .update({
          title: editTitle.trim(),
          category: editCategory,
          client_name: editClientName.trim() || null,
          project_year: projectYear,
          location: editLocation.trim() || null,
          materials: parseListInput(editMaterialsInput),
          processes: parseListInput(editProcessesInput),
          keywords: normalizedKeywords,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedPost.id);
      if (error) throw error;

      if (orderedImages.length > 0) {
        const imageUpdates = await Promise.all(orderedImages.map((image, index) => (
          supabase
            .from('portfolio_images')
            .update({ display_order: index, is_main: index === 0, caption: image.caption?.trim() || null })
            .eq('id', image.id)
        )));
        const imageError = imageUpdates.find(result => result.error)?.error;
        if (imageError) throw imageError;
      }

      for (const image of editRemovedImages) {
        await supabase.from('portfolio_images').update({ delete_status: 'pending', delete_error: null }).eq('id', image.id);
        await deletePortfolioDriveFile(image.drive_file_id, image.drive_folder_id);
        await deletePortfolioThumbnail(image.thumbnail_bucket, image.thumbnail_path);
        const { error: deleteRowError } = await supabase.from('portfolio_images').delete().eq('id', image.id);
        if (deleteRowError) throw deleteRowError;
      }

      for (let i = 0; i < editPendingImages.length; i++) {
        const pendingImage = editPendingImages[i];
        if (pendingImage.source !== 'local') continue;
        const displayOrder = orderedImages.length + insertedImages.length;
        const uploadFile = await optimizePortfolioImage(pendingImage.file);
        const uploadData = await uploadPortfolioFile(uploadFile, { category: editCategory, postTitle: editTitle.trim() });
        uploadedDriveFiles.push({ fileId: uploadData.fileId, folderId: uploadData.folderId });
        const thumbnail = await createPortfolioThumbnail(pendingImage.file, selectedPost.id, displayOrder);
        await uploadPortfolioThumbnail(thumbnail);
        uploadedThumbnails.push({ bucket: thumbnail.bucket, path: thumbnail.path });

        const { data: insertedImage, error: insertImageError } = await supabase.from('portfolio_images').insert({
          post_id: selectedPost.id,
          drive_file_id: uploadData.fileId,
          drive_folder_id: uploadData.folderId,
          drive_path: uploadData.drivePath,
          file_name: pendingImage.file.name,
          caption: null,
          thumbnail_url: null,
          image_url: null,
          thumbnail_bucket: thumbnail.bucket,
          thumbnail_path: thumbnail.path,
          thumbnail_width: thumbnail.width,
          thumbnail_height: thumbnail.height,
          display_order: displayOrder,
          is_main: displayOrder === 0,
          file_size: uploadData.fileSize,
          mime_type: uploadData.mimeType,
          storage_provider: 'google_drive',
          uploaded_by: user?.email || user?.id || null,
          access_level: 'internal',
          delete_status: 'active',
        }).select().single();
        if (insertImageError) throw insertImageError;
        const [hydratedImage] = await hydratePortfolioImages([insertedImage as PortfolioImage]);
        insertedImages.push(hydratedImage);
      }

      toast.success('수정되었습니다.');
      setShowEditDialog(false);
      setEditKeywords(normalizedKeywords);
      setEditRemovedImages([]);
      setEditPendingImages([]);
      setSelectedPost(prev => {
        if (!prev || prev.id !== selectedPost.id) return prev;
        const nextImages = [...orderedImages, ...insertedImages];
        return {
          ...prev,
          title: editTitle.trim(),
          category: editCategory,
          client_name: editClientName.trim() || null,
          project_year: projectYear,
          location: editLocation.trim() || null,
          materials: parseListInput(editMaterialsInput),
          processes: parseListInput(editProcessesInput),
          keywords: normalizedKeywords,
          image_count: nextImages.length,
          images: nextImages,
          updated_at: new Date().toISOString(),
        };
      });
      const currentImageId = selectedPost.images[currentImageIndex]?.id;
      const nextImageIndex = currentImageId ? [...orderedImages, ...insertedImages].findIndex(image => image.id === currentImageId) : 0;
      setCurrentImageIndex(nextImageIndex >= 0 ? nextImageIndex : 0);
      qc.invalidateQueries({ queryKey: ['portfolio-posts'] });
      qc.invalidateQueries({ queryKey: ['portfolio-popular-keywords'] });
    } catch (err) {
      await Promise.allSettled(uploadedDriveFiles.map(file => deletePortfolioDriveFile(file.fileId, file.folderId)));
      await Promise.allSettled(uploadedThumbnails.map(file => deletePortfolioThumbnail(file.bucket, file.path)));
      toast.error('수정 실패: ' + getErrorMessage(err));
    } finally {
      setEditing(false);
    }
  }, [
    selectedPost,
    editTitle,
    editCategory,
    editClientName,
    editProjectYear,
    editLocation,
    editMaterialsInput,
    editProcessesInput,
    editKeywords,
    editImages,
    editPendingImages,
    editRemovedImages,
    currentImageIndex,
    user,
    qc,
  ]);

  const editKeywordSuggestions = useMemo(() => {
    if (!editKeywordInput.trim()) return [];
    const q = editKeywordInput.toLowerCase().replace(/^#/, '');
    return popularKeywords.filter(k => k.toLowerCase().includes(q) && !editKeywords.includes(k)).slice(0, 5);
  }, [editKeywordInput, popularKeywords, editKeywords]);

  const handleKeywordFilterClick = (keyword: string) => {
    saveRecentKeyword(keyword);
    if (activeKeywordFilter === keyword) {
      setActiveKeywordFilter(null);
    } else {
      setActiveKeywordFilter(keyword);
    }
  };

  const getMainImage = (post: PortfolioPost) => (
    post.images.find(image => post.cover_image_id && image.id === post.cover_image_id)
    || post.images.find(i => i.is_main)
    || post.images[0]
  );

  // Suggestions for keyword input in create form
  const keywordSuggestions = useMemo(() => {
    if (!keywordInput.trim()) return [];
    const q = keywordInput.toLowerCase().replace(/^#/, '');
    return popularKeywords.filter(k => k.toLowerCase().includes(q) && !newKeywords.includes(k)).slice(0, 5);
  }, [keywordInput, popularKeywords, newKeywords]);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-[#e5e5e5] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]">
        <div className="relative grid min-h-[64px] place-items-center border-b border-[#e5e5e5] px-4 py-4 text-center">
          <h2 className="text-[24px] font-black leading-none tracking-tight text-[#111111] sm:text-[28px]">
            ACBANK PORTFOLIO
          </h2>
          <Badge variant="outline" className="absolute right-4 top-1/2 hidden -translate-y-1/2 font-mono text-[11px] font-black sm:inline-flex">
            {portfolioData.totalMatches} PROJECTS
          </Badge>
        </div>

        <CardContent className="space-y-4 p-4">
          <div className="sticky top-2 z-30 -mx-4 -mt-4 grid gap-3 border-b border-[#e5e5e5] bg-white/95 px-4 py-3 shadow-[0_8px_20px_rgba(255,255,255,0.85)] backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707072]" />
                <Input
                  placeholder="키워드, 공간, 소재, 파일명 검색"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setShowKeywordSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowKeywordSuggestions(false), 200)}
                  className="h-12 rounded-full border-[#cacacb] bg-white pl-10 text-[15px] font-bold"
                />
                {showKeywordSuggestions && !searchQuery && (recentKeywords.length > 0 || popularKeywords.length > 0) && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1 space-y-2 rounded-xl border border-[#e5e5e5] bg-white p-2 shadow-lg">
                    {recentKeywords.length > 0 && (
                      <div>
                        <p className="mb-1 flex items-center gap-1 px-1 text-xs font-bold text-[#707072]">
                          <Clock className="h-3 w-3" /> 최근 검색
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {recentKeywords.slice(0, 6).map(k => (
                            <button
                              key={k}
                              className="rounded-full bg-[#f5f5f5] px-2 py-1 text-xs font-bold transition-colors hover:bg-[#ededed]"
                              onMouseDown={() => { handleKeywordFilterClick(k); setShowKeywordSuggestions(false); }}
                            >
                              #{k}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {popularKeywords.length > 0 && (
                      <div>
                        <p className="mb-1 flex items-center gap-1 px-1 text-xs font-bold text-[#707072]">
                          <TrendingUp className="h-3 w-3" /> 자주 사용
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {popularKeywords.slice(0, 8).map(k => (
                            <button
                              key={k}
                              className="rounded-full bg-[#f5f5f5] px-2 py-1 text-xs font-bold transition-colors hover:bg-[#ededed]"
                              onMouseDown={() => { handleKeywordFilterClick(k); setShowKeywordSuggestions(false); }}
                            >
                              #{k}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant={isConsultingMode ? 'default' : 'outline'}
                  size="sm"
                  className={`h-11 rounded-full px-3 ${isConsultingMode ? 'bg-[#111111] text-white hover:bg-[#39393b]' : 'border-[#cacacb]'}`}
                  onClick={() => setIsConsultingMode(prev => !prev)}
                >
                  <Monitor className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">상담</span>
                </Button>
                <Button
                  variant={isManageMode ? 'default' : 'outline'}
                  size="sm"
                  className={`h-11 rounded-full px-3 ${isManageMode ? 'bg-[#111111] text-white hover:bg-[#39393b]' : 'border-[#cacacb]'}`}
                  onClick={() => setIsManageMode(prev => !prev)}
                >
                  <ShieldCheck className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">관리</span>
                </Button>
                <Button
                  variant={showFavoritesOnly ? 'default' : 'outline'}
                  size="sm"
                  className={`h-11 rounded-full px-3 ${showFavoritesOnly ? 'bg-[#111111] text-white hover:bg-[#39393b]' : 'border-[#cacacb]'}`}
                  onClick={() => setShowFavoritesOnly(prev => !prev)}
                >
                  <Star className="mr-1 h-4 w-4" />
                  <span className="hidden sm:inline">즐겨찾기</span>
                </Button>
                <Button variant="outline" size="sm" className="h-11 rounded-full border-[#cacacb] px-3" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">새로고침</span>
                </Button>
                {isManageMode && (
                  <Button size="sm" className="h-11 rounded-full bg-[#111111] px-4 text-white hover:bg-[#39393b]" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-1 h-4 w-4" />
                    등록
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PORTFOLIO_CATEGORY_FILTERS.map(filter => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveCategoryFilter(filter.key)}
                  className={`h-11 shrink-0 rounded-full border px-4 text-sm font-black transition-colors ${
                    activeCategoryFilter === filter.key
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#e5e5e5] bg-[#fafafa] text-[#39393b] hover:border-[#111111]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-3 text-xs font-bold" onClick={saveCurrentFilter}>
                <Save className="mr-1 h-3.5 w-3.5" />
                필터 저장
              </Button>
              {(normalizedSearchQuery || activeKeywordFilter || activeCategoryFilter !== 'all' || showFavoritesOnly) && (
                <Button type="button" variant="ghost" size="sm" className="h-9 rounded-full px-3 text-xs font-bold" onClick={clearPortfolioFilters}>
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  초기화
                </Button>
              )}
              {savedFilters.map(filter => (
                <button
                  key={filter.id}
                  type="button"
                  className="h-9 rounded-full border border-[#e5e5e5] bg-[#fafafa] px-3 text-xs font-bold text-[#39393b] hover:border-[#111111]"
                  onClick={() => applySavedFilter(filter)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {isManageMode && (
            <div className="grid gap-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-xs font-bold text-[#707072] sm:grid-cols-4">
              <div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4" /> 로딩 {portfolioData.totalMatches}건</div>
              <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4" /> 사진 {portfolioStats.imageCount}장</div>
              <div className="flex items-center gap-2"><Layers className="h-4 w-4" /> 대표 파일 {formatBytes(portfolioStats.fileBytes)}</div>
              <div className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" /> 대표 삭제 실패 {portfolioStats.failedDeletes}건</div>
            </div>
          )}

          {recentPosts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-black text-[#707072]">최근 본</span>
              {recentPosts.slice(0, 6).map(item => {
                const post = posts.find(candidate => candidate.id === item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="h-9 rounded-full border border-[#e5e5e5] bg-white px-3 text-xs font-bold text-[#39393b] hover:border-[#111111]"
                    onClick={() => { if (post) openPostDetail(post); }}
                    disabled={!post}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          )}

          {(activeKeywordFilter || popularKeywords.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-[#e5e5e5] pt-3">
              <Hash className="h-4 w-4 shrink-0 text-[#707072]" />
              {activeKeywordFilter && (
                <Badge
                  className="cursor-pointer gap-1 rounded-full bg-[#111111] text-white hover:bg-[#39393b]"
                  onClick={() => setActiveKeywordFilter(null)}
                >
                  #{activeKeywordFilter}
                  <X className="h-3 w-3" />
                </Badge>
              )}
              {popularKeywords.filter(k => k !== activeKeywordFilter).slice(0, 10).map(k => (
                <Badge
                  key={k}
                  variant="outline"
                  className="cursor-pointer rounded-full border-[#e5e5e5] bg-white font-bold hover:border-[#111111]"
                  onClick={() => handleKeywordFilterClick(k)}
                >
                  #{k}
                </Badge>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
                  <div className="aspect-[4/3] animate-pulse bg-[#f5f5f5]" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-[#ededed]" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-[#ededed]" />
                  </div>
                </div>
              ))}
            </div>
          ) : visiblePosts.length === 0 ? (
            <div className="grid min-h-[180px] place-items-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-4 py-12 text-center">
              <div>
                <ImageIcon className="mx-auto mb-3 h-12 w-12 text-[#9e9ea0]" />
                <p className="font-bold text-[#707072]">
                  {searchQuery || activeKeywordFilter || activeCategoryFilter !== 'all' || showFavoritesOnly ? '검색 결과가 없습니다.' : '등록된 포트폴리오가 없습니다.'}
                </p>
                {(searchQuery || activeKeywordFilter || activeCategoryFilter !== 'all' || showFavoritesOnly) ? (
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <Button variant="outline" className="h-11 rounded-full" onClick={clearPortfolioFilters}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      필터 초기화
                    </Button>
                    {popularKeywords.slice(0, 4).map(keyword => (
                      <Button key={keyword} variant="ghost" className="h-11 rounded-full" onClick={() => handleKeywordFilterClick(keyword)}>
                        #{keyword}
                      </Button>
                    ))}
                  </div>
                ) : isManageMode && (
                  <Button variant="outline" className="mt-4 rounded-full" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    첫 포트폴리오 등록
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={`grid gap-3 ${isConsultingMode ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                {visiblePosts.map(post => {
                  const mainImg = getMainImage(post);
                  return (
                    <article
                      key={post.id}
                      className="group relative overflow-hidden rounded-lg border border-[#e5e5e5] bg-white text-left transition-colors hover:border-[#111111]"
                    >
                      <button
                        type="button"
                        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
                        onClick={() => openPostDetail(post)}
                      >
                        <PortfolioCardThumbnail src={mainImg?.thumbnail_url || mainImg?.image_url || ''} alt={post.title} />
                        <span className="grid gap-1.5 p-3">
                        <span className="flex items-center justify-between gap-2">
                          <span className="line-clamp-2 text-[15px] font-black leading-snug text-[#111111]">{post.title}</span>
                          <Badge variant="outline" className="shrink-0 rounded-full text-[10px] font-black">{getPostCategoryLabel(post)}</Badge>
                        </span>
                        {getPostMetaLine(post) && (
                          <span className="line-clamp-1 text-xs font-bold text-[#707072]">{getPostMetaLine(post)}</span>
                        )}
                        <span className="flex items-center gap-1 text-xs font-bold text-[#707072]">
                          <ImageIcon className="h-3.5 w-3.5" /> {post.image_count}장
                        </span>
                        {post.keywords.length > 0 && (
                          <span className="flex gap-1 overflow-x-auto pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {post.keywords.slice(0, 4).map(k => (
                              <span key={k} className="shrink-0 rounded-full bg-[#1111110f] px-2 py-1 text-[11px] font-black text-[#39393b]">#{k}</span>
                            ))}
                          </span>
                        )}
                      </span>
                      </button>
                      <div className="absolute right-2 top-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          className="grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                          onClick={() => openPostDetail(post)}
                          aria-label={`${post.title} 열람`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${favoritePostIds.has(post.id) ? 'bg-white text-[#111111]' : 'bg-black/70 text-white hover:bg-black'}`}
                          onClick={() => toggleFavoritePost(post.id)}
                          aria-label={`${post.title} 즐겨찾기`}
                        >
                          <Star className={`h-4 w-4 ${favoritePostIds.has(post.id) ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          type="button"
                          className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${collectionPostIds.has(post.id) ? 'bg-white text-[#111111]' : 'bg-black/70 text-white hover:bg-black'}`}
                          onClick={() => toggleCollectionPost(post.id)}
                          aria-label={`${post.title} 컬렉션`}
                        >
                          {collectionPostIds.has(post.id) ? <BookmarkCheck className="h-4 w-4" /> : <BookmarkPlus className="h-4 w-4" />}
                        </button>
                        <button
                          type="button"
                          className={`grid h-10 w-10 place-items-center rounded-full transition-colors ${comparePostIds.includes(post.id) ? 'bg-white text-[#111111]' : 'bg-black/70 text-white hover:bg-black'}`}
                          onClick={() => toggleComparePost(post.id)}
                          aria-label={`${post.title} 비교`}
                        >
                          <Columns2 className="h-4 w-4" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {(collectionPostIds.size > 0 || comparePostIds.length > 0) && (
                <div className="sticky bottom-3 z-20 rounded-lg border border-[#e5e5e5] bg-white/95 p-3 shadow-lg backdrop-blur">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#707072]">상담 컬렉션</p>
                      <div className="mt-1 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {collectionPosts.length > 0 ? collectionPosts.map(post => (
                          <button
                            key={post.id}
                            type="button"
                            className="h-9 shrink-0 rounded-full border border-[#e5e5e5] bg-[#fafafa] px-3 text-xs font-bold hover:border-[#111111]"
                            onClick={() => openPostDetail(post)}
                          >
                            {post.title}
                          </button>
                        )) : (
                          <span className="text-xs font-bold text-[#9e9ea0]">현재 로딩된 컬렉션 항목이 없습니다.</span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-full"
                        onClick={() => {
                          setCollectionPostIds(new Set<string>());
                          saveStringSetToStorage(CONSULTING_COLLECTION_KEY, new Set<string>());
                        }}
                        disabled={collectionPostIds.size === 0}
                      >
                        비우기
                      </Button>
                      <Button
                        type="button"
                        className="h-11 rounded-full bg-[#111111] text-white hover:bg-[#39393b]"
                        onClick={() => setShowCompareDialog(true)}
                        disabled={comparePostIds.length !== 2}
                      >
                        <Columns2 className="mr-1 h-4 w-4" />
                        비교 보기 {comparePostIds.length}/2
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {portfolioData.hasMore && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                    disabled={isFetching}
                  >
                    {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    더 보기
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>포트폴리오 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>제목 *</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="포트폴리오 제목" />
            </div>
            <div>
              <Label>저장 카테고리 *</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                로컬 이미지와 Drive 복제 사진은 ACBANK_SYS/04_포트폴리오/{`{카테고리}`}/{`{제목}`} 폴더에 앱 관리본으로 저장됩니다.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PORTFOLIO_UPLOAD_CATEGORIES.map(category => (
                  <button
                    key={category}
                    type="button"
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
                      newCategory === category
                        ? 'border-[#111111] bg-[#111111] text-white'
                        : 'border-[#e5e5e5] bg-white text-[#39393b] hover:border-[#111111]'
                    }`}
                    onClick={() => setNewCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
              <Label className="mb-2 block">프로젝트 정보</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="고객/브랜드" />
                <Input value={newProjectYear} onChange={e => setNewProjectYear(e.target.value)} placeholder="연도 예: 2026" inputMode="numeric" />
                <Input value={newLocation} onChange={e => setNewLocation(e.target.value)} placeholder="위치/공간" />
                <Input value={newMaterialsInput} onChange={e => setNewMaterialsInput(e.target.value)} placeholder="소재, 쉼표로 구분" />
                <Input className="sm:col-span-2" value={newProcessesInput} onChange={e => setNewProcessesInput(e.target.value)} placeholder="공정/가공 방식, 쉼표로 구분" />
              </div>
            </div>
            <div>
              <Label>키워드</Label>
              <p className="text-xs text-muted-foreground mb-2">Enter 또는 콤마(,)로 키워드를 추가하세요</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {newKeywords.map(k => (
                  <Badge key={k} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeKeyword(k)}>
                    #{k}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  placeholder="키워드 입력"
                  className="pl-9"
                />
                {keywordSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-1">
                    {keywordSuggestions.map(k => (
                      <button
                        key={k}
                        className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-accent transition-colors"
                        onClick={() => addKeyword(k)}
                      >
                        #{k}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Popular keyword chips for quick add */}
              {popularKeywords.length > 0 && newKeywords.length === 0 && !keywordInput && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">자주 사용하는 키워드:</p>
                  <div className="flex flex-wrap gap-1">
                    {popularKeywords.slice(0, 6).map(k => (
                      <button
                        key={k}
                        className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-accent transition-colors"
                        onClick={() => addKeyword(k)}
                      >
                        #{k}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4" />
                Drive 폴더에서 복제 업로드
              </Label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={driveFolderUrl}
                  onChange={e => setDriveFolderUrl(e.target.value)}
                  placeholder="Google Drive 폴더 URL"
                  disabled={creating || loadingDriveFolder}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleLoadDriveFolder}
                  disabled={creating || loadingDriveFolder}
                  className="shrink-0"
                >
                  {loadingDriveFolder ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <FolderOpen className="mr-1 h-4 w-4" />}
                  불러오기
                </Button>
              </div>
              {driveFolderResult && (
                <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{driveFolderResult.folder.name}</p>
                      <p className="text-xs text-muted-foreground">
                        이미지 {driveFolderResult.files.length}개
                        {driveFolderResult.unsupportedCount > 0 ? ` · 미지원 ${driveFolderResult.unsupportedCount}개` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {driveFolderResult.folder.webViewLink && (
                        <Button type="button" variant="ghost" size="sm" asChild>
                          <a href={driveFolderResult.folder.webViewLink} target="_blank" rel="noreferrer">
                            <LinkIcon className="mr-1 h-4 w-4" />
                            열기
                          </a>
                        </Button>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={selectAllDriveFiles} disabled={creating}>
                        전체선택
                      </Button>
                      <Button type="button" size="sm" onClick={addSelectedDriveFiles} disabled={creating || selectedDriveFileIds.length === 0}>
                        선택 추가
                      </Button>
                    </div>
                  </div>
                  {driveFolderResult.files.length > 0 && (
                    <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4 md:grid-cols-5">
                      {driveFolderResult.files.map((file, index) => {
                        const alreadyPending = pendingDriveFileIdSet.has(file.id);
                        const disabled = creating || alreadyPending;
                        const selected = selectedDriveFileIdSet.has(file.id);
                        return (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => { if (!disabled) toggleDriveFileSelection(file.id); }}
                            disabled={disabled}
                            className={`min-w-0 rounded-lg border bg-white p-1 text-left transition-colors ${
                              selected
                                ? 'border-[#111111] ring-2 ring-[#111111]/20'
                                : 'border-[#e5e5e5] hover:border-[#111111]'
                            } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            <span className="relative grid aspect-square place-items-center overflow-hidden rounded-md bg-muted">
                              <DriveFolderImagePreview file={file} folderId={driveFolderResult.folder.id} enabled={index < 40 || selected} />
                              <span className="absolute right-1 top-1 rounded bg-black/70 p-0.5 text-white">
                                {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                              </span>
                              {alreadyPending && (
                                <span className="absolute inset-x-1 bottom-1 rounded bg-black/70 px-1 py-0.5 text-center text-[10px] font-bold text-white">
                                  추가됨
                                </span>
                              )}
                            </span>
                            <span className="mt-1 block truncate text-[11px] font-bold">{file.name}</span>
                            <span className="block text-[10px] text-muted-foreground">{formatBytes(file.size)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <Label>이미지 ({pendingImages.length}개) *</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                첫 번째 이미지가 대표 이미지로 표시됩니다. 최대 {MAX_UPLOAD_FILES}장, 파일당 {formatBytes(MAX_UPLOAD_IMAGE_BYTES)}까지 등록됩니다.
              </p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {pendingImages.map((item, i) => (
                  <PendingImagePreview
                    key={item.id}
                    item={item}
                    isMain={i === 0}
                    onRemove={() => removePendingImage(i)}
                  />
                ))}
                <button
                  type="button"
                  className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pendingImages.length >= MAX_UPLOAD_FILES}
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
              {uploadStatus && (
                <p className="text-xs font-bold text-muted-foreground">{uploadStatus}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={creating}>취소</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {creating ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Lightbox */}
      <Dialog open={!!selectedPost} onOpenChange={open => { if (!open) closePostDetail(); }}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-hidden p-0" aria-describedby={undefined}>
          {selectedPost && (
            <>
              <DialogTitle className="sr-only">{selectedPost.title} 상세 보기</DialogTitle>
              <div className="grid max-h-[92vh] bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
              <div
                ref={lightboxStageRef}
                className={`relative min-h-[360px] overflow-hidden bg-[#0f0f10] lg:min-h-[680px] ${imageZoom > 1 ? 'touch-none' : ''}`}
                onWheel={e => {
                  e.preventDefault();
                  setBoundedZoom(imageZoom + (e.deltaY < 0 ? 0.18 : -0.18));
                }}
                onPointerDown={handleLightboxPointerDown}
                onPointerMove={handleLightboxPointerMove}
                onPointerUp={handleLightboxPointerEnd}
                onPointerCancel={handleLightboxPointerEnd}
                onTouchStart={handleLightboxTouchStart}
                onTouchMove={handleLightboxTouchMove}
                onTouchEnd={handleLightboxTouchEnd}
              >
                {selectedPost.images.length > 0 ? (
                  <img
                    src={currentOriginalImageUrl || selectedPost.images[currentImageIndex]?.thumbnail_url || ''}
                    alt={selectedPost.images[currentImageIndex]?.file_name}
                    className={`absolute left-1/2 top-1/2 block max-h-full max-w-full select-none object-contain ${imageZoom > 1 ? isImageDragging ? 'cursor-grabbing' : 'cursor-grab' : 'cursor-zoom-in'}`}
                    draggable={false}
                    style={{
                      transform: `translate(-50%, -50%) translate(${imageOffset.x}px, ${imageOffset.y}px) scale(${imageZoom})`,
                      transformOrigin: 'center',
                    }}
                    onDoubleClick={() => setBoundedZoom(imageZoom > 1 ? 1 : 2)}
                  />
                ) : (
                  <div className="grid h-full min-h-[360px] place-items-center text-white/60">
                    <ImageIcon className="h-12 w-12" />
                  </div>
                )}
                {loadingOriginalImage && (
                  <div className="absolute inset-x-0 top-16 z-10 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      원본 로딩 중
                    </span>
                  </div>
                )}
                {loadingDetailImages && (
                  <div className="absolute inset-x-0 top-28 z-10 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      사진 목록 로딩 중
                    </span>
                  </div>
                )}

                <div className="absolute left-3 top-3 flex gap-1.5">
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={closePostDetail}
                    aria-label="닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="absolute right-3 top-3 flex gap-1.5">
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={() => setBoundedZoom(imageZoom - 0.25)}
                    aria-label="축소"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={() => setBoundedZoom(imageZoom + 0.25)}
                    aria-label="확대"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={resetImageView}
                    aria-label="화면 맞춤"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={toggleLightboxFullscreen}
                    aria-label="전체화면"
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                  </button>
                </div>

                {selectedPost.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 grid h-14 w-12 -translate-y-1/2 place-items-center rounded bg-black/50 text-white transition-colors hover:bg-black/75"
                      onClick={() => showImageAt(currentImageIndex - 1)}
                      aria-label="이전 사진"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 grid h-14 w-12 -translate-y-1/2 place-items-center rounded bg-black/50 text-white transition-colors hover:bg-black/75"
                      onClick={() => showImageAt(currentImageIndex + 1)}
                      aria-label="다음 사진"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
                {selectedPost.images.length > 1 && (
                  <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
                    <div className="flex max-w-full gap-2 overflow-x-auto rounded-full bg-black/55 p-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {selectedPost.images.map((img, i) => (
                        <button
                          key={img.id}
                          type="button"
                          className={`h-14 w-20 shrink-0 overflow-hidden rounded-full border-2 transition-colors ${
                            i === currentImageIndex ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                          onClick={() => showImageAt(i)}
                        >
                          <img src={img.thumbnail_url || img.image_url || ''} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <aside className="grid min-h-0 grid-rows-[auto_1fr_auto] border-l border-[#e5e5e5]">
                <div className="space-y-2 border-b border-[#e5e5e5] p-4">
                  <div className="text-[11px] font-black text-[#707072]">PORTFOLIO</div>
                  <h3 className="text-xl font-black leading-tight text-[#111111]">{selectedPost.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="w-fit rounded-full text-[11px] font-black">
                      {getPostCategoryLabel(selectedPost)}
                    </Badge>
                    <Badge variant="secondary" className="w-fit rounded-full font-mono text-[11px]">
                      {selectedPost.images.length > 0 ? currentImageIndex + 1 : 0} / {Math.max(selectedPost.image_count, selectedPost.images.length)}
                    </Badge>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto p-4">
                  <dl className="grid gap-2">
                    {getPostMetaLine(selectedPost) && (
                      <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                        <dt className="text-[11px] font-black text-[#707072]">프로젝트 정보</dt>
                        <dd className="mt-1 break-all text-sm font-bold text-[#111111]">
                          {getPostMetaLine(selectedPost)}
                        </dd>
                      </div>
                    )}
                    {selectedPost.images[currentImageIndex]?.caption && (
                      <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                        <dt className="text-[11px] font-black text-[#707072]">사진 메모</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-sm font-bold text-[#111111]">
                          {selectedPost.images[currentImageIndex]?.caption}
                        </dd>
                      </div>
                    )}
                    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                      <dt className="text-[11px] font-black text-[#707072]">파일명</dt>
                      <dd className="mt-1 break-all text-sm font-bold text-[#111111]">
                        {selectedPost.images[currentImageIndex]?.file_name || '-'}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                      <dt className="text-[11px] font-black text-[#707072]">파일 용량</dt>
                      <dd className="mt-1 break-all text-sm font-bold text-[#111111]">
                        {formatBytes(selectedPost.images[currentImageIndex]?.file_size)}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                      <dt className="text-[11px] font-black text-[#707072]">등록자</dt>
                      <dd className="mt-1 break-all text-sm font-bold text-[#111111]">{selectedPost.created_by}</dd>
                    </div>
                  </dl>

                  {selectedPost.keywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {selectedPost.keywords.map(k => (
                        <Badge key={k} variant="outline" className="cursor-pointer rounded-full border-[#e5e5e5] font-bold" onClick={() => {
                          handleKeywordFilterClick(k);
                          closePostDetail();
                        }}>#{k}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-[#e5e5e5] bg-[#fafafa] p-3">
                  {selectedPost.images.length > 1 && (
                    <div className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {selectedPost.images.map((img, i) => (
                        <button
                          key={img.id}
                          type="button"
                          className={`h-12 w-16 shrink-0 overflow-hidden rounded border-2 transition-colors ${
                            i === currentImageIndex ? 'border-[#111111]' : 'border-transparent hover:border-[#cacacb]'
                          }`}
                          onClick={() => showImageAt(i)}
                        >
                          <img src={img.thumbnail_url || img.image_url || ''} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => toggleFavoritePost(selectedPost.id)}>
                      {favoritePostIds.has(selectedPost.id) ? <StarOff className="mr-1 h-4 w-4" /> : <Star className="mr-1 h-4 w-4" />}
                      {favoritePostIds.has(selectedPost.id) ? '해제' : '즐겨찾기'}
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => toggleCollectionPost(selectedPost.id)}>
                      {collectionPostIds.has(selectedPost.id) ? <BookmarkCheck className="mr-1 h-4 w-4" /> : <BookmarkPlus className="mr-1 h-4 w-4" />}
                      컬렉션
                    </Button>
                    {isManageMode && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => openEditDialog(selectedPost)} disabled={loadingDetailImages}>
                          <Pencil className="mr-1 h-4 w-4" />
                          수정
                        </Button>
                        <Button
                          variant="outline" size="sm" className="flex-1 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => { if (confirm('이 포트폴리오를 삭제하시겠습니까?')) deleteMutation.mutate(selectedPost.id); }}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          삭제
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </aside>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Compare Dialog */}
      <Dialog open={showCompareDialog} onOpenChange={setShowCompareDialog}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>포트폴리오 비교</DialogTitle>
          </DialogHeader>
          {comparePosts.length === 2 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {comparePosts.map(post => {
                const image = getMainImage(post);
                return (
                  <div key={post.id} className="overflow-hidden rounded-lg border border-[#e5e5e5] bg-white">
                    <div className="aspect-[4/3] bg-[#111111]">
                      {image ? (
                        <img src={image.thumbnail_url || image.image_url || ''} alt={post.title} className="h-full w-full object-contain" />
                      ) : (
                        <div className="grid h-full place-items-center text-white/60"><ImageIcon className="h-10 w-10" /></div>
                      )}
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-black text-[#111111]">{post.title}</h3>
                        <Badge variant="outline" className="rounded-full font-black">{getPostCategoryLabel(post)}</Badge>
                      </div>
                      {getPostMetaLine(post) && <p className="text-sm font-bold text-[#707072]">{getPostMetaLine(post)}</p>}
                      <div className="flex flex-wrap gap-1">
                        {post.keywords.slice(0, 8).map(keyword => (
                          <Badge key={keyword} variant="secondary" className="rounded-full">#{keyword}</Badge>
                        ))}
                      </div>
                      <Button type="button" variant="outline" className="h-11 rounded-full" onClick={() => openPostDetail(post)}>
                        크게 보기
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid min-h-32 place-items-center rounded-lg border border-dashed text-sm font-bold text-muted-foreground">
              비교할 포트폴리오 2건을 선택해주세요.
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>포트폴리오 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>제목 *</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="포트폴리오 제목" />
            </div>
            <div>
              <Label>카테고리</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PORTFOLIO_UPLOAD_CATEGORIES.map(category => (
                  <button
                    key={category}
                    type="button"
                    className={`h-10 rounded-full border px-3 text-xs font-bold transition-colors ${
                      editCategory === category
                        ? 'border-[#111111] bg-[#111111] text-white'
                        : 'border-[#e5e5e5] bg-white text-[#39393b] hover:border-[#111111]'
                    }`}
                    onClick={() => setEditCategory(category)}
                    disabled={editing}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
              <Label className="mb-2 block">프로젝트 정보</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={editClientName} onChange={e => setEditClientName(e.target.value)} placeholder="고객/브랜드" disabled={editing} />
                <Input value={editProjectYear} onChange={e => setEditProjectYear(e.target.value)} placeholder="연도 예: 2026" inputMode="numeric" disabled={editing} />
                <Input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="위치/공간" disabled={editing} />
                <Input value={editMaterialsInput} onChange={e => setEditMaterialsInput(e.target.value)} placeholder="소재, 쉼표로 구분" disabled={editing} />
                <Input className="sm:col-span-2" value={editProcessesInput} onChange={e => setEditProcessesInput(e.target.value)} placeholder="공정/가공 방식, 쉼표로 구분" disabled={editing} />
              </div>
            </div>
            <div>
              <Label>키워드</Label>
              <p className="text-xs text-muted-foreground mb-2">Enter 또는 콤마(,)로 키워드를 추가하세요</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editKeywords.map(k => (
                  <Badge key={k} variant="secondary" className="gap-1 cursor-pointer" onClick={() => setEditKeywords(prev => prev.filter(x => x !== k))}>
                    #{k}
                    <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={editKeywordInput}
                  onChange={e => setEditKeywordInput(e.target.value)}
                  onKeyDown={handleEditKeywordKeyDown}
                  placeholder="키워드 입력"
                  className="pl-9"
                />
                {editKeywordSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-1">
                    {editKeywordSuggestions.map(k => (
                      <button
                        key={k}
                        className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-accent transition-colors"
                        onClick={() => addEditKeyword(k)}
                      >
                        #{k}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <Label>사진 순서</Label>
                  <p className="mt-1 text-xs text-muted-foreground">드래그하거나 버튼으로 순서를 바꿀 수 있고, 첫 번째 사진이 대표 이미지입니다.</p>
                </div>
                <Badge variant="outline" className="shrink-0 rounded-full font-bold">
                  {editImages.length + editPendingImages.length}장
                </Badge>
              </div>
              {editImages.length > 0 ? (
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleEditImageDragEnd}>
                  <SortableContext items={editImages.map(image => image.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-2">
                      {editImages.map((image, index) => (
                        <SortableEditImageRow
                          key={image.id}
                          image={image}
                          index={index}
                          total={editImages.length}
                          editing={editing}
                          onMove={moveEditImage}
                          onMakeMain={makeEditImageMain}
                          onCaptionChange={updateEditImageCaption}
                          onRemove={removeEditImage}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="grid min-h-24 place-items-center rounded-lg border border-dashed text-sm font-bold text-muted-foreground">
                  등록된 사진이 없습니다.
                </div>
              )}
              {editPendingImages.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-bold text-muted-foreground">추가 예정 사진</p>
                  <div className="grid grid-cols-4 gap-2">
                    {editPendingImages.map((item, index) => (
                      <PendingImagePreview
                        key={item.id}
                        item={item}
                        isMain={editImages.length === 0 && index === 0}
                        onRemove={() => setEditPendingImages(prev => prev.filter((_, i) => i !== index))}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={editing || editImages.length + editPendingImages.length >= MAX_UPLOAD_FILES}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  사진 추가
                </Button>
                {editRemovedImages.length > 0 && (
                  <Badge variant="outline" className="rounded-full text-destructive">
                    삭제 예정 {editRemovedImages.length}장
                  </Badge>
                )}
                <input ref={editFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleEditFilesSelected} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} disabled={editing}>취소</Button>
            <Button onClick={handleEdit} disabled={editing}>
              {editing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Pencil className="h-4 w-4 mr-1" />}
              {editing ? '수정 중...' : '수정'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioGallery;
