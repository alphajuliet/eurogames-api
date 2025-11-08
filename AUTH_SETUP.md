# API Authentication Setup Guide

## Setting API Keys

### 1. Set API Key Secret

Use the wrangler CLI to set the API key as a secret:

```bash
# Set API key (format: key:permission)
wrangler secret put EUROGAMES_API_KEY

# Example input when prompted:
# admin-key-2024:admin
```

The EUROGAMES_API_KEY environment variable should contain a single API key entry with the format `key:permission` where permission is one of: admin, user, or read-only.

### 2. Permission Levels

- **admin**: Full access (read, write, delete, export, query)
- **user**: Read and write access (read, write)  
- **read-only**: View-only access (read)

### 3. Test API Keys

```bash
# Test with admin key
curl -H "Authorization: Bearer admin-key-2024" \
  https://your-worker.workers.dev/v1/games

# Test with X-API-Key header
curl -H "X-API-Key: user-key-2024" \
  https://your-worker.workers.dev/v1/plays

# Test unauthorized access (should return 401)
curl https://your-worker.workers.dev/v1/games
```

### 4. Development Mode

For local development, set `REQUIRE_AUTH=false` in wrangler.toml to disable authentication entirely, or set `EUROGAMES_API_KEY` with a test key in your development environment.

Example for testing locally:
```bash
# Disable auth for development
wrangler dev  # Uses REQUIRE_AUTH=false setting in wrangler.toml
```

For production, always use `wrangler secret put EUROGAMES_API_KEY` to securely store the API key.

### 5. Key Management Best Practices

- **Rotate keys regularly**
- **Use strong, random keys**
- **Monitor API access logs**
- **Revoke compromised keys immediately**

## Permission Matrix

| Endpoint | Read | Write | Delete | Export | Query |
|----------|------|-------|---------|---------|-------|
| GET /v1/games/* | ✓ | | | | |
| POST /v1/games | | ✓ | | | |
| PATCH /v1/games/* | | ✓ | | | |
| GET /v1/plays/* | ✓ | | | | |
| POST /v1/plays | | ✓ | | | |
| PUT /v1/plays/* | | ✓ | | | |
| DELETE /v1/plays/* | | | ✓ | | |
| GET /v1/stats/* | ✓ | | | | |
| GET /v1/export | | | | ✓ | |
| POST /v1/query | | | | | ✓ |

## Error Codes

- **401 Unauthorized**: Missing or invalid API key
- **403 Forbidden**: Valid key but insufficient permissions
- **400 Bad Request**: Malformed request

## Examples

### Create API Key

```bash
# Generate secure key
openssl rand -hex 32  # Generate random key

# Set the API key
wrangler secret put EUROGAMES_API_KEY
# Enter: my-admin-key-abc123:admin
```

### API Usage

Assuming your EUROGAMES_API_KEY is set to `my-admin-key-abc123:admin`:

```bash
# Read games (requires 'read' permission)
curl -H "Authorization: Bearer my-admin-key-abc123" \
  "https://games.your-subdomain.workers.dev/v1/games?limit=5"

# Add a play record (requires 'write' permission)
curl -X POST \
  -H "Authorization: Bearer my-admin-key-abc123" \
  -H "Content-Type: application/json" \
  -d '{"game_id": 123, "winner": "Andrew", "scores": "85-72"}' \
  "https://games.your-subdomain.workers.dev/v1/plays"

# Export data (requires 'export' permission - admin only)
curl -H "Authorization: Bearer my-admin-key-abc123" \
  "https://games.your-subdomain.workers.dev/v1/export"

# Delete a play record (requires 'delete' permission - admin only)
curl -X DELETE \
  -H "Authorization: Bearer my-admin-key-abc123" \
  "https://games.your-subdomain.workers.dev/v1/plays/491"
```