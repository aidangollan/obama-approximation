export interface GlobalMatch {
  seed: number
  sse: number
  mse: number
  similarity: number
  timestamp: number
  username?: string
}

export interface GlobalStats {
  total_images_explored: number
  best_sse: number | null
  best_seed: number | null
  best_similarity: number | null
  best_mse: number | null
}

// Get global top 10
export async function getGlobalTop10(): Promise<GlobalMatch[]> {
  try {
    const response = await fetch('/api/global/top10', { cache: 'no-store' })
    const data = await response.json()
    return data.matches || []
  } catch (error) {
    console.error('Error fetching top 10:', error)
    return []
  }
}

// Submit match to global database (stored in top 10 if good enough)
export async function submitIfGlobalBest(seed: number, sse: number, mse: number, similarity: number, username?: string) {
  try {
    console.log('Submitting to global:', { seed, sse, similarity, username })
    const response = await fetch('/api/global/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed, sse, mse, similarity, username }),
    })
    const data = await response.json()
    console.log('Submit response:', data)
    return data.isNewBest || false
  } catch (error) {
    console.error('Error submitting match:', error)
    return false
  }
}

// Get global stats (best match + total explored)
export async function getGlobalStats(): Promise<GlobalStats> {
  try {
    const response = await fetch('/api/global/stats', { cache: 'no-store' })
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching global stats:', error)
    return {
      total_images_explored: 0,
      best_sse: null,
      best_seed: null,
      best_similarity: null,
      best_mse: null,
    }
  }
}

// Increment global counter by batch amount (adds to existing value)
export async function incrementGlobalCounter(count: number) {
  try {
    const response = await fetch('/api/global/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    })
    return response.ok
  } catch (error) {
    console.error('Error incrementing counter:', error)
    return false
  }
}

export interface TopUser {
  username: string
  bestSimilarity: number
  bestSeed: number
  matchCount: number
  lastUpdated: number
}

export async function getTopUsers(): Promise<TopUser[]> {
  try {
    const response = await fetch('/api/global/users', { cache: 'no-store' })
    const data = await response.json()
    console.log('🔍 RAW top users API response:', data)
    console.log('🔍 Users array:', data.users)
    console.log('🔍 Users array length:', data.users?.length)
    if (data.users && data.users.length > 0) {
      console.log('🔍 First user:', data.users[0])
    }
    return data.users || []
  } catch (error) {
    console.error('Error fetching top users:', error)
    return []
  }
}


