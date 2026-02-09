import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Shield, Users, ChevronDown, Loader2, Lock, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageDef {
  key: string;
  label: string;
  description: string;
}

const MANAGED_PAGES: PageDef[] = [
  { key: '/saved-quotes', label: '견적 내역', description: '저장된 견적서 목록 조회' },
  { key: '/quotes-summary', label: '견적 현황', description: '전체 견적 현황 요약' },
  { key: '/customer-quotes-summary', label: '고객 견적 현황', description: '고객별 견적 요약' },
  { key: '/recipients', label: '수신처 관리', description: '수신처 목록 및 정보 관리' },
  { key: '/project-management', label: '프로젝트 관리', description: '프로젝트 진행 상황 관리' },
  { key: '/attendance', label: '근태 관리', description: '출퇴근 기록 관리' },
  { key: '/leave-management', label: '연차·휴가 관리', description: '연차 및 휴가 신청/관리' },
  { key: '/performance-review', label: '업무평가', description: '업무평가 작성 및 조회' },
  { key: '/announcements', label: '공지사항', description: '회사 공지사항 관리' },
  { key: '/team-chat', label: '팀 채팅', description: '사내 메신저 및 팀 채팅' },
];

interface Profile {
  id: string;
  full_name: string;
  department: string | null;
  avatar_url: string | null;
}

const PageAccessManager: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profilesRes, permsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, department, avatar_url').eq('is_approved', true).order('full_name'),
      supabase.from('page_access_permissions').select('page_key, user_id'),
    ]);

    if (profilesRes.data) setProfiles(profilesRes.data);

    if (permsRes.data) {
      const map: Record<string, string[]> = {};
      for (const p of permsRes.data) {
        if (!map[p.page_key]) map[p.page_key] = [];
        map[p.page_key].push(p.user_id);
      }
      setPermissions(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleUser = async (pageKey: string, userId: string) => {
    setSaving(pageKey);
    const current = permissions[pageKey] || [];
    const hasAccess = current.includes(userId);

    try {
      if (hasAccess) {
        const { error } = await supabase
          .from('page_access_permissions')
          .delete()
          .eq('page_key', pageKey)
          .eq('user_id', userId);
        if (error) throw error;
        setPermissions(prev => ({
          ...prev,
          [pageKey]: (prev[pageKey] || []).filter(id => id !== userId),
        }));
      } else {
        const { error } = await supabase
          .from('page_access_permissions')
          .insert({ page_key: pageKey, user_id: userId });
        if (error) throw error;
        setPermissions(prev => ({
          ...prev,
          [pageKey]: [...(prev[pageKey] || []), userId],
        }));
      }
    } catch (e: any) {
      toast.error('권한 변경 실패: ' + (e.message || ''));
    } finally {
      setSaving(null);
    }
  };

  const clearPagePermissions = async (pageKey: string) => {
    setSaving(pageKey);
    try {
      const { error } = await supabase
        .from('page_access_permissions')
        .delete()
        .eq('page_key', pageKey);
      if (error) throw error;
      setPermissions(prev => {
        const next = { ...prev };
        delete next[pageKey];
        return next;
      });
      toast.success('전체 공개로 변경되었습니다.');
    } catch (e: any) {
      toast.error('변경 실패: ' + (e.message || ''));
    } finally {
      setSaving(null);
    }
  };

  const getAssignedNames = (pageKey: string): string[] => {
    const userIds = permissions[pageKey] || [];
    return userIds.map(uid => {
      const p = profiles.find(pr => pr.id === uid);
      return p?.full_name || '알 수 없음';
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-primary" />
          페이지 접근 권한 관리
        </CardTitle>
        <CardDescription>
          각 페이지에 접근할 수 있는 직원을 설정합니다. 직원이 지정되지 않은 페이지는 <strong>전체 공개</strong>됩니다.
          관리자 및 중간관리자는 모든 페이지에 접근할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {MANAGED_PAGES.map(page => {
            const assigned = permissions[page.key] || [];
            const assignedNames = getAssignedNames(page.key);
            const isRestricted = assigned.length > 0;
            const isSaving = saving === page.key;

            return (
              <div
                key={page.key}
                className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: isRestricted ? 'hsl(var(--primary) / 0.1)' : 'hsl(var(--muted))' }}
                >
                  {isRestricted ? (
                    <Lock className="h-4 w-4 text-primary" />
                  ) : (
                    <Globe className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{page.label}</span>
                    {isRestricted ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                        제한됨 · {assigned.length}명
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        전체 공개
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{page.description}</p>

                  {assignedNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {assignedNames.map((name, i) => (
                        <Badge key={i} variant="secondary" className="text-xs py-0 h-5">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {isRestricted && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-muted-foreground"
                      onClick={() => clearPagePermissions(page.key)}
                      disabled={isSaving}
                    >
                      전체 공개
                    </Button>
                  )}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" disabled={isSaving}>
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                        직원 선택
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0" align="end">
                      <Command>
                        <CommandInput placeholder="이름으로 검색..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>검색 결과 없음</CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="max-h-60">
                              {profiles.map(profile => {
                                const isChecked = assigned.includes(profile.id);
                                return (
                                  <CommandItem
                                    key={profile.id}
                                    value={profile.full_name}
                                    onSelect={() => toggleUser(page.key, profile.id)}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Checkbox checked={isChecked} className="pointer-events-none" />
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm">{profile.full_name}</span>
                                      {profile.department && (
                                        <span className="text-xs text-muted-foreground ml-1.5">
                                          {profile.department}
                                        </span>
                                      )}
                                    </div>
                                  </CommandItem>
                                );
                              })}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PageAccessManager;
