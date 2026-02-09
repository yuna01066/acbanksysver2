import React from 'react';

interface MessageContentProps {
  message: string;
  isMine: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ message, isMine }) => {
  // Split message by @mentions and #project tags
  const parts = message.split(/([@#]\S+)/g);

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
          return (
            <span
              key={i}
              className={`font-semibold ${
                isMine
                  ? 'text-primary-foreground/90 bg-primary-foreground/10 rounded px-0.5'
                  : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 rounded px-0.5'
              }`}
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
