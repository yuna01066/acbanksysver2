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
  ChevronLeft, ChevronRight, Search, RefreshCw, Eye, X, Hash, Clock, TrendingUp
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

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PortfolioPost | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeKeywordFilter, setActiveKeywordFilter] = useState<string | null>(null);
  const [showKeywordSuggestions, setShowKeywordSuggestions] = useState(false);

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
        const { data: initData, error: initError } = await supabase.functions.invoke('google-drive', {
          body: {
            action: 'init-resumable-upload',
            folderPath: PORTFOLIO_FOLDER,
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
          },
        });
        if (initError || !initData?.success) continue;

        const uploadRes = await fetch(initData.uploadUri, {
          method: 'PUT',
          headers: { 'Content-Type': file.type, 'Content-Length': file.size.toString() },
          body: file,
        });

        if (uploadRes.ok) {
          const driveFile = await uploadRes.json();
          await supabase.from('portfolio_images').insert({
            post_id: post.id,
            drive_file_id: driveFile.id,
            file_name: file.name,
            thumbnail_url: `https://drive.google.com/thumbnail?id=${driveFile.id}&sz=w400`,
            image_url: `https://drive.google.com/thumbnail?id=${driveFile.id}&sz=w1600`,
            display_order: i,
            is_main: i === 0,
          });
        }
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

  // Filter posts by keyword or search
  const filteredPosts = useMemo(() => {
    let result = posts;
    if (activeKeywordFilter) {
      result = result.filter(p => p.keywords.includes(activeKeywordFilter));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.keywords.some(k => k.toLowerCase().includes(q))
      );
    }
    return result;
  }, [posts, activeKeywordFilter, searchQuery]);

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
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="제목 또는 키워드 검색..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setShowKeywordSuggestions(true)}
              onBlur={() => setTimeout(() => setShowKeywordSuggestions(false), 200)}
              className="pl-9"
            />
            {/* Search suggestions dropdown */}
            {showKeywordSuggestions && !searchQuery && (recentKeywords.length > 0 || popularKeywords.length > 0) && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg z-50 p-2 space-y-2">
                {recentKeywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 px-1 mb-1">
                      <Clock className="h-3 w-3" /> 최근 검색
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {recentKeywords.slice(0, 6).map(k => (
                        <button
                          key={k}
                          className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-accent transition-colors"
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
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 px-1 mb-1">
                      <TrendingUp className="h-3 w-3" /> 자주 사용
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {popularKeywords.slice(0, 8).map(k => (
                        <button
                          key={k}
                          className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-accent transition-colors"
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
          <Badge variant="secondary" className="shrink-0">{filteredPosts.length}개</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            포트폴리오 등록
          </Button>
        </div>
      </div>

      {/* Active keyword filter + popular keywords */}
      {(activeKeywordFilter || popularKeywords.length > 0) && (
        <div className="flex items-center gap-2 flex-wrap">
          <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
          {activeKeywordFilter && (
            <Badge
              className="cursor-pointer gap-1"
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
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => handleKeywordFilterClick(k)}
            >
              #{k}
            </Badge>
          ))}
        </div>
      )}

      {/* Post Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">
              {searchQuery || activeKeywordFilter ? '검색 결과가 없습니다.' : '등록된 포트폴리오가 없습니다.'}
            </p>
            {!searchQuery && !activeKeywordFilter && (
              <Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                첫 포트폴리오 등록
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filteredPosts.map(post => {
            const mainImg = getMainImage(post);
            return (
              <div
                key={post.id}
                className="group relative rounded-xl overflow-hidden border bg-card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
                onClick={() => { setSelectedPost(post); setCurrentImageIndex(0); }}
              >
                <div className="aspect-square bg-muted/30">
                  {mainImg ? (
                    <img src={mainImg.thumbnail_url || mainImg.image_url || ''} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm truncate">{post.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <ImageIcon className="h-3 w-3" />{post.images.length}
                    </span>
                    {post.keywords.length > 0 && (
                      <span className="text-xs text-muted-foreground truncate">
                        {post.keywords.slice(0, 2).map(k => `#${k}`).join(' ')}
                        {post.keywords.length > 2 && ` +${post.keywords.length - 2}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
      <Dialog open={!!selectedPost} onOpenChange={open => { if (!open) setSelectedPost(null); }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background">
          {selectedPost && (
            <div>
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="font-semibold text-lg">{selectedPost.title}</h3>
                  {selectedPost.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPost.keywords.map(k => (
                        <Badge key={k} variant="outline" className="text-xs cursor-pointer" onClick={() => {
                          handleKeywordFilterClick(k);
                          setSelectedPost(null);
                        }}>#{k}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{currentImageIndex + 1} / {selectedPost.images.length}</Badge>
                  <Button
                    variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                    onClick={() => { if (confirm('이 포트폴리오를 삭제하시겠습니까?')) deleteMutation.mutate(selectedPost.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="relative flex items-center justify-center bg-muted/20" style={{ minHeight: '60vh' }}>
                {selectedPost.images.length > 0 && (
                  <img
                    src={selectedPost.images[currentImageIndex]?.image_url || selectedPost.images[currentImageIndex]?.thumbnail_url || ''}
                    alt={selectedPost.images[currentImageIndex]?.file_name}
                    className="max-w-full max-h-[65vh] object-contain"
                  />
                )}
                {selectedPost.images.length > 1 && (
                  <>
                    <button
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                      onClick={() => setCurrentImageIndex(i => (i - 1 + selectedPost.images.length) % selectedPost.images.length)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
                      onClick={() => setCurrentImageIndex(i => (i + 1) % selectedPost.images.length)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
              {selectedPost.images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto border-t">
                  {selectedPost.images.map((img, i) => (
                    <button
                      key={img.id}
                      className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                        i === currentImageIndex ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'
                      }`}
                      onClick={() => setCurrentImageIndex(i)}
                    >
                      <img src={img.thumbnail_url || img.image_url || ''} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioGallery;
