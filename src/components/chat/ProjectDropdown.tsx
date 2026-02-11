import React from 'react';
import { FileText, BookOpen, FolderKanban } from 'lucide-react';
import { TaggableProject } from '@/hooks/useProjectSuggestions';

interface ProjectDropdownProps {
  projects: TaggableProject[];
  selectedIndex: number;
  onSelect: (project: TaggableProject) => void;
}

const SOURCE_CONFIG = {
  project: { icon: FolderKanban, label: '프로젝트', color: 'text-emerald-500' },
  quote: { icon: FileText, label: '견적서', color: 'text-blue-500' },
  notion: { icon: BookOpen, label: 'Notion', color: 'text-purple-500' },
} as const;

const ProjectDropdown: React.FC<ProjectDropdownProps> = ({ projects, selectedIndex, onSelect }) => {
  if (projects.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border rounded-lg shadow-lg z-20 overflow-hidden max-h-52 overflow-y-auto">
      <div className="px-3 py-1.5 border-b">
        <span className="text-[10px] font-medium text-muted-foreground">프로젝트 / 견적서 태그</span>
      </div>
      {projects.map((p, i) => {
        const config = SOURCE_CONFIG[p.source];
        const Icon = config.icon;
        return (
          <button
            key={`${p.source}-${p.id}`}
            type="button"
            className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
              i === selectedIndex ? 'bg-accent' : 'hover:bg-muted'
            }`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(p);
            }}
          >
            <Icon className={`h-3.5 w-3.5 ${config.color} shrink-0`} />
            <span className="font-medium truncate">{p.title}</span>
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {config.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ProjectDropdown;
