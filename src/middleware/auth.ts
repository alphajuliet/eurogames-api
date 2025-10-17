import { Env, AuthContext, Permission } from '../types';
import { createErrorResponse } from '../utils';

export interface AuthResult {
  valid: boolean;
  permissions: Permission[];
  keyId?: string;
}

export function extractApiKey(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const apiKeyHeader = request.headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

export async function validateApiKey(key: string, env: Env): Promise<AuthResult> {
  try {
    const apiKeysString = env.API_KEYS;
    if (!apiKeysString) {
      return { valid: false, permissions: [] };
    }

    const apiKeys = apiKeysString.split(',');
    for (const keyEntry of apiKeys) {
      const [keyValue, permissionLevel] = keyEntry.trim().split(':');
      if (keyValue === key) {
        const permissions = getPermissionsForLevel(permissionLevel);
        return {
          valid: true,
          permissions,
          keyId: keyValue.slice(0, 8) + '...'
        };
      }
    }

    return { valid: false, permissions: [] };
  } catch (error) {
    console.error('Error validating API key:', error);
    return { valid: false, permissions: [] };
  }
}

export function getPermissionsForLevel(level: string): Permission[] {
  switch (level?.toLowerCase()) {
    case 'admin':
      return ['read', 'write', 'delete', 'export', 'query'];
    case 'user':
      return ['read', 'write'];
    case 'read-only':
    case 'readonly':
      return ['read'];
    default:
      return [];
  }
}

export function hasPermission(userPermissions: Permission[], requiredPermission: Permission): boolean {
  return userPermissions.includes(requiredPermission);
}

export function getRequiredPermission(method: string, pathname: string): Permission {
  if (method === 'GET') {
    if (pathname === '/v1/export') {
      return 'export';
    }
    return 'read';
  }

  if (method === 'POST') {
    if (pathname === '/v1/query') {
      return 'query';
    }
    if (pathname.startsWith('/v1/games')) {
      return 'write';
    }
    if (pathname.startsWith('/v1/plays')) {
      return 'write';
    }
    return 'write';
  }

  if (method === 'PUT' || method === 'PATCH') {
    return 'write';
  }

  if (method === 'DELETE') {
    return 'delete';
  }

  return 'read';
}

export function isPublicRoute(method: string, pathname: string): boolean {
  const publicRoutes = [
    { method: 'GET', path: '/' },
    { method: 'GET', path: '' },
    { method: 'OPTIONS', path: '*' }
  ];

  for (const route of publicRoutes) {
    if (route.method === method && (route.path === '*' || route.path === pathname)) {
      return true;
    }
  }

  return false;
}

export async function authenticateRequest(request: Request, env: Env): Promise<AuthContext | Response> {
  const method = request.method;
  const pathname = new URL(request.url).pathname;

  if (isPublicRoute(method, pathname)) {
    return { authenticated: false, permissions: [] };
  }

  if (!env.REQUIRE_AUTH || env.REQUIRE_AUTH.toLowerCase() === 'false') {
    return {
      authenticated: true,
      permissions: ['read', 'write', 'delete', 'export', 'query'],
      keyId: 'dev-mode'
    };
  }

  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return createErrorResponse(
      'MISSING_API_KEY',
      'API key is required. Provide it via Authorization: Bearer <key> or X-API-Key header.',
      401
    );
  }

  const authResult = await validateApiKey(apiKey, env);
  if (!authResult.valid) {
    return createErrorResponse(
      'INVALID_API_KEY',
      'Invalid API key provided.',
      401
    );
  }

  const requiredPermission = getRequiredPermission(method, pathname);
  if (!hasPermission(authResult.permissions, requiredPermission)) {
    return createErrorResponse(
      'INSUFFICIENT_PERMISSIONS',
      `This operation requires '${requiredPermission}' permission.`,
      403
    );
  }

  return {
    authenticated: true,
    permissions: authResult.permissions,
    keyId: authResult.keyId
  };
}