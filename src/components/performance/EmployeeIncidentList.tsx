import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Loader2, Eye, MapPin, Clock, Send, CheckCircle2, Paperclip, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface IncidentReport {
  id: string;
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
  review_comment: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  attachments: any[];
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  submitted: { label: '제출 완료', className: 'bg-primary/10 text-primary' },
  reviewed: { label: '검토 완료', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
};

interface Props {
  userId: string;
}

const EmployeeIncidentList: React.FC<Props> = ({ userId }) => {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewReport, setViewReport] = useState<IncidentReport | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const { data } = await supabase
        .from('incident_reports')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['submitted', 'reviewed'])
        .gte('incident_date', oneYearAgo.toISOString().split('T')[0])
        .order('incident_date', { ascending: false });
      if (data) setReports(data as IncidentReport[]);
      setLoading(false);
    };
    fetchReports();
  }, [userId]);

  const downloadAttachment = async (attachment: any) => {
    const { data } = await supabase.storage.from('incident-attachments').createSignedUrl(attachment.path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        최근 1년간 제출된 경위서가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          사고 경위서 ({reports.length}건, 최근 1년)
        </h4>
      </div>

      <div className="space-y-2">
        {reports.map(r => {
          const statusCfg = STATUS_LABEL[r.status] || STATUS_LABEL.submitted;
          return (
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge className={`text-xs border-0 ${statusCfg.className}`}>{statusCfg.label}</Badge>
                      {r.incident_subject && (
                        <span className="text-xs font-medium">대상: {r.incident_subject}</span>
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
                    </div>
                    <p className="text-sm font-medium">{r.cause_analysis || r.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.description}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setViewReport(r)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* View dialog */}
      <Dialog open={!!viewReport} onOpenChange={() => setViewReport(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>경위서 상세</DialogTitle>
          </DialogHeader>
          {viewReport && (
            <div className="space-y-4 mt-2">
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
                <p className="text-sm whitespace-pre-wrap mt-1 p-3 rounded-lg border bg-card">{viewReport.description}</p>
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
    </div>
  );
};

export default EmployeeIncidentList;
