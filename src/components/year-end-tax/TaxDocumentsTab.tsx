import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText, Trash2, Download, File } from 'lucide-react';
import { DOCUMENT_TYPES, type TaxSettlement, type TaxDocument } from '@/hooks/useYearEndTax';
import { toast } from 'sonner';
import { openDocumentFile } from '@/services/documentFiles';

interface Props {
  settlement: TaxSettlement;
  documents: TaxDocument[];
  onUpload: (file: File, docType: string, memo?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isEditable: boolean;
}

const TaxDocumentsTab: React.FC<Props> = ({ documents, onUpload, onDelete, isEditable }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('hometax_pdf');
  const [memo, setMemo] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onUpload(file, docType, memo || undefined);
    setMemo('');
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
  };

  const getDocTypeLabel = (key: string) => DOCUMENT_TYPES.find(d => d.key === key)?.label || key;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" /> 증빙서류 업로드
        </CardTitle>
        <CardDescription>국세청 간소화 PDF 및 기타 증빙서류를 업로드하세요.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isEditable && (
          <div className="p-4 border-2 border-dashed rounded-lg space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>서류 유형</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(d => <SelectItem key={d.key} value={d.key}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>메모 (선택)</Label>
                <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 의료비 영수증 2건" />
              </div>
            </div>
            <div>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" />
              <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? '업로드 중...' : '파일 선택 및 업로드'}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">PDF, 이미지, 엑셀, 워드 파일 지원</p>
            </div>
          </div>
        )}

        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">업로드된 서류가 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center shrink-0">
                  {doc.mime_type?.includes('pdf') ? (
                    <FileText className="h-4 w-4 text-red-500" />
                  ) : (
                    <File className="h-4 w-4 text-blue-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span className="bg-muted px-1.5 py-0.5 rounded">{getDocTypeLabel(doc.document_type)}</span>
                    {doc.file_size && <span>{formatSize(doc.file_size)}</span>}
                    {doc.memo && <span>· {doc.memo}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={async () => {
                      try {
                        await openDocumentFile({
                          storageProvider: doc.file_url.startsWith('http') ? 'external_url' : 'gcs',
                          storagePath: doc.file_url,
                          externalUrl: doc.file_url.startsWith('http') ? doc.file_url : null,
                        });
                      } catch {
                        toast.error('파일 다운로드에 실패했습니다.');
                      }
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {isEditable && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(doc.id)}>
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
};

export default TaxDocumentsTab;
