import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MentionUser } from '@/hooks/useMentionSuggestions';

interface MentionDropdownProps {
  users: MentionUser[];
  selectedIndex: number;
  onSelect: (user: MentionUser) => void;
}

const MentionDropdown: React.FC<MentionDropdownProps> = ({ users, selectedIndex, onSelect }) => {
  if (users.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg z-20 overflow-hidden">
      {users.map((u, i) => (
        <button
          key={u.id}
          type="button"
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
            i === selectedIndex ? 'bg-accent' : 'hover:bg-muted'
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(u);
          }}
        >
          <Avatar className="h-6 w-6 rounded-md shrink-0">
            <AvatarImage src={u.avatar_url || undefined} className="object-cover" />
            <AvatarFallback className="rounded-md bg-primary/10 text-primary text-[10px] font-semibold">
              {u.full_name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium truncate">{u.full_name}</span>
          {u.department && (
            <span className="text-xs text-muted-foreground ml-auto shrink-0">{u.department}</span>
          )}
        </button>
      ))}
    </div>
  );
};

export default MentionDropdown;
