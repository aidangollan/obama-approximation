# Quick Start Guide

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Click "Start"** to begin generating images
   - The worker will continuously generate random 128×128 grayscale images
   - Each image is deterministically generated from an integer seed
   - Performance stats show iterations per second

2. **Watch the displays**:
   - **Target**: The reference Obama image
   - **Current**: The latest generated image
   - **Best**: The closest match found so far

3. **View rankings**:
   - **Top 10**: Best matches, persisted to localStorage
   - **Recent 5**: Last 5 generations (rolling window)

4. **Interact**:
   - Click any Top 10 entry to view that specific seed
   - Click "Pause" to stop generation
   - Click "Clear Top 10" to reset the leaderboard

## How It Works

### Deterministic Generation
- Seeds are incremented (0, 1, 2, 3, ...)
- Each seed generates the same image every time
- Uses Mulberry32 PRNG for speed and quality

### Scoring
- **SSE** (Sum of Squared Errors): Total pixel-wise difference
- **MSE** (Mean Squared Error): Average error per pixel
- Lower scores = closer matches

### Performance
- Web Worker keeps UI responsive
- Typically 1000-5000 iterations/second (varies by hardware)
- Zero-copy transfers using Transferables

## Tips

- Let it run for a while to find good matches
- The best score will likely be in the millions (SSE)
- MSE is typically 100-300 for random images
- Finding exact matches is extremely unlikely (2^131072 possible images!)

## Troubleshooting

**Worker not starting?**
- Check browser console for errors
- Ensure you're using a modern browser (Chrome, Firefox, Edge, Safari)

**Performance slow?**
- Close other tabs/applications
- Try a different browser
- Check CPU usage in task manager

**Top 10 not persisting?**
- localStorage might be disabled
- Check browser privacy settings
- Try clearing site data and refreshing

