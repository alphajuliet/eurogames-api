import { APIResponse, ErrorResponse } from './types';

export function createResponse<T>(
  data: T,
  status: number = 200,
  headers: Record<string, string> = {}
): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Content-Type': 'application/json',
    ...headers
  };

  const response: APIResponse<T> = { data };
  
  return new Response(JSON.stringify(response, null, 2), {
    status,
    headers: corsHeaders
  });
}

export function createErrorResponse(
  code: string,
  message: string,
  status: number = 400,
  details?: Record<string, any>
): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Content-Type': 'application/json'
  };

  const errorResponse: ErrorResponse = {
    error: {
      code,
      message,
      ...(details && { details })
    }
  };

  return new Response(JSON.stringify(errorResponse, null, 2), {
    status,
    headers: corsHeaders
  });
}

export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number
): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Content-Type': 'application/json'
  };

  const response: APIResponse<T[]> = {
    data,
    meta: {
      total,
      limit,
      offset
    }
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}

export function handleCORS(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  return null;
}

export function parseQueryParams(url: URL): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  
  for (const [key, value] of url.searchParams.entries()) {
    if (key === 'limit' || key === 'offset') {
      const num = parseInt(value, 10);
      if (!isNaN(num) && num >= 0) {
        params[key] = num;
      }
    } else {
      params[key] = value;
    }
  }
  
  return params;
}

export function validateGameId(id: string): number | null {
  const gameId = parseInt(id, 10);
  if (isNaN(gameId) || gameId <= 0) {
    return null;
  }
  return gameId;
}

export function validateDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
}

export function validateGameStatus(status: string): boolean {
  const validStatuses = ['Playing', 'Inbox', 'Completed', 'Sold', 'Wishlisted'];
  return validStatuses.includes(status);
}

export function getCurrentDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export async function handleDatabaseError(error: Error, operation: string): Promise<Response> {
  console.error(`Database error in ${operation}:`, error);
  
  if (error.message.includes('no such table')) {
    return createErrorResponse(
      'DATABASE_TABLE_NOT_FOUND',
      'Database table not found. Please ensure the database is properly migrated.',
      500
    );
  }
  
  if (error.message.includes('UNIQUE constraint failed')) {
    return createErrorResponse(
      'DUPLICATE_RECORD',
      'A record with this ID already exists.',
      409
    );
  }
  
  return createErrorResponse(
    'DATABASE_ERROR',
    'An error occurred while accessing the database.',
    500,
    { operation }
  );
}

export function extractPathParams(pathname: string, pattern: string): Record<string, string> {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');
  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      const paramName = patternPart.slice(1, -1);
      params[paramName] = pathParts[i];
    }
  }

  return params;
}

export function matchesPattern(pathname: string, pattern: string): boolean {
  const patternParts = pattern.split('/');
  const pathParts = pathname.split('/');

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const pathPart = pathParts[i];

    if (patternPart.startsWith('{') && patternPart.endsWith('}')) {
      continue;
    }

    if (patternPart !== pathPart) {
      return false;
    }
  }

  return true;
}