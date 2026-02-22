import React, { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, Trash2, Image as ImageIcon, Loader2, X, ZoomIn, Search, RefreshCw } from 'lucide-react';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  thumbnailLink: string | null;
  authImageUrl: string;
  authThumbnail: string | null;
  viewLink: string;
}

const PORTFOLIO_FOLDER = ['포트폴리오'];

const PortfolioGallery = () => {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<DriveFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Fetch portfolio images from Google Drive
  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ['portfolio-files'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('google-drive', {
        body: { action: 'list-folder-files', folderPath: PORTFOLIO_FOLDER },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to list files');
      return data.files as DriveFile[];
    },
  });

  // Upload files
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    let successCount = 0;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name}: 이미지 파일만 업로드 가능합니다.`);
          continue;
        }

        setUploadProgress(`${i + 1}/${selectedFiles.length} 업로드 중: ${file.name}`);

        // Use resumable upload for reliability
        const { data: initData, error: initError } = await supabase.functions.invoke('google-drive', {
          body: {
            action: 'init-resumable-upload',
            folderPath: PORTFOLIO_FOLDER,
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
          },
        });

        if (initError || !initData?.success) {
          toast.error(`${file.name} 업로드 세션 실패`);
          continue;
        }

        // Direct upload to Google Drive via resumable URI
        const uploadRes = await fetch(initData.uploadUri, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type,
            'Content-Length': file.size.toString(),
          },
          body: file,
        });

        if (uploadRes.ok) {
          successCount++;
        } else {
          toast.error(`${file.name} 업로드 실패`);
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount}개 이미지가 업로드되었습니다.`);
        qc.invalidateQueries({ queryKey: ['portfolio-files'] });
      }
    } catch (err: any) {
      toast.error('업로드 중 오류: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [qc]);

  // Delete file
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const { data, error } = await supabase.functions.invoke('google-drive', {
        body: { action: 'delete-file', fileId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio-files'] });
      setSelectedImage(null);
      toast.success('삭제되었습니다.');
    },
    onError: () => toast.error('삭제 실패'),
  });

  const filteredFiles = searchQuery
    ? files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이미지 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary" className="shrink-0">{files.length}개</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
            {uploading ? uploadProgress : '이미지 업로드'}
          </Button>
        </div>
      </div>

      {/* Gallery Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ImageIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">
              {searchQuery ? '검색 결과가 없습니다.' : '포트폴리오 이미지가 없습니다.'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">이미지를 업로드하여 포트폴리오를 구성하세요.</p>
            {!searchQuery && (
              <Button variant="outline" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                첫 이미지 업로드
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="group relative aspect-square rounded-xl overflow-hidden border bg-muted/30 cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
              onClick={() => setSelectedImage(file)}
            >
              <img
                src={file.authThumbnail || file.authImageUrl}
                alt={file.name}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* File name */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{file.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => { if (!open) setSelectedImage(null); }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black/95">
          {selectedImage && (
            <div className="relative">
              <div className="flex items-center justify-between p-3 bg-black/80">
                <div className="text-white">
                  <p className="text-sm font-medium truncate max-w-md">{selectedImage.name}</p>
                  <p className="text-xs text-white/60">{formatSize(selectedImage.size)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:text-red-400 hover:bg-red-500/10"
                    onClick={() => {
                      if (confirm('이 이미지를 삭제하시겠습니까?')) {
                        deleteMutation.mutate(selectedImage.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    삭제
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center max-h-[70vh] p-4">
                <img
                  src={selectedImage.authImageUrl}
                  alt={selectedImage.name}
                  className="max-w-full max-h-[65vh] object-contain rounded"
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PortfolioGallery;
