# Quick Setup - Vercel KV Database

Your app is deployed! Now add the global leaderboard in 3 steps:

## Step 1: Create KV Database

1. **Go to your Vercel project:**
   https://vercel.com/aidan-gollans-projects/obama-approximation

2. **Click "Storage" tab** (top navigation)

3. **Click "Create Database"**

4. **Select "KV" (Redis)**

5. **Name it:** `obama-global`

6. **Click "Create"**

✅ Environment variables will be **automatically added** to your project!

## Step 2: Redeploy

After creating the KV database, you need to redeploy:

**Option A: Via Dashboard**
1. Go to "Deployments" tab
2. Click "..." menu on latest deployment
3. Click "Redeploy"
4. Click "Redeploy" again to confirm

**Option B: Via CLI**
```bash
cd /home/aidangollan/projects/obama-approximation
npx vercel --prod
```

## Step 3: Test!

1. **Open your app:**
   https://obama-approximation-cg5q1p0f9-aidan-gollans-projects.vercel.app

2. **Click "Start"**

3. **Watch the global stats update!**
   - "GLOBAL EXPLORED" counter increments
   - Your matches submit every 10 seconds
   - Click "SHOW TOP 100" to see global leaderboard

4. **Open in multiple tabs/devices:**
   - All tabs share the same global data
   - Updates every 5 seconds
   - Everyone contributes to the search!

## Verification

After redeploying, check:
- [ ] Global Explored counter is working
- [ ] Global Best similarity shows a value
- [ ] Clicking "SHOW TOP 100" shows matches
- [ ] Opening in multiple tabs shows shared data
- [ ] Matches submit automatically every 10 seconds

## That's It!

Your app now has a global leaderboard! Everyone who uses it contributes to finding the best Obama match! 🌍🚀

---

**Current URL:**
https://obama-approximation-cg5q1p0f9-aidan-gollans-projects.vercel.app

**Vercel Dashboard:**
https://vercel.com/aidan-gollans-projects/obama-approximation

**After creating KV database:**
- Environment variables auto-added
- Redeploy to activate
- Global leaderboard works!

