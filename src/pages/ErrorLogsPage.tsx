import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, RefreshCw, Trash2, Search, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ErrorLog {
  id: string;
  user_id: string | null;
  route: string | null;
  message: string;
  stack: string | null;
  source: string | null;
  user_agent: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
}

const SOURCE_OPTIONS = ['all', 'window.error', 'unhandledrejection', 'react.errorBoundary', 'manual', 'unknown'];
const RANGE_OPTIONS = [
  { value: '1h', label: '최근 1시간' },
  { value: '24h', label: '최근 24시간' },
  { value: '7d', label: '최근 7일' },
  { value: '30d', label: '최근 30일' },
  { value: 'all', label: '전체' },
];

function rangeToDate(value: string): Date | null {
  const now = Date.now();
  switch (value) {
    case '1h': return new Date(now - 3600_000);
    case '24h': return new Date(now - 24 * 3600_000);
    case '7d': return new Date(now - 7 * 24 * 3600_000);
    case '30d': return new Date(now - 30 * 24 * 3600_000);
    default: return null;
  }
}

export default function ErrorLogsPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('24h');
  const [selected, setSelected] = useState<ErrorLog | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error('관리자만 접근할 수 있습니다.');
      navigate('/');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any)
      .from('client_error_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    const since = rangeToDate(rangeFilter);
    if (since) query = query.gte('created_at', since.toISOString());
    if (sourceFilter !== 'all') query = query.eq('source', sourceFilter);

    const { data, error } = await query;
    if (error) {
      toast.error('오류 로그를 불러오지 못했습니다.');
      console.error(error);
    } else {
      setLogs((data as ErrorLog[]) ?? []);
    }
    setLoading(false);
  }, [sourceFilter, rangeFilter]);

  useEffect(() => {
    if (user && isAdmin) load();
  }, [user, isAdmin, load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return logs;
    return logs.filter(l =>
      (l.message || '').toLowerCase().includes(s) ||
      (l.route || '').toLowerCase().includes(s) ||
      (l.stack || '').toLowerCase().includes(s) ||
      (l.source || '').toLowerCase().includes(s),
    );
  }, [logs, search]);

  const stats = useMemo(() => {
    const bySource: Record<string, number> = {};
    for (const l of filtered) {
      const k = l.source || 'unknown';
      bySource[k] = (bySource[k] || 0) + 1;
    }
    return bySource;
  }, [filtered]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 로그를 삭제할까요?')) return;
    const { error } = await (supabase as any).from('client_error_logs').delete().eq('id', id);
    if (error) {
      toast.error('삭제 실패');
    } else {
      setLogs(prev => prev.filter(l => l.id !== id));
      setSelected(null);
      toast.success('삭제됨');
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`현재 보기에 표시된 ${filtered.length}건을 모두 삭제할까요?`)) return;
    const ids = filtered.map(l => l.id);
    const { error } = await (supabase as any).from('client_error_logs').delete().in('id', ids);
    if (error) {
      toast.error('삭제 실패');
    } else {
      setLogs(prev => prev.filter(l => !ids.includes(l.id)));
      toast.success('삭제 완료');
    }
  };

  if (authLoading || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-2 flex items-center justify-between gap-4 bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin-settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            클라이언트 오류 로그
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
          <Button variant="outline" size="sm" onClick={handleClearAll} disabled={!filtered.length}>
            <Trash2 className="h-4 w-4 mr-1" />
            현재 보기 전체 삭제
          </Button>
        </div>
      </div>

      <div className="container max-w-7xl mx-auto px-6 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="메시지, 경로, 스택 검색"
              className="pl-8"
            />
          </div>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="소스 필터" />
            </SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map(s => (
                <SelectItem key={s} value={s}>{s === 'all' ? '모든 소스' : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={rangeFilter} onValueChange={setRangeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="기간" />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>총 {filtered.length}건</span>
          {Object.entries(stats).map(([k, v]) => (
            <Badge key={k} variant="secondary">{k}: {v}</Badge>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">표시할 오류 로그가 없습니다.</CardContent></Card>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 w-[150px]">시각</th>
                  <th className="text-left px-3 py-2 w-[140px]">소스</th>
                  <th className="text-left px-3 py-2">메시지</th>
                  <th className="text-left px-3 py-2 w-[200px]">경로</th>
                  <th className="px-3 py-2 w-[60px]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => (
                  <tr
                    key={l.id}
                    className="border-t hover:bg-accent/30 cursor-pointer"
                    onClick={() => setSelected(l)}
                  >
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ko })}
                    </td>
                    <td className="px-3 py-2"><Badge variant="outline" className="text-xs">{l.source || 'unknown'}</Badge></td>
                    <td className="px-3 py-2 truncate max-w-[400px]">{l.message}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground truncate">{l.route || '-'}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              오류 상세
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">시각: </span>{new Date(selected.created_at).toLocaleString('ko-KR')}</div>
                <div><span className="text-muted-foreground">소스: </span>{selected.source || 'unknown'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">경로: </span>{selected.route || '-'}</div>
                <div className="col-span-2"><span className="text-muted-foreground">User ID: </span>{selected.user_id || '익명'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">메시지</div>
                <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-words">{selected.message}</pre>
              </div>
              {selected.stack && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">스택</div>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto">{selected.stack}</pre>
                </div>
              )}
              {selected.context && Object.keys(selected.context).length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">컨텍스트</div>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap break-words">{JSON.stringify(selected.context, null, 2)}</pre>
                </div>
              )}
              {selected.user_agent && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">User Agent</div>
                  <p className="text-xs break-words">{selected.user_agent}</p>
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button variant="destructive" size="sm" onClick={() => handleDelete(selected.id)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  삭제
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
