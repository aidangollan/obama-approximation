import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export interface GlobalMatch {
  seed: number
  sse: number
  mse: number
  similarity: number
  timestamp: number
}

export async function GET() {
  try {
    // Get top 12 from sorted set (sorted by SSE)
    const top10 = await kv.zrange('global:top10', 0, 11, { withScores: true })
    
    // Parse results - data is already objects, not strings!
    const matches: GlobalMatch[] = []
    for (let i = 0; i < top10.length; i += 2) {
      const data = top10[i]
      const sse = top10[i + 1] as number
      
      // Check if data is already an object
      if (typeof data === 'object' && data !== null) {
        matches.push({ ...(data as any), sse })
      } else if (typeof data === 'string') {
        // Fallback for string data
        try {
          const match = JSON.parse(data)
          matches.push({ ...match, sse })
        } catch (e) {
          console.error('Failed to parse match:', e, 'Data:', data)
        }
      }
    }
    
    return NextResponse.json({ matches })
  } catch (error) {
    console.error('Error fetching top 10:', error)
    return NextResponse.json({ matches: [], error: String(error) }, { status: 200 })
  }
}

