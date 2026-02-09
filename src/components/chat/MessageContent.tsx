import React from 'react';

interface MessageContentProps {
  message: string;
  isMine: boolean;
}

const MessageContent: React.FC<MessageContentProps> = ({ message, isMine }) => {
  // Split message by @mentions pattern: @이름
  const parts = message.split(/(@\S+)/g);

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
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

export default MessageContent;
