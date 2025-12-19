const TOP_10_KEY = 'obama-approximation-top10'
const TOTAL_COUNT_KEY = 'obama-approximation-total-count'

export interface Top10Entry {
  seed: number
  sse: number
  mse: number
  similarity?: number // Optional for backwards compatibility
  username?: string // Optional Twitter handle
}

/**
 * Load top 10 entries from localStorage
 */
export function loadTop10(): Top10Entry[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(TOP_10_KEY)
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 10)
    }
    return []
  } catch (error) {
    console.error('Failed to load top 10:', error)
    return []
  }
}

/**
 * Save top 10 entries to localStorage
 */
export function saveTop10(entries: Top10Entry[]): void {
  if (typeof window === 'undefined') return
  
  try {
    const toSave = entries.slice(0, 10)
    localStorage.setItem(TOP_10_KEY, JSON.stringify(toSave))
  } catch (error) {
    console.error('Failed to save top 10:', error)
  }
}

/**
 * Load total images count from localStorage
 */
export function loadTotalCount(): number {
  if (typeof window === 'undefined') return 0
  
  try {
    const stored = localStorage.getItem(TOTAL_COUNT_KEY)
    if (!stored) return 0
    
    const count = parseInt(stored, 10)
    return isNaN(count) ? 0 : count
  } catch (error) {
    console.error('Failed to load total count:', error)
    return 0
  }
}

/**
 * Save total images count to localStorage
 */
export function saveTotalCount(count: number): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(TOTAL_COUNT_KEY, count.toString())
  } catch (error) {
    console.error('Failed to save total count:', error)
  }
}

const PROGRESS_KEY = 'obama-approximation-progress'

export interface ProgressPoint {
  generation: number
  bestSimilarity: number
  timestamp: number
}

/**
 * Load progress history from localStorage
 */
export function loadProgress(): ProgressPoint[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(PROGRESS_KEY)
    if (!stored) return []
    
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return []
  } catch (error) {
    console.error('Failed to load progress:', error)
    return []
  }
}

/**
 * Save progress history to localStorage
 */
export function saveProgress(progress: ProgressPoint[]): void {
  if (typeof window === 'undefined') return
  
  try {
    // Keep last 1000 points max
    const toSave = progress.slice(-1000)
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(toSave))
  } catch (error) {
    console.error('Failed to save progress:', error)
  }
}

/**
 * Add a progress point
 */
export function addProgressPoint(generation: number, bestSimilarity: number): void {
  const progress = loadProgress()
  progress.push({
    generation,
    bestSimilarity,
    timestamp: Date.now()
  })
  saveProgress(progress)
}

