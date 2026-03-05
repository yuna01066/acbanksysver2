import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, Loader2, Lock, Globe } from 'lucide-react';
import { ROLE_LABELS, type AppRole, ROLE_HIERARCHY } from '@/contexts/AuthContext';

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
  { key: '/material-orders', label: '자재 발주', description: '자재 발주 요청 및 관리' },
  { key: '/tax-invoices', label: '세금계산서', description: '세금계산서 발행 및 조회' },
  { key: '/imweb-management', label: '아임웹 관리', description: '아임웹 연동 주문/상품 관리' },
  { key: '/exhibition-management', label: '전시회 관리', description: '전시회 일정 및 상담 관리' },
  { key: '/business-dashboard', label: '경영 대시보드', description: '매출 및 경영 현황 대시보드' },
];

const ROLE_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'open', label: '전체 공개', description: '모든 직원 접근 가능' },
  { value: 'employee', label: ROLE_LABELS.employee, description: '직원 이상 (모든 역할)' },
  { value: 'manager', label: ROLE_LABELS.manager, description: '담당자 이상' },
  { value: 'moderator', label: ROLE_LABELS.moderator, description: '중간관리자 이상' },
  { value: 'admin', label: ROLE_LABELS.admin, description: '관리자만' },
];

const ROLE_COLORS: Record<string, string> = {
  admin: 'border-red-300 text-red-700 dark:text-red-400',
  moderator: 'border-blue-300 text-blue-700 dark:text-blue-400',
  manager: 'border-amber-300 text-amber-700 dark:text-amber-400',
  employee: 'border-green-300 text-green-700 dark:text-green-400',
};

const PageAccessManager: React.FC = () => {
  const [roleMap, setRoleMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('page_role_access').select('page_key, min_role');
    if (data) {
      const map: Record<string, string> = {};
      for (const row of data) map[row.page_key] = row.min_role;
      setRoleMap(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRoleChange = async (pageKey: string, value: string) => {
    setSaving(pageKey);
    try {
      if (value === 'open') {
        await supabase.from('page_role_access').delete().eq('page_key', pageKey);
        setRoleMap(prev => {
          const next = { ...prev };
          delete next[pageKey];
          return next;
        });
      } else {
        const { error } = await supabase
          .from('page_role_access')
          .upsert({ page_key: pageKey, min_role: value }, { onConflict: 'page_key' });
        if (error) throw error;
        setRoleMap(prev => ({ ...prev, [pageKey]: value }));
      }
      toast.success('권한이 변경되었습니다.');
    } catch (e: any) {
      toast.error('변경 실패: ' + (e.message || ''));
    } finally {
      setSaving(null);
    }
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
          각 페이지에 접근할 수 있는 <strong>최소 권한</strong>을 설정합니다. 설정된 권한 이상의 역할은 모두 접근할 수 있습니다.
          설정하지 않은 페이지는 <strong>전체 공개</strong>됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {MANAGED_PAGES.map(page => {
            const currentRole = roleMap[page.key];
            const isRestricted = !!currentRole;
            const isSaving = saving === page.key;

            return (
              <div
                key={page.key}
                className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
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
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${ROLE_COLORS[currentRole] || ''}`}>
                        {ROLE_LABELS[currentRole as AppRole]} 이상
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                        전체 공개
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{page.description}</p>
                </div>

                <Select
                  value={currentRole || 'open'}
                  onValueChange={(v) => handleRoleChange(page.key, v)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    {isSaving ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <SelectValue />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        <div>
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-muted-foreground text-[10px]">{opt.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default PageAccessManager;
