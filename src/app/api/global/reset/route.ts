import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    // Delete all global data
    await kv.del('global:top10')
    await kv.del('global:total_explored')
    await kv.del('global:best_sse')
    await kv.del('global:best_seed')
    await kv.del('global:best_similarity')
    await kv.del('global:best_mse')
    await kv.del('global:progress')

    console.log('✅ KV store cleared (including progress)')

    return NextResponse.json({ 
      success: true,
      message: 'Global data reset successfully'
    })
  } catch (error) {
    console.error('Error resetting KV:', error)
    return NextResponse.json({ error: 'Failed to reset' }, { status: 500 })
  }
}

