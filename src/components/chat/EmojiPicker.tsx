import React, { useState } from 'react';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: '자주 사용', emojis: ['👍', '❤️', '😂', '🔥', '👏', '🎉', '💪', '🙏', '😊', '✅', '⭐', '💯'] },
  { label: '표정', emojis: ['😀', '😃', '😄', '😁', '😆', '🤣', '😅', '😉', '😍', '🥰', '😘', '😎', '🤔', '😢', '😭', '😤', '🤯', '😱', '🥳', '😴'] },
  { label: '제스처', emojis: ['👋', '🤝', '✌️', '🤞', '👌', '🫡', '🙌', '👊', '✊', '🫶', '💅', '🤙'] },
  { label: '사물', emojis: ['☕', '🍕', '🍺', '🎂', '🎁', '📌', '💡', '🔔', '📎', '✏️', '📝', '💻'] },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted transition-colors shrink-0"
          title="이모지"
        >
          <Smile className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" side="top" align="end">
        <div className="space-y-2 max-h-52 overflow-y-auto">
          {EMOJI_CATEGORIES.map(cat => (
            <div key={cat.label}>
              <p className="text-[10px] font-medium text-muted-foreground px-1 mb-1">{cat.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {cat.emojis.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-muted text-base transition-colors"
                    onClick={() => {
                      onSelect(emoji);
                      setOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default EmojiPicker;
