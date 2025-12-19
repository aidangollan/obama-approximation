// GPU-accelerated worker using WebGPU compute shaders
import { OBAMA_128_NEAREST_UINT8 } from '@/lib/targets/obama_128_nearest_uint8'

const TARGET_SIZE = 128 * 128
const BATCH_SIZE = 1024 // Process 1024 images per GPU dispatch

let isRunning = false
let totalImagesGenerated = 0
let bestSeed = 0
let bestSSE = Infinity
let iterationCount = 0
let lastStatsTime = Date.now()
let lastRecentTime = Date.now()

// GPU resources
let device: any = null
let pipeline: any = null
let targetBuffer: any = null
let resultsBuffer: any = null
let seedBuffer: any = null
let readBuffer: any = null

// WebGPU compute shader
const COMPUTE_SHADER = `
@group(0) @binding(0) var<storage, read> target: array<u32>;
@group(0) @binding(1) var<storage, read_write> results: array<u32>;
@group(0) @binding(2) var<storage, read> seeds: array<u32>;

fn mulberry32(seed: u32, iteration: u32) -> u32 {
  var s = seed + iteration * 0x6D2B79F5u;
  s = s + 0x6D2B79F5u;
  s = (s ^ (s >> 15u)) * (s | 1u);
  s = s ^ (s + (s ^ (s >> 7u)) * (s | 61u));
  return s ^ (s >> 14u);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let batch_idx = global_id.x;
  if (batch_idx >= arrayLength(&seeds)) {
    return;
  }

  let base_seed = seeds[batch_idx];
  var rng_state = base_seed;
  var sse: u32 = 0u;

  // Generate 16384 pixels and calculate SSE
  for (var i: u32 = 0u; i < 16384u; i = i + 1u) {
    rng_state = mulberry32(rng_state, i);
    let pixel = (rng_state >> 24u) & 0xFFu;
    let target_val = target[i];
    let diff = i32(pixel) - i32(target_val);
    sse = sse + u32(diff * diff);
  }

  results[batch_idx] = sse;
}
`

// Initialize WebGPU
async function initGPU(): Promise<boolean> {
  try {
    if (!(self as any).gpu) {
      console.log('WebGPU not available, falling back to CPU')
      return false
    }

    const adapter = await (self as any).gpu.requestAdapter()
    if (!adapter) {
      console.log('No GPU adapter found')
      return false
    }

    device = await adapter.requestDevice()
    
    // Create shader module
    const shaderModule = device.createShaderModule({
      code: COMPUTE_SHADER
    })

    // Create pipeline
    pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main'
      }
    })

    // Create target buffer
    targetBuffer = device.createBuffer({
      size: TARGET_SIZE * 4,
      usage: 0x80 | 0x100 // STORAGE | COPY_DST
    })
    const targetU32 = new Uint32Array(OBAMA_128_NEAREST_UINT8)
    device.queue.writeBuffer(targetBuffer, 0, targetU32)

    // Create results buffer
    resultsBuffer = device.createBuffer({
      size: BATCH_SIZE * 4,
      usage: 0x80 | 0x1 // STORAGE | COPY_SRC
    })

    // Create seed buffer
    seedBuffer = device.createBuffer({
      size: BATCH_SIZE * 4,
      usage: 0x80 | 0x100 // STORAGE | COPY_DST
    })

    // Create read buffer
    readBuffer = device.createBuffer({
      size: BATCH_SIZE * 4,
      usage: 0x100 | 0x2 // COPY_DST | MAP_READ
    })

    console.log('✅ WebGPU initialized - GPU acceleration active!')
    return true
  } catch (error) {
    console.error('WebGPU init failed:', error)
    return false
  }
}

// CPU fallback
function mulberry32PRNG(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function generateImageCPU(seed: number): Uint8Array {
  const rng = mulberry32PRNG(seed)
  const bytes = new Uint8Array(TARGET_SIZE)
  for (let i = 0; i < TARGET_SIZE; i++) {
    bytes[i] = Math.floor(rng() * 256)
  }
  return bytes
}

function calculateSSE(generated: Uint8Array, target: Uint8Array): number {
  let sse = 0
  for (let i = 0; i < TARGET_SIZE; i++) {
    const diff = generated[i] - target[i]
    sse += diff * diff
  }
  return sse
}

function calculateSimilarity(sse: number): number {
  const mse = sse / TARGET_SIZE
  const rmse = Math.sqrt(mse)
  return Math.max(0, Math.min(100, (1 - rmse / 128) * 100))
}

function getRandomSeed(): number {
  return Math.floor(Math.random() * 0x7FFFFFFF)
}

// GPU batch processing
async function processBatchGPU(seeds: Uint32Array): Promise<Uint32Array> {
  if (!device || !pipeline) return new Uint32Array(seeds.length)

  // Upload seeds
  device.queue.writeBuffer(seedBuffer, 0, seeds)

  // Create command encoder
  const commandEncoder = device.createCommandEncoder()

  // Compute pass
  const passEncoder = commandEncoder.beginComputePass()
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: targetBuffer } },
      { binding: 1, resource: { buffer: resultsBuffer } },
      { binding: 2, resource: { buffer: seedBuffer } }
    ]
  })
  
  passEncoder.setPipeline(pipeline)
  passEncoder.setBindGroup(0, bindGroup)
  passEncoder.dispatchWorkgroups(Math.ceil(seeds.length / 64))
  passEncoder.end()

  // Copy results
  commandEncoder.copyBufferToBuffer(resultsBuffer, 0, readBuffer, 0, seeds.length * 4)
  device.queue.submit([commandEncoder.finish()])

  // Read results
  await readBuffer.mapAsync(0x0001) // MAP_READ
  const resultData = new Uint32Array(readBuffer.getMappedRange().slice(0))
  readBuffer.unmap()

  return resultData
}

// Main loop
async function runLoop() {
  const useGPU = device !== null

  while (isRunning) {
    if (useGPU) {
      // GPU path: process batch
      const seeds = new Uint32Array(BATCH_SIZE)
      for (let i = 0; i < BATCH_SIZE; i++) {
        seeds[i] = getRandomSeed()
      }

      try {
        const results = await processBatchGPU(seeds)
        
        // Process results
        for (let i = 0; i < results.length && isRunning; i++) {
          const seed = seeds[i]
          const sse = results[i]
          totalImagesGenerated++
          iterationCount++

          // Send current occasionally
          const now = Date.now()
          if (i % 100 === 0 || now - lastRecentTime > 100) {
            const bytes = generateImageCPU(seed)
            postMessage({
              type: 'current',
              data: { bytes: bytes.slice(), seed, sse, similarity: calculateSimilarity(sse) }
            }, { transfer: [bytes.buffer] })
            lastRecentTime = now
          }

          // Check best
          if (sse < bestSSE) {
            bestSSE = sse
            bestSeed = seed
            const bytes = generateImageCPU(seed)
            postMessage({
              type: 'best',
              data: { seed, sse, mse: sse / TARGET_SIZE, similarity: calculateSimilarity(sse), bytes }
            }, { transfer: [bytes.buffer] })
          }
        }
      } catch (error) {
        console.error('GPU processing failed, falling back to CPU:', error)
        // Fall back to CPU for this iteration
        for (let i = 0; i < 100 && isRunning; i++) {
          const seed = getRandomSeed()
          const bytes = generateImageCPU(seed)
          const sse = calculateSSE(bytes, OBAMA_128_NEAREST_UINT8)
          totalImagesGenerated++
          iterationCount++

          if (sse < bestSSE) {
            bestSSE = sse
            bestSeed = seed
            postMessage({
              type: 'best',
              data: { seed, sse, mse: sse / TARGET_SIZE, similarity: calculateSimilarity(sse), bytes: bytes.slice() }
            }, { transfer: [bytes.buffer] })
          }
        }
      }
    } else {
      // CPU path
      for (let i = 0; i < 100 && isRunning; i++) {
        const seed = getRandomSeed()
        const bytes = generateImageCPU(seed)
        const sse = calculateSSE(bytes, OBAMA_128_NEAREST_UINT8)
        totalImagesGenerated++
        iterationCount++

        const now = Date.now()
        if (now - lastRecentTime > 100) {
          postMessage({
            type: 'current',
            data: { bytes: bytes.slice(), seed, sse, similarity: calculateSimilarity(sse) }
          }, { transfer: [bytes.buffer] })
          lastRecentTime = now
        }

        if (sse < bestSSE) {
          bestSSE = sse
          bestSeed = seed
          postMessage({
            type: 'best',
            data: { seed, sse, mse: sse / TARGET_SIZE, similarity: calculateSimilarity(sse), bytes: bytes.slice() }
          }, { transfer: [bytes.buffer] })
        }
      }
    }

    // Send stats
    const now = Date.now()
    if (now - lastStatsTime > 100) {
      const elapsed = (now - lastStatsTime) / 1000
      const iterationsPerSecond = iterationCount / elapsed

      postMessage({
        type: 'stats',
        data: {
          currentSeed: 0,
          currentSSE: 0,
          currentMSE: 0,
          currentSimilarity: 0,
          bestSeed,
          bestSSE,
          bestMSE: bestSSE / TARGET_SIZE,
          bestSimilarity: calculateSimilarity(bestSSE),
          iterationsPerSecond,
          totalImagesGenerated
        }
      })

      iterationCount = 0
      lastStatsTime = now
    }

    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

// Message handler
self.onmessage = async (e) => {
  const { type, seed } = e.data

  switch (type) {
    case 'start':
      if (!isRunning) {
        isRunning = true
        lastStatsTime = Date.now()
        lastRecentTime = Date.now()
        iterationCount = 0
        
        // Try GPU init
        if (!device) {
          await initGPU()
        }
        
        runLoop()
      }
      break

    case 'pause':
      isRunning = false
      break

    case 'generate':
      if (typeof seed === 'number') {
        const bytes = generateImageCPU(seed)
        const sse = calculateSSE(bytes, OBAMA_128_NEAREST_UINT8)
        postMessage({
          type: 'current',
          data: { bytes: bytes.slice(), seed, sse, similarity: calculateSimilarity(sse) }
        }, { transfer: [bytes.buffer] })
      }
      break
  }
}

