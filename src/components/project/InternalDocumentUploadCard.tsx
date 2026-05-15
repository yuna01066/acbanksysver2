import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { gcsUploadFile, gcsDeleteFile } from '@/hooks/useGcsStorage';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Receipt, Trash2, Loader2, CheckCircle2, Eye, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { buildProjectDrivePath } from '@/utils/documentOrganization';
import { createDocumentFileRecord, updateDocumentFileRecord } from '@/services/documentFiles';

interface Props {
  projectId: string;
  projectName?: string;
  documentType: 'quote' | 'receipt';
  title: string;
}

const InternalDocumentUploadCard: React.FC<Props> = ({ projectId, projectName, documentType, title }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);

  const { data: documents = [] } = useQuery({
    queryKey: ['internal-docs', projectId, documentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_project_documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('document_type', documentType)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('파일 크기는 10MB 이하만 가능합니다.');
      return;
    }

    setUploading(true);
    try {
      // Upload to GCS as primary storage
      const typeFolder = documentType === 'quote' ? '매입견적서' : '영수증';
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const gcsPrefix = projectName
        ? buildProjectDrivePath({
            projectName,
            section: `02_발주_매입/${typeFolder}/${y}년/${m}월`,
          }).join('/')
        : `internal-project-docs/${projectId}/${documentType}`;
      const { gcsPath } = await gcsUploadFile(file, gcsPrefix);

      // Create DB record with GCS path
      const { data: doc, error: insertError } = await supabase
        .from('internal_project_documents')
        .insert({
          project_id: projectId,
          document_type: documentType,
          file_name: file.name,
          file_url: gcsPath,
          file_size: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      let documentFileId: string | null = null;
      try {
        documentFileId = await createDocumentFileRecord({
          owner_type: 'project',
          project_id: projectId,
          document_type: documentType === 'quote' ? 'purchase_quote' : documentType,
          file_name: file.name,
          storage_provider: 'gcs',
          storage_path: gcsPath,
          mime_type: file.type,
          file_size: file.size,
          drive_path: projectName ? buildProjectDrivePath({
            projectName,
            section: `02_발주_매입/${typeFolder}/${y}년/${m}월`,
          }).join('/') : null,
          uploaded_by: user.id,
          sync_status: projectName ? 'pending' : 'not_required',
          metadata: {
            source: 'internal_project_documents',
            internal_document_id: doc.id,
          },
        });
      } catch (recordError) {
        console.warn('Document file record failed:', recordError);
      }

      toast.success('파일이 업로드되었습니다. OCR 분석 중...');

      // Run OCR
      setOcrProcessing(true);
      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
        }
        const base64 = btoa(binary);

        const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('ocr-document', {
          body: { imageBase64: base64, mimeType: file.type, documentType },
        });

        if (ocrError) throw ocrError;

        if (ocrResult?.success && ocrResult.data) {
          const ocrData = ocrResult.data;
          await supabase
            .from('internal_project_documents')
            .update({
              ocr_result: ocrData,
              vendor_name: ocrData.vendor_name || null,
              vendor_phone: ocrData.vendor_phone || null,
              vendor_business_number: ocrData.vendor_business_number || null,
              purchase_date: ocrData.purchase_date || null,
              items: ocrData.items || [],
              subtotal: ocrData.subtotal || 0,
              tax: ocrData.tax || 0,
              total: ocrData.total || 0,
            })
            .eq('id', doc.id);

          toast.success('OCR 분석이 완료되었습니다.');

          // Google Drive 자동 업로드 (백업)
          if (projectName) {
            try {
              const { error: driveErr } = await supabase.functions.invoke('google-drive', {
                body: {
                  action: 'upload-document',
                  projectName,
                  folderPath: buildProjectDrivePath({
                    projectName,
                    section: `02_발주_매입/${typeFolder}/${y}년/${m}월`,
                  }),
                  documentType,
                  fileName: file.name,
                  fileBase64: base64,
                  contentType: file.type,
                  year: y.toString(),
                  month: m,
                },
              });
              if (driveErr) console.error('Drive upload error:', driveErr);
              if (driveErr) {
                await updateDocumentFileRecord(documentFileId, {
                  sync_status: 'failed',
                  sync_error: driveErr.message || 'Google Drive upload failed',
                });
              } else {
                await updateDocumentFileRecord(documentFileId, {
                  sync_status: 'synced',
                  sync_error: null,
                  synced_at: new Date().toISOString(),
                });
                toast.success('Google Drive에 자동 저장되었습니다.');
              }
            } catch (driveErr) {
              console.error('Drive upload failed:', driveErr);
              await updateDocumentFileRecord(documentFileId, {
                sync_status: 'failed',
                sync_error: driveErr instanceof Error ? driveErr.message : 'Google Drive upload failed',
              });
            }
          }
        } else {
          toast.warning('OCR 분석에 실패했습니다. 수동으로 입력해주세요.');
        }
      } catch (ocrErr) {
        console.error('OCR error:', ocrErr);
        toast.warning('OCR 분석 중 오류가 발생했습니다.');
      } finally {
        setOcrProcessing(false);
      }

      queryClient.invalidateQueries({ queryKey: ['internal-docs', projectId, documentType] });
      queryClient.invalidateQueries({ queryKey: ['internal-docs-summary', projectId] });
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error('업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deleteDoc = useMutation({
    mutationFn: async (docId: string) => {
      const doc = documents.find((d: any) => d.id === docId);
      if (doc?.file_url) {
        try { await gcsDeleteFile(doc.file_url); } catch {}
      }
      const { error } = await supabase.from('internal_project_documents').delete().eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-docs', projectId, documentType] });
      queryClient.invalidateQueries({ queryKey: ['internal-docs-summary', projectId] });
      toast.success('문서가 삭제되었습니다.');
    },
  });

  const markPaid = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from('internal_project_documents')
        .update({ is_paid: true, paid_at: new Date().toISOString() })
        .eq('id', docId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['internal-docs', projectId, documentType] });
      queryClient.invalidateQueries({ queryKey: ['internal-docs-summary', projectId] });
      toast.success('입금 완료 처리되었습니다.');
    },
  });

  const Icon = documentType === 'quote' ? FileText : Receipt;

  return (
    <div className="rounded-lg border bg-card p-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Icon className="h-3 w-3" /> {title}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 text-[10px] gap-1"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || ocrProcessing}
        >
          {uploading || ocrProcessing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Upload className="h-2.5 w-2.5" />}
          업로드
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
        />
      </div>

      {documents.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-3">
          {documentType === 'quote' ? '매입 견적서를 업로드하세요.' : '영수증을 업로드하세요.'}
        </p>
      ) : (
        <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
          {documents.map((doc: any) => (
            <div key={doc.id} className="p-2 bg-muted/30 rounded-md text-[11px] group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate font-medium">{doc.file_name}</span>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {documentType === 'quote' && !doc.is_paid && doc.total > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-emerald-600"
                      onClick={() => markPaid.mutate(doc.id)}
                      title="입금 완료"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteDoc.mutate(doc.id)}>
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
              {doc.vendor_name && (
                <p className="text-[10px] text-muted-foreground">
                  {doc.vendor_name} {doc.vendor_phone && `· ${doc.vendor_phone}`}
                </p>
              )}
              {doc.total > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold">₩{Math.round(doc.total).toLocaleString()}</span>
                  {doc.is_paid && (
                    <Badge variant="secondary" className="text-[8px] bg-emerald-50 text-emerald-700 border-emerald-200">입금완료</Badge>
                  )}
                </div>
              )}
              {doc.purchase_date && (
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {format(new Date(doc.purchase_date), 'yyyy.MM.dd', { locale: ko })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InternalDocumentUploadCard;
