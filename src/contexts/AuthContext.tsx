import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  department?: string;
  position?: string;
  is_approved?: boolean;
}

export type AppRole = 'admin' | 'moderator' | 'manager' | 'employee';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isModerator: boolean;
  isManager: boolean;
  isEmployee: boolean;
  isApproved: boolean;
  userRole: AppRole | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: '관리자',
  moderator: '중간관리자',
  manager: '담당자',
  employee: '직원',
};

export const ROLE_HIERARCHY: AppRole[] = ['admin', 'moderator', 'manager', 'employee'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isManager, setIsManager] = useState(false);
  const [isEmployee, setIsEmployee] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data);
      setIsApproved(data.is_approved ?? false);
    }
  };

  const checkUserRole = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (data && data.length > 0) {
      const roles = data.map(r => r.role);
      const admin = roles.includes('admin');
      const moderator = roles.includes('moderator');
      const manager = roles.includes('manager');
      const employee = roles.includes('employee');
      // 하위 호환: 기존 'user' 역할
      const legacyUser = roles.includes('user');
      
      setIsAdmin(admin);
      setIsModerator(moderator);
      setIsManager(manager);
      setIsEmployee(employee || legacyUser);
      
      // 우선순위: admin > moderator > manager > employee
      if (admin) setUserRole('admin');
      else if (moderator) setUserRole('moderator');
      else if (manager) setUserRole('manager');
      else if (employee || legacyUser) setUserRole('employee');
      else setUserRole(null);
    } else {
      setIsAdmin(false);
      setIsModerator(false);
      setIsManager(false);
      setIsEmployee(false);
      setUserRole(null);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(async () => {
            await fetchProfile(session.user.id);
            await checkUserRole(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setIsModerator(false);
          setIsManager(false);
          setIsEmployee(false);
          setIsApproved(false);
          setUserRole(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await fetchProfile(session.user.id);
        await checkUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName
        }
      }
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return { error };
    }

    // 로그인 성공 후 승인 여부 확인
    if (data.user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('is_approved')
        .eq('id', data.user.id)
        .single();

      if (profileData && !profileData.is_approved) {
        // 미승인 사용자는 로그아웃 처리
        await supabase.auth.signOut();
        return { error: { message: 'PENDING_APPROVAL' } };
      }
      
      toast.success('로그인되었습니다!');
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
    setIsModerator(false);
    setIsManager(false);
    setIsEmployee(false);
    setIsApproved(false);
    setUserRole(null);
    toast.success('로그아웃되었습니다!');
    window.location.href = '/';
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update(data)
      .eq('id', user.id);

    if (!error) {
      await fetchProfile(user.id);
      toast.success('프로필이 업데이트되었습니다!');
    } else {
      toast.error('프로필 업데이트에 실패했습니다.');
    }
  };

  // isUser 하위 호환성 (기존 코드에서 isUser를 쓰는 곳이 있을 수 있음)
  const isUser = isEmployee;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isModerator,
        isManager,
        isEmployee,
        isApproved,
        userRole,
        loading,
        signUp,
        signIn,
        signOut,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
