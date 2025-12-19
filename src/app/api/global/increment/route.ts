import { kv } from '@vercel/kv'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { count } = await request.json()
    
    if (typeof count !== 'number' || count <= 0) {
      return NextResponse.json({ error: 'Invalid count' }, { status: 400 })
    }

    // Increment total images explored by the count
    await kv.incrby('global:total_explored', count)

    const newTotal = await kv.get<number>('global:total_explored')

    return NextResponse.json({ 
      success: true,
      total: newTotal
    })
  } catch (error) {
    console.error('Error incrementing counter:', error)
    return NextResponse.json({ error: 'Failed to increment' }, { status: 500 })
  }
}

