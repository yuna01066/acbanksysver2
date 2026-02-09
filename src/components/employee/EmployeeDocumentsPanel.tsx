import React, { useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FileText, Upload, Download, Trash2, Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useDocumentBox, useEmployeeDocuments, type DocumentCategory, type EmployeeDocument } from '@/hooks/useDocumentBox';

interface EmployeeDocumentsPanelProps {
  userId: string;
  isAdmin?: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const EmployeeDocumentsPanel: React.FC<EmployeeDocumentsPanelProps> = ({ userId, isAdmin = false }) => {
  const { categories, loading: catLoading } = useDocumentBox();
  const { documents, loading: docLoading, uploadDocument, deleteDocument, getSignedUrl } = useEmployeeDocuments(userId);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const getDocsForCategory = (categoryId: string) =>
    documents.filter(d => d.category_id === categoryId);

  const handleUploadClick = (categoryId: string) => {
    setActiveCategoryId(categoryId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeCategoryId) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    const category = categories.find(c => c.id === activeCategoryId);
    const existingDocs = getDocsForCategory(activeCategoryId);
    if (category && !category.allow_multiple && existingDocs.length > 0) {
      toast.error('이 문서함은 파일을 하나만 업로드할 수 있습니다. 기존 파일을 삭제 후 다시 시도하세요.');
      e.target.value = '';
      return;
    }

    setUploading(activeCategoryId);
    try {
      await uploadDocument(file, activeCategoryId, userId);
      toast.success('파일이 업로드되었습니다.');
    } catch (err: any) {
      toast.error('업로드 실패: ' + err.message);
    } finally {
      setUploading(null);
      setActiveCategoryId(null);
      e.target.value = '';
    }
  };

  const handleDownload = async (doc: EmployeeDocument) => {
    try {
      const url = await getSignedUrl(doc.file_url);
      window.open(url, '_blank');
    } catch (err: any) {
      toast.error('다운로드 실패: ' + err.message);
    }
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    if (!confirm('이 파일을 삭제하시겠습니까?')) return;
    try {
      await deleteDocument(doc);
      toast.success('삭제되었습니다.');
    } catch (err: any) {
      toast.error('삭제 실패: ' + err.message);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (catLoading || docLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">등록된 문서함이 없습니다.</p>
        <p className="text-xs mt-1">관리자가 문서함을 설정하면 여기에 표시됩니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.hwp,.hwpx"
      />

      {categories.map(cat => {
        const docs = getDocsForCategory(cat.id);
        const hasDoc = docs.length > 0;

        return (
          <Card key={cat.id} className="border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasDoc ? 'bg-green-100 dark:bg-green-950/30' : 'bg-muted'}`}>
                    {hasDoc ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.is_confidential && (
                        <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-600">
                          <Lock className="h-3 w-3" /> 비밀
                        </Badge>
                      )}
                    </div>
                    {cat.description && (
                      <p className="text-xs text-muted-foreground">{cat.description}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => handleUploadClick(cat.id)}
                  disabled={uploading === cat.id || (!cat.allow_multiple && hasDoc)}
                >
                  {uploading === cat.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  업로드
                </Button>
              </div>

              {docs.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/50 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{doc.file_name}</span>
                        {doc.file_size && (
                          <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(doc.file_size)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDownload(doc)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {(!cat.is_confidential || isAdmin) && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(doc)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default EmployeeDocumentsPanel;
