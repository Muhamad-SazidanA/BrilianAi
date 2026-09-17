import { NextRequest } from 'next/server';
import { getUserById } from '@lib/db/userStore';
import type { PermissionKey, User } from '@/types/user';

function readUserId(request: NextRequest): string | null {
  const raw = request.cookies.get('brilian_active_user_id')?.value;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function getAuthenticatedUser(request: NextRequest): Promise<User | null> {
  const userId = readUserId(request);
  if (!userId) return null;
  const user = await getUserById(userId);
  if (!user || user.status !== 'active') return null;
  return user;
}

export async function hasServerPermission(
  request: NextRequest,
  permission: PermissionKey
): Promise<boolean> {
  const user = await getAuthenticatedUser(request);
  return Boolean(user?.role?.permissions.includes(permission));
}
