import React, { useState, useEffect } from 'react';
import { FileText, Image, Download, X, Loader2 } from 'lucide-react';
import { resolveFileUrl, isGcsPath } from '@/hooks/useGcsStorage';

interface Attachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface ChatAttachmentsProps {
  attachments: Attachment[];
  isPreview?: boolean;
  onRemove?: (index: number) => void;
}

const isImageType = (type: string) =>
  type.startsWith('image/');

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
};

/** Resolves a single attachment URL (GCS path → signed URL) */
const ResolvedAttachment: React.FC<{
  att: Attachment;
  idx: number;
  isPreview?: boolean;
  onRemove?: (index: number) => void;
}> = ({ att, idx, isPreview, onRemove }) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    isGcsPath(att.url) ? null : att.url,
  );

  useEffect(() => {
    if (isGcsPath(att.url)) {
      resolveFileUrl(att.url).then(setResolvedUrl).catch(() => setResolvedUrl(null));
    }
  }, [att.url]);

  if (!resolvedUrl) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/60 text-xs border">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        <span className="truncate max-w-[120px]">{att.name}</span>
      </div>
    );
  }

  if (isImageType(att.type)) {
    return (
      <div className="relative group">
        <a href={resolvedUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
          <img
            src={resolvedUrl}
            alt={att.name}
            className="rounded-md max-w-[200px] max-h-[150px] object-cover border cursor-pointer hover:opacity-90 transition-opacity"
          />
        </a>
        {isPreview && onRemove && (
          <button
            onClick={() => onRemove(idx)}
            className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-xs"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <a
        href={resolvedUrl}
        target="_blank"
        rel="noopener noreferrer"
        download={att.name}
        onClick={e => e.stopPropagation()}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/60 hover:bg-muted transition-colors text-xs border"
      >
        <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="truncate max-w-[120px]">{att.name}</span>
        <span className="text-muted-foreground/60 shrink-0">{formatSize(att.size)}</span>
        <Download className="h-3 w-3 text-muted-foreground shrink-0" />
      </a>
      {isPreview && onRemove && (
        <button
          onClick={() => onRemove(idx)}
          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-xs"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

const ChatAttachments: React.FC<ChatAttachmentsProps> = ({ attachments, isPreview, onRemove }) => {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${isPreview ? 'mt-1' : 'mt-1'}`}>
      {attachments.map((att, idx) => (
        <ResolvedAttachment
          key={idx}
          att={att}
          idx={idx}
          isPreview={isPreview}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

export default ChatAttachments;