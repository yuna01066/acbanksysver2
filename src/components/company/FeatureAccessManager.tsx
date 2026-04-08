import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Shield, Loader2, Eye, Pencil, Trash2, Users, FileText, DollarSign, BarChart3, ClipboardList, Settings } from 'lucide-react';
import { ROLE_LABELS, type AppRole } from '@/contexts/AuthContext';

interface FeatureDef {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  group: string;
}

const FEATURE_GROUPS = [
  { key: 'hr', label: '인사 관리', icon: <Users className="h-4 w-4" /> },
  { key: 'quote', label: '견적·프로젝트', icon: <FileText className="h-4 w-4" /> },
  { key: 'finance', label: '급여·계약', icon: <DollarSign className="h-4 w-4" /> },
  { key: 'review', label: '업무평가', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'system', label: '시스템 관리', icon: <Settings className="h-4 w-4" /> },
];

const MANAGED_FEATURES: FeatureDef[] = [
  // 인사 관리
  { key: 'hr.view_employee_info', label: '직원 인사정보 열람', description: '직원의 개인정보, 연락처 등 상세 정보 조회', icon: <Eye className="h-3.5 w-3.5" />, group: 'hr' },
  { key: 'hr.edit_employee_info', label: '직원 정보 수정', description: '직원 프로필 및 인사정보 수정', icon: <Pencil className="h-3.5 w-3.5" />, group: 'hr' },
  { key: 'hr.manage_attendance', label: '근태 기록 관리', description: '전체 직원 출퇴근 기록 조회 및 수정', icon: <ClipboardList className="h-3.5 w-3.5" />, group: 'hr' },
  { key: 'hr.manage_leave', label: '연차·휴가 관리', description: '직원 연차 부여, 승인/반려 처리', icon: <ClipboardList className="h-3.5 w-3.5" />, group: 'hr' },
  { key: 'hr.view_documents', label: '직원 서류함 열람', description: '직원이 제출한 서류 및 문서 조회', icon: <Eye className="h-3.5 w-3.5" />, group: 'hr' },

  // 견적·프로젝트
  { key: '/saved-quotes', label: '담은 견적서 페이지', description: '담은 견적서 목록 및 상세 페이지 접근', icon: <Eye className="h-3.5 w-3.5" />, group: 'quote' },
  { key: '/quotes-summary', label: '견적 요약 페이지', description: '견적 요약 페이지 접근', icon: <Eye className="h-3.5 w-3.5" />, group: 'quote' },
  { key: '/customer-quotes-summary', label: '고객 견적 요약 페이지', description: '고객용 견적 요약 페이지 접근', icon: <Eye className="h-3.5 w-3.5" />, group: 'quote' },
  { key: 'quote.view_all', label: '전체 견적 열람', description: '다른 직원이 작성한 견적서 조회', icon: <Eye className="h-3.5 w-3.5" />, group: 'quote' },
  { key: 'quote.edit_others', label: '타인 견적 수정', description: '다른 직원이 작성한 견적서 편집', icon: <Pencil className="h-3.5 w-3.5" />, group: 'quote' },
  { key: 'quote.delete', label: '견적 삭제', description: '저장된 견적서 삭제 권한', icon: <Trash2 className="h-3.5 w-3.5" />, group: 'quote' },
  { key: 'quote.manage_recipients', label: '수신처 관리', description: '수신처 추가, 수정, 삭제', icon: <Pencil className="h-3.5 w-3.5" />, group: 'quote' },
  { key: 'quote.manage_projects', label: '프로젝트 관리', description: '프로젝트 생성, 수정, 삭제 및 배정', icon: <Pencil className="h-3.5 w-3.5" />, group: 'quote' },

  // 급여·계약
  { key: 'finance.view_salary', label: '급여 정보 열람', description: '직원 급여, 수당 등 금액 정보 조회', icon: <Eye className="h-3.5 w-3.5" />, group: 'finance' },
  { key: 'finance.manage_contracts', label: '계약서 관리', description: '근로계약서 작성, 수정, 발송', icon: <Pencil className="h-3.5 w-3.5" />, group: 'finance' },

  // 업무평가
  { key: '/performance-review', label: '업무평가 페이지', description: '업무평가 작성 및 조회 페이지 접근', icon: <ClipboardList className="h-3.5 w-3.5" />, group: 'review' },
  { key: 'review.view_all', label: '전체 평가 열람', description: '모든 직원의 업무평가 결과 조회', icon: <Eye className="h-3.5 w-3.5" />, group: 'review' },
  { key: 'review.manage_cycles', label: '평가 주기 관리', description: '평가 주기 생성 및 관리', icon: <Settings className="h-3.5 w-3.5" />, group: 'review' },
  { key: 'review.send_results', label: '평가 결과 전달', description: '평가 결과를 직원에게 전달', icon: <FileText className="h-3.5 w-3.5" />, group: 'review' },

  // 시스템 관리
  { key: 'system.manage_announcements', label: '공지사항 관리', description: '공지사항 작성, 수정, 삭제', icon: <Pencil className="h-3.5 w-3.5" />, group: 'system' },
  { key: 'system.manage_prices', label: '단가 관리', description: '패널 단가 및 가공비 설정', icon: <DollarSign className="h-3.5 w-3.5" />, group: 'system' },
  { key: 'system.manage_users', label: '사용자 권한 관리', description: '사용자 승인, 역할 변경, 비밀번호 초기화', icon: <Shield className="h-3.5 w-3.5" />, group: 'system' },
];

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'employee', label: '전체 직원' },
  { value: 'manager', label: ROLE_LABELS.manager + ' 이상' },
  { value: 'moderator', label: ROLE_LABELS.moderator + ' 이상' },
  { value: 'admin', label: ROLE_LABELS.admin + '만' },
];

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
  moderator: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
  manager: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
  employee: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
};

const FeatureAccessManager: React.FC = () => {
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

  const handleRoleChange = async (featureKey: string, value: string) => {
    setSaving(featureKey);
    try {
      const { error } = await supabase
        .from('page_role_access')
        .upsert({ page_key: featureKey, min_role: value }, { onConflict: 'page_key' });
      if (error) throw error;
      setRoleMap(prev => ({ ...prev, [featureKey]: value }));
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
    <div className="space-y-6">
      {FEATURE_GROUPS.map(group => {
        const features = MANAGED_FEATURES.filter(f => f.group === group.key);
        if (features.length === 0) return null;

        return (
          <Card key={group.key}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                {group.icon}
                {group.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y">
                {features.map(feature => {
                  const currentRole = roleMap[feature.key] || 'admin';
                  const isSaving = saving === feature.key;

                  return (
                    <div
                      key={feature.key}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0 text-muted-foreground">
                        {feature.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{feature.label}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 font-normal ${ROLE_BADGE_STYLES[currentRole] || ''}`}>
                            {currentRole === 'employee' ? '전체' : ROLE_LABELS[currentRole as AppRole] + (currentRole === 'admin' ? '' : '↑')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{feature.description}</p>
                      </div>

                      <Select
                        value={currentRole}
                        onValueChange={(v) => handleRoleChange(feature.key, v)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          {isSaving ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
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
      })}
    </div>
  );
};

export default FeatureAccessManager;
