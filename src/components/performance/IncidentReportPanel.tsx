import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle, Plus, FileText, Loader2, Trash2, Pencil, Send, Eye,
  Paperclip, Download, X, Clock, CheckCircle2, UserPlus, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { gcsUploadFile, resolveFileUrl } from '@/hooks/useGcsStorage';

interface IncidentReport {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  incident_date: string;
  incident_time: string | null;
  incident_subject: string | null;
  incident_location: string | null;
  description: string;
  cause_analysis: string | null;
  prevention_measures: string | null;
  status: string;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_at: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  attachments: any[];
  cycle_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ReportForm {
  title: string;
  incident_subject: string;
  incident_date: string;
  incident_time: string;
  incident_location: string;
  cause_analysis: string;
  description: string;
  prevention_measures: string;
}

const emptyForm: ReportForm = {
  title: '',
  incident_subject: '',
  incident_date: new Date().toISOString().split('T')[0],
  incident_time: '',
  incident_location: '',
  cause_analysis: '',
  description: '',
  prevention_measures: '',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  draft: { label: '임시저장', icon: <Clock className="h-3 w-3" />, className: 'bg-muted text-muted-foreground' },
  requested: { label: '작성 요청', icon: <AlertTriangle className="h-3 w-3" />, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  submitted: { label: '제출 완료', icon: <Send className="h-3 w-3" />, className: 'bg-primary/10 text-primary' },
  reviewed: { label: '검토 완료', icon: <CheckCircle2 className="h-3 w-3" />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

interface IncidentReportPanelProps {
  isAdminView?: boolean;
}

const IncidentReportPanel: React.FC<IncidentReportPanelProps> = ({ isAdminView = false }) => {
  const { user, profile, isAdmin, isModerator } = useAuth();
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReportForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IncidentReport | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewReport, setViewReport] = useState<IncidentReport | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);

  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; full_name: string; department: string }[]>([]);
  const [requestTargetId, setRequestTargetId] = useState('');
  const [requestTitle, setRequestTitle] = useState('');
  const [requesting, setRequesting] = useState(false);

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<IncidentReport | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const canManage = isAdmin || isModerator;

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let query = supabase.from('incident_reports').select('*').order('created_at', { ascending: false });
    if (!isAdminView) {
      query = query.eq('user_id', user.id);
    }
    const { data } = await query;
    if (data) setReports(data as IncidentReport[]);
    setLoading(false);
  }, [user, isAdminView]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  useEffect(() => {
    if (isAdminView && canManage) {
      supabase.from('profiles').select('id, full_name, department').eq('is_approved', true).order('full_name')
        .then(({ data }) => { if (data) setEmployees(data as any[]); });
    }
  }, [isAdminView, canManage]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFiles([]);
    setExistingAttachments([]);
    setDialogOpen(true);
  };

  const openEdit = (r: IncidentReport) => {
    setEditingId(r.id);
    setForm({
      title: r.title,
      incident_subject: (r as any).incident_subject || '',
      incident_date: r.incident_date,
      incident_time: (r as any).incident_time || '',
      incident_location: (r as any).incident_location || '',
      cause_analysis: r.cause_analysis || '',
      description: r.description,
      prevention_measures: r.prevention_measures || '',
    });
    setFiles([]);
    setExistingAttachments(r.attachments || []);
    setDialogOpen(true);
  };

  const uploadFiles = async (reportId: string): Promise<any[]> => {
    const uploaded: any[] = [];
    for (const file of files) {
      try {
        const prefix = `incident-attachments/${user!.id}/${reportId}`;
        const { gcsPath } = await gcsUploadFile(file, prefix);
        uploaded.push({ name: file.name, path: gcsPath, size: file.size, type: file.type });
      } catch (err) {
        console.error('File upload error:', err);
      }
    }
    return uploaded;
  };

  const handleSave = async (asSubmit = false) => {
    if (!form.incident_subject.trim()) { toast.error('사고 대상자를 입력해주세요.'); return; }
    if (!form.description.trim()) { toast.error('사고 경위를 입력해주세요.'); return; }
    setSaving(true);
    try {
      let newAttachments = [...existingAttachments];
      // Auto-generate title from subject + date
      const autoTitle = `${form.incident_subject.trim()} - ${form.incident_date}`;

      if (editingId) {
        if (files.length > 0) {
          const uploaded = await uploadFiles(editingId);
          newAttachments = [...newAttachments, ...uploaded];
        }
        const { error } = await supabase.from('incident_reports').update({
          title: autoTitle,
          incident_date: form.incident_date,
          incident_subject: form.incident_subject.trim(),
          incident_time: form.incident_time.trim() || null,
          incident_location: form.incident_location.trim() || null,
          description: form.description.trim(),
          cause_analysis: form.cause_analysis.trim() || null,
          prevention_measures: form.prevention_measures.trim() || null,
          attachments: newAttachments,
          status: asSubmit ? 'submitted' : undefined,
          submitted_at: asSubmit ? new Date().toISOString() : undefined,
        } as any).eq('id', editingId);
        if (error) throw error;
        toast.success(asSubmit ? '경위서가 제출되었습니다.' : '경위서가 저장되었습니다.');
      } else {
        const tempId = crypto.randomUUID();
        if (files.length > 0) {
          const uploaded = await uploadFiles(tempId);
          newAttachments = [...newAttachments, ...uploaded];
        }
        const { error } = await supabase.from('incident_reports').insert({
          user_id: user!.id,
          user_name: profile?.full_name || user!.email,
          title: autoTitle,
          incident_date: form.incident_date,
          incident_subject: form.incident_subject.trim(),
          incident_time: form.incident_time.trim() || null,
          incident_location: form.incident_location.trim() || null,
          description: form.description.trim(),
          cause_analysis: form.cause_analysis.trim() || null,
          prevention_measures: form.prevention_measures.trim() || null,
          attachments: newAttachments,
          status: asSubmit ? 'submitted' : 'draft',
          submitted_at: asSubmit ? new Date().toISOString() : null,
        } as any);
        if (error) throw error;
        toast.success(asSubmit ? '경위서가 제출되었습니다.' : '임시저장되었습니다.');
      }
      setDialogOpen(false);
      fetchReports();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('incident_reports').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('경위서가 삭제되었습니다.');
      setDeleteTarget(null);
      fetchReports();
    } catch (e: any) {
      toast.error('삭제 실패: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => ALLOWED_TYPES.includes(f.type) && f.size <= 10 * 1024 * 1024);
    if (valid.length !== selected.length) toast.error('일부 파일이 형식 또는 크기 제한(10MB)으로 제외되었습니다.');
    setFiles(prev => [...prev, ...valid]);
  };

  const removeExistingAttachment = (index: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const downloadAttachment = async (attachment: any) => {
    try {
      const url = await resolveFileUrl(attachment.path);
      if (url) window.open(url, '_blank');
      else toast.error('파일 다운로드에 실패했습니다.');
    } catch {
      toast.error('파일 다운로드에 실패했습니다.');
    }
  };

  const handleRequest = async () => {
    if (!requestTargetId || !requestTitle.trim()) { toast.error('대상자와 제목을 입력해주세요.'); return; }
    setRequesting(true);
    try {
      const target = employees.find(e => e.id === requestTargetId);
      const { error } = await supabase.from('incident_reports').insert({
        user_id: requestTargetId,
        user_name: target?.full_name || '',
        title: requestTitle.trim(),
        incident_date: new Date().toISOString().split('T')[0],
        description: '',
        status: 'requested',
        requested_by: user!.id,
        requested_by_name: profile?.full_name || '',
        requested_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: requestTargetId, type: 'system',
        title: '사고 경위서 작성 요청',
        description: `"${requestTitle.trim()}" 경위서 작성이 요청되었습니다.`, data: {},
      });
      toast.success('경위서 작성을 요청했습니다.');
      setRequestDialogOpen(false);
      setRequestTargetId('');
      setRequestTitle('');
      fetchReports();
    } catch (e: any) {
      toast.error('요청 실패: ' + e.message);
    } finally {
      setRequesting(false);
    }
  };

  const handleReview = async () => {
    if (!reviewTarget) return;
    setReviewing(true);
    try {
      const { error } = await supabase.from('incident_reports').update({
        status: 'reviewed',
        reviewed_by: user!.id,
        reviewed_by_name: profile?.full_name || '',
        reviewed_at: new Date().toISOString(),
        review_comment: reviewComment.trim() || null,
      } as any).eq('id', reviewTarget.id);
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: reviewTarget.user_id, type: 'system',
        title: '경위서 검토 완료',
        description: `"${reviewTarget.title}" 경위서가 검토 완료되었습니다.`, data: {},
      });
      toast.success('검토 완료 처리되었습니다.');
      setReviewDialogOpen(false);
      setReviewTarget(null);
      setReviewComment('');
      fetchReports();
    } catch (e: any) {
      toast.error('검토 실패: ' + e.message);
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            사고 경위서
          </h3>
          <p className="text-sm text-muted-foreground">
            {isAdminView ? '전 직원의 경위서를 관리하고 검토합니다.' : '사고 경위를 작성하고 제출합니다.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdminView && canManage && (
            <Button variant="outline" onClick={() => setRequestDialogOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" /> 작성 요청
            </Button>
          )}
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" /> 경위서 작성
          </Button>
        </div>
      </div>

      {/* Report list */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">경위서가 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.draft;
            const canEdit = r.user_id === user?.id && (r.status === 'draft' || r.status === 'requested');
            const canDelete = r.user_id === user?.id && r.status === 'draft';
            const canReview = canManage && r.status === 'submitted';

            return (
              <Card key={r.id} className={`transition-all ${r.status === 'requested' && r.user_id === user?.id ? 'border-orange-300 dark:border-orange-700' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge className={`text-xs border-0 gap-1 ${statusCfg.className}`}>
                          {statusCfg.icon}{statusCfg.label}
                        </Badge>
                        {isAdminView && (
                          <Badge variant="outline" className="text-xs">작성: {r.user_name}</Badge>
                        )}
                        {r.incident_subject && (
                          <Badge variant="secondary" className="text-xs">대상: {r.incident_subject}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(r.incident_date), 'yyyy.MM.dd', { locale: ko })}
                          {r.incident_time && ` ${r.incident_time}`}
                        </span>
                        {r.incident_location && (
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-3 w-3" />{r.incident_location}
                          </span>
                        )}
                        {r.attachments && r.attachments.length > 0 && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Paperclip className="h-3 w-3" />{r.attachments.length}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium text-sm">{r.cause_analysis || r.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {r.description || '(내용 없음)'}
                      </p>
                      {r.requested_by_name && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">요청자: {r.requested_by_name}</p>
                      )}
                      {r.review_comment && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">검토 의견: {r.review_comment}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewReport(r)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {canEdit && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(r)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canReview && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => { setReviewTarget(r); setReviewDialogOpen(true); }}>
                          <CheckCircle2 className="h-3 w-3" /> 검토
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {editingId ? '경위서 수정' : '사고 경위서 작성'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Writer & date (read-only info) */}
            <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50 border">
              <div>
                <Label className="text-xs text-muted-foreground">작성인</Label>
                <p className="text-sm font-medium">{profile?.full_name || user?.email}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">작성일</Label>
                <p className="text-sm font-medium">{format(new Date(), 'yyyy년 MM월 dd일', { locale: ko })}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>사고 대상자 *</Label>
              <Input placeholder="사고와 관련된 대상자 이름" value={form.incident_subject} onChange={e => setForm(f => ({ ...f, incident_subject: e.target.value }))} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>사고 날짜 *</Label>
                <Input type="date" value={form.incident_date} onChange={e => setForm(f => ({ ...f, incident_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>사고 시간</Label>
                <Input type="time" value={form.incident_time} onChange={e => setForm(f => ({ ...f, incident_time: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>사고 장소</Label>
                <Input placeholder="사고 발생 장소" value={form.incident_location} onChange={e => setForm(f => ({ ...f, incident_location: e.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>사고 원인 (1줄 요약) *</Label>
              <Input
                placeholder="사고의 원인을 한 줄로 요약해주세요"
                value={form.cause_analysis}
                onChange={e => setForm(f => ({ ...f, cause_analysis: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>사고 경위 *</Label>
              <Textarea
                placeholder="사고 발생 경위를 상세히 기술해주세요..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>사고 대안 및 재발 방지안</Label>
              <Textarea
                placeholder="향후 재발 방지를 위한 구체적 대책을 작성해주세요..."
                value={form.prevention_measures}
                onChange={e => setForm(f => ({ ...f, prevention_measures: e.target.value }))}
                rows={4}
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" /> 증빙자료 첨부
              </Label>
              <Input type="file" multiple accept={ALLOWED_TYPES.join(',')} onChange={handleFileChange} className="text-sm" />
              <p className="text-xs text-muted-foreground">이미지, PDF, Word 파일 (최대 10MB)</p>
              {existingAttachments.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">기존 첨부파일</span>
                  {existingAttachments.map((att, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                      <Paperclip className="h-3 w-3" />
                      <span className="flex-1 truncate">{att.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeExistingAttachment(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">새 첨부파일</span>
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                      <Paperclip className="h-3 w-3" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              임시저장
            </Button>
            <Button onClick={() => handleSave(true)} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Send className="h-4 w-4" /> 제출
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewReport} onOpenChange={() => setViewReport(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>경위서 상세</DialogTitle>
          </DialogHeader>
          {viewReport && (
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-2 flex-wrap">
                {(() => { const s = STATUS_CONFIG[viewReport.status] || STATUS_CONFIG.draft; return <Badge className={`text-xs border-0 gap-1 ${s.className}`}>{s.icon}{s.label}</Badge>; })()}
              </div>

              <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-muted/50 border text-sm">
                <div><span className="text-xs text-muted-foreground block">작성인</span>{viewReport.user_name}</div>
                <div><span className="text-xs text-muted-foreground block">작성일</span>{format(new Date(viewReport.created_at), 'yyyy.MM.dd', { locale: ko })}</div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">사고 대상자</span>
                  <span className="font-medium">{viewReport.incident_subject || '-'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">사고 날짜</span>
                  {format(new Date(viewReport.incident_date), 'yyyy.MM.dd', { locale: ko })}
                  {viewReport.incident_time && ` ${viewReport.incident_time}`}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">사고 장소</span>
                  {viewReport.incident_location || '-'}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">사고 원인</span>
                  {viewReport.cause_analysis || '-'}
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">사고 경위</Label>
                <p className="text-sm whitespace-pre-wrap mt-1 p-3 rounded-lg border bg-card">{viewReport.description || '-'}</p>
              </div>

              {viewReport.prevention_measures && (
                <div>
                  <Label className="text-xs text-muted-foreground">사고 대안 및 재발 방지안</Label>
                  <p className="text-sm whitespace-pre-wrap mt-1 p-3 rounded-lg border bg-card">{viewReport.prevention_measures}</p>
                </div>
              )}

              {viewReport.attachments && viewReport.attachments.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> 첨부파일 ({viewReport.attachments.length})
                  </Label>
                  <div className="mt-1 space-y-1">
                    {viewReport.attachments.map((att: any, i: number) => (
                      <Button key={i} variant="outline" size="sm" className="gap-1.5 text-xs w-full justify-start" onClick={() => downloadAttachment(att)}>
                        <Download className="h-3 w-3" /> {att.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {viewReport.requested_by_name && (
                <div className="text-xs text-muted-foreground border-t pt-3">
                  요청자: {viewReport.requested_by_name} · {viewReport.requested_at && format(new Date(viewReport.requested_at), 'yyyy.MM.dd HH:mm')}
                </div>
              )}

              {viewReport.review_comment && (
                <div className="border-t pt-3">
                  <Label className="text-xs text-muted-foreground">관리자 검토 의견</Label>
                  <p className="text-sm mt-1">{viewReport.review_comment}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {viewReport.reviewed_by_name} · {viewReport.reviewed_at && format(new Date(viewReport.reviewed_at), 'yyyy.MM.dd HH:mm')}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>경위서를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>"{deleteTarget?.title}" 경위서가 영구적으로 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin: Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> 경위서 작성 요청
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>대상자 *</Label>
              <Select value={requestTargetId} onValueChange={setRequestTargetId}>
                <SelectTrigger><SelectValue placeholder="직원 선택" /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} {e.department && `(${e.department})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>경위서 제목 *</Label>
              <Input placeholder="경위서 제목을 입력하세요" value={requestTitle} onChange={e => setRequestTitle(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>취소</Button>
            <Button onClick={handleRequest} disabled={requesting}>
              {requesting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}요청
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin: Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>경위서 검토</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm"><strong>{reviewTarget?.user_name}</strong>님의 "{reviewTarget?.title}" 경위서를 검토합니다.</p>
            <div className="space-y-2">
              <Label>검토 의견 (선택)</Label>
              <Textarea placeholder="검토 의견을 입력하세요..." value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>취소</Button>
            <Button onClick={handleReview} disabled={reviewing} className="gap-1">
              {reviewing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <CheckCircle2 className="h-4 w-4" /> 검토 완료
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default IncidentReportPanel;
