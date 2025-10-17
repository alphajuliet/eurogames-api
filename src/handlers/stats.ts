import { Env, WinnerStats, OverallTotals, LastPlayedGame, RouteHandler } from '../types';
import { 
  createResponse, 
  createErrorResponse, 
  createPaginatedResponse,
  parseQueryParams,
  handleDatabaseError
} from '../utils';

export const getWinnerStats: RouteHandler = async (request, env) => {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const countQuery = 'SELECT COUNT(*) as total FROM winner';
    
    const dataQuery = `
      SELECT name, id, Games, Andrew, Trish, Draw
      FROM winner 
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `;

    const [countResult, statsResult] = await Promise.all([
      env.DB.prepare(countQuery).first(),
      env.DB.prepare(dataQuery).bind(limit, offset).all()
    ]);

    const total = countResult?.total || 0;
    const stats = statsResult.results || [];

    const formattedStats = stats.map((row: any) => ({
      gameId: row.id,
      gameName: row.name,
      totalGames: row.Games,
      andrew: row.Andrew || 0,
      trish: row.Trish || 0,
      draw: row.Draw || 0
    }));

    return createPaginatedResponse(formattedStats, total, limit, offset);

  } catch (error: any) {
    return handleDatabaseError(error, 'getWinnerStats');
  }
};

export const getOverallTotals: RouteHandler = async (request, env) => {
  try {
    const query = `
      SELECT 
        SUM(Games) as totalGames,
        SUM(Andrew) as andrew,
        SUM(Trish) as trish,
        SUM(Draw) as draw
      FROM winner
    `;

    const result = await env.DB.prepare(query).first();

    if (!result) {
      return createResponse({
        totalGames: 0,
        players: { Andrew: 0, Trish: 0, Draw: 0 }
      });
    }

    const totals: OverallTotals = {
      totalGames: result.totalGames || 0,
      players: {
        Andrew: result.andrew || 0,
        Trish: result.trish || 0,
        Draw: result.draw || 0
      }
    };

    return createResponse(totals);

  } catch (error: any) {
    return handleDatabaseError(error, 'getOverallTotals');
  }
};

export const getLastPlayed: RouteHandler = async (request, env) => {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const countQuery = 'SELECT COUNT(*) as total FROM last_played';
    
    const dataQuery = `
      SELECT id, name, lastPlayed, daysSince, games
      FROM last_played 
      ORDER BY lastPlayed DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, gamesResult] = await Promise.all([
      env.DB.prepare(countQuery).first(),
      env.DB.prepare(dataQuery).bind(limit, offset).all()
    ]);

    const total = countResult?.total || 0;
    const games = gamesResult.results || [];

    const formattedGames = games.map((row: any) => ({
      id: row.id,
      name: row.name,
      lastPlayed: row.lastPlayed,
      daysSince: Math.floor(row.daysSince || 0),
      games: row.games || 0
    }));

    return createPaginatedResponse(formattedGames, total, limit, offset);

  } catch (error: any) {
    return handleDatabaseError(error, 'getLastPlayed');
  }
};

export const getRecentPlays: RouteHandler = async (request, env) => {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '15'), 500);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const countQuery = 'SELECT COUNT(*) as total FROM played';
    
    const dataQuery = `
      SELECT date, id, name, winner, scores, comment
      FROM played 
      ORDER BY date DESC
      LIMIT ? OFFSET ?
    `;

    const [countResult, playsResult] = await Promise.all([
      env.DB.prepare(countQuery).first(),
      env.DB.prepare(dataQuery).bind(limit, offset).all()
    ]);

    const total = countResult?.total || 0;
    const plays = playsResult.results || [];

    return createPaginatedResponse(plays, total, limit, offset);

  } catch (error: any) {
    return handleDatabaseError(error, 'getRecentPlays');
  }
};

export const getPlayerStats: RouteHandler = async (request, env, params) => {
  try {
    const player = params?.player;
    
    if (!player) {
      return createErrorResponse('MISSING_PLAYER', 'Player name is required', 400);
    }

    const validPlayers = ['Andrew', 'Trish'];
    if (!validPlayers.includes(player)) {
      return createErrorResponse(
        'INVALID_PLAYER', 
        `Player must be one of: ${validPlayers.join(', ')}`, 
        400
      );
    }

    const gamesPlayedQuery = `
      SELECT COUNT(DISTINCT id) as gamesPlayed
      FROM log 
      WHERE winner = ?
    `;

    const totalPlaysQuery = `
      SELECT COUNT(*) as totalPlays
      FROM log 
      WHERE winner = ?
    `;

    const recentWinsQuery = `
      SELECT date, name, scores
      FROM played 
      WHERE winner = ?
      ORDER BY date DESC
      LIMIT 10
    `;

    const winRateQuery = `
      SELECT 
        COUNT(*) as totalGames,
        SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins
      FROM log
    `;

    const [gamesResult, playsResult, recentResult, winRateResult] = await Promise.all([
      env.DB.prepare(gamesPlayedQuery).bind(player).first(),
      env.DB.prepare(totalPlaysQuery).bind(player).first(),
      env.DB.prepare(recentWinsQuery).bind(player).all(),
      env.DB.prepare(winRateQuery).bind(player).first()
    ]);

    const winRate = winRateResult?.totalGames > 0 
      ? ((winRateResult.wins / winRateResult.totalGames) * 100).toFixed(1)
      : '0.0';

    const playerStats = {
      player,
      gamesPlayed: gamesResult?.gamesPlayed || 0,
      totalPlays: playsResult?.totalPlays || 0,
      winRate: parseFloat(winRate),
      recentWins: recentResult.results || []
    };

    return createResponse(playerStats);

  } catch (error: any) {
    return handleDatabaseError(error, 'getPlayerStats');
  }
};

export const getGameStats: RouteHandler = async (request, env) => {
  try {
    const summaryQuery = `
      SELECT 
        COUNT(*) as totalGames,
        COUNT(DISTINCT id) as uniqueGames,
        AVG(complexity) as avgComplexity
      FROM bgg
    `;

    const categoryQuery = `
      SELECT category, COUNT(*) as count
      FROM bgg 
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category
      ORDER BY count DESC
      LIMIT 10
    `;

    const mechanicQuery = `
      SELECT mechanic, COUNT(*) as count
      FROM bgg 
      WHERE mechanic IS NOT NULL AND mechanic != ''
      GROUP BY mechanic
      ORDER BY count DESC
      LIMIT 10
    `;

    const complexityQuery = `
      SELECT 
        CASE 
          WHEN complexity <= 2.0 THEN 'Light (≤2.0)'
          WHEN complexity <= 3.0 THEN 'Medium (2.1-3.0)'
          WHEN complexity <= 4.0 THEN 'Heavy (3.1-4.0)'
          ELSE 'Very Heavy (>4.0)'
        END as complexity_range,
        COUNT(*) as count
      FROM bgg 
      WHERE complexity IS NOT NULL
      GROUP BY complexity_range
      ORDER BY count DESC
    `;

    const [summaryResult, categoriesResult, mechanicsResult, complexityResult] = await Promise.all([
      env.DB.prepare(summaryQuery).first(),
      env.DB.prepare(categoryQuery).all(),
      env.DB.prepare(mechanicQuery).all(),
      env.DB.prepare(complexityQuery).all()
    ]);

    const gameStats = {
      summary: {
        totalGames: summaryResult?.totalGames || 0,
        uniqueGames: summaryResult?.uniqueGames || 0,
        averageComplexity: summaryResult?.avgComplexity 
          ? parseFloat(summaryResult.avgComplexity.toFixed(2))
          : 0
      },
      topCategories: categoriesResult.results || [],
      topMechanics: mechanicsResult.results || [],
      complexityDistribution: complexityResult.results || []
    };

    return createResponse(gameStats);

  } catch (error: any) {
    return handleDatabaseError(error, 'getGameStats');
  }
};