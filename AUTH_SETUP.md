# API Authentication Setup Guide

## Setting API Keys

### 1. Set API Key Secret

Use the wrangler CLI to set the API key as a secret:

```bash
# Set API key
wrangler secret put EUROGAMES_API_KEY

# Example input when prompted:
# my-secret-api-key-12345
```

The EUROGAMES_API_KEY environment variable should contain the API key itself. All requests with this key will have full admin permissions (read, write, delete, export, query).

### 2. Test API Key

```bash
# Test with Authorization header
curl -H "Authorization: Bearer my-secret-api-key-12345" \
  https://your-worker.workers.dev/v1/games

# Test with X-API-Key header
curl -H "X-API-Key: my-secret-api-key-12345" \
  https://your-worker.workers.dev/v1/plays

# Test unauthorized access (should return 401)
curl https://your-worker.workers.dev/v1/games
```

### 3. Development Mode

For local development, set `REQUIRE_AUTH=false` in wrangler.toml to disable authentication entirely, or set `EUROGAMES_API_KEY` with a test key in your development environment.

Example for testing locally:
```bash
# Disable auth for development
wrangler dev  # Uses REQUIRE_AUTH=false setting in wrangler.toml
```

For production, always use `wrangler secret put EUROGAMES_API_KEY` to securely store the API key.

### 4. Key Management Best Practices

- **Rotate keys regularly**
- **Use strong, random keys**
- **Monitor API access logs**
- **Revoke compromised keys immediately**

## Permissions

The EUROGAMES_API_KEY has full admin permissions for all API operations:
- **Read**: GET /v1/games/*, GET /v1/plays/*, GET /v1/stats/*
- **Write**: POST /v1/games, POST /v1/plays, PUT/PATCH /v1/games/*, PUT /v1/plays/*
- **Delete**: DELETE /v1/games/*, DELETE /v1/plays/*
- **Export**: GET /v1/export
- **Query**: POST /v1/query

## Error Codes

- **401 Unauthorized**: Missing or invalid API key
- **400 Bad Request**: Malformed request

## Examples

### Create API Key

```bash
# Generate secure key
openssl rand -hex 32  # Generate random key

# Set the API key (use the output from above)
wrangler secret put EUROGAMES_API_KEY
# Enter: your-generated-random-key-here
```

### API Usage

Assuming your EUROGAMES_API_KEY is set to `my-secret-api-key-12345`:

```bash
# Read games
curl -H "Authorization: Bearer my-secret-api-key-12345" \
  "https://games.your-subdomain.workers.dev/v1/games?limit=5"

# Add a play record
curl -X POST \
  -H "Authorization: Bearer my-secret-api-key-12345" \
  -H "Content-Type: application/json" \
  -d '{"game_id": 123, "winner": "Andrew", "scores": "85-72"}' \
  "https://games.your-subdomain.workers.dev/v1/plays"

# Export data
curl -H "Authorization: Bearer my-secret-api-key-12345" \
  "https://games.your-subdomain.workers.dev/v1/export"

# Delete a play record
curl -X DELETE \
  -H "Authorization: Bearer my-secret-api-key-12345" \
  "https://games.your-subdomain.workers.dev/v1/plays/491"
```