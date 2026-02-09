import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Calendar, Loader2, Trash2, Settings2, Users, Search, X } from 'lucide-react';

interface Cycle {
  id: string;
  year: number;
  quarter: number;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  display_order: number;
  is_active: boolean;
}

interface Employee {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
}

interface CycleTarget {
  id: string;
  cycle_id: string;
  user_id: string;
  user_name: string;
}

const ReviewCycleManager: React.FC = () => {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

  // Target management
  const [showTargetDialog, setShowTargetDialog] = useState(false);
  const [targetCycle, setTargetCycle] = useState<Cycle | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cycleTargets, setCycleTargets] = useState<CycleTarget[]>([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [savingTargets, setSavingTargets] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  // Cycle form
  const [formYear, setFormYear] = useState(new Date().getFullYear());
  const [formQuarter, setFormQuarter] = useState('1');
  const [formStatus, setFormStatus] = useState('draft');
  const [saving, setSaving] = useState(false);

  // Category form
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catWeight, setCatWeight] = useState('1');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [c, cat] = await Promise.all([
      supabase.from('performance_review_cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }),
      supabase.from('performance_review_categories').select('*').order('display_order'),
    ]);
    if (c.data) setCycles(c.data as Cycle[]);
    if (cat.data) setCategories(cat.data as Category[]);
    setLoading(false);
  };

  const getQuarterDates = (year: number, q: number) => {
    const starts = [`${year}-01-01`, `${year}-04-01`, `${year}-07-01`, `${year}-10-01`];
    const ends = [`${year}-03-31`, `${year}-06-30`, `${year}-09-30`, `${year}-12-31`];
    return { start: starts[q - 1], end: ends[q - 1] };
  };

  const handleAddCycle = async () => {
    const q = parseInt(formQuarter);
    const dates = getQuarterDates(formYear, q);
    setSaving(true);
    const { error } = await supabase.from('performance_review_cycles').insert({
      year: formYear, quarter: q,
      title: `${formYear}년 ${q}분기 평가`,
      start_date: dates.start, end_date: dates.end, status: formStatus,
    });
    setSaving(false);
    if (error) {
      if (error.code === '23505') toast.error('이미 해당 분기의 평가 주기가 있습니다.');
      else toast.error('생성 실패: ' + error.message);
    } else {
      toast.success('평가 주기가 생성되었습니다.');
      setShowCycleForm(false);
      fetchData();
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('performance_review_cycles').update({ status }).eq('id', id);
    if (!error) { toast.success('상태가 변경되었습니다.'); fetchData(); }
  };

  const handleDeleteCycle = async (id: string) => {
    if (!confirm('이 평가 주기와 관련된 모든 평가가 삭제됩니다. 계속하시겠습니까?')) return;
    const { error } = await supabase.from('performance_review_cycles').delete().eq('id', id);
    if (!error) { toast.success('삭제되었습니다.'); fetchData(); }
  };

  const handleAddCategory = async () => {
    if (!catName.trim()) return;
    const { error } = await supabase.from('performance_review_categories').insert({
      name: catName, description: catDesc || null,
      weight: parseFloat(catWeight) || 1, display_order: categories.length,
    });
    if (!error) {
      toast.success('평가 항목이 추가되었습니다.');
      setCatName(''); setCatDesc(''); setCatWeight('1');
      setShowCategoryForm(false);
      fetchData();
    }
  };

  const handleToggleCategory = async (id: string, active: boolean) => {
    await supabase.from('performance_review_categories').update({ is_active: !active }).eq('id', id);
    fetchData();
  };

  // === Target management ===
  const openTargetDialog = async (cycle: Cycle) => {
    setTargetCycle(cycle);
    setShowTargetDialog(true);
    setLoadingTargets(true);
    setTargetSearch('');

    const [empRes, targetsRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, department, position, avatar_url').eq('is_approved', true).order('full_name'),
      supabase.from('review_cycle_targets' as any).select('*').eq('cycle_id', cycle.id),
    ]);

    if (empRes.data) setEmployees(empRes.data as Employee[]);
    const targets = (targetsRes.data || []) as unknown as CycleTarget[];
    setCycleTargets(targets);
    setSelectedUserIds(new Set(targets.map(t => t.user_id)));
    setLoadingTargets(false);
  };

  const toggleTarget = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = getFilteredEmployees();
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      filtered.forEach(e => next.add(e.id));
      return next;
    });
  };

  const deselectAll = () => {
    const filtered = getFilteredEmployees();
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      filtered.forEach(e => next.delete(e.id));
      return next;
    });
  };

  const getFilteredEmployees = () => {
    if (!targetSearch.trim()) return employees;
    const s = targetSearch.toLowerCase();
    return employees.filter(e =>
      e.full_name.toLowerCase().includes(s) ||
      (e.department && e.department.toLowerCase().includes(s))
    );
  };

  const saveTargets = async () => {
    if (!targetCycle) return;
    setSavingTargets(true);

    try {
      // Delete all existing targets for this cycle
      await (supabase.from('review_cycle_targets' as any) as any).delete().eq('cycle_id', targetCycle.id);

      // Insert new targets
      if (selectedUserIds.size > 0) {
        const inserts = Array.from(selectedUserIds).map(userId => {
          const emp = employees.find(e => e.id === userId);
          return {
            cycle_id: targetCycle.id,
            user_id: userId,
            user_name: emp?.full_name || '',
          };
        });
        const { error } = await (supabase.from('review_cycle_targets' as any) as any).insert(inserts);
        if (error) throw error;
      }

      toast.success(`${selectedUserIds.size}명의 평가 대상자가 저장되었습니다.`);
      setShowTargetDialog(false);
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    } finally {
      setSavingTargets(false);
    }
  };

  // Count targets per cycle (fetch on mount)
  const [targetCounts, setTargetCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (cycles.length > 0) fetchTargetCounts();
  }, [cycles]);

  const fetchTargetCounts = async () => {
    const { data } = await (supabase.from('review_cycle_targets' as any) as any).select('cycle_id');
    if (data) {
      const counts: Record<string, number> = {};
      (data as any[]).forEach(d => {
        counts[d.cycle_id] = (counts[d.cycle_id] || 0) + 1;
      });
      setTargetCounts(counts);
    }
  };

  const filteredEmployees = getFilteredEmployees();

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Cycles */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar className="h-4 w-4" /> 평가 주기 관리
            </CardTitle>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowCycleForm(true)}>
              <Plus className="h-3.5 w-3.5" /> 주기 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">평가 주기</TableHead>
                <TableHead className="text-xs">기간</TableHead>
                <TableHead className="text-xs">대상자</TableHead>
                <TableHead className="text-xs">상태</TableHead>
                <TableHead className="text-xs text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="text-sm font-medium">{c.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.start_date} ~ {c.end_date}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => openTargetDialog(c)}
                    >
                      <Users className="h-3 w-3" />
                      {targetCounts[c.id] ? `${targetCounts[c.id]}명` : '미설정'}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Select value={c.status} onValueChange={(v) => handleStatusChange(c.id, v)}>
                      <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">준비중</SelectItem>
                        <SelectItem value="active">진행중</SelectItem>
                        <SelectItem value="completed">완료</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDeleteCycle(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {cycles.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">등록된 평가 주기가 없습니다</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> 평가 항목 관리
            </CardTitle>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowCategoryForm(true)}>
              <Plus className="h-3.5 w-3.5" /> 항목 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">항목명</TableHead>
                <TableHead className="text-xs">설명</TableHead>
                <TableHead className="text-xs">가중치</TableHead>
                <TableHead className="text-xs">상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat => (
                <TableRow key={cat.id} className={!cat.is_active ? 'opacity-50' : ''}>
                  <TableCell className="text-sm font-medium">{cat.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cat.description || '-'}</TableCell>
                  <TableCell className="text-sm">×{cat.weight}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleToggleCategory(cat.id, cat.is_active)}>
                      {cat.is_active ? '비활성화' : '활성화'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Cycle Dialog */}
      <Dialog open={showCycleForm} onOpenChange={setShowCycleForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>평가 주기 추가</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">연도</Label>
                <Input type="number" value={formYear} onChange={e => setFormYear(parseInt(e.target.value))} className="h-9 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs">분기</Label>
                <Select value={formQuarter} onValueChange={setFormQuarter}>
                  <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1분기</SelectItem>
                    <SelectItem value="2">2분기</SelectItem>
                    <SelectItem value="3">3분기</SelectItem>
                    <SelectItem value="4">4분기</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">초기 상태</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">준비중</SelectItem>
                  <SelectItem value="active">진행중</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAddCycle} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              추가
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={showCategoryForm} onOpenChange={setShowCategoryForm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>평가 항목 추가</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">항목명</Label>
              <Input value={catName} onChange={e => setCatName(e.target.value)} className="h-9 text-sm mt-1" placeholder="예: 업무 수행 능력" />
            </div>
            <div>
              <Label className="text-xs">설명</Label>
              <Input value={catDesc} onChange={e => setCatDesc(e.target.value)} className="h-9 text-sm mt-1" placeholder="항목에 대한 설명" />
            </div>
            <div>
              <Label className="text-xs">가중치</Label>
              <Input type="number" step="0.5" value={catWeight} onChange={e => setCatWeight(e.target.value)} className="h-9 text-sm mt-1" />
            </div>
            <Button className="w-full" onClick={handleAddCategory}>추가</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Target Management Dialog */}
      <Dialog open={showTargetDialog} onOpenChange={setShowTargetDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              평가 대상자 관리
              {targetCycle && <Badge variant="secondary" className="text-xs ml-1">{targetCycle.title}</Badge>}
            </DialogTitle>
          </DialogHeader>

          {loadingTargets ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="px-6 pb-6 space-y-3">
              {/* Search & bulk actions */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="이름, 부서로 검색..."
                    value={targetSearch}
                    onChange={e => setTargetSearch(e.target.value)}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={selectAll}>전체 선택</Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={deselectAll}>전체 해제</Button>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{selectedUserIds.size}명 선택됨</span>
                <span>전체 {employees.length}명</span>
              </div>

              {/* Employee list */}
              <ScrollArea className="h-[45vh] border rounded-lg">
                <div className="divide-y">
                  {filteredEmployees.map(emp => {
                    const checked = selectedUserIds.has(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleTarget(emp.id)}
                        />
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary overflow-hidden">
                          {emp.avatar_url
                            ? <img src={emp.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                            : emp.full_name?.charAt(0) || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{emp.full_name}</span>
                          {emp.department && <span className="text-xs text-muted-foreground ml-2">{emp.department}</span>}
                          {emp.position && <span className="text-xs text-muted-foreground ml-1">· {emp.position}</span>}
                        </div>
                      </label>
                    );
                  })}
                  {filteredEmployees.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다</div>
                  )}
                </div>
              </ScrollArea>

              {/* Save */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTargetDialog(false)}>취소</Button>
                <Button size="sm" className="gap-1.5" onClick={saveTargets} disabled={savingTargets}>
                  {savingTargets ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                  {selectedUserIds.size}명 저장
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReviewCycleManager;
