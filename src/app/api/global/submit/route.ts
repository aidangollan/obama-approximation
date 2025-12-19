import { kv } from '@vercel/kv'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { seed, sse, mse, similarity, username } = await request.json()
    
    if (typeof seed !== 'number' || typeof sse !== 'number' || 
        typeof mse !== 'number' || typeof similarity !== 'number') {
      console.error('Invalid data received:', { seed, sse, mse, similarity })
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }


    // Store in global top 10 sorted set (sorted by SSE)
    const matchData = JSON.stringify({
      seed,
      mse,
      similarity,
      timestamp: Date.now(),
      ...(username && { username })
    })
    
    await kv.zadd('global:top10', {
      score: sse,
      member: matchData
    })

    // Keep only top 12 (trim sorted set)
    await kv.zremrangebyrank('global:top10', 12, -1)

    // Update user leaderboard if username provided
    if (username) {
      const userKey = `user:${username}`
      const existingUser = await kv.get<any>(userKey)
      
      // Update if new user OR better score
      if (!existingUser || similarity > existingUser.bestSimilarity) {
        const userData = {
          username,
          bestSimilarity: similarity,
          bestSeed: seed,
          matchCount: existingUser ? existingUser.matchCount + 1 : 1,
          lastUpdated: Date.now()
        }
        
        // Store user data
        await kv.set(userKey, userData)
        
        // Remove old entry from sorted set if exists
        if (existingUser) {
          const oldEntry = JSON.stringify({
            username: existingUser.username,
            bestSimilarity: existingUser.bestSimilarity,
            bestSeed: existingUser.bestSeed,
            matchCount: existingUser.matchCount,
            lastUpdated: existingUser.lastUpdated
          })
          await kv.zrem('global:users', oldEntry)
        }
        
        // Add new entry to sorted set
        await kv.zadd('global:users', {
          score: similarity,
          member: JSON.stringify(userData)
        })
        
        // Keep only top 10 users
        const userCount = await kv.zcard('global:users')
        if (userCount > 10) {
          await kv.zremrangebyrank('global:users', 0, userCount - 11)
        }
      }
    }

    // Check if this is better than current global best
    const currentBest = await kv.get<number>('global:best_sse')
    
    // Update global best if this is better
    if (currentBest === null || sse < currentBest) {
      await kv.set('global:best_sse', sse)
      await kv.set('global:best_seed', seed)
      await kv.set('global:best_similarity', similarity)
      await kv.set('global:best_mse', mse)
      
      return NextResponse.json({ success: true, isNewBest: true })
    }

    return NextResponse.json({ success: true, isNewBest: false })
  } catch (error) {
    console.error('Error submitting match:', error)
    return NextResponse.json({ error: 'Failed to submit', details: String(error) }, { status: 500 })
  }
}

