# Deployment Guide - Vercel KV (Simplified)

This guide will help you deploy the Obama Approximation app with a global real-time leaderboard using Vercel KV (Redis).

## Why Vercel KV?

- ✅ **Integrated** with Vercel (no separate service)
- ✅ **Auto-configured** when deployed
- ✅ **Free tier** included
- ✅ **No CLI setup** required
- ✅ **Fast** (Redis-based)
- ✅ **Simple** API

## Quick Deploy (5 Minutes)

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/obama-approximation.git
   git push -u origin main
   ```

2. **Import to Vercel**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Click "Deploy"

3. **Add Vercel KV Database**
   - In your Vercel project dashboard
   - Go to "Storage" tab
   - Click "Create Database"
   - Select "KV (Redis)"
   - Name it "obama-global"
   - Click "Create"
   - **Environment variables are auto-added!**

4. **Redeploy**
   - Go to "Deployments" tab
   - Click "..." on latest deployment
   - Click "Redeploy"

5. **Done!** 🎉
   - Your app is live with global leaderboard
   - All users share the same database
   - Real-time updates every 5 seconds

### Option 2: Deploy via CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Add KV Database**
   ```bash
   # In Vercel dashboard, add KV database as described above
   ```

4. **Link environment variables**
   ```bash
   vercel env pull .env.local
   ```

5. **Redeploy**
   ```bash
   vercel --prod
   ```

## Local Development

### Without Real Redis (Mock Storage)

```bash
npm run dev
```

- Works out of the box
- Uses in-memory mock
- Resets on server restart
- Good for testing UI

### With Real Redis (Vercel KV locally)

1. **Create KV database in Vercel** (see above)

2. **Pull environment variables**
   ```bash
   vercel env pull .env.local
   ```

3. **Run dev server**
   ```bash
   npm run dev
   ```

4. **Now using real Redis!**
   - Data persists
   - Shared with production
   - Full testing capability

## How It Works

### API Routes (Next.js App Router)

**POST `/api/global/submit`**
- Submits new match to global leaderboard
- Updates global stats (total explored, best match)
- Stores in Redis sorted set (sorted by SSE)

**GET `/api/global/top100`**
- Returns top 100 matches
- Sorted by SSE (ascending)
- Includes seed, sse, mse, similarity

**GET `/api/global/stats`**
- Returns global statistics
- Total images explored (all users)
- Best match overall

### Data Structure (Redis)

```
global:matches         → Sorted Set (sorted by SSE)
global:total_explored  → Counter
global:best_sse        → Number
global:best_seed       → Number
global:best_similarity → Number
```

### Client Behavior

**Every 10 seconds (when you find new best):**
- Submit your best match to global DB
- Increment global counter

**Every 5 seconds (polling):**
- Fetch global top 100
- Fetch global stats
- Update UI

**Result:**
- Near real-time updates
- All users see each other's discoveries
- Global stats update live

## Costs

**Vercel Free Tier:**
- 100 GB bandwidth
- 100 GB-hours serverless function execution
- Unlimited requests
- **KV Database**: 30,000 commands/month free

**For this app:**
- ~500 KV commands/hour/user
- Free tier supports ~2-3 concurrent users 24/7
- Upgrade to Pro ($20/month) for unlimited

## Features

✅ **Global Leaderboard**
- Top 100 best matches from all users
- Auto-updates every 5 seconds
- Click "SHOW TOP 100" to expand

✅ **Global Stats**
- Total images explored (everyone combined)
- Best match globally
- Your contribution vs global

✅ **Auto-submission**
- Your best matches auto-submit every 10 seconds
- Throttled to prevent spam
- Only submits improvements

✅ **Persistent Storage**
- Redis-based (fast!)
- Data persists across deploys
- Keeps top 1000 matches (auto-trims)

## Testing

### Local Testing

1. Start dev server: `npm run dev`
2. Open two browser windows
3. Click Start in both
4. Watch global stats update!

### Production Testing

1. Deploy to Vercel
2. Share URL with friends
3. Everyone runs it simultaneously
4. Watch global leaderboard fill up!

## Monitoring

### Vercel Dashboard

**KV Database Usage:**
- Dashboard → Storage → obama-global
- View commands/day
- Monitor storage usage
- Check request logs

**Function Logs:**
- Dashboard → Deployments → [Latest] → Functions
- See API route executions
- Debug errors

## Configuration

### Polling Frequency

In `src/app/page.tsx`, adjust:
```typescript
setInterval(() => {
  getGlobalTop100().then(setGlobalTop100)
  getGlobalStats().then(setGlobalStats)
}, 5000) // Change 5000 to different milliseconds
```

### Submission Frequency

In `src/app/page.tsx`, adjust:
```typescript
if (now - lastSubmitTime.current > 10000) { // Change 10000
  submitMatch(...)
}
```

### Top 100 Size

In `src/app/api/global/top100/route.ts`, adjust:
```typescript
const top100 = await kv.zrange('global:matches', 0, 99) // Change 99
```

## Troubleshooting

### "Error fetching top 100"
- Check Vercel KV is created and linked
- Verify environment variables are set
- Check API route logs in Vercel dashboard

### "Failed to submit"
- Check network connection
- Verify API route is deployed
- Check KV command quota (free tier limit)

### Local development not persisting
- Install Vercel CLI: `npm i -g vercel`
- Run: `vercel env pull .env.local`
- Restart dev server

## Quick Commands

```bash
# Deploy to Vercel
vercel --prod

# Pull environment variables
vercel env pull .env.local

# View logs
vercel logs

# Test API routes locally
curl http://localhost:3000/api/global/stats

# Check build
npm run build
```

## Success Checklist

- [x] Dependencies installed (`npm install`)
- [ ] Deployed to Vercel
- [ ] KV database created in Vercel dashboard
- [ ] Environment variables auto-configured
- [ ] App redeployed after KV creation
- [ ] Global stats updating
- [ ] Top 100 displaying
- [ ] Multiple users can contribute

## Next Steps

1. **Deploy**: Push to GitHub and import to Vercel
2. **Add KV**: Create KV database in Vercel dashboard
3. **Share**: Send URL to friends to contribute
4. **Watch**: Global leaderboard fills up!

**Much simpler than Supabase!** No separate accounts or CLI tools needed. Everything is integrated with Vercel! 🚀

