# Health Check Endpoint

## Endpoint

**URL**: `GET /health`  
**Full URL**: `https://api.paxify.org/health`

## Current Status

✅ **API is ONLINE** - The endpoint is responding successfully.

## Enhanced Health Check

The health check endpoint has been enhanced to provide comprehensive status information:

### Response Format

```json
{
  "status": "ok" | "degraded",
  "service": "mentor-app-api",
  "version": "1.0.0",
  "environment": "production" | "staging" | "development",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "checks": {
    "database": "connected" | "not_initialized" | "error",
    "server": "ok"
  }
}
```

### Status Codes

- **200 OK**: All systems operational
- **503 Service Unavailable**: Database connection failed (degraded status)

### Health Check Details

1. **Status**: Overall health status
   - `ok`: Everything working
   - `degraded`: Database connection issue

2. **Service**: Service name (from `SERVICE_NAME` env var or default)

3. **Version**: Service version (from `SERVICE_VERSION` env var or default)

4. **Environment**: Current environment (`NODE_ENV`)

5. **Timestamp**: Current server time in ISO format

6. **Uptime**: Server uptime in seconds

7. **Checks**:
   - **database**: Database connection status
     - `connected`: Database is connected and responding
     - `not_initialized`: Database not yet initialized
     - `error`: Database connection error
   - **server**: Server status (always `ok` if endpoint responds)

## Testing

### Using cURL

```bash
curl https://api.paxify.org/health
```

### Using Browser

Visit: https://api.paxify.org/health

### Expected Response (Production)

```json
{
  "status": "ok",
  "service": "mentor-app-api",
  "version": "1.0.0",
  "environment": "production",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600.5,
  "checks": {
    "database": "connected",
    "server": "ok"
  }
}
```

## Monitoring

This endpoint can be used for:
- Load balancer health checks
- Monitoring systems (Prometheus, Datadog, etc.)
- CI/CD pipeline checks
- Manual verification

## Deployment

After pushing the enhanced health check:
1. Build: `npm run build:main`
2. Deploy to cPanel
3. Test: `curl https://api.paxify.org/health`

