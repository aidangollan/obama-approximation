import { kv } from '@vercel/kv'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json()
    
    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    // Get user data
    const userKey = `user:${username}`
    const userData = await kv.get<any>(userKey)
    
    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Remove from sorted set
    await kv.zrem('global:users', JSON.stringify(userData))
    
    // Delete user key
    await kv.del(userKey)

    console.log(`Removed user: ${username}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing user:', error)
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 })
  }
}

