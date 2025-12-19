import { kv } from '@vercel/kv'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { seed } = await request.json()
    
    if (typeof seed !== 'number') {
      return NextResponse.json({ error: 'Invalid seed' }, { status: 400 })
    }

    // Get all entries from the sorted set
    const allEntries = await kv.zrange('global:top10', 0, -1, { withScores: true })
    
    let deleted = false
    
    // Find and remove the entry with matching seed
    for (let i = 0; i < allEntries.length; i += 2) {
      const data = allEntries[i]
      
      let entryData: any = null
      
      if (typeof data === 'object' && data !== null) {
        entryData = data
      } else if (typeof data === 'string') {
        try {
          entryData = JSON.parse(data)
        } catch (e) {
          console.error('Failed to parse entry:', e)
          continue
        }
      }
      
      if (entryData && entryData.seed === seed) {
        // Remove this entry
        if (typeof data === 'string') {
          await kv.zrem('global:top10', data)
        } else {
          // For object data, we need to stringify it the same way to remove it
          await kv.zrem('global:top10', JSON.stringify(data))
        }
        deleted = true
        break
      }
    }

    if (deleted) {
      // Check if we need to update global best
      const remaining = await kv.zrange('global:top10', 0, 0, { withScores: true })
      
      if (remaining.length > 0) {
        const bestData = remaining[0]
        const bestSse = remaining[1] as number
        
        let bestEntry: any = null
        if (typeof bestData === 'object' && bestData !== null) {
          bestEntry = bestData
        } else if (typeof bestData === 'string') {
          try {
            bestEntry = JSON.parse(bestData)
          } catch (e) {
            console.error('Failed to parse best entry:', e)
          }
        }
        
        if (bestEntry) {
          await kv.set('global:best_sse', bestSse)
          await kv.set('global:best_seed', bestEntry.seed)
          await kv.set('global:best_similarity', bestEntry.similarity)
          await kv.set('global:best_mse', bestEntry.mse)
        }
      } else {
        // No entries left, clear global best
        await kv.del('global:best_sse')
        await kv.del('global:best_seed')
        await kv.del('global:best_similarity')
        await kv.del('global:best_mse')
      }

      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 })
    }
  } catch (error) {
    console.error('Error deleting entry:', error)
    return NextResponse.json({ error: 'Failed to delete entry', details: String(error) }, { status: 500 })
  }
}

