# Eurogames API

A REST API for tracking board game plays and statistics, built on Cloudflare Workers with D1 (SQLite) database.

## Features

- **Game Collection Management**: Track your board game collection with BoardGameGeek integration
- **Play Session Recording**: Log game plays with dates, winners, scores, and comments
- **Statistics & Analytics**: View win rates, play frequency, and player performance
- **Flexible Queries**: Execute custom SQL queries for advanced analysis
- **Data Export**: Export complete dataset for backup or migration
- **API Key Authentication**: Secure access with role-based permissions

## Quick Start

### Prerequisites

- Node.js 18 or later
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI (`npm install -g wrangler`)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd eurogames-api

# Install dependencies
npm install

# Login to Cloudflare
wrangler login
```

### Development

```bash
# Start local development server
npm run dev

# Type check TypeScript
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

## API Documentation

### Authentication

API requests require authentication via API key in one of two headers:

```bash
Authorization: Bearer <your-api-key>
# OR
X-API-Key: <your-api-key>
```

#### Permission Levels

- **admin**: Full access (read, write, delete, export, query)
- **user**: Read and write access
- **read-only**: View-only access

For development, authentication can be disabled by setting `REQUIRE_AUTH=false` in `wrangler.toml`.

### Base URL

```
https://your-worker.workers.dev/v1
```

### Endpoints

#### Games

```http
# Get all games
GET /v1/games?limit=50&offset=0

# Get single game
GET /v1/games/{id}

# Add new game
POST /v1/games
Content-Type: application/json

{
  "id": 123,
  "name": "Wingspan",
  "status": "Playing",
  "platform": "Physical"
}

# Update game notes
PUT /v1/games/{id}/notes
Content-Type: application/json

{
  "status": "Completed",
  "comment": "Great game!"
}

# Delete game
DELETE /v1/games/{id}

# Sync with BoardGameGeek (not yet implemented)
POST /v1/games/sync
```

#### Plays

Each play record has a unique `play_id` that is returned in API responses. Use `play_id` to identify and modify specific play records.

```http
# Get all plays
GET /v1/plays?limit=50&offset=0

# Get single play by play_id
GET /v1/plays/{play_id}

# Get play history for a specific game
GET /v1/games/{game_id}/history?limit=50&offset=0

# Record a new play
POST /v1/plays
Content-Type: application/json

{
  "game_id": 123,
  "date": "2025-01-15",
  "winner": "Andrew",
  "scores": "Andrew:95,Trish:87",
  "comment": "Close game!"
}

# Response includes play_id for future references
{
  "data": {
    "play_id": 42,
    "date": "2025-01-15",
    "gameId": 123,
    "winner": "Andrew",
    "scores": "Andrew:95,Trish:87",
    "comment": "Close game!"
  }
}

# Update a play using its play_id
PATCH /v1/plays/{play_id}
Content-Type: application/json

{
  "winner": "Trish",
  "scores": "Andrew:87,Trish:95"
}

# Delete a play using its play_id
DELETE /v1/plays/{play_id}
```

#### Statistics

```http
# Get total statistics
GET /v1/stats/totals

# Get winner statistics
GET /v1/stats/winners?limit=50

# Get player statistics
GET /v1/stats/players/{player}
# player must be: Andrew or Trish
```

#### Data Management

```http
# Export all data
GET /v1/export

# Execute custom SQL query (SELECT only)
POST /v1/query
Content-Type: application/json

{
  "query": "SELECT * FROM game_list2 WHERE status = 'Playing' LIMIT 10"
}
```

### Response Format

#### Success Response

```json
{
  "data": {
    // Response data
  },
  "meta": {
    "total": 100,
    "limit": 50,
    "offset": 0
  }
}
```

#### Error Response

```json
{
  "error": {
    "code": "GAME_NOT_FOUND",
    "message": "Game with ID 123 not found",
    "details": {}
  }
}
```

## Database Schema

### Tables

#### bgg
BoardGameGeek game data
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT)
- `yearPublished` (INTEGER)
- `complexity` (REAL)
- `rating` (REAL)
- `ranking` (INTEGER)
- Additional BGG metadata fields

#### notes
User notes and metadata about games
- `id` (INTEGER, references bgg.id)
- `status` (TEXT): Playing, Inbox, Completed, Sold, Wishlisted
- `platform` (TEXT): Physical, BGA, etc.
- `uri` (TEXT): Custom URI/reference
- `comment` (TEXT): User notes

#### log
Play session records
- `play_id` (INTEGER PRIMARY KEY AUTOINCREMENT): Unique identifier for each play record
- `date` (TEXT): YYYY-MM-DD format
- `id` (INTEGER, references bgg.id): BoardGameGeek game ID
- `winner` (TEXT): Andrew, Trish, or Draw
- `scores` (TEXT): Comma-separated player:score pairs
- `comment` (TEXT): Play notes

### Views

- **game_list2**: Games with notes and play statistics
- **played**: Play log joined with game names
- **winner**: Win statistics by game
- **last_played**: Last play date and days since for each game

## Configuration

### Environment Variables (wrangler.toml)

```toml
[vars]
REQUIRE_AUTH = "true"  # Set to "false" to disable authentication in development
API_KEYS = "key1:admin,key2:user,key3:read-only"  # Comma-separated API keys with roles

[[d1_databases]]
binding = "DB"
database_name = "eurogames"
database_id = "your-database-id"
```

## Architecture

### Tech Stack

- **Runtime**: Cloudflare Workers (Edge computing)
- **Database**: Cloudflare D1 (SQLite)
- **Language**: TypeScript
- **Build Tool**: esbuild (via Wrangler)

### Project Structure

```
src/
├── index.ts              # Main worker entry point and routing
├── types.ts              # TypeScript type definitions
├── utils.ts              # Shared utilities and helpers
├── middleware/
│   └── auth.ts          # Authentication and authorization
└── handlers/
    ├── games.ts         # Game management endpoints
    ├── plays.ts         # Play record endpoints
    └── stats.ts         # Statistics endpoints
```

### Request Flow

1. **CORS Handling**: Process OPTIONS preflight requests
2. **Authentication**: Validate API keys and check permissions
3. **Route Matching**: Pattern-based routing with path parameters
4. **Handler Execution**: Delegate to specialized handler functions
5. **Response Formatting**: Return standardized JSON with CORS headers

## Development

### Input Validation

All inputs are validated:
- **Game IDs**: Must be positive integers
- **Dates**: Must be in YYYY-MM-DD format
- **Status**: Playing, Inbox, Completed, Sold, Wishlisted
- **Winners**: Andrew, Trish, Draw
- **Players**: Andrew, Trish
- **Strings**: Sanitized to remove `<>` characters

### Security

- All database queries use prepared statements with parameter binding
- SQL injection protection on custom queries
- Destructive operations blocked in `/v1/query` endpoint
- API key authentication with role-based permissions
- CORS headers for cross-origin access

### Error Handling

Consistent error responses across all endpoints:
- **400**: Invalid input or JSON parsing errors
- **403**: Permission denied
- **404**: Resource not found
- **500**: Database or server errors
- **501**: Not implemented (e.g., BGG sync)

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

[Add contribution guidelines here]

## Support

For issues or questions, please [create an issue](../../issues) in this repository.
