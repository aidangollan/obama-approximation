import { kv } from '@vercel/kv'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { seed, sse, mse, similarity, username } = await request.json()
    
    if (typeof seed !== 'number' || typeof sse !== 'number' || 
        typeof mse !== 'number' || typeof similarity !== 'number') {
      return NextResponse.json({ error: 'Invalid data types' }, { status: 400 })
    }

    // Create match data
    const matchData = JSON.stringify({
      seed,
      mse,
      similarity,
      timestamp: Date.now(),
      ...(username && { username })
    })
    
    // Add to sorted set
    await kv.zadd('global:top10', {
      score: sse,
      member: matchData
    })

    // Keep only top 12 (trim sorted set)
    await kv.zremrangebyrank('global:top10', 12, -1)

    // If username provided, update user leaderboard too
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
        
        // Store user data in a separate key
        await kv.set(userKey, userData)
        
        // Update sorted set - use username as member to ensure uniqueness
        await kv.zrem('global:users', username)
        
        // Add new entry with updated score
        await kv.zadd('global:users', {
          score: similarity,
          member: username
        })
        
        // Keep only top 10 users
        const userCount = await kv.zcard('global:users')
        if (userCount > 10) {
          await kv.zremrangebyrank('global:users', 0, userCount - 11)
        }
      }
    }

    // Update global best if needed
    const currentBest = await kv.get<number>('global:best_sse')
    if (currentBest === null || sse < currentBest) {
      await kv.set('global:best_sse', sse)
      await kv.set('global:best_seed', seed)
      await kv.set('global:best_similarity', similarity)
      await kv.set('global:best_mse', mse)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding entry:', error)
    return NextResponse.json({ error: 'Failed to add entry', details: String(error) }, { status: 500 })
  }
}

