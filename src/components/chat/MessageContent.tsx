import React from 'react';
import { useProjectSuggestions, TaggableProject } from '@/hooks/useProjectSuggestions';
import { ExternalLink } from 'lucide-react';

interface MessageContentProps {
  message: string;
  isMine: boolean;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

const MessageContent: React.FC<MessageContentProps> = ({ message, isMine }) => {
  const { findProject } = useProjectSuggestions();

  const handleProjectClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const name = tag.slice(1);
    const project = findProject(name);
    if (!project) return;

    if (project.source === 'notion' && project.url) {
      window.open(project.url, '_blank', 'noopener');
    } else if (project.source === 'quote') {
      window.open(`/saved-quotes/${project.id}`, '_self');
    }
  };

  // Split by @mentions, #projects, and URLs
  const parts = message.split(/(#\S+|@\S+|https?:\/\/[^\s]+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          return (
            <span
              key={i}
              className={`font-semibold ${
                isMine ? 'text-primary-foreground/90 underline underline-offset-2' : 'text-primary'
              }`}
            >
              {part}
            </span>
          );
        }
        if (part.startsWith('#')) {
          const name = part.slice(1);
          const project = findProject(name);
          const isClickable = !!project;
          return (
            <span
              key={i}
              role={isClickable ? 'link' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={isClickable ? (e) => handleProjectClick(part, e) : undefined}
              className={`font-semibold rounded px-0.5 ${
                isMine
                  ? 'text-primary-foreground/90 bg-primary-foreground/10'
                  : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30'
              } ${isClickable ? 'cursor-pointer hover:underline underline-offset-2' : ''}`}
            >
              {part}
            </span>
          );
        }
        if (part.match(URL_REGEX)) {
          // Clean trailing punctuation
          const cleanUrl = part.replace(/[).,;!?]+$/, '');
          const trailing = part.slice(cleanUrl.length);
          let displayUrl = cleanUrl;
          try {
            const urlObj = new URL(cleanUrl);
            displayUrl = urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
            if (displayUrl.length > 35) displayUrl = displayUrl.substring(0, 35) + '…';
          } catch {}
          return (
            <React.Fragment key={i}>
              <a
                href={cleanUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`inline-flex items-center gap-0.5 underline underline-offset-2 break-all ${
                  isMine
                    ? 'text-primary-foreground/90 hover:text-primary-foreground'
                    : 'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300'
                }`}
              >
                <ExternalLink className="h-3 w-3 shrink-0 inline" />
                {displayUrl}
              </a>
              {trailing}
            </React.Fragment>
          );
        }
        return <span key={i} className="whitespace-pre-line">{part}</span>;
      })}
    </>
  );
};

export default MessageContent;
