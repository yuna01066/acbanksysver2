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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('로그인이 필요합니다.');
        return;
      }

      const newAttachments: Attachment[] = [];

      for (const file of Array.from(files)) {
        // 파일 크기 체크 (10MB)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name}: 파일 크기는 10MB를 초과할 수 없습니다.`);
          continue;
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('quote-attachments')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        newAttachments.push({
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type
        });
      }

      onAttachmentsChange([...attachments, ...newAttachments]);
      toast.success(`${newAttachments.length}개 파일이 업로드되었습니다.`);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('파일 업로드에 실패했습니다.');
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
            <span className="text-sm text-gray-500">({attachments.length}개)</span>
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
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? '업로드 중...' : '파일 첨부'}
            </Button>
          </div>
        )}
      </div>

      {attachments.length > 0 ? (
        <div className="space-y-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
          {attachments.map((attachment, index) => (
            <Card key={index} className="p-3 bg-white border border-blue-300 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getFileIcon(attachment.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadAttachment(attachment)}
                    className="hover:bg-blue-100"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAttachment(attachment)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
        <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-center">
          {readOnly ? '첨부된 파일이 없습니다.' : '파일을 첨부하려면 "파일 첨부" 버튼을 클릭하세요.'}
        </div>
      )}
    </div>
  );
};

export default QuoteAttachments;