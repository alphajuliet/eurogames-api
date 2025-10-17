import { Env, PlayRecord, PlaysParams, RouteHandler } from '../types';
import { 
  createResponse, 
  createErrorResponse, 
  createPaginatedResponse, 
  parseQueryParams, 
  validateGameId, 
  validateDate,
  handleDatabaseError,
  sanitizeInput,
  getCurrentDate
} from '../utils';

export const getPlays: RouteHandler = async (request, env) => {
  try {
    const url = new URL(request.url);
    const params = parseQueryParams(url) as PlaysParams;
    
    const limit = Math.min(params.limit || 15, 500);
    const offset = params.offset || 0;
    const gameId = params.gameId;
    const winner = params.winner;
    const since = params.since as string;

    let whereClause = '';
    const queryParams: any[] = [];

    const conditions = [];
    
    if (gameId) {
      const validGameId = validateGameId(gameId.toString());
      if (!validGameId) {
        return createErrorResponse('INVALID_GAME_ID', 'Invalid game ID provided', 400);
      }
      conditions.push('played.id = ?');
      queryParams.push(validGameId);
    }

    if (winner) {
      conditions.push('winner = ?');
      queryParams.push(sanitizeInput(winner));
    }

    if (since) {
      if (!validateDate(since)) {
        return createErrorResponse('INVALID_DATE', 'Date must be in YYYY-MM-DD format', 400);
      }
      conditions.push('date >= ?');
      queryParams.push(since);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM played 
      ${whereClause}
    `;

    const dataQuery = `
      SELECT date, id, name, winner, scores, comment
      FROM played 
      ${whereClause}
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, playsResult] = await Promise.all([
      env.DB.prepare(countQuery).bind(...queryParams).first(),
      env.DB.prepare(dataQuery).bind(...queryParams, limit, offset).all()
    ]);

    const total = countResult?.total || 0;
    const plays = playsResult.results || [];

    return createPaginatedResponse(plays, total, limit, offset);

  } catch (error: any) {
    return handleDatabaseError(error, 'getPlays');
  }
};

export const getPlayById: RouteHandler = async (request, env, params) => {
  try {
    const playId = validateGameId(params?.id || '');
    if (!playId) {
      return createErrorResponse('INVALID_PLAY_ID', 'Invalid play ID provided', 400);
    }

    const query = `
      SELECT date, id as gameId, name as gameName, winner, scores, comment
      FROM played 
      WHERE rowid = ?
    `;

    const playResult = await env.DB.prepare(query).bind(playId).first();

    if (!playResult) {
      return createErrorResponse('PLAY_NOT_FOUND', 'Play record not found', 404);
    }

    return createResponse(playResult);

  } catch (error: any) {
    return handleDatabaseError(error, 'getPlayById');
  }
};

export const addPlay: RouteHandler = async (request, env) => {
  try {
    const body = await request.json();
    const { game_id, date, winner, scores, comment } = body;

    if (!game_id) {
      return createErrorResponse('MISSING_GAME_ID', 'Game ID is required', 400);
    }

    const gameId = validateGameId(game_id.toString());
    if (!gameId) {
      return createErrorResponse('INVALID_GAME_ID', 'Invalid game ID provided', 400);
    }

    if (!winner || typeof winner !== 'string') {
      return createErrorResponse('MISSING_WINNER', 'Winner is required', 400);
    }

    const playDate = date || getCurrentDate();
    if (!validateDate(playDate)) {
      return createErrorResponse('INVALID_DATE', 'Date must be in YYYY-MM-DD format', 400);
    }

    const gameExists = await env.DB.prepare('SELECT id FROM bgg WHERE id = ?')
      .bind(gameId)
      .first();

    if (!gameExists) {
      return createErrorResponse('GAME_NOT_FOUND', 'Game not found', 404);
    }

    const validPlayers = ['Andrew', 'Trish', 'Draw'];
    if (!validPlayers.includes(winner)) {
      return createErrorResponse(
        'INVALID_WINNER', 
        'Winner must be one of: ' + validPlayers.join(', '), 
        400
      );
    }

    const insertQuery = `
      INSERT INTO log (date, id, winner, scores, comment) 
      VALUES (?, ?, ?, ?, ?)
    `;

    const result = await env.DB.prepare(insertQuery)
      .bind(
        playDate,
        gameId,
        sanitizeInput(winner),
        scores ? sanitizeInput(scores) : '',
        comment ? sanitizeInput(comment) : ''
      )
      .run();

    const newPlay = {
      id: result.meta.last_row_id,
      date: playDate,
      gameId,
      winner: sanitizeInput(winner),
      scores: scores ? sanitizeInput(scores) : '',
      comment: comment ? sanitizeInput(comment) : ''
    };

    return createResponse(newPlay, 201);

  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', 400);
    }
    return handleDatabaseError(error, 'addPlay');
  }
};

export const updatePlay: RouteHandler = async (request, env, params) => {
  try {
    const playId = validateGameId(params?.id || '');
    if (!playId) {
      return createErrorResponse('INVALID_PLAY_ID', 'Invalid play ID provided', 400);
    }

    const body = await request.json();
    const { game_id, date, winner, scores, comment } = body;

    const existingPlay = await env.DB.prepare('SELECT rowid FROM log WHERE rowid = ?')
      .bind(playId)
      .first();

    if (!existingPlay) {
      return createErrorResponse('PLAY_NOT_FOUND', 'Play record not found', 404);
    }

    const updates = [];
    const queryParams: any[] = [];

    if (game_id !== undefined) {
      const gameId = validateGameId(game_id.toString());
      if (!gameId) {
        return createErrorResponse('INVALID_GAME_ID', 'Invalid game ID provided', 400);
      }
      
      const gameExists = await env.DB.prepare('SELECT id FROM bgg WHERE id = ?')
        .bind(gameId)
        .first();
      
      if (!gameExists) {
        return createErrorResponse('GAME_NOT_FOUND', 'Game not found', 404);
      }
      
      updates.push('id = ?');
      queryParams.push(gameId);
    }

    if (date !== undefined) {
      if (!validateDate(date)) {
        return createErrorResponse('INVALID_DATE', 'Date must be in YYYY-MM-DD format', 400);
      }
      updates.push('date = ?');
      queryParams.push(date);
    }

    if (winner !== undefined) {
      const validPlayers = ['Andrew', 'Trish', 'Draw'];
      if (!validPlayers.includes(winner)) {
        return createErrorResponse(
          'INVALID_WINNER', 
          'Winner must be one of: ' + validPlayers.join(', '), 
          400
        );
      }
      updates.push('winner = ?');
      queryParams.push(sanitizeInput(winner));
    }

    if (scores !== undefined) {
      updates.push('scores = ?');
      queryParams.push(sanitizeInput(scores));
    }

    if (comment !== undefined) {
      updates.push('comment = ?');
      queryParams.push(sanitizeInput(comment));
    }

    if (updates.length === 0) {
      return createErrorResponse('NO_UPDATES', 'No valid fields to update', 400);
    }

    const updateQuery = `UPDATE log SET ${updates.join(', ')} WHERE rowid = ?`;
    queryParams.push(playId);

    await env.DB.prepare(updateQuery).bind(...queryParams).run();

    const updatedPlay = await env.DB.prepare(`
      SELECT date, id as gameId, winner, scores, comment
      FROM log 
      WHERE rowid = ?
    `).bind(playId).first();

    return createResponse(updatedPlay);

  } catch (error: any) {
    if (error instanceof SyntaxError) {
      return createErrorResponse('INVALID_JSON', 'Invalid JSON in request body', 400);
    }
    return handleDatabaseError(error, 'updatePlay');
  }
};

export const deletePlay: RouteHandler = async (request, env, params) => {
  try {
    const playId = validateGameId(params?.id || '');
    if (!playId) {
      return createErrorResponse('INVALID_PLAY_ID', 'Invalid play ID provided', 400);
    }

    const existingPlay = await env.DB.prepare('SELECT rowid FROM log WHERE rowid = ?')
      .bind(playId)
      .first();

    if (!existingPlay) {
      return createErrorResponse('PLAY_NOT_FOUND', 'Play record not found', 404);
    }

    await env.DB.prepare('DELETE FROM log WHERE rowid = ?').bind(playId).run();

    return new Response(null, { 
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error: any) {
    return handleDatabaseError(error, 'deletePlay');
  }
};

export const getGameHistory: RouteHandler = async (request, env, params) => {
  try {
    const gameId = validateGameId(params?.id || '');
    if (!gameId) {
      return createErrorResponse('INVALID_GAME_ID', 'Invalid game ID provided', 400);
    }

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const gameExists = await env.DB.prepare('SELECT id FROM bgg WHERE id = ?')
      .bind(gameId)
      .first();

    if (!gameExists) {
      return createErrorResponse('GAME_NOT_FOUND', 'Game not found', 404);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM log 
      WHERE id = ?
    `;

    const dataQuery = `
      SELECT date, winner, scores, comment
      FROM log 
      WHERE id = ?
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, historyResult] = await Promise.all([
      env.DB.prepare(countQuery).bind(gameId).first(),
      env.DB.prepare(dataQuery).bind(gameId, limit, offset).all()
    ]);

    const total = countResult?.total || 0;
    const history = historyResult.results || [];

    return createPaginatedResponse(history, total, limit, offset);

  } catch (error: any) {
    return handleDatabaseError(error, 'getGameHistory');
  }
};