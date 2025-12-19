// Import target data
import { OBAMA_128_NEAREST_UINT8 } from '@/lib/targets/obama_128_nearest_uint8'

const TARGET_SIZE = 128 * 128

// Calculate similarity percentage (0-100%)
// Uses RMSE (Root Mean Square Error) for better intuitive scaling
function calculateSimilarity(sse: number): number {
  // Calculate MSE (Mean Squared Error)
  const mse = sse / TARGET_SIZE
  
  // Calculate RMSE (Root Mean Square Error) - this is the average pixel difference
  const rmse = Math.sqrt(mse)
  
  // Normalize to 0-100% where:
  // - RMSE = 0 → 100% (perfect match)
  // - RMSE = 128 → 0% (half the range, roughly random)
  // This makes random images score around 40-60% instead of 80-90%
  const similarity = Math.max(0, Math.min(100, (1 - rmse / 128) * 100))
  
  return similarity
}

// Fast 32-bit PRNG (Mulberry32)
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// Generate deterministic 128x128 grayscale image from seed
function generateImage(seed: number): Uint8Array {
  const rng = mulberry32(seed)
  const bytes = new Uint8Array(TARGET_SIZE)
  
  for (let i = 0; i < TARGET_SIZE; i++) {
    bytes[i] = Math.floor(rng() * 256)
  }
  
  return bytes
}

// Calculate SSE (Sum of Squared Errors) using integer math
function calculateSSE(generated: Uint8Array, target: Uint8Array): number {
  let sse = 0
  for (let i = 0; i < TARGET_SIZE; i++) {
    const diff = generated[i] - target[i]
    sse += diff * diff
  }
  return sse
}

// Worker state
let isRunning = false
let currentSeed = 0
let bestSeed = 0
let bestSSE = Infinity
let bestBytes: Uint8Array | null = null

let iterationCount = 0
let totalImagesGenerated = 0 // Total count of images generated
let lastStatsTime = Date.now()
let lastRecentTime = Date.now()

// Generate random seed (0 to 2^31-1)
function getRandomSeed(): number {
  return Math.floor(Math.random() * 0x7FFFFFFF)
}

// Main loop
function runLoop() {
  if (!isRunning) return

  const batchSize = 100 // Process 100 images before checking time

  for (let i = 0; i < batchSize && isRunning; i++) {
    // Generate random seed instead of sequential
    currentSeed = getRandomSeed()
    const bytes = generateImage(currentSeed)
    const sse = calculateSSE(bytes, OBAMA_128_NEAREST_UINT8)
    const mse = sse / TARGET_SIZE

    iterationCount++
    totalImagesGenerated++

    // Always send current image with its score for "best in second" tracking
    const currentBytes = bytes.slice()
    postMessage({
      type: 'current',
      data: {
        bytes: currentBytes,
        seed: currentSeed,
        sse: sse,
        similarity: calculateSimilarity(sse),
      },
    }, { transfer: [currentBytes.buffer] })

    // Check if this is a new best
    if (sse < bestSSE) {
      bestSSE = sse
      bestSeed = currentSeed
      bestBytes = bytes.slice()

      // Send best update immediately (don't transfer, keep a copy)
      const bestCopy = bestBytes.slice()
      const similarity = calculateSimilarity(sse)
      postMessage({
        type: 'best',
        data: {
          seed: bestSeed,
          sse: bestSSE,
          mse: mse,
          similarity: similarity,
          bytes: bestCopy,
        },
      }, { transfer: [bestCopy.buffer] })
    }

    // Send recent update (throttled to ~10/sec)
    const now = Date.now()
    if (now - lastRecentTime > 100) {
      const recentBytes = bytes.slice()
      const similarity = calculateSimilarity(sse)
      postMessage({
        type: 'recent',
        data: {
          seed: currentSeed,
          sse: sse,
          mse: mse,
          similarity: similarity,
          bytes: recentBytes,
        },
      }, { transfer: [recentBytes.buffer] })
      lastRecentTime = now
    }
  }

  // Calculate and send stats every ~100ms
  const now = Date.now()
  if (now - lastStatsTime > 100) {
    const elapsed = (now - lastStatsTime) / 1000
    const iterationsPerSecond = iterationCount / elapsed

    const currentBytes = generateImage(currentSeed)
    const currentSSE = calculateSSE(currentBytes, OBAMA_128_NEAREST_UINT8)
    const currentMSE = currentSSE / TARGET_SIZE
    const currentSimilarity = calculateSimilarity(currentSSE)
    const bestSimilarity = bestSSE === Infinity ? 0 : calculateSimilarity(bestSSE)

    postMessage({
      type: 'stats',
      data: {
        currentSeed,
        currentSSE,
        currentMSE,
        currentSimilarity,
        bestSeed,
        bestSSE: bestSSE === Infinity ? Infinity : bestSSE,
        bestMSE: bestSSE === Infinity ? Infinity : bestSSE / TARGET_SIZE,
        bestSimilarity,
        iterationsPerSecond,
        totalImagesGenerated,
      },
    })

    iterationCount = 0
    lastStatsTime = now
  }

  // Continue loop immediately - use setImmediate-like behavior
  if (isRunning) {
    // Queue next iteration
    setTimeout(runLoop, 0)
  }
}

// Message handler
self.onmessage = (e) => {
  const { type, seed } = e.data

  switch (type) {
    case 'start':
      if (!isRunning) {
        isRunning = true
        lastStatsTime = Date.now()
        lastRecentTime = Date.now()
        iterationCount = 0
        // Note: Don't reset totalImagesGenerated - it persists across start/pause
        // Start the loop
        runLoop()
      }
      break

    case 'pause':
      isRunning = false
      break

    case 'generate':
      // Generate and display a specific seed
      if (typeof seed === 'number') {
        const bytes = generateImage(seed)
        const sse = calculateSSE(bytes, OBAMA_128_NEAREST_UINT8)
        const mse = sse / TARGET_SIZE
        const similarity = calculateSimilarity(sse)

        const byteCopy = bytes.slice()
        postMessage({
          type: 'current',
          data: {
            bytes: byteCopy,
          },
        }, { transfer: [byteCopy.buffer] })

        postMessage({
          type: 'stats',
          data: {
            currentSeed: seed,
            currentSSE: sse,
            currentMSE: mse,
            currentSimilarity: similarity,
            bestSeed,
            bestSSE: bestSSE === Infinity ? Infinity : bestSSE,
            bestMSE: bestSSE === Infinity ? Infinity : bestSSE / TARGET_SIZE,
            bestSimilarity: bestSSE === Infinity ? 0 : calculateSimilarity(bestSSE),
            iterationsPerSecond: 0,
            totalImagesGenerated,
          },
        })
      }
      break
  }
}

