# Database Keep-Alive Setup

This project includes a keep-alive mechanism to prevent the Supabase database from being paused due to inactivity.

## How It Works

- **Edge Function**: `database-keep-alive` - A publicly accessible webhook endpoint
- **Database Function**: `keep_alive_ping()` - Executes a minimal SELECT query (returns 1)
- **Authentication**: Protected by a static secret token
- **Logging**: Console logs only (no database persistence)

## Setup Instructions

### 1. Configure the Keep-Alive Secret

Add the `KEEP_ALIVE_SECRET` environment variable to your Supabase project:

1. Go to your Supabase dashboard
2. Navigate to Project Settings → Edge Functions → Secrets
3. Add a new secret:
   - Key: `KEEP_ALIVE_SECRET`
   - Value: A strong random string (e.g., `your-secure-random-token-here`)

**Generate a secure token:**
```bash
# Using OpenSSL (recommended)
openssl rand -base64 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Deploy the Edge Function

The function is already deployed to your Supabase project. If you need to redeploy:

```bash
supabase functions deploy database-keep-alive --no-verify-jwt
```

### 3. Get Your Function URL

Your keep-alive endpoint is available at:
```
https://<your-project-ref>.supabase.co/functions/v1/database-keep-alive
```

Replace `<your-project-ref>` with your actual Supabase project reference ID.

### 4. Set Up External Scheduling

Since this is a webhook-based approach, you'll need an external service to trigger it every 48 hours.

#### Option A: GitHub Actions (Free)

Create `.github/workflows/keep-alive.yml` in your repository:

```yaml
name: Database Keep-Alive

on:
  schedule:
    # Run every 48 hours (at midnight UTC every 2 days)
    - cron: '0 0 */2 * *'
  workflow_dispatch: # Allow manual triggering

jobs:
  ping-database:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase Database
        run: |
          curl -X POST \
            -H "X-Keep-Alive-Token: ${{ secrets.KEEP_ALIVE_SECRET }}" \
            "https://<your-project-ref>.supabase.co/functions/v1/database-keep-alive"
```

Add `KEEP_ALIVE_SECRET` to your GitHub repository secrets.

#### Option B: cron-job.org (Free)

1. Sign up at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/database-keep-alive?token=YOUR_SECRET_TOKEN`
   - Schedule: Every 48 hours (`0 0 */2 * *`)
   - Method: POST or GET
3. Save and enable the job

#### Option C: EasyCron (Free tier available)

1. Sign up at [easycron.com](https://www.easycron.com)
2. Create a new cron job with similar settings as above
3. Schedule to run every 48 hours

## Testing the Endpoint

### Using curl:

```bash
# Using header authentication (recommended)
curl -X POST \
  -H "X-Keep-Alive-Token: your-secret-token" \
  "https://<your-project-ref>.supabase.co/functions/v1/database-keep-alive"

# Using query parameter
curl "https://<your-project-ref>.supabase.co/functions/v1/database-keep-alive?token=your-secret-token"
```

### Expected Response:

```json
{
  "success": true,
  "message": "Database keep-alive ping successful",
  "responseTime": "45ms",
  "timestamp": "2026-01-27T22:30:00.000Z"
}
```

## Monitoring

The function logs all activity to the console. View logs in your Supabase dashboard:

1. Go to Edge Functions → database-keep-alive
2. Click on "Logs" tab
3. Look for entries like:
   - `[Keep-Alive] ✓ Database ping successful (45ms)`
   - `[Keep-Alive] Unauthorized access attempt` (if wrong token)

## Security Notes

- The endpoint is public but requires a valid secret token
- Token can be passed via header (`X-Keep-Alive-Token`) or query parameter (`token`)
- Failed authentication attempts are logged
- The function only performs a read-only SELECT operation
- No user data is accessed or modified

## Troubleshooting

**401 Unauthorized**
- Check that your `KEEP_ALIVE_SECRET` environment variable is set correctly in Supabase
- Verify you're sending the correct token value

**500 Server Configuration Error**
- The `KEEP_ALIVE_SECRET` environment variable is not configured
- Go to Project Settings → Edge Functions → Secrets and add it

**Database ping failed**
- Check Supabase project status
- Verify the database migration was applied successfully
- Check Edge Function logs for detailed error messages