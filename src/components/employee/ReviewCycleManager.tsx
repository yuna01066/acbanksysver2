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
import { toast } from 'sonner';
import { Plus, Calendar, Loader2, Trash2, Settings2 } from 'lucide-react';

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

const ReviewCycleManager: React.FC = () => {
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCycleForm, setShowCycleForm] = useState(false);
  const [showCategoryForm, setShowCategoryForm] = useState(false);

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
      year: formYear,
      quarter: q,
      title: `${formYear}년 ${q}분기 평가`,
      start_date: dates.start,
      end_date: dates.end,
      status: formStatus,
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
    if (!error) {
      toast.success('상태가 변경되었습니다.');
      fetchData();
    }
  };

  const handleDeleteCycle = async (id: string) => {
    if (!confirm('이 평가 주기와 관련된 모든 평가가 삭제됩니다. 계속하시겠습니까?')) return;
    const { error } = await supabase.from('performance_review_cycles').delete().eq('id', id);
    if (!error) { toast.success('삭제되었습니다.'); fetchData(); }
  };

  const handleAddCategory = async () => {
    if (!catName.trim()) return;
    const { error } = await supabase.from('performance_review_categories').insert({
      name: catName,
      description: catDesc || null,
      weight: parseFloat(catWeight) || 1,
      display_order: categories.length,
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
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">등록된 평가 주기가 없습니다</TableCell></TableRow>
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
    </div>
  );
};

export default ReviewCycleManager;
