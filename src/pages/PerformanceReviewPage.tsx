import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, Search, Loader2, User } from 'lucide-react';
import PerformanceReviewPanel from '@/components/employee/PerformanceReviewPanel';

interface Employee {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
}

const PerformanceReviewPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, department, position, avatar_url')
      .eq('is_approved', true)
      .order('full_name');
    if (data) setEmployees(data);
    setLoading(false);
  };

  const filteredEmployees = employees.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return e.full_name.toLowerCase().includes(s) ||
      (e.department && e.department.toLowerCase().includes(s)) ||
      (e.position && e.position.toLowerCase().includes(s));
  });

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b px-4 py-3 flex items-center gap-3 bg-card">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-semibold flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          업무 평가
        </h1>
      </div>

      <div className="container max-w-5xl mx-auto px-4 py-6">
        {selectedEmployee ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedEmployee(null)}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                직원 목록
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {selectedEmployee.avatar_url ? (
                    <img src={selectedEmployee.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div>
                  <span className="font-semibold text-sm">{selectedEmployee.full_name}</span>
                  {selectedEmployee.department && (
                    <span className="text-xs text-muted-foreground ml-2">{selectedEmployee.department}</span>
                  )}
                </div>
              </div>
            </div>
            <PerformanceReviewPanel userId={selectedEmployee.id} userName={selectedEmployee.full_name} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground">평가할 직원을 선택하세요.</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름, 부서, 직급으로 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : filteredEmployees.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">검색 결과가 없습니다.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredEmployees.map(emp => (
                  <Card
                    key={emp.id}
                    className="cursor-pointer hover:border-primary/40 transition-all"
                    onClick={() => setSelectedEmployee(emp)}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{emp.full_name}</p>
                        <div className="flex items-center gap-1.5">
                          {emp.department && (
                            <Badge variant="secondary" className="text-xs">{emp.department}</Badge>
                          )}
                          {emp.position && (
                            <span className="text-xs text-muted-foreground">{emp.position}</span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformanceReviewPage;
