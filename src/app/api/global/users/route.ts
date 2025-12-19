import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export interface TopUser {
  username: string
  bestSimilarity: number
  bestSeed: number
  matchCount: number
  lastUpdated: number
}

export async function GET() {
  try {
    const count = await kv.zcard('global:users')
    console.log('📊 KV users count:', count)
    
    // Get top 10 usernames from sorted set (sorted by best similarity, descending)
    const usernames = await kv.zrange('global:users', 0, 9, { 
      withScores: false,
      rev: true // Reverse to get highest scores first
    })
    
    console.log('📊 Raw usernames from KV:', usernames)
    
    const topUsers: TopUser[] = []
    
    // Fetch full user data for each username
    for (const username of usernames) {
      if (typeof username === 'string') {
        const userKey = `user:${username}`
        const userData = await kv.get<TopUser>(userKey)
        
        if (userData) {
          topUsers.push(userData)
        } else {
          console.warn('User data not found for username:', username)
        }
      }
    }
    
    console.log('📊 Returning users:', topUsers.length)
    return NextResponse.json({ users: topUsers })
  } catch (error) {
    console.error('Error fetching top users:', error)
    return NextResponse.json({ users: [] })
  }
}

