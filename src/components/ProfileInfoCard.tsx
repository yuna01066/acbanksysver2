import React, { useState, useEffect } from 'react';
import AvatarUpload from '@/components/employee/AvatarUpload';
import LaborLawPanel from '@/components/employee/LaborLawPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  User, Mail, Phone, MapPin, Building2, Briefcase,
  Calendar, CreditCard, Globe, Hash, Pencil, Save, X, Loader2,
  Clock, Award, AlertTriangle, GraduationCap, Heart, FileText, Wallet, CalendarDays, Calculator
} from 'lucide-react';

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  employee_number: string;
  birthday: string;
  address: string;
  detail_address: string;
  zipcode: string;
  nationality: string;
  bank_name: string;
  bank_account: string;
  join_date: string;
  job_title: string;
  job_group: string;
  rank_title: string;
  rank_level: string;
  nickname: string;
  personal_email: string;
  work_type: string;
  work_hours_per_week: number;
  overtime_policy: string;
  salary_info: string;
  wage_contract: string;
  leave_policy: string;
  holidays: string;
  leave_history: string;
  awards: string;
  disciplinary: string;
  career_history: string;
  education: string;
  special_notes: string;
  family_info: string;
  avatar_url: string;
}

const defaultProfile: ProfileData = {
  full_name: '', email: '', phone: '', department: '', position: '',
  employee_number: '', birthday: '', address: '', detail_address: '', zipcode: '',
  nationality: '대한민국(KOR)', bank_name: '', bank_account: '', join_date: '',
  job_title: '', job_group: '', rank_title: '', rank_level: '', nickname: '', personal_email: '',
  work_type: '', work_hours_per_week: 40, overtime_policy: '', salary_info: '',
  wage_contract: '', leave_policy: '', holidays: '', leave_history: '',
  awards: '', disciplinary: '', career_history: '', education: '',
  special_notes: '', family_info: '', avatar_url: '',
};

type FieldDef = { key: string; label: string; type?: string; disabled?: boolean; multiline?: boolean };

interface SectionDef {
  key: string;
  title: string;
  icon: React.ReactNode;
  fields: FieldDef[];
}

const allSections: SectionDef[] = [
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
  { key: 'work', title: '근무 정보', icon: <Clock className="h-4 w-4" />, fields: [
    { key: 'work_type', label: '근무 유형' }, { key: 'work_hours_per_week', label: '주당 근무시간', type: 'number' },
  ]},
  { key: 'overtime', title: '초과 근무 보상', icon: <Clock className="h-4 w-4" />, fields: [
    { key: 'overtime_policy', label: '보상 정책', multiline: true },
  ]},
  { key: 'wage', title: '임금 계약 정보', icon: <Wallet className="h-4 w-4" />, fields: [
    { key: 'wage_contract', label: '임금 계약', multiline: true },
  ]},
  { key: 'salary', title: '급여 지급 정보', icon: <Wallet className="h-4 w-4" />, fields: [
    { key: 'salary_info', label: '급여 지급', multiline: true },
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

const ProfileInfoCard = () => {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<ProfileData>(defaultProfile);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFullProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      const d = data as any;
      const mapped: ProfileData = {
        ...defaultProfile,
        full_name: d.full_name || '',
        email: d.email || '',
        phone: d.phone || '',
        department: d.department || '',
        position: d.position || '',
        employee_number: d.employee_number || '',
        birthday: d.birthday || '',
        address: d.address || '',
        detail_address: d.detail_address || '',
        zipcode: d.zipcode || '',
        nationality: d.nationality || '대한민국(KOR)',
        bank_name: d.bank_name || '',
        bank_account: d.bank_account || '',
        join_date: d.join_date || '',
        job_title: d.job_title || '',
        job_group: d.job_group || '',
        rank_title: d.rank_title || '',
        rank_level: d.rank_level || '',
        nickname: d.nickname || '',
        personal_email: d.personal_email || '',
        work_type: d.work_type || '',
        work_hours_per_week: d.work_hours_per_week ?? 40,
        overtime_policy: d.overtime_policy || '',
        salary_info: d.salary_info || '',
        wage_contract: d.wage_contract || '',
        leave_policy: d.leave_policy || '',
        holidays: d.holidays || '',
        leave_history: d.leave_history || '',
        awards: d.awards || '',
        disciplinary: d.disciplinary || '',
        career_history: d.career_history || '',
        education: d.education || '',
        special_notes: d.special_notes || '',
        family_info: d.family_info || '',
        avatar_url: d.avatar_url || '',
      };
      setProfileData(mapped);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFullProfile();
  }, [user]);

  const startEdit = () => {
    if (!profileData) return;
    setEditValues({ ...profileData });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValues(defaultProfile);
  };

  const handleSave = async () => {
    if (!user || !profileData) return;
    setSaving(true);
    try {
      // Only send changed fields to avoid overwriting with empty strings
      const updates: Record<string, any> = {};
      for (const section of allSections) {
        for (const f of section.fields) {
          if (f.disabled) continue; // skip email
          const newVal = (editValues as any)[f.key];
          const oldVal = (profileData as any)[f.key];
          // Include field if it changed (compare as strings for consistency)
          if (String(newVal ?? '') !== String(oldVal ?? '')) {
            updates[f.key] = newVal || null;
          }
        }
      }

      if (Object.keys(updates).length === 0) {
        toast.info('변경된 내용이 없습니다.');
        setIsEditing(false);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;
      toast.success('프로필이 저장되었습니다.');
      await fetchFullProfile();
      setIsEditing(false);
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const getTenureBadge = () => {
    if (!profileData?.join_date) return null;
    const joinDate = new Date(profileData.join_date);
    const now = new Date();
    const months = differenceInMonths(now, joinDate);
    const days = differenceInDays(now, joinDate) - months * 30;
    if (months > 0) return `${months}개월 ${days > 0 ? days + '일' : ''} 재직`;
    return `${differenceInDays(now, joinDate)}일 재직`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!profileData) return null;

  const InfoRow = ({ label, value, badge }: { label: string; value?: string; badge?: React.ReactNode }) => (
    <div className="flex items-center gap-4 py-1.5">
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm font-medium whitespace-pre-line">{value || <span className="text-muted-foreground/50">미입력</span>}</span>
      {badge}
    </div>
  );

  const renderViewContent = (section: SectionDef) => {
    const val = (key: string) => (profileData as any)[key] || '';

    if (section.key === 'join') {
      return (
        <InfoRow
          label="입사일"
          value={val('join_date') ? format(new Date(val('join_date')), 'yyyy년 M월 d일', { locale: ko }) : undefined}
          badge={getTenureBadge() ? <Badge variant="default" className="text-xs">{getTenureBadge()}</Badge> : undefined}
        />
      );
    }
    if (section.key === 'personal') {
      return (
        <div className="space-y-1">
          <InfoRow label="생일" value={val('birthday') ? format(new Date(val('birthday')), 'yyyy년 M월 d일', { locale: ko }) : undefined} />
          <InfoRow label="국적" value={val('nationality')} />
          <InfoRow label="휴대전화" value={val('phone')} />
        </div>
      );
    }
    if (section.key === 'address') {
      return (
        <div className="space-y-1">
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
        <div className="space-y-1">
          <InfoRow label="근무 유형" value={val('work_type')} />
          <InfoRow label="주당 근무시간" value={val('work_hours_per_week') ? `주 ${val('work_hours_per_week')}시간` : undefined} />
        </div>
      );
    }
    // Default: render all fields
    return (
      <div className="space-y-1">
        {section.fields.map(f => (
          <InfoRow key={f.key} label={f.label} value={val(f.key)} />
        ))}
      </div>
    );
  };

  const renderEditFields = (section: SectionDef) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {section.fields.map(f => (
        <div key={f.key} className={f.multiline ? 'md:col-span-2' : ''}>
          <Label className="text-xs text-muted-foreground">{f.label}</Label>
          {f.multiline ? (
            <Textarea
              value={(editValues as any)[f.key] || ''}
              onChange={(e) => setEditValues({ ...editValues, [f.key]: e.target.value })}
              rows={3}
              className="text-sm mt-1 resize-none"
            />
          ) : (
            <Input
              type={f.type || 'text'}
              value={(editValues as any)[f.key] || ''}
              onChange={(e) => setEditValues({ ...editValues, [f.key]: e.target.value })}
              disabled={f.disabled}
              className="h-9 text-sm mt-1"
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderSection = (section: SectionDef) => (
    <div key={section.key} className="py-4">
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
        {section.icon}
        {section.title}
      </h3>
      {isEditing ? renderEditFields(section) : renderViewContent(section)}
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <AvatarUpload
              userId={user!.id}
              avatarUrl={profileData.avatar_url || null}
              name={profileData.full_name}
              size="lg"
              editable
              onUploaded={(url) => setProfileData({ ...profileData, avatar_url: url })}
            />
            <div>
              <CardTitle className="text-xl">{profileData.full_name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {profileData.department || '부서 미설정'} {profileData.position && `· ${profileData.position}`}
              </p>
            </div>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={startEdit}>
              <Pencil className="h-3.5 w-3.5" />
              수정
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
                <X className="h-4 w-4 mr-1" /> 취소
              </Button>
              <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                저장
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        {allSections.map((section, i) => (
          <React.Fragment key={section.key}>
            {i > 0 && <Separator />}
            {renderSection(section)}
          </React.Fragment>
        ))}

        {/* 근로기준법 */}
        <Separator />
        <div className="py-4">
          <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 mb-3">
            <Calculator className="h-4 w-4" />
            근로기준법 적용
          </h3>
          <LaborLawPanel
            joinDate={profileData.join_date}
            weeklyWorkHours={profileData.work_hours_per_week}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileInfoCard;
