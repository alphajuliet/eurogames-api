# API Authentication Setup Guide

## Setting API Keys

### 1. Set API Keys Secret

Use the wrangler CLI to set API keys as a secret:

```bash
# Set API keys (format: key:permission,key:permission,...)
wrangler secret put API_KEYS

# Example input when prompted:
# admin-key-2024:admin,user-key-2024:user,readonly-key-2024:read-only
```

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

For local development, set `REQUIRE_AUTH=false` in wrangler.toml or as an environment variable to disable authentication.

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

### Create API Keys

```bash
# Generate secure keys
openssl rand -hex 32  # Generate random key

# Set multiple keys
wrangler secret put API_KEYS
# Enter: my-admin-key-abc123:admin,my-user-key-def456:user
```

### API Usage

```bash
# Read games (requires 'read' permission)
curl -H "Authorization: Bearer my-user-key-def456" \
  "https://games.your-subdomain.workers.dev/v1/games?limit=5"

# Add a play record (requires 'write' permission)  
curl -X POST \
  -H "Authorization: Bearer my-user-key-def456" \
  -H "Content-Type: application/json" \
  -d '{"game_id": 123, "winner": "Andrew", "scores": "85-72"}' \
  "https://games.your-subdomain.workers.dev/v1/plays"

# Export data (requires 'export' permission - admin only)
curl -H "Authorization: Bearer my-admin-key-abc123" \
  "https://games.your-subdomain.workers.dev/v1/export"
```