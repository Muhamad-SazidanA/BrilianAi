'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Role, PermissionKey } from '@/types/user';
import { toast } from 'sonner';

interface UserSessionContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  allUsers: User[];
  roles: Role[];
  isLoading: boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  loginUser: (user: User) => void;
  switchUser: (userId: string) => void;
  refreshUsers: () => Promise<void>;
  logout: () => void;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export const DEFAULT_ADMIN_USER: User = {
  id: 'a0000000-0000-0000-0000-000000000001',
  name: 'Super Admin',
  email: 'superadmin@brilian.ai',
  role_id: 'admin',
  status: 'active',
  department: 'System Administration',
  avatar_color: '#2563EB',
  role: {
    id: 'admin',
    name: 'Super Administrator',
    description: 'Akses penuh ke seluruh modul sistem',
    is_system: true,
    permissions: [
      'documents:read',
      'documents:upload',
      'documents:toggle_active',
      'documents:delete',
      'curation:trigger',
      'curation:edit',
      'curation:delete',
      'chat:query',
      'chat:export',
      'users:manage',
      'roles:manage',
      'audit:read',
    ],
  },
};

export function UserSessionProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsersAndRoles = useCallback(async () => {
    try {
      // 1. Verify active session via /api/auth/me
      const meRes = await fetch('/api/auth/me');
      let activeUser: User | null = null;

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.authenticated && meData.user) {
          const userRecord = meData.user as User;
          activeUser = userRecord;
          setCurrentUser(userRecord);
          try {
            localStorage.setItem('brilian_active_user_id', userRecord.id);
            localStorage.setItem('brilian_user_status', userRecord.status || 'active');
          } catch {}
        }
      } else {
        // Not authenticated or session invalid: clean stale cookies & storage
        setCurrentUser(null);
        try {
          localStorage.removeItem('brilian_active_user_id');
          localStorage.removeItem('brilian_user_status');
          document.cookie = 'brilian_active_user_id=; path=/; max-age=0; SameSite=Lax';
          document.cookie = 'brilian_user_status=; path=/; max-age=0; SameSite=Lax';
          document.cookie = 'brilian_chat_access=; path=/; max-age=0; SameSite=Lax';
        } catch {}
      }

      // 2. Fetch users and roles if session is active
      if (activeUser) {
        const [usersRes, rolesRes] = await Promise.all([
          fetch('/api/users').catch(() => null),
          fetch('/api/roles').catch(() => null),
        ]);

        if (rolesRes && rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRoles(rolesData.roles || []);
        }

        if (usersRes && usersRes.ok) {
          const usersData = await usersRes.json();
          const loadedUsers = usersData.users || [];
          setAllUsers(loadedUsers);
          const matched = loadedUsers.find((u: User) => u.id === activeUser?.id);
          if (matched) setCurrentUser(matched);
        } else {
          setAllUsers([activeUser]);
        }
      }
    } catch (err) {
      console.warn('[UserSessionContext] Failed to fetch session/users:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  const loginUser = useCallback((user: User) => {
    setCurrentUser(user);
    setAllUsers((prev) => {
      const filtered = prev.filter((u) => u.id !== user.id);
      return [user, ...filtered];
    });
    try {
      localStorage.setItem('brilian_active_user_id', user.id);
      localStorage.setItem('brilian_user_status', user.status || 'active');
      document.cookie = `brilian_active_user_id=${encodeURIComponent(user.id)}; path=/; max-age=2592000; SameSite=Lax`;
      document.cookie = `brilian_user_status=${encodeURIComponent(user.status || 'active')}; path=/; max-age=2592000; SameSite=Lax`;
      document.cookie = `brilian_chat_access=${user.role?.permissions.includes('chat:query') ? '1' : '0'}; path=/; max-age=2592000; SameSite=Lax`;
    } catch {}
  }, []);

  const switchUser = useCallback(
    (userId: string) => {
      const target = allUsers.find((u) => u.id === userId);
      if (!target) return;

      if (target.status === 'pending_approval') {
        toast.warning(`Akun "${target.name}" masih menunggu persetujuan Super Administrator.`);
        return;
      }

      if (target.status === 'inactive') {
        toast.error(`Akun "${target.name}" sedang nonaktif dan tidak dapat digunakan.`);
        return;
      }

      setCurrentUser(target);
      try {
        localStorage.setItem('brilian_active_user_id', target.id);
        localStorage.setItem('brilian_user_status', target.status);
        document.cookie = `brilian_active_user_id=${encodeURIComponent(target.id)}; path=/; max-age=2592000; SameSite=Lax`;
        document.cookie = `brilian_user_status=${encodeURIComponent(target.status)}; path=/; max-age=2592000; SameSite=Lax`;
        document.cookie = `brilian_chat_access=${target.role?.permissions.includes('chat:query') ? '1' : '0'}; path=/; max-age=2592000; SameSite=Lax`;
      } catch {}

      toast.success(`Beralih akun aktif ke: ${target.name} (${target.role?.name || target.role_id})`);
    },
    [allUsers]
  );

  const logout = useCallback(async () => {
    setCurrentUser(null);
    setAllUsers([]);
    try {
      localStorage.removeItem('brilian_active_user_id');
      localStorage.removeItem('brilian_user_status');
      document.cookie = 'brilian_active_user_id=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'brilian_user_status=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'brilian_chat_access=; path=/; max-age=0; SameSite=Lax';
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch {}
    window.location.href = '/login';
  }, []);

  const hasPermission = useCallback(
    (permission: PermissionKey): boolean => {
      if (!currentUser) return false;

      // Strictly check permissions defined for this role in database/matrix
      const userPermissions =
        currentUser.role?.permissions ||
        roles.find((r) => r.id === currentUser.role_id)?.permissions ||
        [];

      // Fallback for admin role if permissions array is somehow empty
      if (currentUser.role_id === 'admin' && userPermissions.length === 0) {
        return true;
      }

      return userPermissions.includes(permission);
    },
    [currentUser, roles]
  );

  return (
    <UserSessionContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        allUsers,
        roles,
        isLoading,
        hasPermission,
        loginUser,
        switchUser,
        refreshUsers: fetchUsersAndRoles,
        logout,
      }}
    >
      {children}
    </UserSessionContext.Provider>
  );
}

export function useUserSession() {
  const context = useContext(UserSessionContext);
  if (!context) {
    throw new Error('useUserSession must be used within a UserSessionProvider');
  }
  return context;
}
