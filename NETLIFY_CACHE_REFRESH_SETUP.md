# Netlify Cache Refresh System Setup Guide

## Prompt for Perplexity Agentic Comet

Use this prompt with Perplexity Agentic Comet to set up the hourly cache refresh system for a Next.js application deployed on Netlify:

---

**I have a Next.js application deployed on Netlify that uses server-side caching for pool data. I need to set up an automated hourly cache refresh system. Here are the details:**

**Application Details:**
- Framework: Next.js 14 (App Router)
- Deployment: Netlify
- Cache System: Server-side in-memory cache with 1-hour TTL
- Cache Endpoints:
  - `/api/cache/tokenized-stock-pools` - Cached tokenized stock pools data
  - `/api/cache/solana-pools` - Cached Solana pools data
  - `/api/cache/refresh` - Background refresh endpoint (POST/GET)
  - `/api/cron/refresh-cache` - Cron-triggered refresh endpoint (protected with secret)

**Requirements:**
1. Set up environment variable `CACHE_REFRESH_SECRET` on Netlify with a secure random string
2. Configure an external cron service to call the refresh endpoint every hour
3. Ensure the cron job calls: `https://YOUR-NETLIFY-DOMAIN.netlify.app/api/cron/refresh-cache?secret=YOUR_SECRET`
4. Provide step-by-step instructions for:
   - Setting up the environment variable on Netlify
   - Choosing and configuring a cron service (recommend cron-job.org, EasyCron, or GitHub Actions)
   - Testing the setup
   - Monitoring and troubleshooting

**Security Considerations:**
- The endpoint requires a secret token for authentication
- The secret should be a strong random string (at least 32 characters)
- The secret should be stored securely in Netlify environment variables
- The cron service should use HTTPS

**Additional Context:**
- The application uses Next.js API routes
- The refresh endpoint clears cache and fetches fresh data from external APIs (GraphQL and Meteora)
- The cache refresh should run independently of user page loads
- If the refresh fails, the old cached data should still be served until the next successful refresh

**Please provide:**
1. Detailed step-by-step instructions for Netlify environment variable setup
2. Recommendations for cron service providers with pros/cons
3. Complete configuration guide for the chosen cron service
4. Testing procedures to verify the setup works
5. Monitoring and alerting recommendations
6. Troubleshooting guide for common issues

---

## Manual Setup Instructions

### Step 1: Generate a Secure Secret

Generate a secure random string for the cache refresh secret:

```bash
# Using OpenSSL
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Save this secret securely - you'll need it for the next steps.

### Step 2: Set Environment Variable on Netlify

1. **Via Netlify Dashboard:**
   - Go to your site on Netlify
   - Navigate to **Site settings** → **Environment variables**
   - Click **Add variable**
   - Key: `CACHE_REFRESH_SECRET`
   - Value: (paste your generated secret)
   - Click **Save**
   - **Important:** Redeploy your site for the environment variable to take effect

2. **Via Netlify CLI:**
   ```bash
   netlify env:set CACHE_REFRESH_SECRET "your-secret-here"
   ```

3. **Via netlify.toml:**
   ```toml
   [build.environment]
     CACHE_REFRESH_SECRET = "your-secret-here"
   ```
   ⚠️ **Warning:** Don't commit secrets to version control. Use build plugins or environment variables instead.

### Step 3: Choose a Cron Service

#### Option A: cron-job.org (Recommended - Free Tier Available)

**Pros:**
- Free tier available
- Easy to set up
- Reliable
- Supports HTTPS
- Email notifications

**Setup:**
1. Go to https://cron-job.org
2. Sign up for a free account
3. Click **Create cronjob**
4. Configure:
   - **Title:** Cache Refresh
   - **Address:** `https://YOUR-SITE.netlify.app/api/cron/refresh-cache?secret=YOUR_SECRET`
   - **Schedule:** Every hour (`0 * * * *`)
   - **Request method:** GET
   - **Activate:** Yes
5. Click **Create cronjob**
6. Test the job manually

#### Option B: EasyCron (Free Tier Available)

**Pros:**
- Free tier (up to 2 cron jobs)
- Simple interface
- Good documentation

**Setup:**
1. Go to https://www.easycron.com
2. Sign up for free account
3. Click **Add Cron Job**
4. Configure:
   - **Cron Job Name:** Cache Refresh
   - **URL:** `https://YOUR-SITE.netlify.app/api/cron/refresh-cache?secret=YOUR_SECRET`
   - **Schedule:** `0 * * * *` (every hour)
   - **HTTP Method:** GET
   - **Status:** Active
5. Save and test

#### Option C: GitHub Actions (Free for Public Repos)

**Pros:**
- Free for public repositories
- Integrated with your codebase
- Version controlled
- Good for teams

**Setup:**
1. Create `.github/workflows/cache-refresh.yml`:
   ```yaml
   name: Cache Refresh
   
   on:
     schedule:
       # Run every hour
       - cron: '0 * * * *'
     workflow_dispatch: # Allow manual trigger
   
   jobs:
     refresh:
       runs-on: ubuntu-latest
       steps:
         - name: Refresh Cache
           run: |
             curl -X GET "https://YOUR-SITE.netlify.app/api/cron/refresh-cache?secret=${{ secrets.CACHE_REFRESH_SECRET }}"
   ```

2. Add secret to GitHub:
   - Go to repository → Settings → Secrets and variables → Actions
   - Click **New repository secret**
   - Name: `CACHE_REFRESH_SECRET`
   - Value: (your secret)
   - Click **Add secret**

#### Option D: Netlify Functions with Scheduled Triggers (Advanced)

**Note:** Netlify doesn't have built-in scheduled functions, but you can use:
- Netlify Functions + external trigger
- Netlify Build Plugins (runs on build, not ideal for hourly)

### Step 4: Test the Setup

1. **Test the endpoint directly:**
   ```bash
   curl "https://YOUR-SITE.netlify.app/api/cron/refresh-cache?secret=YOUR_SECRET"
   ```

2. **Expected response:**
   ```json
   {
     "success": true,
     "message": "Cache refreshed successfully",
     "tokenizedStockPools": {
       "success": true,
       "count": 16
     },
     "solanaPools": {
       "success": true,
       "count": 5
     },
     "timestamp": "2024-01-01T12:00:00.000Z"
   }
   ```

3. **Check logs:**
   - Netlify Dashboard → Functions → View logs
   - Look for cache refresh logs

### Step 5: Monitoring

1. **Set up alerts:**
   - Configure email notifications in your cron service
   - Monitor Netlify function logs for errors

2. **Health check endpoint:**
   You can create a simple health check:
   ```typescript
   // app/api/cache/health/route.ts
   export async function GET() {
     // Check if cache exists and is valid
     // Return cache status
   }
   ```

### Step 6: Troubleshooting

**Issue: 401 Unauthorized**
- Check that `CACHE_REFRESH_SECRET` is set correctly on Netlify
- Verify the secret in the cron job URL matches
- Redeploy the site after setting environment variables

**Issue: 500 Internal Server Error**
- Check Netlify function logs
- Verify external APIs (GraphQL, Meteora) are accessible
- Check for timeout issues (increase timeout if needed)

**Issue: Cache not refreshing**
- Verify cron job is running (check cron service logs)
- Test the endpoint manually
- Check Netlify function execution logs

**Issue: CORS errors**
- Ensure cron service uses HTTPS
- Check Netlify CORS settings if applicable

### Step 7: Security Best Practices

1. **Rotate secrets regularly:**
   - Change `CACHE_REFRESH_SECRET` every 90 days
   - Update cron job URL when rotating

2. **Monitor access:**
   - Check Netlify function logs for unauthorized access attempts
   - Set up alerts for failed authentication

3. **Use strong secrets:**
   - Minimum 32 characters
   - Mix of letters, numbers, and symbols
   - Don't use predictable patterns

### Alternative: Using Netlify Build Hooks (Not Recommended)

⚠️ **Note:** Netlify build hooks trigger full site rebuilds, which is inefficient for cache refresh. Use external cron services instead.

---

## Quick Reference

**Environment Variable:**
- Key: `CACHE_REFRESH_SECRET`
- Value: (32+ character random string)

**Cron Endpoint:**
- URL: `https://YOUR-SITE.netlify.app/api/cron/refresh-cache?secret=YOUR_SECRET`
- Method: GET or POST
- Schedule: `0 * * * *` (every hour)

**Test Command:**
```bash
curl "https://YOUR-SITE.netlify.app/api/cron/refresh-cache?secret=YOUR_SECRET"
```

**Cron Schedule Examples:**
- Every hour: `0 * * * *`
- Every 30 minutes: `*/30 * * * *`
- Every 15 minutes: `*/15 * * * *`

