import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileText, File, RotateCcw } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildIssuedQuoteDrivePath, toDrivePathText } from '@/utils/documentOrganization';
import {
  createDocumentFileRecord,
  deleteStoredFile,
  getAttachmentTarget,
  getDownloadUrl,
  removeDocumentFileRecord,
  updateDocumentFileRecord,
  type DocumentSyncStatus,
} from '@/services/documentFiles';

interface DriveSyncResult {
  success: boolean;
  fileId?: string;
  folderId?: string;
  error?: string;
}

// Google Drive에 파일을 동기화하는 헬퍼 함수
async function syncFileToGoogleDrive(
  file: globalThis.File,
  folderPath: string[],
): Promise<DriveSyncResult> {
  try {
    // 1. Init resumable upload session via edge function
    const { data: sessionData, error: sessionError } = await supabase.functions.invoke('google-drive', {
      body: {
        action: 'init-resumable-upload',
        folderPath,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
      }
    });

    if (sessionError || !sessionData?.uploadUri) {
      console.error('Google Drive session init failed:', sessionError || sessionData);
      return { success: false, error: sessionError?.message || sessionData?.error || 'Drive upload session init failed' };
    }

    // 2. Client-side direct upload to Google Drive
    const uploadRes = await fetch(sessionData.uploadUri, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Content-Length': file.size.toString(),
      },
      body: file,
    });

    if (!uploadRes.ok) {
      const message = await uploadRes.text();
      console.error('Google Drive upload failed:', message);
      return { success: false, folderId: sessionData.folderId, error: message };
    }

    const uploaded = await uploadRes.json().catch(() => null);
    console.log(`Google Drive sync successful: ${toDrivePathText(folderPath)}/${file.name}`);
    return {
      success: true,
      fileId: uploaded?.id,
      folderId: sessionData.folderId,
    };
  } catch (error) {
    console.error('Google Drive sync error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown Drive sync error' };
  }
}

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
  documentFileId?: string | null;
  storageProvider?: 'supabase_storage' | 'gcs' | 'google_drive' | 'external_url';
  storageBucket?: string;
  storagePath?: string;
  driveFileId?: string | null;
  driveFolderId?: string | null;
  syncStatus?: DocumentSyncStatus;
  pendingDelete?: boolean;
}

export interface QuotePdfAttachment {
  name: string;
  path: string;
  size: number;
  url: string;
  uploadedAt: string;
  type?: string;
  documentFileId?: string | null;
  storageProvider?: 'supabase_storage' | 'gcs' | 'google_drive' | 'external_url';
  storageBucket?: string;
  storagePath?: string;
  driveFileId?: string | null;
  driveFolderId?: string | null;
  syncStatus?: DocumentSyncStatus;
  pendingDelete?: boolean;
}

interface QuoteAttachmentsProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  readOnly?: boolean;
  quoteId?: string;
  projectId?: string | null;
  quoteNumber?: string;
  recipientCompany?: string;
  projectName?: string;
  // 견적서 PDF 관련 props
  quotePdf?: QuotePdfAttachment | null;
  onQuotePdfChange?: (pdf: QuotePdfAttachment | null) => void;
  showQuotePdfSection?: boolean;
}

const QuoteAttachments = ({ 
  attachments, 
  onAttachmentsChange, 
  readOnly = false, 
  quoteId,
  projectId,
  quoteNumber,
  recipientCompany,
  projectName,
  quotePdf,
  onQuotePdfChange,
  showQuotePdfSection = false
}: QuoteAttachmentsProps) => {
  const [uploading, setUploading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  useEffect(() => {
    if (readOnly || quoteId || attachments.length === 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [attachments.length, quoteId, readOnly]);

  const buildSavedAttachments = (
    clientAttachments: Attachment[],
    pdf: QuotePdfAttachment | null = quotePdf,
  ) => [
    ...(pdf && !pdf.pendingDelete ? [{ ...pdf, type: 'quote_pdf' }] : []),
    ...clientAttachments
      .filter((attachment) => attachment.type !== 'quote_pdf' && !attachment.pendingDelete)
      .map(({ pendingDelete, ...attachment }) => attachment),
  ];

  const persistQuoteAttachments = async (
    clientAttachments: Attachment[],
    pdf: QuotePdfAttachment | null = quotePdf,
  ) => {
    if (!quoteId) return;
    const { error } = await supabase
      .from('saved_quotes')
      .update({ attachments: buildSavedAttachments(clientAttachments, pdf) as any })
      .eq('id', quoteId);
    if (error) throw error;
  };

  const markDriveSyncResult = async (
    documentFileId: string | null,
    result: DriveSyncResult,
  ) => {
    if (!documentFileId) return;
    await updateDocumentFileRecord(documentFileId, {
      sync_status: result.success ? 'synced' : 'failed',
      sync_error: result.success ? null : result.error || 'Google Drive sync failed',
      synced_at: result.success ? new Date().toISOString() : null,
      drive_file_id: result.fileId || null,
      drive_folder_id: result.folderId || null,
    });
  };

  const rollbackUploadedAttachments = async (items: Attachment[]) => {
    await Promise.allSettled(
      items.map(async (item) => {
        await deleteStoredFile(getAttachmentTarget(item, 'quote-attachments'));
        await removeDocumentFileRecord(item.documentFileId);
      })
    );
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedCount = { success: 0, failed: 0 };
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        toast.error('인증 오류가 발생했습니다. 다시 로그인해주세요.');
        return;
      }
      
      if (!user) {
        toast.error('로그인이 필요합니다.');
        return;
      }

      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'application/zip',
        'application/x-zip-compressed',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      const newAttachments: Attachment[] = [];

      for (const file of Array.from(files)) {
        try {
          // 파일 형식 체크
          if (!allowedTypes.includes(file.type)) {
            toast.error(`${file.name}: 지원하지 않는 파일 형식입니다.`);
            uploadedCount.failed++;
            continue;
          }

          // 파일 크기 체크 (10MB)
          if (file.size > 10 * 1024 * 1024) {
            toast.error(`${file.name}: 파일 크기는 10MB를 초과할 수 없습니다.`);
            uploadedCount.failed++;
            continue;
          }

          const fileExt = file.name.split('.').pop();
          const timestamp = Date.now();
          const random = Math.random().toString(36).substring(2, 9);
          const fileName = `${timestamp}-${random}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          console.log('Uploading file:', { name: file.name, path: filePath, size: file.size, type: file.type });

          const { data, error: uploadError } = await supabase.storage
            .from('quote-attachments')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error for', file.name, ':', uploadError);
            toast.error(`${file.name}: ${uploadError.message}`);
            uploadedCount.failed++;
            continue;
          }

          console.log('Upload successful:', data);

          const driveFolderPath = quoteNumber ? buildIssuedQuoteDrivePath({
            quoteNumber,
            recipientCompany,
            projectName,
            section: '01_고객첨부',
          }) : null;
          const initialSyncStatus: DocumentSyncStatus = driveFolderPath ? 'pending' : 'not_required';
          let documentFileId: string | null = null;
          let driveFileId: string | null = null;
          let driveFolderId: string | null = null;
          let syncStatus: DocumentSyncStatus = initialSyncStatus;

          if (quoteId) {
            try {
              documentFileId = await createDocumentFileRecord({
                owner_type: 'quote',
                quote_id: quoteId,
                project_id: projectId || null,
                document_type: 'customer_attachment',
                file_name: file.name,
                storage_provider: 'supabase_storage',
                storage_bucket: 'quote-attachments',
                storage_path: filePath,
                mime_type: file.type || 'application/octet-stream',
                file_size: file.size,
                drive_path: driveFolderPath ? toDrivePathText(driveFolderPath) : null,
                uploaded_by: user.id,
                sync_status: initialSyncStatus,
                metadata: {
                  source: 'QuoteAttachments',
                  quoteNumber: quoteNumber || null,
                  originalPath: filePath,
                },
              });
            } catch (recordError) {
              console.error('Document file record failed:', recordError);
              await supabase.storage.from('quote-attachments').remove([filePath]);
              toast.error(`${file.name}: 파일 원장 기록 실패`);
              uploadedCount.failed++;
              continue;
            }
          }

          // Google Drive 동기화 (quoteNumber가 있으면)
          if (driveFolderPath) {
            const driveResult = await syncFileToGoogleDrive(file, driveFolderPath);
            driveFileId = driveResult.fileId || null;
            driveFolderId = driveResult.folderId || null;
            syncStatus = driveResult.success ? 'synced' : 'failed';
            try {
              await markDriveSyncResult(documentFileId, driveResult);
            } catch (syncRecordError) {
              console.error('Drive sync status update failed:', syncRecordError);
            }
            if (driveResult.success) {
              console.log(`Google Drive sync OK: ${file.name}`);
            } else {
              toast.warning(`${file.name}: Drive 동기화 실패, 파일은 저장되었습니다.`);
            }
          }
          
          newAttachments.push({
            name: file.name,
            path: filePath,
            size: file.size,
            type: file.type,
            documentFileId,
            storageProvider: 'supabase_storage',
            storageBucket: 'quote-attachments',
            storagePath: filePath,
            driveFileId,
            driveFolderId,
            syncStatus,
          });
          
          uploadedCount.success++;
        } catch (fileError) {
          console.error('Error uploading individual file:', file.name, fileError);
          toast.error(`${file.name}: 업로드 실패`);
          uploadedCount.failed++;
        }
      }

      if (newAttachments.length > 0) {
        const nextAttachments = [...attachments.filter((a) => a.type !== 'quote_pdf'), ...newAttachments];
        try {
          await persistQuoteAttachments(nextAttachments);
        } catch (persistError) {
          if (quoteId) await rollbackUploadedAttachments(newAttachments);
          throw persistError;
        }
        onAttachmentsChange(nextAttachments);
      }

      // 결과 메시지
      if (uploadedCount.success > 0 && uploadedCount.failed === 0) {
        toast.success(`${uploadedCount.success}개 파일이 업로드되었습니다.`);
      } else if (uploadedCount.success > 0 && uploadedCount.failed > 0) {
        toast.warning(`${uploadedCount.success}개 성공, ${uploadedCount.failed}개 실패`);
      } else if (uploadedCount.failed > 0) {
        toast.error(`모든 파일 업로드에 실패했습니다.`);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error(`파일 업로드 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = async (attachment: Attachment) => {
    if (quoteId) {
      const nextAttachments = attachments.map((item) =>
        item.path === attachment.path ? { ...item, pendingDelete: true } : item
      );
      onAttachmentsChange(nextAttachments);
      toast.info('저장 버튼을 누르면 파일이 삭제됩니다.');
      return;
    }

    try {
      await deleteStoredFile(getAttachmentTarget(attachment, 'quote-attachments'));
      await removeDocumentFileRecord(attachment.documentFileId);

      onAttachmentsChange(attachments.filter(a => a.path !== attachment.path));
      toast.success('파일이 삭제되었습니다.');
    } catch (error) {
      console.error('Error removing file:', error);
      toast.error('파일 삭제에 실패했습니다.');
    }
  };

  const handleRestoreAttachment = (attachment: Attachment) => {
    onAttachmentsChange(
      attachments.map((item) =>
        item.path === attachment.path ? { ...item, pendingDelete: false } : item
      )
    );
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    if (attachment.pendingDelete) return;
    try {
      const url = await getDownloadUrl(getAttachmentTarget(attachment, 'quote-attachments'));

      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('파일 다운로드에 실패했습니다.');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  // 견적서 PDF 업로드 핸들러
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('PDF 파일만 업로드할 수 있습니다.');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error('파일 크기는 20MB를 초과할 수 없습니다.');
      return;
    }

    setUploadingPdf(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        toast.error('로그인이 필요합니다.');
        return;
      }

      // 견적번호 기반 경로로 저장 (수정 시 덮어쓰기 가능)
      const safeQuoteNumber = quoteNumber || `temp-${Date.now()}`;
      const fileRevision = quoteId ? `-${Date.now()}-${Math.random().toString(36).substring(2, 7)}` : '';
      const fileName = `${safeQuoteNumber}${fileRevision}.pdf`;
      const filePath = `${user.id}/${safeQuoteNumber}/${fileName}`;

      // 신규 견적 작성 중에는 기존 파일을 바로 지워도 DB 참조가 없습니다.
      // 저장된 견적에서는 새 PDF가 DB에 반영된 뒤 이전 파일을 정리합니다.
      if (quotePdf?.path && !quoteId) {
        try {
          await supabase.storage
            .from('quote-pdfs')
            .remove([quotePdf.path]);
          console.log('기존 PDF 삭제됨:', quotePdf.path);
        } catch (removeError) {
          console.warn('기존 PDF 삭제 실패 (무시):', removeError);
        }
      }

      // quote-pdfs 버킷에 업로드 (public bucket)
      const { data, error: uploadError } = await supabase.storage
        .from('quote-pdfs')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('PDF upload error:', uploadError);
        toast.error(`업로드 실패: ${uploadError.message}`);
        return;
      }

      // Public URL 생성
      const { data: urlData } = supabase.storage
        .from('quote-pdfs')
        .getPublicUrl(filePath);

      const driveFolderPath = quoteNumber ? buildIssuedQuoteDrivePath({
        quoteNumber: safeQuoteNumber,
        recipientCompany,
        projectName,
        section: '00_견적서PDF',
      }) : null;
      const initialSyncStatus: DocumentSyncStatus = driveFolderPath ? 'pending' : 'not_required';
      let documentFileId: string | null = null;
      let driveFileId: string | null = null;
      let driveFolderId: string | null = null;
      let syncStatus: DocumentSyncStatus = initialSyncStatus;

      if (quoteId) {
        try {
          documentFileId = await createDocumentFileRecord({
            owner_type: 'quote',
            quote_id: quoteId,
            project_id: projectId || null,
            document_type: 'quote_pdf',
            file_name: file.name,
            storage_provider: 'supabase_storage',
            storage_bucket: 'quote-pdfs',
            storage_path: filePath,
            mime_type: file.type || 'application/pdf',
            file_size: file.size,
            drive_path: driveFolderPath ? toDrivePathText(driveFolderPath) : null,
            uploaded_by: user.id,
            sync_status: initialSyncStatus,
            metadata: {
              source: 'QuoteAttachments',
              quoteNumber: safeQuoteNumber,
              originalPath: filePath,
            },
          });
        } catch (recordError) {
          console.error('PDF document file record failed:', recordError);
          await supabase.storage.from('quote-pdfs').remove([filePath]);
          toast.error('PDF 파일 원장 기록에 실패했습니다.');
          return;
        }
      }

      const pdfData: QuotePdfAttachment = {
        name: file.name,
        path: filePath,
        size: file.size,
        url: urlData.publicUrl,
        uploadedAt: new Date().toISOString(),
        type: 'quote_pdf',
        documentFileId,
        storageProvider: 'supabase_storage',
        storageBucket: 'quote-pdfs',
        storagePath: filePath,
        driveFileId,
        driveFolderId,
        syncStatus,
      };

      // Google Drive 동기화
      if (driveFolderPath) {
        const driveResult = await syncFileToGoogleDrive(file, driveFolderPath);
        driveFileId = driveResult.fileId || null;
        driveFolderId = driveResult.folderId || null;
        syncStatus = driveResult.success ? 'synced' : 'failed';
        pdfData.driveFileId = driveFileId;
        pdfData.driveFolderId = driveFolderId;
        pdfData.syncStatus = syncStatus;
        try {
          await markDriveSyncResult(documentFileId, driveResult);
        } catch (syncRecordError) {
          console.error('PDF Drive sync status update failed:', syncRecordError);
        }
        if (driveResult.success) {
          console.log('PDF Google Drive sync OK');
        } else {
          toast.warning('PDF Drive 동기화 실패, 파일은 저장되었습니다.');
        }
      }

      if (quoteId) {
        const previousPdf = quotePdf;
        try {
          await persistQuoteAttachments(attachments as Attachment[], pdfData);
        } catch (persistError) {
          await deleteStoredFile(getAttachmentTarget(pdfData, 'quote-pdfs'));
          await removeDocumentFileRecord(documentFileId);
          throw persistError;
        }
        if (previousPdf?.path && previousPdf.path !== pdfData.path) {
          try {
            await deleteStoredFile(getAttachmentTarget(previousPdf, 'quote-pdfs'));
          } catch (cleanupError) {
            console.warn('Old PDF storage cleanup failed:', cleanupError);
          }
        }
        if (previousPdf?.documentFileId && previousPdf.documentFileId !== documentFileId) {
          try {
            await removeDocumentFileRecord(previousPdf.documentFileId);
          } catch (cleanupError) {
            console.warn('Old PDF ledger cleanup failed:', cleanupError);
          }
        }
      }

      onQuotePdfChange?.(pdfData);
      toast.success(quoteId ? '견적서 PDF가 업로드되고 파일 원장에 기록되었습니다.' : '견적서 PDF가 업로드되었습니다. 저장 버튼을 눌러 변경사항을 저장하세요.');
    } catch (error) {
      console.error('Error uploading PDF:', error);
      toast.error('PDF 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingPdf(false);
      event.target.value = '';
    }
  };

  // 견적서 PDF 삭제 핸들러
  const handleRemovePdf = async () => {
    if (!quotePdf) return;

    if (quoteId) {
      onQuotePdfChange?.({ ...quotePdf, pendingDelete: true });
      toast.info('저장 버튼을 누르면 PDF가 삭제됩니다.');
      return;
    }

    try {
      await deleteStoredFile(getAttachmentTarget(quotePdf, 'quote-pdfs'));
      await removeDocumentFileRecord(quotePdf.documentFileId);

      onQuotePdfChange?.(null);
      toast.success('견적서 PDF가 삭제되었습니다.');
    } catch (error) {
      console.error('Error removing PDF:', error);
      toast.error('PDF 삭제에 실패했습니다.');
    }
  };

  const handleRestorePdf = () => {
    if (!quotePdf) return;
    onQuotePdfChange?.({ ...quotePdf, pendingDelete: false });
  };

  return (
    <div className="space-y-4">
      {/* 견적서 PDF 섹션 */}
      {showQuotePdfSection && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              견적서 PDF
              <span className="text-xs text-gray-500 font-normal ml-2">
                (Pluuug 동기화 시 링크 포함)
              </span>
            </h4>
            {!readOnly && !quotePdf && (
              <div>
                <input
                  type="file"
                  id="pdf-upload"
                  onChange={handlePdfUpload}
                  className="hidden"
                  accept=".pdf"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('pdf-upload')?.click()}
                  disabled={uploadingPdf}
                  className="border-red-300 hover:bg-red-50 text-red-600"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadingPdf ? '업로드 중...' : 'PDF 업로드'}
                </Button>
              </div>
            )}
          </div>

          {quotePdf ? (
            <Card className={`p-4 border-2 shadow-sm ${
              quotePdf.pendingDelete
                ? 'bg-red-50 border-red-300 opacity-70'
                : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="bg-red-100 p-2 rounded-lg">
                    <FileText className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {quotePdf.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(quotePdf.size)}
                      {quotePdf.pendingDelete ? ' • 저장 시 삭제 예정' : ' • Pluuug 동기화 시 링크 포함됨'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!quotePdf.pendingDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          const url = await getDownloadUrl(getAttachmentTarget(quotePdf, 'quote-pdfs'));
                          window.open(url, '_blank', 'noopener,noreferrer');
                        } catch {
                          toast.error('PDF 다운로드에 실패했습니다.');
                        }
                      }}
                      className="hover:bg-red-100 text-red-600"
                      title="다운로드"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  {!readOnly && quotePdf.pendingDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRestorePdf}
                      className="text-slate-600 hover:bg-white"
                      title="삭제 취소"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  ) : !readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePdf}
                      className="text-red-600 hover:text-red-700 hover:bg-red-100"
                      title="삭제"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <div className="text-sm text-gray-500 p-4 bg-red-50/50 rounded-lg border-2 border-dashed border-red-200 text-center">
              <FileText className="w-6 h-6 mx-auto mb-2 text-red-300" />
              <p className="text-gray-600">
                {readOnly 
                  ? '업로드된 견적서 PDF가 없습니다.' 
                  : '브라우저에서 "PDF 출력" 후 저장한 파일을 업로드하세요.'}
              </p>
              {!readOnly && (
                <p className="text-xs text-gray-400 mt-1">
                  Pluuug 동기화 시 자동으로 다운로드 링크가 포함됩니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {showQuotePdfSection && <div className="border-t border-gray-200 pt-4" />}

      {/* 기존 클라이언트 첨부 파일 섹션 */}
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-slate-800 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          클라이언트 첨부 파일
          {attachments.length > 0 && (
            <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
              {attachments.length}개
            </span>
          )}
        </h4>
        {!readOnly && (
          <div>
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.zip,.xls,.xlsx,.doc,.docx"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={uploading}
              className="border-blue-300 hover:bg-blue-50"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? '업로드 중...' : '파일 첨부'}
            </Button>
          </div>
        )}
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-3 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="text-sm text-blue-700 font-medium mb-2">
            첨부된 파일 목록
          </div>
          {attachments.map((attachment, index) => (
            <Card
              key={index}
              className={`p-4 bg-white border-2 shadow-sm transition-all ${
                attachment.pendingDelete
                  ? 'border-red-200 opacity-70'
                  : 'border-blue-200 hover:shadow-md'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="bg-blue-100 p-2 rounded-lg">
                    {getFileIcon(attachment.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      파일 크기: {formatFileSize(attachment.size)}
                      {attachment.pendingDelete && ' • 저장 시 삭제 예정'}
                      {attachment.syncStatus === 'failed' && ' • Drive 동기화 실패'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!attachment.pendingDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadAttachment(attachment)}
                      className="hover:bg-blue-100 text-blue-600"
                      title="다운로드"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                  {!readOnly && attachment.pendingDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestoreAttachment(attachment)}
                      className="text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                      title="삭제 취소"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  ) : !readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(attachment)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="삭제"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="font-medium text-gray-700">
            {readOnly ? '첨부된 파일이 없습니다.' : '파일을 첨부하려면 "파일 첨부" 버튼을 클릭하세요.'}
          </p>
          {!readOnly && (
            <p className="text-xs text-gray-500 mt-1">
              PDF, 이미지, 문서 파일 등을 첨부할 수 있습니다 (최대 10MB)
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default QuoteAttachments;
