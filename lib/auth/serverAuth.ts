import { NextRequest } from 'next/server';
import { getUserById } from '@lib/db/userStore';
import { validateSession } from '@lib/db/sessionStore';
import type { PermissionKey, User } from '@/types/user';
import type { DocumentClassification } from '@/types/document';

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
  try {
    // 1. Enterprise Database Session Validation (Primary Secure Path)
    const sessionToken = request.cookies.get('brilian_session_token')?.value;
    if (sessionToken) {
      const sessionUser = await validateSession(sessionToken);
      if (sessionUser && sessionUser.status === 'active') {
        return sessionUser;
      }
    }

    // 2. Strict development/testing-only fallback (disabled in production)
    const isLocalDevOrTest =
      process.env.NODE_ENV !== 'production' &&
      !process.env.DOCKER_CONTAINER &&
      process.env.ENABLE_INSECURE_DEV_AUTH === 'true';

    if (isLocalDevOrTest) {
      const userId = readUserId(request);
      if (!userId) return null;
      const user = await getUserById(userId);
      if (!user || user.status !== 'active') return null;
      return user;
    }

    return null;
  } catch (err) {
    console.warn('[serverAuth] getAuthenticatedUser error:', err);
    return null;
  }
}

export async function hasServerPermission(
  request: NextRequest,
  permission: PermissionKey
): Promise<boolean> {
  const user = await getAuthenticatedUser(request);
  return Boolean(user?.role?.permissions.includes(permission));
}

/**
 * Returns allowed document classifications for a specific role according to role settings or PRD v2.0 defaults.
 */
export function getAllowedClassificationsForRole(
  roleOrId?: string | { id?: string; allowed_classifications?: DocumentClassification[] }
): DocumentClassification[] {
  if (roleOrId && typeof roleOrId === 'object') {
    if (Array.isArray(roleOrId.allowed_classifications) && roleOrId.allowed_classifications.length > 0) {
      return roleOrId.allowed_classifications;
    }
    return getAllowedClassificationsForRole(roleOrId.id);
  }

  const roleId = typeof roleOrId === 'string' ? roleOrId : undefined;
  switch (roleId) {
    case 'superadmin':
    case 'admin':
      return ['Publik', 'Internal', 'Rahasia', 'Sangat Rahasia'];
    case 'editor':
      return ['Publik', 'Internal', 'Rahasia'];
    case 'member':
    default:
      return ['Publik', 'Internal'];
  }
}

/**
 * Enterprise ABAC + RBAC + User Grants: Verifies if a user has clearance to access a specific document.
 * Checks:
 * 1. Global admin clearance
 * 2. Document owner clearance
 * 3. Explicit user access grant (User Whitelist / Invite)
 * 4. Division + Classification clearance
 */
export function canUserAccessDocument(
  user: { id?: string; role_id?: string; department?: string; role?: { id?: string; allowed_classifications?: DocumentClassification[] } } | null | undefined,
  doc: { id?: string; classification?: DocumentClassification | string; division_id?: string; owner_id?: string | null },
  explicitGrantedBatchIds?: Set<string> | string[]
): boolean {
  const docClassification = (doc.classification || 'Internal') as DocumentClassification;

  // 1. Unauthenticated guest can only view 'Publik' documents
  if (!user) {
    return docClassification === 'Publik';
  }

  // 2. Owner can always access their own documents
  if (doc.owner_id && user.id && doc.owner_id === user.id) {
    return true;
  }

  // 3. Superadmin & Admin have global enterprise clearance
  if (user.role_id === 'superadmin' || user.role_id === 'admin') {
    return true;
  }

  // 4. Explicit user access grant (additive rule: admin or doc owner explicitly invited this user)
  if (doc.id && explicitGrantedBatchIds) {
    if (explicitGrantedBatchIds instanceof Set) {
      if (explicitGrantedBatchIds.has(doc.id)) return true;
    } else if (Array.isArray(explicitGrantedBatchIds)) {
      if (explicitGrantedBatchIds.includes(doc.id)) return true;
    }
  }

  // 5. Classification check
  const allowedClassifications = getAllowedClassificationsForRole(user.role || user.role_id);
  if (!allowedClassifications.includes(docClassification)) {
    return false;
  }

  // 6. Division check (ABAC)
  if (!doc.division_id || doc.division_id === 'General' || doc.division_id === 'all') {
    return true;
  }
  const userDept = user.department?.trim();
  if (userDept && userDept.toLowerCase() === doc.division_id.toLowerCase()) {
    return true;
  }

  return false;
}

/**
 * Asynchronously checks document access, resolving explicit grants from the database if needed.
 */
export async function canUserAccessDocumentAsync(
  user: { id?: string; role_id?: string; department?: string; role?: { id?: string; allowed_classifications?: DocumentClassification[] } } | null | undefined,
  doc: { id?: string; classification?: DocumentClassification | string; division_id?: string; owner_id?: string | null }
): Promise<{ canAccess: boolean; canEdit: boolean; accessLevel?: 'viewer' | 'editor' | 'owner' | 'admin' | null }> {
  if (!user) {
    const isPublic = doc.classification === 'Publik';
    return { canAccess: isPublic, canEdit: false };
  }

  if (doc.owner_id && user.id && doc.owner_id === user.id) {
    return { canAccess: true, canEdit: true, accessLevel: 'owner' };
  }

  if (user.role_id === 'superadmin' || user.role_id === 'admin') {
    return { canAccess: true, canEdit: true, accessLevel: 'admin' };
  }

  // Check explicit grant from database
  if (doc.id && user.id) {
    try {
      const { getUserDocumentGrant } = await import('@lib/db/documentGrantStore');
      const grant = await getUserDocumentGrant(doc.id, user.id);
      if (grant) {
        return {
          canAccess: true,
          canEdit: grant.access_level === 'editor',
          accessLevel: grant.access_level,
        };
      }
    } catch {
      // quiet fallback
    }
  }

  const canAccess = canUserAccessDocument(user, doc);
  const canEdit = canAccess && user.role_id === 'editor';
  return {
    canAccess,
    canEdit,
    accessLevel: canAccess ? (canEdit ? 'editor' : 'viewer') : null,
  };
}

