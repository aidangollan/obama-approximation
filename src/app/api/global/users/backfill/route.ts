import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Backfill user leaderboard from existing global top 10
export async function POST() {
  try {
    console.log('Backfilling user leaderboard from global top 10...')
    
    // Get all matches from global top 10
    const matches = await kv.zrange('global:top10', 0, -1, { withScores: true })
    
    const userMap = new Map<string, { bestSimilarity: number, bestSeed: number, count: number }>()
    
    // Process matches
    for (let i = 0; i < matches.length; i += 2) {
      const data = matches[i]
      const sse = matches[i + 1] as number
      
      let match: any
      if (typeof data === 'object') {
        match = data
      } else if (typeof data === 'string') {
        try {
          match = JSON.parse(data)
        } catch (e) {
          continue
        }
      }
      
      if (match.username) {
        const existing = userMap.get(match.username)
        if (!existing || match.similarity > existing.bestSimilarity) {
          userMap.set(match.username, {
            bestSimilarity: match.similarity,
            bestSeed: match.seed,
            count: (existing?.count || 0) + 1
          })
        } else if (existing) {
          existing.count++
        }
      }
    }
    
    // Clear existing user leaderboard
    await kv.del('global:users')
    
    // Add all users to sorted set
    for (const [username, data] of userMap.entries()) {
      const userData = {
        username,
        bestSimilarity: data.bestSimilarity,
        bestSeed: data.bestSeed,
        matchCount: data.count,
        lastUpdated: Date.now()
      }
      
      await kv.set(`user:${username}`, userData)
      await kv.zadd('global:users', {
        score: data.bestSimilarity,
        member: JSON.stringify(userData)
      })
    }
    
    console.log(`Backfilled ${userMap.size} users`)
    
    return NextResponse.json({ 
      success: true,
      usersAdded: userMap.size
    })
  } catch (error) {
    console.error('Backfill error:', error)
    return NextResponse.json({ error: 'Failed to backfill' }, { status: 500 })
  }
}

