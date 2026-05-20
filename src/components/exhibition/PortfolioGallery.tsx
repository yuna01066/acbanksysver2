import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  ZoomIn, ZoomOut, Maximize2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PortfolioPost {
  id: string;
  title: string;
  keywords: string[];
  created_by: string;
  created_at: string;
  images: PortfolioImage[];
}

interface PortfolioImage {
  id: string;
  post_id: string;
  drive_file_id: string;
  file_name: string;
  thumbnail_url: string | null;
  image_url: string | null;
  display_order: number;
  is_main: boolean;
}

const PORTFOLIO_FOLDER = ['포트폴리오'];
const RECENT_KEYWORDS_KEY = 'portfolio-recent-keywords';
const MAX_RECENT = 10;
const PORTFOLIO_CATEGORY_FILTERS = [
  { key: 'all', label: '전체', keywords: [] },
  { key: 'interior', label: '인테리어', keywords: ['인테리어', '공간', '로비', '매장', '쇼룸', '오피스', '팝업'] },
  { key: 'fabrication', label: '제작가공', keywords: ['제작가공', '제작', '가공', '레이저', 'cnc', '절곡', '접합'] },
  { key: 'detail', label: '디테일', keywords: ['디테일', '마감', '코너', '접착', '모서리'] },
  { key: 'signage', label: '사인/디스플레이', keywords: ['사인', '디스플레이', '진열', '전시', '팝업'] },
] as const;

function getRecentKeywords(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEYWORDS_KEY) || '[]');
  } catch { return []; }
}

function saveRecentKeyword(keyword: string) {
  const recent = getRecentKeywords().filter(k => k !== keyword);
  recent.unshift(keyword);
  localStorage.setItem(RECENT_KEYWORDS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

const PortfolioGallery = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragStateRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PortfolioPost | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKeywordFilter, setActiveKeywordFilter] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('all');
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isImageDragging, setIsImageDragging] = useState(false);

  // Edit state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editKeywords, setEditKeywords] = useState<string[]>([]);
  const [editKeywordInput, setEditKeywordInput] = useState('');
  const [editing, setEditing] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newKeywords, setNewKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [creating, setCreating] = useState(false);

  // Fetch posts with images
  const { data: posts = [], isLoading, refetch } = useQuery({
    queryKey: ['portfolio-posts'],
    queryFn: async () => {
      const { data: postsData, error: postsError } = await supabase
        .from('portfolio_posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (postsError) throw postsError;

      const { data: imagesData, error: imagesError } = await supabase
        .from('portfolio_images')
        .select('*')
        .order('display_order', { ascending: true });
      if (imagesError) throw imagesError;

      return (postsData || []).map((post: any) => ({
        ...post,
        keywords: post.keywords || [],
        images: (imagesData || []).filter((img: any) => img.post_id === post.id),
      })) as PortfolioPost[];
    },
  });

  // Compute popular keywords (sorted by frequency)
  const popularKeywords = useMemo(() => {
    const freq: Record<string, number> = {};
    posts.forEach(p => p.keywords.forEach(k => { freq[k] = (freq[k] || 0) + 1; }));
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }, [posts]);

  const recentKeywords = useMemo(() => getRecentKeywords(), [activeKeywordFilter, searchQuery]);

  const resetImageView = useCallback(() => {
    setImageZoom(1);
    setImageOffset({ x: 0, y: 0 });
    setIsImageDragging(false);
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
    setSelectedPost(post);
    setCurrentImageIndex(0);
    resetImageView();
  }, [resetImageView]);

  const closePostDetail = useCallback(() => {
    setSelectedPost(null);
    resetImageView();
  }, [resetImageView]);

  const showImageAt = useCallback((index: number) => {
    if (!selectedPost?.images.length) return;
    const length = selectedPost.images.length;
    setCurrentImageIndex(((index % length) + length) % length);
    resetImageView();
  }, [selectedPost, resetImageView]);

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
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeyword(keywordInput);
    }
  };

  const removeKeyword = (keyword: string) => {
    setNewKeywords(prev => prev.filter(k => k !== keyword));
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) { toast.error('이미지 파일만 업로드 가능합니다.'); return; }
    setPendingFiles(prev => [...prev, ...imageFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) { toast.error('제목을 입력해주세요.'); return; }
    if (pendingFiles.length === 0) { toast.error('이미지를 최소 1개 추가해주세요.'); return; }

    setCreating(true);
    try {
      const { data: post, error: postError } = await supabase
        .from('portfolio_posts')
        .insert({
          title: newTitle.trim(),
          keywords: newKeywords,
          created_by: user?.email || 'unknown',
        })
        .select()
        .single();
      if (postError) throw postError;

      for (let i = 0; i < pendingFiles.length; i++) {
        const file = pendingFiles[i];
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]); // Remove data:...;base64, prefix
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('google-drive', {
          body: {
            action: 'upload-portfolio-image',
            folderPath: PORTFOLIO_FOLDER,
            fileName: file.name,
            fileBase64: base64,
            contentType: file.type,
          },
        });
        if (uploadError || !uploadData?.success) continue;

        const driveFileId = uploadData.fileId;
        await supabase.from('portfolio_images').insert({
          post_id: post.id,
          drive_file_id: driveFileId,
          file_name: file.name,
          thumbnail_url: `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w400`,
          image_url: `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w2400`,
          display_order: i,
          is_main: i === 0,
        });
      }

      toast.success('포트폴리오가 등록되었습니다.');
      setShowCreateDialog(false);
      setNewTitle('');
      setNewKeywords([]);
      setPendingFiles([]);
      qc.invalidateQueries({ queryKey: ['portfolio-posts'] });
    } catch (err: any) {
      toast.error('등록 실패: ' + err.message);
    } finally {
      setCreating(false);
    }
  }, [newTitle, newKeywords, pendingFiles, user, qc]);

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const post = posts.find(p => p.id === postId);
      if (post) {
        for (const img of post.images) {
          await supabase.functions.invoke('google-drive', {
            body: { action: 'delete-file', fileId: img.drive_file_id },
          });
        }
      }
      const { error } = await supabase.from('portfolio_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-posts'] });
      setSelectedPost(null);
      toast.success('삭제되었습니다.');
    },
    onError: () => toast.error('삭제 실패'),
  });

  // Edit handlers
  const openEditDialog = (post: PortfolioPost) => {
    setEditTitle(post.title);
    setEditKeywords([...post.keywords]);
    setEditKeywordInput('');
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
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addEditKeyword(editKeywordInput);
    }
  };

  const handleEdit = useCallback(async () => {
    if (!selectedPost || !editTitle.trim()) { toast.error('제목을 입력해주세요.'); return; }
    setEditing(true);
    try {
      const { error } = await supabase
        .from('portfolio_posts')
        .update({ title: editTitle.trim(), keywords: editKeywords, updated_at: new Date().toISOString() })
        .eq('id', selectedPost.id);
      if (error) throw error;
      toast.success('수정되었습니다.');
      setShowEditDialog(false);
      setSelectedPost({ ...selectedPost, title: editTitle.trim(), keywords: editKeywords });
      qc.invalidateQueries({ queryKey: ['portfolio-posts'] });
    } catch (err: any) {
      toast.error('수정 실패: ' + err.message);
    } finally {
      setEditing(false);
    }
  }, [selectedPost, editTitle, editKeywords, qc]);

  const editKeywordSuggestions = useMemo(() => {
    if (!editKeywordInput.trim()) return [];
    const q = editKeywordInput.toLowerCase().replace(/^#/, '');
    return popularKeywords.filter(k => k.toLowerCase().includes(q) && !editKeywords.includes(k)).slice(0, 5);
  }, [editKeywordInput, popularKeywords, editKeywords]);

  // Filter posts by keyword or search
  const filteredPosts = useMemo(() => {
    let result = posts;
    if (activeCategoryFilter !== 'all') {
      const category = PORTFOLIO_CATEGORY_FILTERS.find(filter => filter.key === activeCategoryFilter);
      const categoryKeywords = category?.keywords || [];
      result = result.filter(p => {
        const searchable = [
          p.title,
          ...p.keywords,
          ...p.images.map(img => img.file_name),
        ].join(' ').toLowerCase();
        return categoryKeywords.some(keyword => searchable.includes(keyword.toLowerCase()));
      });
    }
    if (activeKeywordFilter) {
      result = result.filter(p => p.keywords.includes(activeKeywordFilter));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.keywords.some(k => k.toLowerCase().includes(q)) ||
        p.images.some(img => img.file_name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [posts, activeCategoryFilter, activeKeywordFilter, searchQuery]);

  const handleKeywordFilterClick = (keyword: string) => {
    saveRecentKeyword(keyword);
    if (activeKeywordFilter === keyword) {
      setActiveKeywordFilter(null);
    } else {
      setActiveKeywordFilter(keyword);
    }
  };

  const getMainImage = (post: PortfolioPost) => post.images.find(i => i.is_main) || post.images[0];

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
            {filteredPosts.length} PROJECTS
          </Badge>
        </div>

        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#707072]" />
                <Input
                  placeholder="키워드, 공간, 소재, 파일명 검색"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={() => setShowKeywordSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowKeywordSuggestions(false), 200)}
                  className="h-11 rounded-full border-[#cacacb] bg-white pl-10 text-sm font-bold"
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
              <div className="flex shrink-0 gap-2">
                <Button variant="outline" size="sm" className="h-10 rounded-full border-[#cacacb]" onClick={() => refetch()} disabled={isLoading}>
                  <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                  새로고침
                </Button>
                <Button size="sm" className="h-10 rounded-full bg-[#111111] px-4 text-white hover:bg-[#39393b]" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  등록
                </Button>
              </div>
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {PORTFOLIO_CATEGORY_FILTERS.map(filter => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveCategoryFilter(filter.key)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition-colors ${
                    activeCategoryFilter === filter.key
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#e5e5e5] bg-[#fafafa] text-[#39393b] hover:border-[#111111]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

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
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#707072]" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="grid min-h-[180px] place-items-center rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-4 py-12 text-center">
              <div>
                <ImageIcon className="mx-auto mb-3 h-12 w-12 text-[#9e9ea0]" />
                <p className="font-bold text-[#707072]">
                  {searchQuery || activeKeywordFilter || activeCategoryFilter !== 'all' ? '검색 결과가 없습니다.' : '등록된 포트폴리오가 없습니다.'}
                </p>
                {!searchQuery && !activeKeywordFilter && activeCategoryFilter === 'all' && (
                  <Button variant="outline" className="mt-4 rounded-full" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    첫 포트폴리오 등록
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPosts.map(post => {
                const mainImg = getMainImage(post);
                return (
                  <button
                    key={post.id}
                    type="button"
                    className="group overflow-hidden rounded-lg border border-[#e5e5e5] bg-white text-left transition-colors hover:border-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111]"
                    onClick={() => openPostDetail(post)}
                  >
                    <span className="relative block aspect-[4/3] overflow-hidden border-b border-black/5 bg-[#f5f5f5]">
                      {mainImg ? (
                        <img src={mainImg.thumbnail_url || mainImg.image_url || ''} alt={post.title} className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.025]" loading="lazy" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center"><ImageIcon className="h-8 w-8 text-[#9e9ea0]" /></span>
                      )}
                      <span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100">
                        <Eye className="h-4 w-4" />
                      </span>
                    </span>
                    <span className="grid gap-1.5 p-3">
                      <span className="line-clamp-2 text-sm font-black leading-snug text-[#111111]">{post.title}</span>
                      <span className="flex items-center gap-1 text-xs font-bold text-[#707072]">
                        <ImageIcon className="h-3.5 w-3.5" /> {post.images.length}장
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>포트폴리오 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>제목 *</Label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="포트폴리오 제목" />
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
              <Label>이미지 ({pendingFiles.length}개) *</Label>
              <p className="text-xs text-muted-foreground mb-2">첫 번째 이미지가 대표 이미지로 표시됩니다.</p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    {i === 0 && <Badge className="absolute top-1 left-1 text-[10px] px-1 py-0">대표</Badge>}
                    <button
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-destructive transition-colors"
                      onClick={() => removePendingFile(i)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFilesSelected} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {creating ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Lightbox */}
      <Dialog open={!!selectedPost} onOpenChange={open => { if (!open) closePostDetail(); }}>
        <DialogContent className="max-h-[92vh] w-[96vw] max-w-6xl overflow-hidden p-0">
          {selectedPost && (
            <div className="grid max-h-[92vh] bg-white lg:grid-cols-[minmax(0,1fr)_320px]">
              <div
                className={`relative min-h-[360px] overflow-hidden bg-[#0f0f10] lg:min-h-[680px] ${imageZoom > 1 ? 'touch-none' : ''}`}
                onWheel={e => {
                  e.preventDefault();
                  setBoundedZoom(imageZoom + (e.deltaY < 0 ? 0.18 : -0.18));
                }}
                onPointerDown={handleLightboxPointerDown}
                onPointerMove={handleLightboxPointerMove}
                onPointerUp={handleLightboxPointerEnd}
                onPointerCancel={handleLightboxPointerEnd}
              >
                {selectedPost.images.length > 0 ? (
                  <img
                    src={selectedPost.images[currentImageIndex]?.image_url?.replace('sz=w1600', 'sz=w2400') || selectedPost.images[currentImageIndex]?.thumbnail_url || ''}
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

                <div className="absolute left-3 top-3 flex gap-1.5">
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={closePostDetail}
                    aria-label="닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="absolute right-3 top-3 flex gap-1.5">
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={() => setBoundedZoom(imageZoom - 0.25)}
                    aria-label="축소"
                  >
                    <ZoomOut className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={() => setBoundedZoom(imageZoom + 0.25)}
                    aria-label="확대"
                  >
                    <ZoomIn className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white transition-colors hover:bg-black"
                    onClick={resetImageView}
                    aria-label="화면 맞춤"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>

                {selectedPost.images.length > 1 && (
                  <>
                    <button
                      type="button"
                      className="absolute left-3 top-1/2 grid h-12 w-10 -translate-y-1/2 place-items-center rounded bg-black/50 text-white transition-colors hover:bg-black/75"
                      onClick={() => showImageAt(currentImageIndex - 1)}
                      aria-label="이전 사진"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 grid h-12 w-10 -translate-y-1/2 place-items-center rounded bg-black/50 text-white transition-colors hover:bg-black/75"
                      onClick={() => showImageAt(currentImageIndex + 1)}
                      aria-label="다음 사진"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              <aside className="grid min-h-0 grid-rows-[auto_1fr_auto] border-l border-[#e5e5e5]">
                <div className="space-y-2 border-b border-[#e5e5e5] p-4">
                  <div className="text-[11px] font-black text-[#707072]">PORTFOLIO</div>
                  <h3 className="text-xl font-black leading-tight text-[#111111]">{selectedPost.title}</h3>
                  <Badge variant="secondary" className="w-fit rounded-full font-mono text-[11px]">
                    {currentImageIndex + 1} / {selectedPost.images.length}
                  </Badge>
                </div>

                <div className="min-h-0 overflow-y-auto p-4">
                  <dl className="grid gap-2">
                    <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
                      <dt className="text-[11px] font-black text-[#707072]">파일명</dt>
                      <dd className="mt-1 break-all text-sm font-bold text-[#111111]">
                        {selectedPost.images[currentImageIndex]?.file_name || '-'}
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
                          <img src={img.thumbnail_url || img.image_url || ''} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => openEditDialog(selectedPost)}>
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
                  </div>
                </div>
              </aside>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>포트폴리오 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>제목 *</Label>
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="포트폴리오 제목" />
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>취소</Button>
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
