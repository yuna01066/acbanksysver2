import React, { useState } from 'react';
import AvatarUpload from './AvatarUpload';
import LaborLawPanel from './LaborLawPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  User, Building2, Briefcase, Hash, Calendar, Globe, MapPin,
  CreditCard, Clock, Award, AlertTriangle, GraduationCap,
  Heart, FileText, Wallet, CalendarDays, Pencil, Save, X, Loader2,
  Mail, Phone
} from 'lucide-react';
import type { EmployeeProfile } from './EmployeeListSidebar';

type FieldDef = { key: string; label: string; type?: string; disabled?: boolean; multiline?: boolean };

interface SectionDef {
  key: string;
  title: string;
  icon: React.ReactNode;
  fields: FieldDef[];
}

const personnelSections: SectionDef[] = [
  { key: 'org', title: '조직 · 직책', icon: <Building2 className="h-4 w-4" />, fields: [
    { key: 'department', label: '조직 (부서)' }, { key: 'position', label: '직책' },
  ]},
  { key: 'job', title: '직무 · 직군', icon: <Briefcase className="h-4 w-4" />, fields: [
    { key: 'job_title', label: '직무' }, { key: 'job_group', label: '직군' },
  ]},
  { key: 'rank', title: '직위 · 직급', icon: <Hash className="h-4 w-4" />, fields: [
    { key: 'rank_title', label: '직위' }, { key: 'rank_level', label: '직급' },
  ]},
  { key: 'basic', title: '기본 정보', icon: <User className="h-4 w-4" />, fields: [
    { key: 'full_name', label: '이름' }, { key: 'nickname', label: '닉네임' },
    { key: 'email', label: '이메일', disabled: true }, { key: 'personal_email', label: '개인 이메일' },
    { key: 'employee_number', label: '사번' },
  ]},
  { key: 'join', title: '입사 정보', icon: <Calendar className="h-4 w-4" />, fields: [
    { key: 'join_date', label: '입사일', type: 'date' },
  ]},
  { key: 'personal', title: '개인 정보', icon: <Globe className="h-4 w-4" />, fields: [
    { key: 'birthday', label: '생일', type: 'date' }, { key: 'nationality', label: '국적' },
    { key: 'phone', label: '휴대전화번호' },
  ]},
  { key: 'address', title: '주소', icon: <MapPin className="h-4 w-4" />, fields: [
    { key: 'address', label: '주소' }, { key: 'detail_address', label: '상세주소' },
    { key: 'zipcode', label: '우편번호' },
  ]},
  { key: 'bank', title: '급여계좌', icon: <CreditCard className="h-4 w-4" />, fields: [
    { key: 'bank_name', label: '은행명' }, { key: 'bank_account', label: '계좌번호' },
  ]},
];

const workSections: SectionDef[] = [
  { key: 'work', title: '근무 정보', icon: <Clock className="h-4 w-4" />, fields: [
    { key: 'work_type', label: '근무 유형' }, { key: 'work_hours_per_week', label: '주당 근무시간', type: 'number' },
  ]},
  { key: 'overtime', title: '초과 근무 보상', icon: <Clock className="h-4 w-4" />, fields: [
    { key: 'overtime_policy', label: '보상 정책', multiline: true },
  ]},
  { key: 'leave', title: '휴가 정보', icon: <CalendarDays className="h-4 w-4" />, fields: [
    { key: 'leave_policy', label: '연차 정책', multiline: true },
  ]},
  { key: 'holidays', title: '쉬는 날', icon: <CalendarDays className="h-4 w-4" />, fields: [
    { key: 'holidays', label: '쉬는 날', multiline: true },
  ]},
  { key: 'leave_history', title: '휴직 이력', icon: <FileText className="h-4 w-4" />, fields: [
    { key: 'leave_history', label: '휴직 이력', multiline: true },
  ]},
];

const salarySections: SectionDef[] = [
  { key: 'wage', title: '임금 계약 정보', icon: <Wallet className="h-4 w-4" />, fields: [
    { key: 'wage_contract', label: '임금 계약', multiline: true },
  ]},
  { key: 'salary', title: '급여 지급 정보', icon: <Wallet className="h-4 w-4" />, fields: [
    { key: 'salary_info', label: '급여 지급', multiline: true },
  ]},
];

const etcSections: SectionDef[] = [
  { key: 'awards', title: '수상', icon: <Award className="h-4 w-4" />, fields: [
    { key: 'awards', label: '수상', multiline: true },
  ]},
  { key: 'disciplinary', title: '징계', icon: <AlertTriangle className="h-4 w-4" />, fields: [
    { key: 'disciplinary', label: '징계', multiline: true },
  ]},
  { key: 'career', title: '경력 정보', icon: <Briefcase className="h-4 w-4" />, fields: [
    { key: 'career_history', label: '경력', multiline: true },
  ]},
  { key: 'education', title: '학력', icon: <GraduationCap className="h-4 w-4" />, fields: [
    { key: 'education', label: '학력', multiline: true },
  ]},
  { key: 'special', title: '특이사항', icon: <FileText className="h-4 w-4" />, fields: [
    { key: 'special_notes', label: '특이사항', multiline: true },
  ]},
  { key: 'family', title: '가족', icon: <Heart className="h-4 w-4" />, fields: [
    { key: 'family_info', label: '가족', multiline: true },
  ]},
];

interface EmployeeProfileDetailProps {
  employee: EmployeeProfile;
  onUpdated: (updated: EmployeeProfile) => void;
}

const EmployeeProfileDetail: React.FC<EmployeeProfileDetailProps> = ({ employee, onUpdated }) => {
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const startEdit = (sectionKey: string) => {
    setEditSection(sectionKey);
    setEditValues({ ...employee });
  };

  const cancelEdit = () => {
    setEditSection(null);
    setEditValues({});
  };

  const saveSection = async (section: SectionDef) => {
    setSaving(true);
    try {
      const updates: Record<string, any> = {};
      for (const f of section.fields) {
        if (!f.disabled) {
          updates[f.key] = editValues[f.key] || null;
        }
      }
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', employee.id);
      if (error) throw error;
      toast.success('정보가 저장되었습니다.');
      onUpdated({ ...employee, ...updates });
      setEditSection(null);
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const getTenureBadge = (joinDate: string) => {
    if (!joinDate) return null;
    const jd = new Date(joinDate);
    const now = new Date();
    const months = differenceInMonths(now, jd);
    const days = differenceInDays(now, jd) - months * 30;
    if (months > 0) return `${months}개월 ${days > 0 ? days + '일' : ''} 재직`;
    return `${differenceInDays(now, jd)}일 재직`;
  };

  const InfoRow = ({ label, value, badge }: { label: string; value?: string; badge?: React.ReactNode }) => (
    <div className="flex items-start gap-4 py-2">
      <span className="text-sm text-muted-foreground w-28 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium whitespace-pre-line flex-1">
        {value || <span className="text-muted-foreground/40">미입력</span>}
      </span>
      {badge}
    </div>
  );

  const renderSectionContent = (section: SectionDef) => {
    const val = (key: string) => (employee as any)[key] || '';

    if (section.key === 'join') {
      return (
        <InfoRow
          label="입사일"
          value={val('join_date') ? format(new Date(val('join_date')), 'yyyy년 M월 d일', { locale: ko }) : undefined}
          badge={getTenureBadge(val('join_date')) ? <Badge variant="default" className="text-xs shrink-0">{getTenureBadge(val('join_date'))}</Badge> : undefined}
        />
      );
    }
    if (section.key === 'personal') {
      return (
        <div className="space-y-0">
          <InfoRow label="생일" value={val('birthday') ? format(new Date(val('birthday')), 'yyyy년 M월 d일', { locale: ko }) : undefined} />
          <InfoRow label="국적" value={val('nationality')} />
          <InfoRow label="휴대전화" value={val('phone')} />
        </div>
      );
    }
    if (section.key === 'address') {
      return (
        <div className="space-y-0">
          <InfoRow label="주소" value={[val('address'), val('detail_address')].filter(Boolean).join(' ') || undefined} />
          {val('zipcode') && <InfoRow label="우편번호" value={val('zipcode')} />}
        </div>
      );
    }
    if (section.key === 'bank') {
      return <InfoRow label="계좌" value={val('bank_name') && val('bank_account') ? `${val('bank_name')} ${val('bank_account')}` : undefined} />;
    }
    if (section.key === 'work') {
      return (
        <div className="space-y-0">
          <InfoRow label="근무 유형" value={val('work_type')} />
          <InfoRow label="주당 근무시간" value={val('work_hours_per_week') ? `주 ${val('work_hours_per_week')}시간` : undefined} />
        </div>
      );
    }

    return (
      <div className="space-y-0">
        {section.fields.map(f => (
          <InfoRow key={f.key} label={f.label} value={val(f.key)} />
        ))}
      </div>
    );
  };

  const renderSection = (section: SectionDef) => {
    const isEditing = editSection === section.key;
    return (
      <div key={section.key} className="py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            {section.icon}
            {section.title}
          </h3>
          {!isEditing ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={() => startEdit(section.key)}>
              <Pencil className="h-3 w-3" /> 수정
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>
                <X className="h-3 w-3" />
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => saveSection(section)} disabled={saving}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                저장
              </Button>
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {section.fields.map(f => (
              <div key={f.key} className={f.multiline ? 'md:col-span-2' : ''}>
                <Label className="text-xs text-muted-foreground">{f.label}</Label>
                {f.multiline ? (
                  <Textarea
                    value={editValues[f.key] || ''}
                    onChange={(e) => setEditValues({ ...editValues, [f.key]: e.target.value })}
                    rows={3}
                    className="text-sm mt-1 resize-none"
                  />
                ) : (
                  <Input
                    type={f.type || 'text'}
                    value={editValues[f.key] || ''}
                    onChange={(e) => setEditValues({ ...editValues, [f.key]: e.target.value })}
                    disabled={f.disabled}
                    className="h-9 text-sm mt-1"
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          renderSectionContent(section)
        )}
      </div>
    );
  };

  const renderSections = (sections: SectionDef[]) => (
    <div className="divide-y">
      {sections.map(s => renderSection(s))}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full min-w-0">
      {/* Profile Header */}
      <div className="p-6 border-b bg-card">
        <div className="flex items-start gap-4">
          <AvatarUpload
            userId={employee.id}
            avatarUrl={employee.avatar_url || null}
            name={employee.full_name}
            size="lg"
            editable
            onUploaded={(url) => onUpdated({ ...employee, avatar_url: url })}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-bold truncate">{employee.full_name}</h1>
              {!employee.is_approved && (
                <Badge variant="outline" className="text-xs border-amber-300 text-amber-600">미승인</Badge>
              )}
              {employee.join_date && getTenureBadge(employee.join_date) && (
                <Badge variant="secondary" className="text-xs">{getTenureBadge(employee.join_date)}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {employee.department || '부서 미설정'}
              {employee.position && ` · ${employee.position}`}
              {employee.rank_title && ` · ${employee.rank_title}`}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{employee.email}</span>
              {employee.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{employee.phone}</span>}
              {employee.employee_number && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />사번 {employee.employee_number}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="personnel" className="flex-1 flex flex-col min-h-0">
        <div className="border-b px-6">
          <TabsList className="bg-transparent h-10 p-0 gap-0">
            <TabsTrigger value="personnel" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
              인사 정보
            </TabsTrigger>
            <TabsTrigger value="work" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
              근무 · 휴가
            </TabsTrigger>
            <TabsTrigger value="salary" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
              급여 · 계약
            </TabsTrigger>
            <TabsTrigger value="etc" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
              기타 정보
            </TabsTrigger>
            <TabsTrigger value="labor" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4 text-sm">
              근로기준법
            </TabsTrigger>
          </TabsList>
        </div>
        <ScrollArea className="flex-1">
          <div className="px-6 pb-6">
            <TabsContent value="personnel" className="mt-0">
              {renderSections(personnelSections)}
            </TabsContent>
            <TabsContent value="work" className="mt-0">
              {renderSections(workSections)}
            </TabsContent>
            <TabsContent value="salary" className="mt-0">
              {renderSections(salarySections)}
            </TabsContent>
            <TabsContent value="etc" className="mt-0">
              {renderSections(etcSections)}
            </TabsContent>
            <TabsContent value="labor" className="mt-0">
              <LaborLawPanel
                joinDate={employee.join_date}
                weeklyWorkHours={employee.work_hours_per_week}
                isAdmin
              />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
};

export default EmployeeProfileDetail;
