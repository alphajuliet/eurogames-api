# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Eurogames API is a REST API built on Cloudflare Workers with D1 (SQLite) database for tracking board game plays and statistics. The API supports managing a game collection, recording play sessions, and generating statistics about wins, play frequency, and player performance.

## Development Commands

```bash
# Start local development server
npm run dev

# Deploy to Cloudflare Workers
npm run deploy

# Type check TypeScript
npm run build
```

## Database Schema

The D1 database uses the following main tables:

- **bgg**: BoardGameGeek game data (id, name, yearPublished, complexity, rating, ranking, etc.)
- **notes**: User notes about games (status, platform, uri, comment)
- **log**: Play records (date, id [game ID], winner, scores, comment)

The database also has views for convenience:
- **game_list2**: Combines games with their notes and play statistics
- **played**: Joins log with bgg for game names
- **winner**: Aggregates win statistics by game
- **last_played**: Shows last play date and days since for each game

## Architecture

### Entry Point
`src/index.ts` is the main Cloudflare Worker entry point. It exports a `fetch` handler that:
1. Routes root requests to API documentation
2. Routes `/v1/export` to data export handler
3. Routes `/v1/query` to custom SQL query handler
4. Delegates all other `/v1/*` requests to the route handler

### Request Flow
1. **CORS handling** (`handleCORS()`) - Returns preflight response for OPTIONS requests
2. **Authentication** (`authenticateRequest()`) - Validates API keys and checks permissions
3. **Route matching** - Pattern-based routing using `{param}` syntax for path parameters
4. **Handler execution** - Delegates to specialized handler functions
5. **Response formatting** - Standardized JSON responses with CORS headers

### Code Organization

- **src/index.ts**: Main worker entry point with routing logic
- **src/types.ts**: TypeScript interfaces for all data models and API types
- **src/utils.ts**: Shared utilities for responses, validation, and parsing
- **src/middleware/auth.ts**: Authentication and permission checking
- **src/handlers/games.ts**: Game management endpoints (get, add, update notes, sync)
- **src/handlers/plays.ts**: Play record endpoints (CRUD operations, game history)
- **src/handlers/stats.ts**: Statistics endpoints (winners, totals, player stats)

### Authentication System

The API uses API key authentication with three permission levels:
- **admin**: All permissions (read, write, delete, export, query)
- **user**: Read and write permissions
- **read-only**: View-only access

API keys are stored in the `API_KEYS` environment variable as comma-separated entries:
```
key1:admin,key2:user,key3:read-only
```

Authentication can be bypassed in development by setting `REQUIRE_AUTH=false` in wrangler.toml.

API keys can be provided in two ways:
- `Authorization: Bearer <key>` header
- `X-API-Key: <key>` header

### Permission Requirements

- **GET** requests (except `/v1/export`): require `read` permission
- **POST/PUT/PATCH**: require `write` permission
- **DELETE**: requires `delete` permission
- **GET /v1/export**: requires `export` permission
- **POST /v1/query**: requires `query` permission

### Response Format

All API responses follow a consistent structure:

```typescript
// Success response
{
  "data": T,
  "meta"?: {
    "total"?: number,
    "limit"?: number,
    "offset"?: number
  }
}

// Error response
{
  "error": {
    "code": string,
    "message": string,
    "details"?: Record<string, any>
  }
}
```

All responses include CORS headers for cross-origin access.

### Route Patterns

Routes use a pattern-based system with `{param}` syntax for path parameters:
- `/v1/games/{id}` matches `/v1/games/123` and extracts `id: "123"`
- Pattern matching is done by `matchesPattern()` and params extracted by `extractPathParams()`

### Input Validation

- **Game IDs**: Must be positive integers (`validateGameId()`)
- **Dates**: Must be in YYYY-MM-DD format (`validateDate()`)
- **Game Status**: Must be one of: Playing, Inbox, Completed, Sold, Wishlisted
- **Winners**: Must be one of: Andrew, Trish, Draw
- **Players**: Must be one of: Andrew, Trish
- All string inputs are sanitized using `sanitizeInput()` to remove `<>` characters

### Environment Variables

Configured in `wrangler.toml`:
- **DB**: D1 database binding (required)
- **API_KEYS**: Comma-separated API keys with permission levels (optional, for auth)
- **REQUIRE_AUTH**: Set to "false" to disable authentication in development (default: "true")

## Key Implementation Details

### Error Handling

All handlers use try-catch with `handleDatabaseError()` to provide consistent error responses. Common error patterns:
- JSON parsing errors return 400 with 'INVALID_JSON'
- Missing/invalid IDs return 400 with specific error codes
- Not found resources return 404
- Permission issues return 403
- Database errors return 500

### Pagination

List endpoints support pagination via query parameters:
- `limit`: Max number of results (default varies, max 500)
- `offset`: Number of results to skip (default 0)

Responses include `meta` object with `total`, `limit`, and `offset`.

### Database Queries

- All queries use prepared statements with parameter binding for SQL injection protection
- Complex queries often run in parallel using `Promise.all()` for performance
- Views are used extensively to simplify queries (game_list2, played, winner, last_played)

### Special Endpoints

**Export** (`GET /v1/export`):
- Exports all data from bgg, notes, and log tables
- Returns JSON with timestamp and version
- Requires `export` permission

**Query** (`POST /v1/query`):
- Allows executing custom SELECT queries
- Blocks destructive operations (DROP, DELETE, UPDATE, INSERT, PRAGMA)
- Requires `query` permission

## Development Notes

- BGG sync functionality is mentioned in the API but not yet implemented (returns 501)
- The codebase was originally in a different language (Clojure/Python based on .gitignore) and migrated to TypeScript
- Player names are hardcoded to Andrew and Trish
- The `sqlite3` dependency in package.json is used for local data migration scripts, not by the Worker itself (which uses D1)
