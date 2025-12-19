# Deployment Guide - Global Leaderboard Setup

This guide will help you deploy the Obama Approximation app with a global real-time leaderboard.

## Prerequisites

- Node.js 18+
- npm or yarn
- Vercel account (free)
- Supabase account (free)

## Step 1: Supabase Setup (Backend)

### 1.1 Install Supabase CLI

```bash
npm install -g supabase
```

### 1.2 Login to Supabase

```bash
supabase login
```

### 1.3 Create New Project

```bash
# Create project via CLI (or use web dashboard)
supabase projects create obama-approximation
```

Or create via web dashboard at: https://supabase.com/dashboard

### 1.4 Link Local Project

```bash
supabase link --project-ref your-project-ref
```

### 1.5 Push Database Migrations

```bash
supabase db push
```

This will create:
- `global_matches` table (top 100 seeds)
- `global_stats` table (total images explored, best match)
- `submit_match()` function (atomic updates)
- Real-time subscriptions enabled

### 1.6 Get Your Credentials

```bash
# Get your project URL and anon key
supabase status
```

Or find them in Supabase Dashboard → Settings → API

## Step 2: Environment Variables

### 2.1 Create `.env.local`

```bash
cp .env.local.example .env.local
```

### 2.2 Fill in Credentials

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 3: Install Dependencies

```bash
npm install
```

This will install:
- `@supabase/supabase-js` (Supabase client)
- All existing dependencies

## Step 4: Test Locally

```bash
npm run dev
```

Open http://localhost:3000

**Expected behavior:**
- Click Start
- When new best matches are found, they're submitted to global DB
- Global leaderboard updates in real-time
- Global stats (total explored, best match) update live
- Other users' matches appear automatically

## Step 5: Deploy to Vercel

### 5.1 Install Vercel CLI (optional)

```bash
npm install -g vercel
```

### 5.2 Deploy via CLI

```bash
vercel
```

Or use GitHub integration:
1. Push to GitHub
2. Import repository in Vercel dashboard
3. Add environment variables in Vercel project settings

### 5.3 Add Environment Variables in Vercel

In Vercel Dashboard → Settings → Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 5.4 Deploy

```bash
vercel --prod
```

Or push to `main` branch (auto-deploys via GitHub integration)

## How It Works

### Real-time Flow

```
User 1 finds match → Submit to Supabase → Broadcast change
                          ↓
User 2, 3, 4... ← Real-time subscription ← Supabase
```

### Database Operations

**When new best match found:**
1. Call `submit_match(seed, sse, mse, similarity)`
2. Function atomically:
   - Inserts/updates `global_matches`
   - Increments `total_images_explored`
   - Updates `best_sse/seed/similarity` if better
3. Triggers real-time update to all connected clients

**Every 10 seconds (throttled):**
- Submit current best local match to global DB
- Receive global top 100 updates
- Receive global stats updates

### Data Schema

**global_matches:**
- `seed` (unique)
- `sse`, `mse`, `similarity`
- `created_at`

**global_stats:**
- `total_images_explored` (increments on every submit)
- `best_sse`, `best_seed`, `best_similarity`
- `updated_at`

## Supabase Features Used

- **PostgreSQL**: Reliable database
- **Real-time**: WebSocket subscriptions for live updates
- **Row Level Security**: Public read/write (can be restricted)
- **Database Functions**: Atomic operations
- **Free Tier**: 500MB database, 2GB bandwidth

## Costs

- **Supabase Free Tier**: 
  - 500MB database (enough for millions of matches)
  - 2GB bandwidth/month
  - Unlimited API requests
  
- **Vercel Free Tier**:
  - 100GB bandwidth
  - Unlimited deployments
  - Serverless functions

**Total Cost: $0/month** for reasonable usage!

## Monitoring

### Check Global Stats

Visit your app and watch:
- Total images explored (all users combined)
- Best match globally (across all users)
- Top 100 updating in real-time

### Supabase Dashboard

View live data at:
```
https://supabase.com/dashboard/project/your-project-ref/editor
```

## Troubleshooting

### "Failed to fetch"
- Check `.env.local` has correct credentials
- Verify Supabase project is active
- Check CORS settings (should allow all origins)

### "Not authorized"
- RLS policies might be too restrictive
- Check policies allow public access
- Verify anon key is correct

### Real-time not working
- Check WebSocket connection in DevTools → Network
- Verify real-time is enabled in Supabase dashboard
- Check browser doesn't block WebSockets

## Advanced Configuration

### Limit to Top 100

The database stores all matches, but only top 100 are fetched:
```sql
SELECT * FROM global_matches 
ORDER BY sse ASC 
LIMIT 100
```

### Rate Limiting

To prevent spam, you can add:
```sql
-- In submit_match function
IF (SELECT COUNT(*) FROM global_matches 
    WHERE created_at > NOW() - INTERVAL '1 minute') > 60 THEN
  RAISE EXCEPTION 'Rate limit exceeded';
END IF;
```

### Cleanup Old Matches

Keep only top 1000:
```sql
DELETE FROM global_matches
WHERE id NOT IN (
  SELECT id FROM global_matches
  ORDER BY sse ASC
  LIMIT 1000
);
```

## Security Notes

**Current setup: Public read/write** (for demo)

For production:
- Add user authentication
- Restrict writes to authenticated users
- Add rate limiting
- Validate data server-side
- Use Supabase RLS policies

## Quick Command Reference

```bash
# Setup
supabase login
supabase link --project-ref your-ref
supabase db push

# Local development
npm run dev

# Deploy
vercel --prod

# Check status
supabase status

# View logs
supabase logs
```

## Success Checklist

- [ ] Supabase project created
- [ ] Migrations pushed (`supabase db push`)
- [ ] `.env.local` configured with credentials
- [ ] `npm install` completed
- [ ] Local testing successful (`npm run dev`)
- [ ] Environment variables added to Vercel
- [ ] Deployed to Vercel (`vercel --prod`)
- [ ] Real-time updates working across multiple tabs
- [ ] Global leaderboard displaying

**You're ready to go global!** 🌍🚀

