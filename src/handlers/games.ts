import { Env, Game, GameWithNotes, GameListParams, RouteHandler } from '../types';
import { 
  createResponse, 
  createErrorResponse, 
  createPaginatedResponse, 
  parseQueryParams, 
  validateGameId, 
  handleDatabaseError,
  validateGameStatus,
  sanitizeInput
} from '../utils';

export const getGames: RouteHandler = async (request, env) => {
  try {
    const url = new URL(request.url);
    const params = parseQueryParams(url) as GameListParams;
    
    const status = params.status || 'Playing';
    const limit = Math.min(params.limit || 100, 500);
    const offset = params.offset || 0;
    const search = params.search ? sanitizeInput(params.search as string) : null;
    const sort = params.sort || 'name';

    let whereClause = 'WHERE status = ?';
    let queryParams: any[] = [status];

    if (search) {
      whereClause += ' AND name LIKE ?';
      queryParams.push(`%${search}%`);
    }

    const validSortColumns = ['name', 'complexity', 'ranking', 'lastPlayed'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'name';

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM game_list2 
      ${whereClause}
    `;

    const dataQuery = `
      SELECT id, name, status, complexity, ranking, games, lastPlayed, uri
      FROM game_list2 
      ${whereClause}
      ORDER BY ${sortColumn}
      LIMIT ? OFFSET ?
    `;

    const [countResult, gamesResult] = await Promise.all([
      env.DB.prepare(countQuery).bind(...queryParams).first(),
      env.DB.prepare(dataQuery).bind(...queryParams, limit, offset).all()
    ]);

    const total = countResult?.total || 0;
    const games = gamesResult.results || [];

    return createPaginatedResponse(games, total, limit, offset);

  } catch (error: any) {
    return handleDatabaseError(error, 'getGames');
  }
};

export const getGameById: RouteHandler = async (request, env, params) => {
  try {
    const gameId = validateGameId(params?.id || '');
    if (!gameId) {
      return createErrorResponse('INVALID_GAME_ID', 'Invalid game ID provided', 400);
    }

    const gameQuery = `
      SELECT 
        bgg.*,
        notes.status,
        notes.platform,
        notes.uri,
        notes.comment
      FROM bgg 
      LEFT JOIN notes ON bgg.id = notes.id 
      WHERE bgg.id = ?
    `;

    const statsQuery = `
      SELECT 
        COUNT(*) as totalPlays,
        MAX(date) as lastPlayed,
        julianday('now') - julianday(MAX(date)) as daysSince
      FROM log 
      WHERE id = ?
    `;

    const winsQuery = `
      SELECT winner, COUNT(*) as wins 
      FROM log 
      WHERE id = ? 
      GROUP BY winner
    `;

    const [gameResult, statsResult, winsResult] = await Promise.all([
      env.DB.prepare(gameQuery).bind(gameId).first(),
      env.DB.prepare(statsQuery).bind(gameId).first(),
      env.DB.prepare(winsQuery).bind(gameId).all()
    ]);

    if (!gameResult) {
      return createErrorResponse('GAME_NOT_FOUND', 'Game not found', 404);
    }

    const wins: Record<string, number> = {};
    winsResult.results?.forEach((row: any) => {
      wins[row.winner] = row.wins;
    });

    const gameWithNotes: GameWithNotes = {
      ...gameResult,
      notes: {
        id: gameResult.id,
        status: gameResult.status || 'Inbox',
        platform: gameResult.platform || '',
        uri: gameResult.uri || '',
        comment: gameResult.comment || ''
      },
      stats: {
        totalPlays: statsResult?.totalPlays || 0,
        lastPlayed: statsResult?.lastPlayed || undefined,
        daysSinceLastPlayed: Math.floor(statsResult?.daysSince || 0),
        wins
      }
    };

    return createResponse(gameWithNotes);

  } catch (error: any) {
    return handleDatabaseError(error, 'getGameById');
  }
};

export const addGame: RouteHandler = async (request, env) => {
  try {
    const body = await request.json();
    const bggId = body.bgg_id;

    if (!bggId || !validateGameId(bggId.toString())) {
      return createErrorResponse('INVALID_BGG_ID', 'Valid BGG ID is required', 400);
    }

    const existingGame = await env.DB.prepare('SELECT id FROM bgg WHERE id = ?')
      .bind(bggId)
      .first();

    if (existingGame) {
      return createErrorResponse('GAME_EXISTS', 'Game already exists in database', 409);
    }

    return createErrorResponse(
      'BGG_SYNC_NOT_IMPLEMENTED', 
      'BGG sync functionality not yet implemented. Use existing sync scripts.', 
      501
    );

  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', 400);
    }
    return handleDatabaseError(error, 'addGame');
  }
};

export const updateGameNotes: RouteHandler = async (request, env, params) => {
  try {
    const gameId = validateGameId(params?.id || '');
    if (!gameId) {
      return createErrorResponse('INVALID_GAME_ID', 'Invalid game ID provided', 400);
    }

    const body = await request.json();
    const { status, platform, uri, comment } = body;

    if (status && !validateGameStatus(status)) {
      return createErrorResponse(
        'INVALID_STATUS', 
        'Status must be one of: Playing, Inbox, Completed, Sold, Wishlisted', 
        400
      );
    }

    const gameExists = await env.DB.prepare('SELECT id FROM bgg WHERE id = ?')
      .bind(gameId)
      .first();

    if (!gameExists) {
      return createErrorResponse('GAME_NOT_FOUND', 'Game not found', 404);
    }

    const notesExists = await env.DB.prepare('SELECT id FROM notes WHERE id = ?')
      .bind(gameId)
      .first();

    let query: string;
    let queryParams: any[];

    if (notesExists) {
      const updates = [];
      queryParams = [];

      if (status !== undefined) {
        updates.push('status = ?');
        queryParams.push(sanitizeInput(status));
      }
      if (platform !== undefined) {
        updates.push('platform = ?');
        queryParams.push(sanitizeInput(platform));
      }
      if (uri !== undefined) {
        updates.push('uri = ?');
        queryParams.push(sanitizeInput(uri));
      }
      if (comment !== undefined) {
        updates.push('comment = ?');
        queryParams.push(sanitizeInput(comment));
      }

      if (updates.length === 0) {
        return createErrorResponse('NO_UPDATES', 'No valid fields to update', 400);
      }

      query = `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`;
      queryParams.push(gameId);
    } else {
      query = 'INSERT INTO notes (id, status, platform, uri, comment) VALUES (?, ?, ?, ?, ?)';
      queryParams = [
        gameId,
        status ? sanitizeInput(status) : 'Inbox',
        platform ? sanitizeInput(platform) : '',
        uri ? sanitizeInput(uri) : '',
        comment ? sanitizeInput(comment) : ''
      ];
    }

    await env.DB.prepare(query).bind(...queryParams).run();

    const updatedNotes = await env.DB.prepare('SELECT * FROM notes WHERE id = ?')
      .bind(gameId)
      .first();

    return createResponse(updatedNotes);

  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', 400);
    }
    return handleDatabaseError(error, 'updateGameNotes');
  }
};

export const syncGameData: RouteHandler = async (request, env, params) => {
  try {
    const gameId = validateGameId(params?.id || '');
    if (!gameId) {
      return createErrorResponse('INVALID_GAME_ID', 'Invalid game ID provided', 400);
    }

    const gameExists = await env.DB.prepare('SELECT id FROM bgg WHERE id = ?')
      .bind(gameId)
      .first();

    if (!gameExists) {
      return createErrorResponse('GAME_NOT_FOUND', 'Game not found', 404);
    }

    return createErrorResponse(
      'BGG_SYNC_NOT_IMPLEMENTED',
      'BGG sync functionality not yet implemented. Use existing sync scripts.',
      501
    );

  } catch (error: any) {
    return handleDatabaseError(error, 'syncGameData');
  }
};