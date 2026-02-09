import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format, differenceInMonths, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ArrowLeft, Search, User, Building2, Briefcase, Hash, Calendar,
  Globe, MapPin, CreditCard, Clock, Award, AlertTriangle,
  GraduationCap, Heart, FileText, Wallet, CalendarDays, Pencil,
  Save, X, Loader2, Users, Phone, Mail
} from 'lucide-react';

interface EmployeeProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  is_approved: boolean;
  created_at: string;
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
}

type FieldDef = { key: string; label: string; type?: string; disabled?: boolean; multiline?: boolean };

const sectionDefs: { key: string; title: string; icon: React.ReactNode; fields: FieldDef[] }[] = [
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

const EmployeeProfileManagementPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error('관리자만 접근할 수 있습니다.');
      navigate('/');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    if (!error && data) {
      setEmployees(data.map((d: any) => ({
        id: d.id, full_name: d.full_name || '', email: d.email || '', phone: d.phone || '',
        department: d.department || '', position: d.position || '', is_approved: d.is_approved ?? false,
        created_at: d.created_at || '', employee_number: d.employee_number || '',
        birthday: d.birthday || '', address: d.address || '', detail_address: d.detail_address || '',
        zipcode: d.zipcode || '', nationality: d.nationality || '', bank_name: d.bank_name || '',
        bank_account: d.bank_account || '', join_date: d.join_date || '', job_title: d.job_title || '',
        job_group: d.job_group || '', rank_title: d.rank_title || '', rank_level: d.rank_level || '',
        nickname: d.nickname || '', personal_email: d.personal_email || '', work_type: d.work_type || '',
        work_hours_per_week: d.work_hours_per_week ?? 40, overtime_policy: d.overtime_policy || '',
        salary_info: d.salary_info || '', wage_contract: d.wage_contract || '',
        leave_policy: d.leave_policy || '', holidays: d.holidays || '', leave_history: d.leave_history || '',
        awards: d.awards || '', disciplinary: d.disciplinary || '', career_history: d.career_history || '',
        education: d.education || '', special_notes: d.special_notes || '', family_info: d.family_info || '',
      })));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && isAdmin) fetchEmployees();
  }, [user, isAdmin]);

  const filteredEmployees = employees.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return e.full_name.toLowerCase().includes(s) || e.email.toLowerCase().includes(s) ||
      e.department.toLowerCase().includes(s) || e.phone.includes(s);
  });

  const startEdit = (sectionKey: string) => {
    if (!selectedEmployee) return;
    setEditSection(sectionKey);
    setEditValues({ ...selectedEmployee });
  };

  const cancelEdit = () => {
    setEditSection(null);
    setEditValues({});
  };

  const saveSection = async () => {
    if (!selectedEmployee) return;
    setSaving(true);
    try {
      const section = sectionDefs.find(s => s.key === editSection);
      if (!section) return;
      const updates: Record<string, any> = {};
      for (const f of section.fields) {
        if (!f.disabled) {
          updates[f.key] = editValues[f.key] || null;
        }
      }
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', selectedEmployee.id);
      if (error) throw error;
      toast.success('정보가 저장되었습니다.');
      await fetchEmployees();
      // Update selectedEmployee
      const updated = { ...selectedEmployee, ...updates };
      setSelectedEmployee(updated as EmployeeProfile);
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

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  const InfoRow = ({ label, value, badge }: { label: string; value?: string; badge?: React.ReactNode }) => (
    <div className="flex items-center gap-4 py-1.5">
      <span className="text-sm text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm font-medium whitespace-pre-line">{value || <span className="text-muted-foreground/50">미입력</span>}</span>
      {badge}
    </div>
  );

  const renderSectionContent = (section: typeof sectionDefs[0], emp: EmployeeProfile) => {
    const val = (key: string) => (emp as any)[key] || '';

    // Special rendering for some sections
    if (section.key === 'join') {
      return (
        <InfoRow
          label="입사일"
          value={val('join_date') ? format(new Date(val('join_date')), 'yyyy년 M월 d일', { locale: ko }) : undefined}
          badge={getTenureBadge(val('join_date')) ? <Badge variant="default" className="text-xs">{getTenureBadge(val('join_date'))}</Badge> : undefined}
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

    // Default: render all fields as info rows
    return (
      <div className="space-y-1">
        {section.fields.map(f => (
          <InfoRow key={f.key} label={f.label} value={val(f.key)} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/admin-settings')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            관리자 설정
          </Button>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            직원 프로필 관리
          </h1>
          <p className="text-muted-foreground">직원들의 상세 프로필 정보를 조회하고 수정할 수 있습니다.</p>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="이름, 이메일, 부서로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Employee List */}
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEmployees.map(emp => (
              <Card
                key={emp.id}
                className="cursor-pointer hover:shadow-md transition-all hover:scale-[1.02]"
                onClick={() => setSelectedEmployee(emp)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                      {emp.full_name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{emp.full_name}</p>
                        {!emp.is_approved && <Badge variant="secondary" className="text-xs">미승인</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {emp.department && <Badge variant="outline" className="text-xs">{emp.department}</Badge>}
                        {emp.position && <span className="text-xs text-muted-foreground">{emp.position}</span>}
                      </div>
                    </div>
                  </div>
                  {emp.phone && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" /> {emp.phone}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && filteredEmployees.length === 0 && (
          <p className="text-center text-muted-foreground py-12">검색 결과가 없습니다.</p>
        )}

        {/* Employee Detail Dialog */}
        <Dialog open={!!selectedEmployee} onOpenChange={(open) => { if (!open) { setSelectedEmployee(null); setEditSection(null); } }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedEmployee && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-2xl font-bold text-primary">
                      {selectedEmployee.full_name?.charAt(0) || '?'}
                    </div>
                    <div>
                      <DialogTitle className="text-xl">{selectedEmployee.full_name}</DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        {selectedEmployee.department || '부서 미설정'} {selectedEmployee.position && `· ${selectedEmployee.position}`}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /> {selectedEmployee.email}
                        {selectedEmployee.phone && <><Phone className="h-3 w-3 ml-2" /> {selectedEmployee.phone}</>}
                      </div>
                    </div>
                  </div>
                </DialogHeader>

                <div className="mt-4">
                  {sectionDefs.map((section, idx) => {
                    const isEditing = editSection === section.key;
                    return (
                      <React.Fragment key={section.key}>
                        {idx > 0 && <Separator />}
                        <div className="py-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                              {section.icon}
                              {section.title}
                            </h3>
                            {!isEditing ? (
                              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => startEdit(section.key)}>
                                <Pencil className="h-3 w-3" /> 변경
                              </Button>
                            ) : (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={cancelEdit} disabled={saving}>
                                  <X className="h-3 w-3" />
                                </Button>
                                <Button size="sm" className="h-7 text-xs gap-1" onClick={saveSection} disabled={saving}>
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
                            renderSectionContent(section, selectedEmployee)
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EmployeeProfileManagementPage;
