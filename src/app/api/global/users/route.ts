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
    
    // Get top 10 users from sorted set (sorted by best similarity, descending)
    const users = await kv.zrange('global:users', 0, 9, { 
      withScores: false,
      rev: true // Reverse to get highest scores first
    })
    
    console.log('📊 Raw users from KV:', users)
    console.log('📊 Type of first item:', users[0] ? typeof users[0] : 'undefined')
    
    const topUsers: TopUser[] = []
    for (const item of users) {
      if (typeof item === 'object' && item !== null) {
        // Data is already an object
        topUsers.push(item as TopUser)
      } else if (typeof item === 'string') {
        // Data is a JSON string
        try {
          const parsed = JSON.parse(item)
          topUsers.push(parsed)
        } catch (e) {
          console.error('Failed to parse user:', e, 'Data:', item)
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

