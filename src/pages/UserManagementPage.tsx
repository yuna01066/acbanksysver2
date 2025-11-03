import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Edit, Trash2, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  department?: string;
  position?: string;
  created_at: string;
}

interface UserWithRole extends UserProfile {
  roles: string[];
}

const ADMIN_PASSWORD = '4999';

const UserManagementPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Edit form state
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');

  useEffect(() => {
    // Check session storage for authentication
    const adminAuth = sessionStorage.getItem('user_management_authenticated');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
    }
  }, [isAuthenticated]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('user_management_authenticated', 'true');
      setPasswordError('');
    } else {
      setPasswordError('비밀번호가 올바르지 않습니다.');
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    
    // Fetch all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (profilesError) {
      toast.error('사용자 목록을 불러오는데 실패했습니다.');
      setLoading(false);
      return;
    }

    // Fetch all user roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      toast.error('권한 정보를 불러오는데 실패했습니다.');
      setLoading(false);
      return;
    }

    // Combine profiles with roles
    const usersWithRoles: UserWithRole[] = profiles.map(profile => ({
      ...profile,
      roles: roles
        .filter(r => r.user_id === profile.id)
        .map(r => r.role)
    }));

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const handleEditUser = (user: UserWithRole) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditPhone(user.phone || '');
    setEditDepartment(user.department || '');
    setEditPosition(user.position || '');
    setEditRole(user.roles.includes('admin') ? 'admin' : 'user');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        full_name: editFullName,
        phone: editPhone,
        department: editDepartment,
        position: editPosition
      })
      .eq('id', editingUser.id);

    if (profileError) {
      toast.error('사용자 정보 업데이트에 실패했습니다.');
      return;
    }

    // Update role if changed
    const currentRole = editingUser.roles.includes('admin') ? 'admin' : 'user';
    if (currentRole !== editRole) {
      // Remove old role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editingUser.id);

      // Add new role
      await supabase
        .from('user_roles')
        .insert({ user_id: editingUser.id, role: editRole });
    }

    toast.success('사용자 정보가 업데이트되었습니다.');
    setEditingUser(null);
    fetchUsers();
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    // Delete from auth.users (cascade will handle profiles and roles)
    const { error } = await supabase.auth.admin.deleteUser(deleteUserId);

    if (!error) {
      toast.success('사용자가 삭제되었습니다.');
      fetchUsers();
    } else {
      toast.error('사용자 삭제에 실패했습니다.');
    }
    setDeleteUserId(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>관리자 인증</CardTitle>
            <CardDescription>
              담당자 관리 페이지에 접근하려면 관리자 비밀번호를 입력하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-password">관리자 비밀번호</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                />
                {passwordError && (
                  <p className="text-sm text-destructive">{passwordError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => navigate('/')} className="flex-1">
                  취소
                </Button>
                <Button type="submit" className="flex-1">
                  확인
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate('/admin-settings')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            관리자 페이지로
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>담당자 관리</CardTitle>
            <CardDescription>
              사용자 계정을 조회하고 관리할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>로딩 중...</p>
            ) : users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                등록된 사용자가 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {users.map((user) => (
                  <Card key={user.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{user.full_name}</h3>
                            {user.roles.includes('admin') ? (
                              <Badge variant="default" className="gap-1">
                                <Shield className="h-3 w-3" />
                                관리자
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <User className="h-3 w-3" />
                                사용자
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm space-y-1">
                            <p>이메일: {user.email}</p>
                            {user.phone && <p>전화번호: {user.phone}</p>}
                            {user.department && <p>부서: {user.department}</p>}
                            {user.position && <p>직급: {user.position}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteUserId(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>담당자 정보 수정</DialogTitle>
            <DialogDescription>
              담당자의 정보를 수정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-full-name">이름</Label>
              <Input
                id="edit-full-name"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">전화번호</Label>
              <Input
                id="edit-phone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">부서</Label>
              <Input
                id="edit-department"
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-position">직급</Label>
              <Input
                id="edit-position"
                value={editPosition}
                onChange={(e) => setEditPosition(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">권한</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as 'admin' | 'user')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">사용자</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)} className="flex-1">
                취소
              </Button>
              <Button type="submit" className="flex-1">
                저장
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>사용자를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 사용자 계정과 관련된 모든 데이터가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
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

export default UserManagementPage;
