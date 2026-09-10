'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Role, PermissionKey } from '@/types/user';
import { toast } from 'sonner';

interface UserSessionContextType {
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  allUsers: User[];
  roles: Role[];
  isLoading: boolean;
  hasPermission: (permission: PermissionKey) => boolean;
  switchUser: (userId: string) => void;
  refreshUsers: () => Promise<void>;
}

const UserSessionContext = createContext<UserSessionContextType | undefined>(undefined);

export const DEFAULT_ADMIN_USER: User = {
  id: 'a0000000-0000-0000-0000-000000000001',
  name: 'Muhammad Sazidan',
  email: 'admin@brilian.ai',
  role_id: 'admin',
  status: 'active',
  department: 'IT & Architecture',
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
  const [currentUser, setCurrentUser] = useState<User | null>(DEFAULT_ADMIN_USER);
  const [allUsers, setAllUsers] = useState<User[]>([DEFAULT_ADMIN_USER]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsersAndRoles = useCallback(async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/roles'),
      ]);

      let loadedUsers: User[] = [];
      let loadedRoles: Role[] = [];

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        loadedRoles = rolesData.roles || [];
        setRoles(loadedRoles);
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        loadedUsers = usersData.users || [];
        if (loadedUsers.length > 0) {
          setAllUsers(loadedUsers);
        }
      }

      // Check saved user in localStorage
      const savedUserId = localStorage.getItem('brilian_active_user_id');
      if (savedUserId && loadedUsers.length > 0) {
        const match = loadedUsers.find((u) => u.id === savedUserId);
        if (match) {
          setCurrentUser(match);
          return;
        }
      }

      // Fallback: Default to admin or first user
      if (loadedUsers.length > 0) {
        const admin = loadedUsers.find((u) => u.role_id === 'admin') || loadedUsers[0];
        setCurrentUser(admin);
      }
    } catch (err) {
      console.warn('[UserSessionContext] Failed to fetch users & roles:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  const switchUser = useCallback(
    (userId: string) => {
      const target = allUsers.find((u) => u.id === userId);
      if (!target) return;

      if (target.status === 'inactive') {
        toast.error(`Akun "${target.name}" sedang nonaktif dan tidak dapat digunakan.`);
        return;
      }

      setCurrentUser(target);
      try {
        localStorage.setItem('brilian_active_user_id', target.id);
      } catch {}

      toast.success(`Beralih akun aktif ke: ${target.name} (${target.role?.name || target.role_id})`);
    },
    [allUsers]
  );

  const hasPermission = useCallback(
    (permission: PermissionKey): boolean => {
      if (!currentUser) return false;
      // Admin role always has all permissions
      if (currentUser.role_id === 'admin') return true;

      const userPermissions = currentUser.role?.permissions || [];
      return userPermissions.includes(permission);
    },
    [currentUser]
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
        switchUser,
        refreshUsers: fetchUsersAndRoles,
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
