import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileText, Upload, Trash2, Eye, Loader2, FileImage } from 'lucide-react';
import { toast } from 'sonner';

interface RecipientDocumentUploadProps {
  recipientId: string;
  documentUrl: string | null;
  onDocumentChange: (url: string | null) => void;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function RecipientDocumentUpload({
  recipientId,
  documentUrl,
  onDocumentChange,
}: RecipientDocumentUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('PDF 또는 이미지 파일(JPG, PNG, WEBP)만 업로드 가능합니다.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error('파일 크기는 10MB 이하만 가능합니다.');
      return;
    }

    setUploading(true);
    try {
      // Delete old file if exists
      if (documentUrl) {
        await supabase.storage.from('recipient-documents').remove([documentUrl]);
      }

      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${recipientId}/business-doc.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('recipient-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Save path to recipients table
      const { error: updateError } = await supabase
        .from('recipients')
        .update({ business_document_url: filePath } as any)
        .eq('id', recipientId);

      if (updateError) throw updateError;

      onDocumentChange(filePath);
      toast.success('사업자 사본이 업로드되었습니다.');
    } catch (err) {
      console.error('업로드 에러:', err);
      toast.error('파일 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!documentUrl || !confirm('사업자 사본을 삭제하시겠습니까?')) return;

    setDeleting(true);
    try {
      await supabase.storage.from('recipient-documents').remove([documentUrl]);

      const { error } = await supabase
        .from('recipients')
        .update({ business_document_url: null } as any)
        .eq('id', recipientId);

      if (error) throw error;

      onDocumentChange(null);
      toast.success('사업자 사본이 삭제되었습니다.');
    } catch (err) {
      console.error('삭제 에러:', err);
      toast.error('파일 삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = async () => {
    if (!documentUrl) return;

    setPreviewLoading(true);
    setPreviewOpen(true);
    try {
      const { data, error } = await supabase.storage
        .from('recipient-documents')
        .createSignedUrl(documentUrl, 300); // 5 min

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (err) {
      console.error('미리보기 에러:', err);
      toast.error('파일을 불러오지 못했습니다.');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const isPdf = documentUrl?.toLowerCase().endsWith('.pdf');
  const fileName = documentUrl?.split('/').pop() || '';

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            사업자 사본
          </CardTitle>
        </CardHeader>
        <CardContent>
          {documentUrl ? (
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2 text-sm truncate">
                {isPdf ? (
                  <FileText className="w-5 h-5 text-red-500 shrink-0" />
                ) : (
                  <FileImage className="w-5 h-5 text-blue-500 shrink-0" />
                )}
                <span className="truncate">{fileName}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="outline" size="sm" onClick={handlePreview}>
                  <Eye className="w-4 h-4 mr-1" />
                  미리보기
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-destructive hover:text-destructive"
                >
                  {deleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-muted-foreground mb-3">
                사업자등록증 사본을 업로드하세요 (PDF/이미지, 최대 10MB)
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-1" />
                )}
                {uploading ? '업로드 중...' : '파일 선택'}
              </Button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              사업자 사본 미리보기
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto min-h-0">
            {previewLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl ? (
              isPdf ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] rounded border"
                  title="사업자 사본 미리보기"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="사업자 사본"
                  className="max-w-full max-h-[70vh] mx-auto rounded object-contain"
                />
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
