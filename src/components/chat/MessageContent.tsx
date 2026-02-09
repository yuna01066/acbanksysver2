import React from 'react';
import { useProjectSuggestions, TaggableProject } from '@/hooks/useProjectSuggestions';

interface MessageContentProps {
  message: string;
  isMine: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ message, isMine }) => {
  const { findProject } = useProjectSuggestions();

  const parts = message.split(/(#\S+|@\S+)/g);

  const handleProjectClick = (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const name = tag.slice(1); // remove #
    const project = findProject(name);
    if (!project) return;

    if (project.source === 'notion' && project.url) {
      window.open(project.url, '_blank', 'noopener');
    } else if (project.source === 'quote') {
      window.open(`/saved-quotes/${project.id}`, '_self');
    }
  };

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
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export default MessageContent;
