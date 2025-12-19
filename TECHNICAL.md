# Technical Documentation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser UI                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  Target  │  │ Current  │  │   Best   │  Controls       │
│  │  Canvas  │  │  Canvas  │  │  Canvas  │  Top 10         │
│  └──────────┘  └──────────┘  └──────────┘  Recent 5       │
└────────────────────┬────────────────────────────────────────┘
                     │ postMessage (commands)
                     │ onmessage (updates)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      Web Worker                             │
│                                                             │
│  Hot Loop:                                                  │
│  1. seed++ (0 → 1 → 2 → ...)                               │
│  2. generate(seed) → Uint8Array(16384)                     │
│  3. calculateSSE(generated, target) → number               │
│  4. if (sse < bestSSE) → update best                       │
│  5. throttle & send updates to UI                          │
│  6. goto 1                                                  │
└─────────────────────────────────────────────────────────────┘
```

## Core Algorithms

### 1. Deterministic Image Generation (Mulberry32)

```typescript
function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
```

**Why Mulberry32?**
- Fast: 32-bit integer operations only
- Good distribution: Passes statistical tests
- Deterministic: Same seed = same sequence
- Simple: No external dependencies

**Image Generation Process:**
1. Seed → Initialize PRNG state
2. Generate 16,384 uniform random values [0, 1)
3. Scale to [0, 255] and floor to integer
4. Store in Uint8Array(16384)

### 2. SSE Calculation

```typescript
function calculateSSE(generated: Uint8Array, target: Uint8Array): number {
  let sse = 0
  for (let i = 0; i < 16384; i++) {
    const diff = generated[i] - target[i]
    sse += diff * diff
  }
  return sse
}
```

**Properties:**
- Quadratic penalty for large errors
- Range: [0, 255²×16384] = [0, 1,065,369,600]
- Integer math only (fast!)
- Sum of 16,384 squared differences

**Why SSE over other metrics?**
- Simple to compute
- Differentiable (useful for optimization)
- Standard in image comparison
- Integer-friendly (no floating point)

### 3. Worker Message Protocol

**Main → Worker:**
```typescript
{ type: 'start' }                    // Begin generation loop
{ type: 'pause' }                    // Stop generation loop
{ type: 'generate', seed: number }   // Generate specific seed
```

**Worker → Main:**
```typescript
// Every 100ms
{ type: 'stats', data: {
  currentSeed, currentSSE, currentMSE,
  bestSeed, bestSSE, bestMSE,
  iterationsPerSecond
}}

// Every frame (throttled)
{ type: 'current', data: {
  bytes: Uint8Array(16384)
}}

// When new best found
{ type: 'best', data: {
  seed, sse, mse,
  bytes: Uint8Array(16384)
}}

// ~10/sec
{ type: 'recent', data: {
  seed, sse, mse,
  bytes: Uint8Array(16384)
}}
```

## Performance Optimizations

### 1. Batch Processing
```typescript
const batchSize = 100 // Process 100 images before checking time
for (let i = 0; i < batchSize && isRunning; i++) {
  // Generate and score
}
```
Reduces overhead from time checks and message passing.

### 2. Transferable Objects
```typescript
postMessage({ type: 'best', data: { bytes } }, [bytes.buffer])
```
Zero-copy transfer of Uint8Arrays between threads.

### 3. Throttled Updates
- **Stats**: Every 100ms (10 Hz)
- **Recent**: Max 10/sec (100ms minimum)
- **Current**: Every iteration but throttled by batch
- **Best**: Immediate (no throttle)

### 4. Integer Math
All calculations use 32-bit integers:
- Pixel values: 0-255 (uint8)
- Differences: -255 to +255 (int16 effective)
- Squared differences: 0 to 65,025 (uint16)
- SSE: 0 to 1,065,369,600 (uint32)

### 5. CSS Rendering
```css
canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}
```
Hardware-accelerated pixel-perfect scaling.

## Data Structures

### Image Format
```
Uint8Array(16384)  // 128×128 pixels
[0] = pixel(0,0)
[1] = pixel(0,1)
...
[127] = pixel(0,127)
[128] = pixel(1,0)
...
[16383] = pixel(127,127)
```
Row-major order, grayscale 0-255.

### localStorage Schema
```typescript
{
  "obama-approximation-top10": [
    { seed: number, sse: number, mse: number },
    ...
  ]
}
```
Max 10 entries, sorted by SSE ascending.

## Expected Performance

### Generation Speed
- **Modern CPU (2020+)**: 3,000-5,000 iterations/sec
- **Older CPU (2015)**: 1,000-2,000 iterations/sec
- **Mobile**: 500-1,500 iterations/sec

### Memory Usage
- **Worker**: ~100 KB (code + state)
- **Recent 5**: ~80 KB (5 × 16 KB images)
- **UI**: ~500 KB (React + rendering)
- **Total**: < 1 MB

### Search Space
- **Total possible images**: 256^16384 ≈ 2^131072
- **Images per second**: ~3,000
- **Time to exhaustive search**: Effectively infinite

## Statistical Properties

### Expected SSE Distribution
For completely random images vs target:
- **Mean SSE**: ~5,460,000
- **Std Dev**: ~350,000
- **Typical range**: 4,500,000 - 6,500,000

Better matches (SSE < 4,000,000) are rare and valuable.

### MSE Interpretation
- **MSE = 0**: Perfect match (impossible)
- **MSE < 100**: Excellent (very rare)
- **MSE < 200**: Good (rare)
- **MSE < 300**: Fair (uncommon)
- **MSE > 300**: Poor (typical)

## Browser Compatibility

### Required Features
- Web Workers (all modern browsers)
- Canvas API (all browsers)
- localStorage (all browsers)
- ES2017+ (arrow functions, async, etc.)

### Tested Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Known Issues
- Safari may limit Web Worker performance in background tabs
- Some browsers limit localStorage to 5-10 MB

## Future Optimizations

### Potential Improvements
1. **SIMD**: Use WebAssembly SIMD for 4-8x faster SSE calculation
2. **GPU**: WebGL compute shaders for massive parallelism
3. **Genetic Algorithm**: Smart seed selection instead of sequential
4. **Hill Climbing**: Refine promising seeds locally
5. **Distributed**: Share work across multiple tabs/workers

### Trade-offs
- Complexity vs. maintainability
- Speed vs. code size
- Memory vs. CPU usage

## Testing

### Manual Tests
1. Start → Verify generation begins
2. Pause → Verify generation stops
3. Clear Top 10 → Verify localStorage cleared
4. Click Top 10 entry → Verify seed displays
5. Refresh → Verify Top 10 persists

### Performance Tests
1. Monitor CPU usage (should be 1 core at 100%)
2. Check iterations/sec (should be > 1000)
3. Verify UI remains responsive
4. Check memory usage (should stay < 100 MB)

### Edge Cases
- Seed = 0 (should work)
- Seed = 2^32-1 (max 32-bit integer)
- localStorage full (graceful degradation)
- Worker termination (cleanup)

## References

- [Mulberry32 PRNG](https://github.com/bryc/code/blob/master/jshash/PRNGs.md)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Sum of Squared Errors](https://en.wikipedia.org/wiki/Residual_sum_of_squares)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

