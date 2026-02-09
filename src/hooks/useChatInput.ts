import { useState, useRef, useCallback } from 'react';
import { useMentionSuggestions, MentionUser } from '@/hooks/useMentionSuggestions';
import { useProjectSuggestions, TaggableProject } from '@/hooks/useProjectSuggestions';

type DropdownMode = 'mention' | 'project' | null;

export const useChatInput = () => {
  const { filterUsers } = useMentionSuggestions();
  const { filterProjects } = useProjectSuggestions();
  const [dropdownMode, setDropdownMode] = useState<DropdownMode>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const mentionResults = dropdownMode === 'mention' ? filterUsers(query) : [];
  const projectResults = dropdownMode === 'project' ? filterProjects(query) : [];
  const hasResults = mentionResults.length > 0 || projectResults.length > 0;
  const resultCount = mentionResults.length || projectResults.length;

  const handleInputChange = useCallback((value: string, cursorPos: number) => {
    const textBeforeCursor = value.slice(0, cursorPos);

    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);
    if (mentionMatch) {
      setDropdownMode('mention');
      setQuery(mentionMatch[1]);
      setSelectedIndex(0);
      return;
    }

    const projectMatch = textBeforeCursor.match(/#([^\s]*)$/);
    if (projectMatch) {
      setDropdownMode('project');
      setQuery(projectMatch[1]);
      setSelectedIndex(0);
      return;
    }

    setDropdownMode(null);
  }, []);

  const insertTag = useCallback((text: string, triggerChar: string, message: string, setMessage: (v: string) => void) => {
    const cursorPos = inputRef.current?.selectionStart || message.length;
    const textBeforeCursor = message.slice(0, cursorPos);
    const textAfterCursor = message.slice(cursorPos);
    const regex = triggerChar === '@' ? /@([^\s]*)$/ : /#([^\s]*)$/;
    const beforeTag = textBeforeCursor.replace(regex, '');
    const tagText = text.replace(/\s+/g, '_');
    const updated = `${beforeTag}${triggerChar}${tagText} ${textAfterCursor}`;
    setMessage(updated);
    setDropdownMode(null);
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, message: string, setMessage: (v: string) => void): boolean => {
    if (dropdownMode !== null && hasResults) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % resultCount);
        return true;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + resultCount) % resultCount);
        return true;
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (dropdownMode === 'mention') {
          insertTag(mentionResults[selectedIndex].full_name, '@', message, setMessage);
        } else {
          insertTag(projectResults[selectedIndex].title, '#', message, setMessage);
        }
        return true;
      } else if (e.key === 'Escape') {
        setDropdownMode(null);
        return true;
      }
    }
    return false;
  }, [dropdownMode, hasResults, resultCount, mentionResults, projectResults, selectedIndex, insertTag]);

  const closeDropdown = useCallback(() => {
    setTimeout(() => setDropdownMode(null), 150);
  }, []);

  return {
    inputRef,
    dropdownMode,
    mentionResults,
    projectResults,
    selectedIndex,
    hasResults,
    handleInputChange,
    insertTag,
    handleKeyDown,
    closeDropdown,
  };
};
