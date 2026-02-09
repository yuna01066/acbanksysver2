import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users2, MessageSquare, Search, Loader2 } from 'lucide-react';
import { useConversationList, ConversationPartner } from '@/hooks/useDirectMessages';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export type ChatTarget = 
  | { type: 'team' }
  | { type: 'dm'; partner: ConversationPartner };

interface MessengerSidebarProps {
  activeTarget: ChatTarget;
  onSelectTarget: (target: ChatTarget) => void;
}

interface EmployeeProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
}

const MessengerSidebar: React.FC<MessengerSidebarProps> = ({ activeTarget, onSelectTarget }) => {
  const { user } = useAuth();
  const { partners, loading: convLoading } = useConversationList();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'conversations' | 'contacts'>('conversations');

  useEffect(() => {
    const fetchEmployees = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, department, position')
        .eq('is_approved', true)
        .order('full_name');
      if (data) setEmployees(data.filter(e => e.id !== user?.id));
      setLoadingEmps(false);
    };
    fetchEmployees();
  }, [user]);

  const filteredPartners = partners.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const isTeamActive = activeTarget.type === 'team';
  const activeDmId = activeTarget.type === 'dm' ? activeTarget.partner.user_id : null;

  const handleEmployeeClick = (emp: EmployeeProfile) => {
    const existing = partners.find(p => p.user_id === emp.id);
    onSelectTarget({
      type: 'dm',
      partner: existing || {
        user_id: emp.id,
        full_name: emp.full_name,
        avatar_url: emp.avatar_url,
        department: emp.department,
        position: emp.position,
        unread_count: 0,
      },
    });
  };

  const totalUnread = partners.reduce((sum, p) => sum + p.unread_count, 0);

  return (
    <div className="flex flex-col h-full border-r bg-card">
      {/* Header */}
      <div className="p-3 border-b shrink-0">
        <h2 className="text-sm font-semibold text-foreground mb-2">메신저</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 검색..."
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b shrink-0">
        <button
          onClick={() => setTab('conversations')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            tab === 'conversations' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          대화 {totalUnread > 0 && <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0">{totalUnread}</Badge>}
        </button>
        <button
          onClick={() => setTab('contacts')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            tab === 'contacts' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          직원 목록
        </button>
      </div>

      <ScrollArea className="flex-1">
        {tab === 'conversations' ? (
          <div className="p-1.5 space-y-0.5">
            {/* Team Chat Entry */}
            <button
              onClick={() => onSelectTarget({ type: 'team' })}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                isTeamActive ? 'bg-accent' : 'hover:bg-muted'
              }`}
            >
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Users2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">팀 채팅</p>
                <p className="text-[11px] text-muted-foreground truncate">전체 팀 대화방</p>
              </div>
            </button>

            {/* DM Conversations */}
            {convLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredPartners.length === 0 && !search ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                아직 1:1 대화가 없습니다.<br />직원 목록에서 대화를 시작해보세요.
              </p>
            ) : (
              filteredPartners.map(p => (
                <button
                  key={p.user_id}
                  onClick={() => onSelectTarget({ type: 'dm', partner: p })}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                    activeDmId === p.user_id ? 'bg-accent' : 'hover:bg-muted'
                  }`}
                >
                  <Avatar className="h-9 w-9 rounded-lg shrink-0">
                    <AvatarImage src={p.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                      {p.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground truncate">{p.full_name}</p>
                      {p.last_message_at && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {format(new Date(p.last_message_at), 'HH:mm')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground truncate flex-1">
                        {p.last_message || p.department || '메시지 없음'}
                      </p>
                      {p.unread_count > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 ml-1 shrink-0">
                          {p.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {loadingEmps ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredEmployees.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">직원을 찾을 수 없습니다.</p>
            ) : (
              filteredEmployees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleEmployeeClick(emp)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                    activeDmId === emp.id ? 'bg-accent' : 'hover:bg-muted'
                  }`}
                >
                  <Avatar className="h-9 w-9 rounded-lg shrink-0">
                    <AvatarImage src={emp.avatar_url || undefined} className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
                      {emp.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{emp.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {emp.department || '부서 미설정'}
                      {emp.position && ` · ${emp.position}`}
                    </p>
                  </div>
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>
              ))
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default MessengerSidebar;
