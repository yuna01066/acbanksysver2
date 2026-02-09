import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  projectId: string;
}

const ProjectAssignments: React.FC<Props> = ({ projectId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');

  const { data: assignments = [] } = useQuery({
    queryKey: ['project-assignments', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_assignments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['all-employees'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, department, position')
        .eq('is_approved', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const assignedIds = assignments.map((a: any) => a.user_id);
  const availableEmployees = employees.filter((e: any) => !assignedIds.includes(e.id));

  const addAssignment = useMutation({
    mutationFn: async (userId: string) => {
      const emp = employees.find((e: any) => e.id === userId);
      if (!emp) throw new Error('직원을 찾을 수 없습니다');
      const { error } = await supabase.from('project_assignments').insert({
        project_id: projectId,
        user_id: userId,
        user_name: emp.full_name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-assignments-all'] });
      setSelectedUserId('');
      toast.success('담당자가 배정되었습니다.');
    },
    onError: () => toast.error('배정에 실패했습니다.'),
  });

  const removeAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('project_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-assignments-all'] });
      toast.success('담당자가 해제되었습니다.');
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={selectedUserId} onValueChange={setSelectedUserId}>
          <SelectTrigger className="flex-1 h-8 text-xs">
            <SelectValue placeholder="담당자 선택..." />
          </SelectTrigger>
          <SelectContent>
            {availableEmployees.map((e: any) => (
              <SelectItem key={e.id} value={e.id} className="text-xs">
                {e.full_name} {e.department ? `(${e.department})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1 shrink-0"
          disabled={!selectedUserId || addAssignment.isPending}
          onClick={() => selectedUserId && addAssignment.mutate(selectedUserId)}
        >
          <UserPlus className="h-3 w-3" /> 배정
        </Button>
      </div>

      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1">배정된 담당자가 없습니다.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {assignments.map((a: any) => (
            <Badge key={a.id} variant="secondary" className="text-xs gap-1 pr-1">
              {a.user_name}
              <button
                onClick={() => removeAssignment.mutate(a.id)}
                className="ml-0.5 hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectAssignments;
