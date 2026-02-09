import React, { useEffect, useState } from 'react';
import { useAuth, AppRole, ROLE_LABELS, ROLE_HIERARCHY } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Edit, Trash2, Shield, User, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import PasswordResetRequests from '@/components/PasswordResetRequests';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  department?: string;
  position?: string;
  created_at: string;
  is_approved?: boolean;
}

interface UserWithRole extends UserProfile {
  roles: string[];
}

function getRoleBadge(roles: string[]) {
  if (roles.includes('admin')) {
    return <Badge variant="default" className="gap-1"><Shield className="h-3 w-3" />{ROLE_LABELS.admin}</Badge>;
  }
  if (roles.includes('moderator')) {
    return <Badge variant="outline" className="gap-1 border-primary text-primary"><Shield className="h-3 w-3" />{ROLE_LABELS.moderator}</Badge>;
  }
  if (roles.includes('manager')) {
    return <Badge variant="outline" className="gap-1"><User className="h-3 w-3" />{ROLE_LABELS.manager}</Badge>;
  }
  return <Badge variant="secondary" className="gap-1"><User className="h-3 w-3" />{ROLE_LABELS.employee}</Badge>;
}

function getHighestRole(roles: string[]): AppRole {
  for (const role of ROLE_HIERARCHY) {
    if (roles.includes(role)) return role;
  }
  if (roles.includes('user')) return 'employee';
  return 'employee';
}

const UserAccountManagement: React.FC = () => {
  const { userRole, session } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'approved' | 'pending'>('approved');

  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editRole, setEditRole] = useState<AppRole>('employee');

  useEffect(() => {
    if (userRole === 'admin') fetchUsers();
  }, [userRole]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: false });
    if (profilesError) { toast.error('사용자 목록을 불러오는데 실패했습니다.'); setLoading(false); return; }

    const { data: roles, error: rolesError } = await supabase.from('user_roles').select('user_id, role');
    if (rolesError) { toast.error('권한 정보를 불러오는데 실패했습니다.'); setLoading(false); return; }

    setUsers(profiles.map(profile => ({
      ...profile,
      roles: roles.filter(r => r.user_id === profile.id).map(r => r.role),
    })));
    setLoading(false);
  };

  const handleApproveUser = async (userId: string) => {
    const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('id', userId);
    if (error) { toast.error('승인에 실패했습니다.'); return; }
    toast.success('사용자가 승인되었습니다.');
    fetchUsers();
  };

  const handleEditUser = (user: UserWithRole) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditEmail(user.email);
    setEditPassword('');
    setEditPhone(user.phone || '');
    setEditDepartment(user.department || '');
    setEditPosition(user.position || '');
    setEditRole(getHighestRole(user.roles));
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !session) return;

    const { error: profileError } = await supabase.from('profiles').update({
      full_name: editFullName, phone: editPhone, department: editDepartment, position: editPosition,
    }).eq('id', editingUser.id);
    if (profileError) { toast.error('사용자 정보 업데이트에 실패했습니다.'); return; }

    const currentRole = getHighestRole(editingUser.roles);
    if (currentRole !== editRole) {
      await supabase.from('user_roles').delete().eq('user_id', editingUser.id);
      await supabase.from('user_roles').insert({ user_id: editingUser.id, role: editRole });
    }

    const emailChanged = editEmail.trim() !== editingUser.email;
    const passwordChanged = editPassword.length > 0;
    if (emailChanged || passwordChanged) {
      try {
        const body: Record<string, string> = { userId: editingUser.id };
        if (emailChanged) body.email = editEmail.trim();
        if (passwordChanged) body.password = editPassword;
        const { data, error } = await supabase.functions.invoke('admin-update-user', {
          body, headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      } catch (err: any) {
        toast.error('이메일/비밀번호 변경 실패: ' + (err.message || '알 수 없는 오류'));
        return;
      }
    }

    toast.success('사용자 정보가 업데이트되었습니다.');
    setEditingUser(null);
    fetchUsers();
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId || !session) return;
    try {
      const { error } = await supabase.functions.invoke('delete-user', {
        body: { userId: deleteUserId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      toast.success('사용자가 삭제되었습니다.');
      setDeleteUserId(null);
      fetchUsers();
    } catch (error: any) {
      toast.error('사용자 삭제에 실패했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  };

  const approvedUsers = users.filter(u => u.is_approved !== false);
  const pendingUsers = users.filter(u => u.is_approved === false);

  return (
    <div className="space-y-6">
      <PasswordResetRequests />

      <Card>
        <CardHeader>
          <CardTitle>계정 / 권한 관리</CardTitle>
          <CardDescription>
            사용자 계정을 조회하고 관리할 수 있습니다. 권한: {ROLE_HIERARCHY.map(r => ROLE_LABELS[r]).join(' > ')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'approved' | 'pending')}>
            <TabsList className="mb-4">
              <TabsTrigger value="approved">승인된 사용자 ({approvedUsers.length})</TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                승인 대기 ({pendingUsers.length})
                {pendingUsers.length > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending">
              {loading ? <p>로딩 중...</p> : pendingUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">승인 대기 중인 사용자가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {pendingUsers.map((user) => (
                    <Card key={user.id} className="border-amber-200 dark:border-amber-800">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{user.full_name}</h3>
                              <Badge variant="outline" className="gap-1 border-amber-400 text-amber-700 dark:text-amber-400">
                                <Clock className="h-3 w-3" />승인 대기
                              </Badge>
                            </div>
                            <div className="text-sm space-y-1">
                              <p>이메일: {user.email}</p>
                              <p className="text-xs text-muted-foreground">가입일: {new Date(user.created_at).toLocaleDateString('ko-KR')}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleApproveUser(user.id)}>
                              <CheckCircle className="h-4 w-4 mr-1" />승인
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setDeleteUserId(user.id)}>
                              <XCircle className="h-4 w-4 mr-1" />거부
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="approved">
              {loading ? <p>로딩 중...</p> : approvedUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">등록된 사용자가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {approvedUsers.map((user) => (
                    <Card key={user.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{user.full_name}</h3>
                              {getRoleBadge(user.roles)}
                            </div>
                            <div className="text-sm space-y-1">
                              <p>이메일: {user.email}</p>
                              {user.phone && <p>전화번호: {user.phone}</p>}
                              {user.department && <p>부서: {user.department}</p>}
                              {user.position && <p>직급: {user.position}</p>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditUser(user)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setDeleteUserId(user.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>담당자 정보 수정</DialogTitle>
            <DialogDescription>담당자의 정보와 권한을 수정할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">이메일</Label>
              <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">비밀번호 변경</Label>
              <Input id="edit-password" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="변경하려면 입력 (최소 6자)" minLength={6} />
              <p className="text-xs text-muted-foreground">비워두면 기존 비밀번호가 유지됩니다.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">이름</Label>
              <Input id="edit-full-name" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">전화번호</Label>
              <Input id="edit-phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">부서</Label>
              <Input id="edit-department" value={editDepartment} onChange={(e) => setEditDepartment(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-position">직급</Label>
              <Input id="edit-position" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">권한</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_HIERARCHY.map(role => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)} className="flex-1">취소</Button>
              <Button type="submit" className="flex-1">저장</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다. 사용자 계정과 관련된 모든 데이터가 영구적으로 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UserAccountManagement;
