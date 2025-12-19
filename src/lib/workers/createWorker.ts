import { OBAMA_128_NEAREST_UINT8 } from '@/lib/targets/obama_128_nearest_uint8'

export function createGeneratorWorker(useGPU: boolean = false): Worker {
  const targetArray = Array.from(OBAMA_128_NEAREST_UINT8)
  const workerCode = useGPU ? getGPUWorkerCode(targetArray) : getCPUWorkerCode(targetArray)
  const blob = new Blob([workerCode], { type: 'application/javascript' })
  return new Worker(URL.createObjectURL(blob))
}

function getCPUWorkerCode(target: number[]): string {
  return `
const TARGET = new Uint8Array([${target.join(',')}]);
const SIZE = 128 * 128;

let running = false;
let total = 0;
let bestSeed = 0;
let bestSSE = Infinity;
let iters = 0;
let statsTime = Date.now();
let recentTime = statsTime;
let currentSeed = 0;

function randSeed() {
  return Math.floor(Math.random() * 0x7FFFFFFF);
}

function similarity(sse) {
  const mse = sse / SIZE;
  const rmse = Math.sqrt(mse);
  return Math.max(0, Math.min(100, (1 - rmse / 128) * 100));
}

function rng(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function genImage(seed) {
  const gen = rng(seed);
  const bytes = new Uint8Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    bytes[i] = Math.floor(gen() * 256);
  }
  return bytes;
}

function calcSSE(img) {
  let sse = 0;
  for (let i = 0; i < SIZE; i++) {
    const d = img[i] - TARGET[i];
    sse += d * d;
  }
  return sse;
}

function loop() {
  if (!running) return;

  for (let i = 0; i < 200 && running; i++) {
    currentSeed = randSeed();
    const img = genImage(currentSeed);
    const sse = calcSSE(img);
    
    total++;
    iters++;

    const now = Date.now();
    if (now - recentTime > 500) {
      postMessage({
        type: 'current',
        data: { bytes: img.slice(), seed: currentSeed, sse, similarity: similarity(sse) }
      }, { transfer: [img.buffer] });
      recentTime = now;
    }

    if (sse < bestSSE) {
      bestSSE = sse;
      bestSeed = currentSeed;
      const best = img.slice();
      postMessage({
        type: 'best',
        data: { seed: bestSeed, sse: bestSSE, mse: bestSSE / SIZE, similarity: similarity(bestSSE), bytes: best }
      }, { transfer: [best.buffer] });
    }
  }

  const now = Date.now();
  if (now - statsTime > 200) {
    const rate = iters / ((now - statsTime) / 1000);
    postMessage({
      type: 'stats',
      data: {
        currentSeed,
        currentSSE: 0,
        currentMSE: 0,
        currentSimilarity: 0,
        bestSeed,
        bestSSE,
        bestMSE: bestSSE / SIZE,
        bestSimilarity: similarity(bestSSE),
        iterationsPerSecond: rate,
        totalImagesGenerated: total
      }
    });
    iters = 0;
    statsTime = now;
  }

  if (running) {
    setTimeout(loop, 0);
  }
}

self.onmessage = (e) => {
  const { type, seed } = e.data;
  if (type === 'start' && !running) {
    running = true;
    statsTime = Date.now();
    recentTime = statsTime;
    iters = 0;
    console.log('💻 CPU worker started');
    loop();
  } else if (type === 'pause') {
    running = false;
  } else if (type === 'generate' && typeof seed === 'number') {
    const img = genImage(seed);
    const sse = calcSSE(img);
    postMessage({
      type: 'current',
      data: { bytes: img.slice(), seed, sse, similarity: similarity(sse) }
    }, { transfer: [img.buffer] });
  }
};
`
}

function getGPUWorkerCode(target: number[]): string {
  return `
const TARGET = new Uint8Array([${target.join(',')}]);
const SIZE = 128 * 128;
const BATCH = 2048;

let running = false;
let total = 0;
let bestSeed = 0;
let bestSSE = Infinity;
let iters = 0;
let statsTime = Date.now();
let recentTime = statsTime;
let device = null;
let pipeline = null;
let buffers = null;

const SHADER = String.raw\`
@group(0) @binding(0) var<storage, read> targetData: array<u32>;
@group(0) @binding(1) var<storage, read_write> results: array<u32>;
@group(0) @binding(2) var<storage, read> seeds: array<u32>;

fn getTargetPixel(index: u32) -> u32 {
  let wordIdx = index / 4u;
  let byteIdx = index % 4u;
  let word = targetData[wordIdx];
  return (word >> (byteIdx * 8u)) & 0xFFu;
}

struct RNGResult {
  pixel: u32,
  newState: u32,
}

fn xorshift32Step(state: u32) -> RNGResult {
  // Simple XORshift32 - easier to match exactly between CPU/GPU
  var x = state;
  x = x ^ (x << 13u);
  x = x ^ (x >> 17u);
  x = x ^ (x << 5u);
  
  let normalized = f32(x) / 4294967296.0;
  let pixel = u32(floor(normalized * 256.0));
  
  return RNGResult(pixel, x);
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= arrayLength(&seeds)) { return; }

  var rngState = seeds[idx];
  var sse: u32 = 0u;

  for (var i: u32 = 0u; i < 16384u; i = i + 1u) {
    let result = xorshift32Step(rngState);
    rngState = result.newState;
    let px = result.pixel;
    let tgt = getTargetPixel(i);
    let diff = i32(px) - i32(tgt);
    sse = sse + u32(diff * diff);
  }

  results[idx] = sse;
}
\`;

function randSeed() {
  return Math.floor(Math.random() * 0x7FFFFFFF);
}

function similarity(sse) {
  const mse = sse / SIZE;
  const rmse = Math.sqrt(mse);
  return Math.max(0, Math.min(100, (1 - rmse / 128) * 100));
}

function rng(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function genImage(seed) {
  const gen = rng(seed);
  const bytes = new Uint8Array(SIZE);
  for (let i = 0; i < SIZE; i++) {
    bytes[i] = Math.floor(gen() * 256);
  }
  return bytes;
}

async function initGPU() {
  if (!navigator.gpu) {
    console.log('⚠️  WebGPU API not available');
    console.log('💡 Enable at chrome://flags/#enable-unsafe-webgpu');
    return false;
  }

  try {
    console.log('🔍 Requesting GPU adapter...');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.log('❌ No GPU adapter available');
      return false;
    }

    console.log('📱 Requesting GPU device...');
    device = await adapter.requestDevice();
    console.log('✅ GPU device obtained');
    const module = device.createShaderModule({ code: SHADER });

    pipeline = device.createComputePipeline({
      layout: 'auto',
      compute: { module, entryPoint: 'main' }
    });

    // Pack TARGET bytes into u32 array (4 bytes per u32)
    const targetU32 = new Uint32Array(TARGET.buffer.slice(0));
    const targetBuf = device.createBuffer({
      size: targetU32.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    device.queue.writeBuffer(targetBuf, 0, targetU32);

    const resultsBuf = device.createBuffer({
      size: BATCH * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
    });

    const seedsBuf = device.createBuffer({
      size: BATCH * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const readBuf = device.createBuffer({
      size: BATCH * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    buffers = { targetBuf, resultsBuf, seedsBuf, readBuf };

    console.log('✅ WebGPU initialized!');
    console.log('⚡ Processing', BATCH, 'images per GPU batch');
    return true;
  } catch (err) {
    console.error('❌ GPU init failed:', err);
    console.error('Error details:', err.message || err);
    return false;
  }
}

function calcSSE(img) {
  let sse = 0;
  for (let i = 0; i < SIZE; i++) {
    const d = img[i] - TARGET[i];
    sse += d * d;
  }
  return sse;
}

async function processBatch(seeds) {
  const { targetBuf, resultsBuf, seedsBuf, readBuf } = buffers;
  
  device.queue.writeBuffer(seedsBuf, 0, seeds);

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  
  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: targetBuf } },
      { binding: 1, resource: { buffer: resultsBuf } },
      { binding: 2, resource: { buffer: seedsBuf } }
    ]
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bindGroup);
  pass.dispatchWorkgroups(Math.ceil(seeds.length / 256));
  pass.end();

  encoder.copyBufferToBuffer(resultsBuf, 0, readBuf, 0, seeds.length * 4);
  device.queue.submit([encoder.finish()]);

  await readBuf.mapAsync(1); // MAP_READ = 1
  const data = new Uint32Array(readBuf.getMappedRange());
  const output = new Uint32Array(data);
  readBuf.unmap();

  return output;
}

async function loop() {
  if (!running) return;

  if (device && buffers) {
    // GPU path
    const seeds = new Uint32Array(BATCH);
    for (let i = 0; i < BATCH; i++) {
      seeds[i] = randSeed();
    }

    try {
      const results = await processBatch(seeds);
      
        // COMPREHENSIVE DEBUG for first batch only
      if (total === 0) {
        console.log('═══ GPU DEBUG START ═══');
        const testSeed = seeds[0];
        const gpuSSE = results[0];
        
        // CPU calculation for same seed
        const cpuImg = genImage(testSeed);
        let cpuSSE = 0;
        for (let j = 0; j < SIZE; j++) {
          const d = cpuImg[j] - TARGET[j];
          cpuSSE += d * d;
        }
        
        console.log('Seed:', testSeed);
        console.log('GPU SSE:', gpuSSE, '(', similarity(gpuSSE).toFixed(2), '% )');
        console.log('CPU SSE:', cpuSSE, '(', similarity(cpuSSE).toFixed(2), '% )');
        console.log('Difference:', Math.abs(gpuSSE - cpuSSE));
        console.log('CPU pixels [0-9]:', Array.from(cpuImg.slice(0, 10)).join(', '));
        console.log('Target [0-9]:', Array.from(TARGET.slice(0, 10)).join(', '));
        console.log('═══ GPU DEBUG END ═══');
      }
      
      for (let i = 0; i < results.length; i++) {
        const seed = seeds[i];
        const sse = results[i];
        total++;
        iters++;

        const now = Date.now();
        if (i % 1024 === 0 && now - recentTime > 1000) {
          const img = genImage(seed);
          postMessage({
            type: 'current',
            data: { bytes: img, seed, sse, similarity: similarity(sse) }
          }, { transfer: [img.buffer] });
          recentTime = now;
        }

        if (sse < bestSSE) {
          bestSSE = sse;
          bestSeed = seed;
          const img = genImage(seed);
          postMessage({
            type: 'best',
            data: { seed, sse, mse: sse / SIZE, similarity: similarity(sse), bytes: img }
          }, { transfer: [img.buffer] });
        }
      }
    } catch (err) {
      console.error('GPU batch error:', err);
    }
  } else {
    // CPU fallback in GPU worker
    console.log('💻 Using CPU fallback');
    for (let i = 0; i < 200 && running; i++) {
      const seed = randSeed();
      const img = genImage(seed);
      const sse = calcSSE(img);
      
      total++;
      iters++;

      const now = Date.now();
      if (now - recentTime > 500) {
        postMessage({
          type: 'current',
          data: { bytes: img.slice(), seed, sse, similarity: similarity(sse) }
        }, { transfer: [img.buffer] });
        recentTime = now;
      }

      if (sse < bestSSE) {
        bestSSE = sse;
        bestSeed = seed;
        postMessage({
          type: 'best',
          data: { seed, sse, mse: sse / SIZE, similarity: similarity(sse), bytes: img.slice() }
        }, { transfer: [img.buffer] });
      }
    }
  }

  const now = Date.now();
  if (now - statsTime > 200) {
    const rate = iters / ((now - statsTime) / 1000);
    postMessage({
      type: 'stats',
      data: {
        currentSeed: 0,
        currentSSE: 0,
        currentMSE: 0,
        currentSimilarity: 0,
        bestSeed,
        bestSSE,
        bestMSE: bestSSE / SIZE,
        bestSimilarity: similarity(bestSSE),
        iterationsPerSecond: rate,
        totalImagesGenerated: total
      }
    });
    iters = 0;
    statsTime = now;
  }

  if (running) {
    setTimeout(loop, 0);
  }
}

self.onmessage = async (e) => {
  const { type, seed } = e.data;
  
  if (type === 'start' && !running) {
    running = true;
    statsTime = Date.now();
    recentTime = statsTime;
    iters = 0;
    
    console.log('🎮 Initializing GPU...');
    const ok = await initGPU();
    if (ok) {
      console.log('✅ GPU ready - starting GPU loop!');
      loop();
    } else {
      console.log('❌ GPU init failed');
      postMessage({ type: 'gpu-failed' });
      running = false;
    }
  } else if (type === 'pause') {
    running = false;
  } else if (type === 'generate' && typeof seed === 'number') {
    const img = genImage(seed);
    let sse = 0;
    for (let i = 0; i < SIZE; i++) {
      const d = img[i] - TARGET[i];
      sse += d * d;
    }
    postMessage({
      type: 'current',
      data: { bytes: img.slice(), seed, sse, similarity: similarity(sse) }
    }, { transfer: [img.buffer] });
  }
};
`
}
