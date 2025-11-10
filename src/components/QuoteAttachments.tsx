import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, X, Download, FileText, File } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface QuoteAttachmentsProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  readOnly?: boolean;
  quoteId?: string;
}

const QuoteAttachments = ({ attachments, onAttachmentsChange, readOnly = false, quoteId }: QuoteAttachmentsProps) => {
  const [uploading, setUploading] = useState(false);

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
          
          newAttachments.push({
            name: file.name,
            path: filePath,
            size: file.size,
            type: file.type
          });
          
          uploadedCount.success++;
        } catch (fileError) {
          console.error('Error uploading individual file:', file.name, fileError);
          toast.error(`${file.name}: 업로드 실패`);
          uploadedCount.failed++;
        }
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments]);
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
    try {
      const { error } = await supabase.storage
        .from('quote-attachments')
        .remove([attachment.path]);

      if (error) throw error;

      onAttachmentsChange(attachments.filter(a => a.path !== attachment.path));
      toast.success('파일이 삭제되었습니다.');
    } catch (error) {
      console.error('Error removing file:', error);
      toast.error('파일 삭제에 실패했습니다.');
    }
  };

  const handleDownloadAttachment = async (attachment: Attachment) => {
    try {
      const { data, error } = await supabase.storage
        .from('quote-attachments')
        .download(attachment.path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  return (
    <div className="space-y-4">
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
            📎 첨부된 파일 목록
          </div>
          {attachments.map((attachment, index) => (
            <Card key={index} className="p-4 bg-white border-2 border-blue-200 shadow-sm hover:shadow-md transition-all">
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
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadAttachment(attachment)}
                    className="hover:bg-blue-100 text-blue-600"
                    title="다운로드"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {!readOnly && (
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