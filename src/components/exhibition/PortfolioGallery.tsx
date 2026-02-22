import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload, Trash2, Image as ImageIcon, Loader2, Plus,
  ChevronLeft, ChevronRight, Search, RefreshCw, Eye
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface PortfolioPost {
  id: string;
  title: string;
  description: string | null;
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

const PortfolioGallery = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<PortfolioPost | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
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
        images: (imagesData || []).filter((img: any) => img.post_id === post.id),
      })) as PortfolioPost[];
    },
  });

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }
    setPendingFiles(prev => [...prev, ...imageFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }
    if (pendingFiles.length === 0) {
      toast.error('이미지를 최소 1개 추가해주세요.');
      return;
    }

    setCreating(true);
    try {
      // 1. Create post
      const { data: post, error: postError } = await supabase
        .from('portfolio_posts')
        .insert({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          created_by: user?.email || 'unknown',
        })
        .select()
        .single();
      if (postError) throw postError;

      // 2. Upload each file to Google Drive and save image records
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
      setNewDescription('');
      setPendingFiles([]);
      qc.invalidateQueries({ queryKey: ['portfolio-posts'] });
    } catch (err: any) {
      toast.error('등록 실패: ' + err.message);
    } finally {
      setCreating(false);
    }
  }, [newTitle, newDescription, pendingFiles, user, qc]);

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

  const filteredPosts = searchQuery
    ? posts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : posts;

  const getMainImage = (post: PortfolioPost) => {
    return post.images.find(i => i.is_main) || post.images[0];
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="포트폴리오 검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Badge variant="secondary" className="shrink-0">{posts.length}개</Badge>
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
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 포트폴리오가 없습니다.'}
            </p>
            {!searchQuery && (
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
                    <img
                      src={mainImg.thumbnail_url || mainImg.image_url || ''}
                      alt={post.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {/* Info */}
                <div className="p-3">
                  <p className="font-medium text-sm truncate">{post.title}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <ImageIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{post.images.length}장</span>
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
              <Label>설명</Label>
              <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="간단한 설명 (선택)" rows={2} />
            </div>
            <div>
              <Label>이미지 ({pendingFiles.length}개) *</Label>
              <p className="text-xs text-muted-foreground mb-2">첫 번째 이미지가 대표 이미지로 표시됩니다.</p>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {pendingFiles.map((file, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    {i === 0 && (
                      <Badge className="absolute top-1 left-1 text-[10px] px-1 py-0">대표</Badge>
                    )}
                    <button
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white hover:bg-red-500 transition-colors"
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
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="font-semibold text-lg">{selectedPost.title}</h3>
                  {selectedPost.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedPost.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{currentImageIndex + 1} / {selectedPost.images.length}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm('이 포트폴리오를 삭제하시겠습니까?')) {
                        deleteMutation.mutate(selectedPost.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Image viewer */}
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

              {/* Thumbnail strip */}
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
