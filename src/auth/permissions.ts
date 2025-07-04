/**
 * Permission management system
 * @module auth/permissions
 * @nist ac-3 "Access enforcement"
 * @nist ac-4 "Information flow enforcement"
 */

import { AppError } from '../core/errors/app-error.js';
import { logSecurityEvent, SecurityEventType } from '../utils/logger.js';

/**
 * Permission types for the system
 */
export enum Permission {
  // Session permissions
  SESSION_CREATE = 'session:create',
  SESSION_READ = 'session:read',
  SESSION_UPDATE = 'session:update',
  SESSION_DELETE = 'session:delete',
  SESSION_LIST = 'session:list',
  SESSION_REFRESH = 'session:refresh',
  
  // Context permissions
  CONTEXT_CREATE = 'context:create',
  CONTEXT_READ = 'context:read',
  CONTEXT_UPDATE = 'context:update',
  CONTEXT_DELETE = 'context:delete',
  CONTEXT_LIST = 'context:list',
  CONTEXT_EXECUTE = 'context:execute',
  
  // API key permissions
  API_KEY_CREATE = 'apikey:create',
  API_KEY_READ = 'apikey:read',
  API_KEY_DELETE = 'apikey:delete',
  API_KEY_LIST = 'apikey:list',
  
  // Subscription permissions
  SUBSCRIPTION_CREATE = 'subscription:create',
  SUBSCRIPTION_READ = 'subscription:read',
  SUBSCRIPTION_DELETE = 'subscription:delete',
  
  // Admin permissions
  ADMIN_ALL = 'admin:*',
  ADMIN_USERS = 'admin:users',
  ADMIN_SESSIONS = 'admin:sessions',
  ADMIN_METRICS = 'admin:metrics',
}

/**
 * Role definitions with their permissions
 */
const rolePermissionsObject: Record<string, Permission[]> = {
  // Basic user role
  user: [
    Permission.SESSION_CREATE,
    Permission.SESSION_READ,
    Permission.SESSION_UPDATE,
    Permission.SESSION_DELETE,
    Permission.SESSION_LIST,
    Permission.SESSION_REFRESH,
    Permission.CONTEXT_CREATE,
    Permission.CONTEXT_READ,
    Permission.CONTEXT_UPDATE,
    Permission.CONTEXT_DELETE,
    Permission.CONTEXT_LIST,
    Permission.API_KEY_CREATE,
    Permission.API_KEY_READ,
    Permission.API_KEY_DELETE,
    Permission.API_KEY_LIST,
    Permission.SUBSCRIPTION_CREATE,
    Permission.SUBSCRIPTION_READ,
    Permission.SUBSCRIPTION_DELETE,
  ],
  
  // Power user with execute permissions
  poweruser: [
    Permission.SESSION_CREATE,
    Permission.SESSION_READ,
    Permission.SESSION_UPDATE,
    Permission.SESSION_DELETE,
    Permission.SESSION_LIST,
    Permission.SESSION_REFRESH,
    Permission.CONTEXT_CREATE,
    Permission.CONTEXT_READ,
    Permission.CONTEXT_UPDATE,
    Permission.CONTEXT_DELETE,
    Permission.CONTEXT_LIST,
    Permission.API_KEY_CREATE,
    Permission.API_KEY_READ,
    Permission.API_KEY_DELETE,
    Permission.API_KEY_LIST,
    Permission.SUBSCRIPTION_CREATE,
    Permission.SUBSCRIPTION_READ,
    Permission.SUBSCRIPTION_DELETE,
    Permission.CONTEXT_EXECUTE,
  ],
  
  // Admin with all permissions
  admin: [
    Permission.ADMIN_ALL,
  ],
  
  // Read-only role
  readonly: [
    Permission.SESSION_READ,
    Permission.SESSION_LIST,
    Permission.CONTEXT_READ,
    Permission.CONTEXT_LIST,
    Permission.API_KEY_READ,
    Permission.API_KEY_LIST,
    Permission.SUBSCRIPTION_READ,
  ],
  
  // Service account role (for API keys)
  service: [
    Permission.SESSION_CREATE,
    Permission.SESSION_READ,
    Permission.SESSION_LIST,
    Permission.CONTEXT_CREATE,
    Permission.CONTEXT_READ,
    Permission.CONTEXT_UPDATE,
    Permission.CONTEXT_DELETE,
    Permission.CONTEXT_LIST,
    Permission.CONTEXT_EXECUTE,
  ],
};

// Convert to Map to avoid object injection issues
export const RolePermissions = new Map(Object.entries(rolePermissionsObject));

/**
 * Check if a set of roles has a specific permission
 * @nist ac-3 "Access enforcement"
 */
export function hasPermission(
  roles: string[],
  permission: Permission,
  scopes?: string[]
): boolean {
  // Check if user has admin:* permission
  if (roles.includes('admin')) {
    return true;
  }
  
  // Check role-based permissions
  if (checkRolePermissions(roles, permission)) {
    return true;
  }
  
  // Check scope-based permissions (for API keys)
  if (scopes && checkScopePermissions(scopes, permission)) {
    return true;
  }
  
  return false;
}

/**
 * Check role-based permissions
 */
function checkRolePermissions(roles: string[], permission: Permission): boolean {
  for (const role of roles) {
    const rolePerms = RolePermissions.get(role);
    if (!rolePerms) {
      continue;
    }
    
    // Check for exact permission match or wildcard admin permission
    if (rolePerms.includes(permission) || rolePerms.includes(Permission.ADMIN_ALL)) {
      return true;
    }
  }
  return false;
}

/**
 * Check scope-based permissions
 */
function checkScopePermissions(scopes: string[], permission: Permission): boolean {
  // Check for wildcard scope
  if (scopes.includes('*')) {
    return true;
  }
  
  // Check for specific permission in scopes
  if (scopes.includes(permission)) {
    return true;
  }
  
  // Check for resource wildcard (e.g., "context:*" matches "context:read")
  const [resource] = permission.split(':');
  if (scopes.includes(`${resource}:*`)) {
    return true;
  }
  
  return false;
}

/**
 * Require permission or throw error
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
interface PermissionCheckParams {
  userId: string;
  roles: string[];
  permission: Permission;
  resource: string;
  scopes?: string[];
}

/**
 * Require permission or throw error
 * @nist ac-3 "Access enforcement"
 * @nist au-3 "Content of audit records"
 */
export async function requirePermission({
  userId,
  roles,
  permission,
  resource,
  scopes
}: PermissionCheckParams): Promise<void> {
  if (!hasPermission(roles, permission, scopes)) {
    await logSecurityEvent(SecurityEventType.ACCESS_DENIED, {
      userId,
      resource,
      action: permission,
      result: 'failure',
      reason: 'Insufficient permissions',
      metadata: {
        requiredPermission: permission,
        userRoles: roles,
        userScopes: scopes,
      },
    });
    
    throw new AppError(
      `Permission denied: ${permission} required`,
      403
    );
  }
}

/**
 * Get all permissions for a set of roles
 */
export function getPermissionsForRoles(roles: string[]): Permission[] {
  const permissions = new Set<Permission>();
  
  for (const role of roles) {
    const rolePerms = RolePermissions.get(role);
    if (rolePerms) {
      for (const perm of rolePerms) {
        permissions.add(perm);
      }
    }
  }
  
  // If user has admin:*, add all permissions
  if (permissions.has(Permission.ADMIN_ALL)) {
    return Object.values(Permission);
  }
  
  return Array.from(permissions);
}

/**
 * Check if a permission string is valid
 */
export function isValidPermission(permission: string): permission is Permission {
  return Object.values(Permission).includes(permission as Permission);
}

/**
 * Parse permission from resource and action
 */
export function parsePermission(resource: string, action: string): Permission | null {
  const permissionString = `${resource}:${action}`;
  if (isValidPermission(permissionString)) {
    return permissionString;
  }
  return null;
}