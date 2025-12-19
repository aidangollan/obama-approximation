# Obama Approximation

A Next.js application that continuously generates deterministic 128×128 grayscale images from integer seeds and ranks them by how closely they match a fixed target image (Obama).

## Overview

This application demonstrates:

- **Deterministic Image Generation**: Each integer seed produces a unique, reproducible 128×128 grayscale image
- **Similarity Scoring**: Images are ranked using Sum of Squared Errors (SSE) and Mean Squared Error (MSE)
- **Performance**: Web Workers keep the UI responsive while generating thousands of images per second
- **Persistence**: Top 10 matches are saved to localStorage

## How It Works

### Image Format

- **Size**: 128×128 pixels (16,384 total pixels)
- **Encoding**: Row-major Uint8Array where each byte represents a grayscale value (0-255)
- **Target**: Pre-computed Obama face stored in `src/lib/targets/obama_128_nearest_uint8.ts`

### Deterministic Generation

Each seed generates a unique image using the Mulberry32 PRNG:

1. Seed → PRNG state
2. Generate 16,384 random values (one per pixel)
3. Map each value to 0-255 grayscale range

The same seed always produces the same image, making results reproducible.

### Scoring: SSE and MSE

**Sum of Squared Errors (SSE)**:
```
SSE = Σ(generated[i] - target[i])²
```
- Measures total pixel-wise difference
- Lower is better
- Integer math for speed

**Mean Squared Error (MSE)**:
```
MSE = SSE / 16384
```
- Average error per pixel
- Normalized version of SSE
- Easier to interpret

Both metrics measure similarity; lower values mean closer matches.

### Why Web Workers?

The generation loop is CPU-intensive (thousands of iterations/second). Running it in a Web Worker:

- Keeps the UI responsive and smooth
- Allows background processing without blocking user interactions
- Efficiently handles message passing with Transferable objects (Uint8Arrays)

### Architecture

```
Main Thread (UI)              Worker Thread
    |                              |
    |------ start message -------->|
    |                              |--- Hot Loop:
    |                              |    1. Generate image
    |<---- stats (every 100ms) ---|    2. Calculate SSE
    |<---- current (throttled) ---|    3. Check if best
    |<---- best (when found) ------|    4. Continue
    |<---- recent (10/sec) --------|
```

## Features

### Main Display
- **Target**: Reference Obama image
- **Current**: Latest generated image
- **Best**: Best match found so far
- Real-time stats (seed, SSE, MSE, iterations/sec)

### Controls
- **Start**: Begin generation loop
- **Pause**: Stop generation (preserves state)
- **Clear Top 10**: Reset saved matches

### Top 10 List
- Displays 10 best matches sorted by SSE
- Persists across sessions (localStorage)
- Click to view any entry

### Recent 5 Feed
- Shows 5 most recently generated images
- Rolling display of latest attempts
- Not persisted (memory only)

## Running the Application

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Technical Details

### Dependencies
- **Next.js 14** (App Router)
- **React 18**
- **TypeScript 5**

### File Structure

```
src/
├── app/
│   ├── page.tsx              # Main UI component
│   ├── page.module.css       # Component styles
│   ├── layout.tsx            # Root layout
│   └── globals.css           # Global styles
├── lib/
│   ├── targets/
│   │   └── obama_128_nearest_uint8.ts  # Target image data
│   └── utils/
│       ├── canvas.ts         # Canvas rendering utilities
│       └── storage.ts        # localStorage helpers
└── worker/
    └── generator.worker.ts   # Web Worker for image generation
```

### Performance Optimizations

1. **Batch Processing**: Generate 100 images before checking time
2. **Throttled Updates**: Stats every 100ms, recent at 10/sec
3. **Integer Math**: SSE calculation uses only integer operations
4. **Transferables**: Zero-copy message passing for Uint8Arrays
5. **CSS Scaling**: `image-rendering: pixelated` for crisp upscaling

## Customization

### Change Target Image
Replace the data in `src/lib/targets/obama_128_nearest_uint8.ts` with your own 128×128 grayscale Uint8Array.

### Adjust Generation Speed
In `generator.worker.ts`, modify `batchSize` to process more/fewer images per tick.

### Change Update Frequency
Adjust timing thresholds in the worker:
- Stats: Change `100ms` check
- Recent: Change `100ms` throttle

## License

MIT
