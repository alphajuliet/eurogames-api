import { Env, RouteHandler, AuthContext } from './types';
import { handleCORS, createErrorResponse, matchesPattern, extractPathParams } from './utils';
import { authenticateRequest } from './middleware/auth';

import { 
  getGames, 
  getGameById, 
  addGame, 
  updateGameNotes, 
  syncGameData 
} from './handlers/games';

import { 
  getPlays, 
  getPlayById, 
  addPlay, 
  updatePlay, 
  deletePlay, 
  getGameHistory 
} from './handlers/plays';

import { 
  getWinnerStats, 
  getOverallTotals, 
  getLastPlayed, 
  getRecentPlays, 
  getPlayerStats, 
  getGameStats 
} from './handlers/stats';

interface Route {
  method: string;
  pattern: string;
  handler: RouteHandler;
}

const routes: Route[] = [
  // Games endpoints
  { method: 'GET', pattern: '/v1/games', handler: getGames },
  { method: 'GET', pattern: '/v1/games/{id}', handler: getGameById },
  { method: 'POST', pattern: '/v1/games', handler: addGame },
  { method: 'PATCH', pattern: '/v1/games/{id}/notes', handler: updateGameNotes },
  { method: 'PUT', pattern: '/v1/games/{id}/sync', handler: syncGameData },
  
  // Game history (specific game plays)
  { method: 'GET', pattern: '/v1/games/{id}/history', handler: getGameHistory },
  
  // Plays endpoints
  { method: 'GET', pattern: '/v1/plays', handler: getPlays },
  { method: 'GET', pattern: '/v1/plays/{id}', handler: getPlayById },
  { method: 'POST', pattern: '/v1/plays', handler: addPlay },
  { method: 'PUT', pattern: '/v1/plays/{id}', handler: updatePlay },
  { method: 'DELETE', pattern: '/v1/plays/{id}', handler: deletePlay },
  
  // Statistics endpoints
  { method: 'GET', pattern: '/v1/stats/winners', handler: getWinnerStats },
  { method: 'GET', pattern: '/v1/stats/totals', handler: getOverallTotals },
  { method: 'GET', pattern: '/v1/stats/last-played', handler: getLastPlayed },
  { method: 'GET', pattern: '/v1/stats/recent', handler: getRecentPlays },
  { method: 'GET', pattern: '/v1/stats/players/{player}', handler: getPlayerStats },
  { method: 'GET', pattern: '/v1/stats/games', handler: getGameStats },
];

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const corsResponse = handleCORS(request);
  if (corsResponse) {
    return corsResponse;
  }

  const authResult = await authenticateRequest(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  const url = new URL(request.url);
  const method = request.method;
  const pathname = url.pathname;

  for (const route of routes) {
    if (route.method === method && matchesPattern(pathname, route.pattern)) {
      try {
        const params = extractPathParams(pathname, route.pattern);
        return await route.handler(request, env, params, authResult);
      } catch (error: any) {
        console.error(`Error in route ${route.method} ${route.pattern}:`, error);
        return createErrorResponse(
          'INTERNAL_ERROR',
          'An internal server error occurred',
          500
        );
      }
    }
  }

  return createErrorResponse(
    'NOT_FOUND',
    `Route ${method} ${pathname} not found`,
    404
  );
}

async function handleExport(request: Request, env: Env): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';

    if (format !== 'json') {
      return createErrorResponse(
        'UNSUPPORTED_FORMAT',
        'Only JSON format is currently supported',
        400
      );
    }

    const [bggResult, notesResult, logResult] = await Promise.all([
      env.DB.prepare('SELECT * FROM bgg ORDER BY name').all(),
      env.DB.prepare('SELECT * FROM notes ORDER BY id').all(),
      env.DB.prepare('SELECT * FROM log ORDER BY date DESC').all()
    ]);

    const exportData = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      data: {
        bgg: bggResult.results || [],
        notes: notesResult.results || [],
        log: logResult.results || []
      }
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="eurogames-export-${new Date().toISOString().split('T')[0]}.json"`,
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('Export error:', error);
    return createErrorResponse(
      'EXPORT_ERROR',
      'Failed to export data',
      500
    );
  }
}

async function handleQuery(request: Request, env: Env): Promise<Response> {
  try {
    const authResult = await authenticateRequest(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }

    const body = await request.json() as any;
    const { sql } = body;

    if (!sql || typeof sql !== 'string') {
      return createErrorResponse(
        'MISSING_SQL',
        'SQL query is required',
        400
      );
    }

    const trimmedSql = sql.trim().toLowerCase();
    
    if (trimmedSql.startsWith('drop') || 
        trimmedSql.startsWith('delete') || 
        trimmedSql.startsWith('update') || 
        trimmedSql.startsWith('insert') ||
        trimmedSql.includes('pragma')) {
      return createErrorResponse(
        'FORBIDDEN_QUERY',
        'Only SELECT queries are allowed',
        403
      );
    }

    const result = await env.DB.prepare(sql).all();
    
    return new Response(JSON.stringify({
      data: result.results || [],
      meta: {
        query: sql,
        rowCount: result.results?.length || 0
      }
    }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(
        'INVALID_JSON',
        'Invalid JSON in request body',
        400
      );
    }

    console.error('Query error:', error);
    return createErrorResponse(
      'QUERY_ERROR',
      'Failed to execute query: ' + error.message,
      400
    );
  }
}

async function handleRoot(request: Request): Promise<Response> {
  const apiInfo = {
    name: 'Eurogames API',
    version: '1.0.0',
    description: 'REST API for Eurogames board game tracking system',
    authentication: {
      method: 'API Key',
      headers: ['Authorization: Bearer <key>', 'X-API-Key: <key>'],
      permissions: {
        'read': 'View games, plays, and statistics',
        'write': 'Add/modify games and plays',
        'delete': 'Delete play records',
        'export': 'Export data',
        'query': 'Execute custom queries'
      }
    },
    endpoints: {
      games: {
        'GET /v1/games': 'List games with optional filtering [read]',
        'GET /v1/games/{id}': 'Get game details [read]',
        'POST /v1/games': 'Add new game from BGG [write]',
        'PATCH /v1/games/{id}/notes': 'Update game notes [write]',
        'PUT /v1/games/{id}/sync': 'Sync game data from BGG [write]',
        'GET /v1/games/{id}/history': 'Get game play history [read]'
      },
      plays: {
        'GET /v1/plays': 'List game plays with filtering [read]',
        'POST /v1/plays': 'Record new game result [write]',
        'GET /v1/plays/{id}': 'Get specific play record [read]',
        'PUT /v1/plays/{id}': 'Update play record [write]',
        'DELETE /v1/plays/{id}': 'Delete play record [delete]'
      },
      statistics: {
        'GET /v1/stats/winners': 'Win statistics by game [read]',
        'GET /v1/stats/totals': 'Overall win totals [read]',
        'GET /v1/stats/last-played': 'Last played dates [read]',
        'GET /v1/stats/recent': 'Recent game plays [read]',
        'GET /v1/stats/players/{player}': 'Player statistics [read]',
        'GET /v1/stats/games': 'Game collection statistics [read]'
      },
      utilities: {
        'GET /v1/export': 'Export all data (JSON) [export]',
        'POST /v1/query': 'Execute custom SELECT query [query]'
      }
    },
    documentation: 'https://github.com/your-repo/eurogames-api'
  };

  return new Response(JSON.stringify(apiInfo, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === '/' || pathname === '') {
      return handleRoot(request);
    }

    if (pathname === '/v1/export' && request.method === 'GET') {
      return handleExport(request, env);
    }

    if (pathname === '/v1/query' && request.method === 'POST') {
      return handleQuery(request, env);
    }

    return handleRequest(request, env);
  }
};