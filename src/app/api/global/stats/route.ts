import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [totalExplored, bestSSE, bestSeed, bestSimilarity] = await Promise.all([
      kv.get<number>('global:total_explored'),
      kv.get<number>('global:best_sse'),
      kv.get<number>('global:best_seed'),
      kv.get<number>('global:best_similarity'),
    ])

    return NextResponse.json({
      total_images_explored: totalExplored || 0,
      best_sse: bestSSE,
      best_seed: bestSeed,
      best_similarity: bestSimilarity,
    })
  } catch (error) {
    console.error('Error fetching global stats:', error)
    return NextResponse.json({
      total_images_explored: 0,
      best_sse: null,
      best_seed: null,
      best_similarity: null,
    }, { status: 200 })
  }
}

