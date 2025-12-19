'use client'

import { useEffect, useRef, useState, memo } from 'react'
import { OBAMA_128_NEAREST_UINT8 } from '@/lib/targets/obama_128_nearest_uint8'
import { renderGrayscaleToCanvas } from '@/lib/utils/canvas'
import { loadTop10, saveTop10, loadTotalCount, saveTotalCount, type Top10Entry } from '@/lib/utils/storage'
import { 
  submitIfGlobalBest, 
  getGlobalStats,
  getGlobalTop10,
  getTopUsers,
  incrementGlobalCounter,
  type GlobalMatch,
  type GlobalStats,
  type TopUser
} from '@/lib/api'
import { useAnimatedCounter } from '@/lib/hooks/useAnimatedCounter'
import { createGeneratorWorker } from '@/lib/workers/createWorker'
import { Switch } from '@/components/ui/Switch'
import styles from './page.module.css'

const IMAGE_SIZE = 128
const TARGET_SIZE = IMAGE_SIZE * IMAGE_SIZE

interface WorkerStats {
  currentSeed: number
  currentSSE: number
  currentMSE: number
  currentSimilarity: number
  bestSeed: number
  bestSSE: number
  bestMSE: number
  bestSimilarity: number
  iterationsPerSecond: number
  totalImagesGenerated: number
}

interface RecentGeneration {
  seed: number
  sse: number
  mse: number
  similarity?: number
  bytes: Uint8Array
}

// Component for displaying thumbnails in Recent 5 feed
function RecentThumbnail({ generation }: { generation: RecentGeneration }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // Calculate similarity if missing - use RMSE-based calculation
  const calculateSimilarityFallback = (sse: number) => {
    const mse = sse / (IMAGE_SIZE * IMAGE_SIZE)
    const rmse = Math.sqrt(mse)
    return Math.max(0, Math.min(100, (1 - rmse / 128) * 100))
  }
  const similarity = generation.similarity ?? calculateSimilarityFallback(generation.sse)

  useEffect(() => {
    if (canvasRef.current) {
      renderGrayscaleToCanvas(canvasRef.current, generation.bytes, IMAGE_SIZE, IMAGE_SIZE)
    }
  }, [generation])

  return (
    <div className={styles.recentItem}>
      <canvas 
        ref={canvasRef} 
        width={IMAGE_SIZE} 
        height={IMAGE_SIZE}
        className={styles.thumbnail}
      />
      <div className={styles.recentStats}>
        <div>Seed: {generation.seed}</div>
        <div className={styles.similarity}>{similarity.toFixed(2)}%</div>
        <div>SSE: {generation.sse.toFixed(0)}</div>
      </div>
    </div>
  )
}

// Component for displaying thumbnails in Top 12 grid
const Top10Thumbnail = memo(function Top10Thumbnail({ entry, rank, onClick }: { entry: Top10Entry; rank: number; onClick: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)

  // Calculate similarity if missing (for old localStorage entries)
  // Use RMSE-based calculation for intuitive scaling
  const calculateSimilarityFallback = (sse: number) => {
    const mse = sse / (IMAGE_SIZE * IMAGE_SIZE)
    const rmse = Math.sqrt(mse)
    return Math.max(0, Math.min(100, (1 - rmse / 128) * 100))
  }
  const similarity = entry.similarity ?? calculateSimilarityFallback(entry.sse)

  useEffect(() => {
    // Create a temporary worker to generate this seed's image
    const worker = new Worker(new URL('../worker/generator.worker.ts', import.meta.url))
    workerRef.current = worker

    worker.onmessage = (e) => {
      if (e.data.type === 'current' && canvasRef.current) {
        renderGrayscaleToCanvas(canvasRef.current, e.data.data.bytes, IMAGE_SIZE, IMAGE_SIZE)
        worker.terminate()
      }
    }

    worker.postMessage({ type: 'generate', seed: entry.seed })

    return () => {
      worker.terminate()
    }
  }, [entry.seed])

  return (
    <div className={styles.top10Item} onClick={onClick}>
      <canvas 
        ref={canvasRef} 
        width={IMAGE_SIZE} 
        height={IMAGE_SIZE}
        className={styles.top10Thumbnail}
      />
      <div className={styles.top10Stats}>
        {entry.username && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
            <img 
              src={`https://unavatar.io/twitter/${entry.username}`}
              alt={entry.username}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '1px solid #6366f1',
                objectFit: 'cover',
                flexShrink: 0
              }}
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
            <span className={styles.username}>@{entry.username}</span>
          </div>
        )}
        <div>Seed: {entry.seed}</div>
        <div className={styles.similarity}>{similarity.toFixed(2)}%</div>
      </div>
    </div>
  )
})

export default function Home() {
  const [isRunning, setIsRunning] = useState(false)
  const [numWorkers, setNumWorkers] = useState(4)
  const [gpuEnabled, setGpuEnabled] = useState(() => {
    // Load GPU setting from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('obama-gpu-enabled')
      return saved === 'true'
    }
    return false
  })
  const [twitterHandle, setTwitterHandle] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('obama-twitter-handle') || ''
    }
    return ''
  })
  const [savedCountOffset, setSavedCountOffset] = useState(0)
  const [stats, setStats] = useState<WorkerStats>({
    currentSeed: 0,
    currentSSE: 0,
    currentMSE: 0,
    currentSimilarity: 0,
    bestSeed: 0,
    bestSSE: Infinity,
    bestMSE: Infinity,
    bestSimilarity: 0,
    iterationsPerSecond: 0,
    totalImagesGenerated: 0,
  })
  const [top10, setTop10] = useState<Top10Entry[]>([])
  const [globalTop10, setGlobalTop10] = useState<GlobalMatch[]>([])
  const [globalTop10Loading, setGlobalTop10Loading] = useState(true)
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [topUsers, setTopUsers] = useState<TopUser[]>([])
  const [currentBestInSecond, setCurrentBestInSecond] = useState<{
    seed: number
    similarity: number
    bytes: Uint8Array
  } | null>(null)
  const [showGPUModal, setShowGPUModal] = useState(false)
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [tempUsername, setTempUsername] = useState('')
  
  // Debug: Log when component renders
  console.log('🔍 Home component rendering, topUsers:', topUsers)

  const workerRef = useRef<Worker | null>(null)
  const currentCanvasRef = useRef<HTMLCanvasElement>(null)
  const bestCanvasRef = useRef<HTMLCanvasElement>(null)
  const targetCanvasRef = useRef<HTMLCanvasElement>(null)
  const globalBestWorkerRef = useRef<Worker | null>(null)
  const lastIncrementTime = useRef<number>(0)
  const lastTotalCount = useRef<number>(0)
  const localIncrementSinceSync = useRef<number>(0)
  const lastServerTotal = useRef<number>(0)
  const bestInSecondRef = useRef<{ seed: number; similarity: number; sse: number; bytes: Uint8Array } | null>(null)
  const lastSecondUpdate = useRef<number>(Date.now())

  // Animated counters for smooth counting effect (after refs)
  const animatedLocalCount = useAnimatedCounter(stats.totalImagesGenerated + savedCountOffset)
  const animatedGlobalCount = useAnimatedCounter((lastServerTotal.current || 0) + localIncrementSinceSync.current)
  const animatedRate = useAnimatedCounter(stats.iterationsPerSecond)

  // Initialize target canvas and load top 10
  useEffect(() => {
    if (targetCanvasRef.current) {
      renderGrayscaleToCanvas(targetCanvasRef.current, OBAMA_128_NEAREST_UINT8, IMAGE_SIZE, IMAGE_SIZE)
    }
    setTop10(loadTop10())
    
    // Load saved total count as an offset
    const savedCount = loadTotalCount()
    setSavedCountOffset(savedCount)
  }, [])

  // Update Current canvas with best of last second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      if (bestInSecondRef.current && currentCanvasRef.current) {
        // Render best of last second
        renderGrayscaleToCanvas(currentCanvasRef.current, bestInSecondRef.current.bytes, IMAGE_SIZE, IMAGE_SIZE)
        setCurrentBestInSecond({
          seed: bestInSecondRef.current.seed,
          similarity: bestInSecondRef.current.similarity,
          bytes: bestInSecondRef.current.bytes,
        })
        // Reset for next second
        bestInSecondRef.current = null
      }
      lastSecondUpdate.current = now
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Load global stats and poll for updates
  useEffect(() => {
    // Initial load
    getGlobalStats().then((stats) => {
      setGlobalStats(stats)
      lastServerTotal.current = stats.total_images_explored
    })
    getGlobalTop10().then((matches) => {
      console.log('Global top 12 loaded:', matches)
      setGlobalTop10(matches)
      setGlobalTop10Loading(false)
    })
    getTopUsers().then(setTopUsers)

    // Poll for updates every 3 seconds for more real-time feel
    const interval = setInterval(() => {
      getGlobalStats().then((stats) => {
        setGlobalStats(stats)
        lastServerTotal.current = stats.total_images_explored
      })
      getGlobalTop10().then((matches) => {
        console.log('Global top 12 updated:', matches)
        setGlobalTop10(matches)
        setGlobalTop10Loading(false)
      })
      getTopUsers().then(setTopUsers)
    }, 3000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  // Generate image for global best when it changes
  useEffect(() => {
    if (globalStats?.best_seed && bestCanvasRef.current) {
      // Create worker to generate global best image
      const worker = new Worker(new URL('../worker/generator.worker.ts', import.meta.url))
      globalBestWorkerRef.current = worker

      worker.onmessage = (e) => {
        if (e.data.type === 'current' && bestCanvasRef.current) {
          renderGrayscaleToCanvas(bestCanvasRef.current, e.data.data.bytes, IMAGE_SIZE, IMAGE_SIZE)
          worker.terminate()
        }
      }

      worker.postMessage({ type: 'generate', seed: globalStats.best_seed })

      return () => {
        worker.terminate()
      }
    }
  }, [globalStats?.best_seed])

  // Initialize worker
  useEffect(() => {
    workerRef.current = createGeneratorWorker(gpuEnabled)
    console.log(gpuEnabled ? '🎮 GPU worker created' : '💻 CPU worker created')

    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data

      switch (type) {
        case 'gpu-failed':
          // GPU initialization failed - show modal
          if (gpuEnabled) {
            setShowGPUModal(true)
            setIsRunning(false)
          }
          break

        case 'stats':
          setStats(data as WorkerStats)
          
          // Track local increment for real-time display
          const currentTotal = (data as WorkerStats).totalImagesGenerated
          const adjustedTotal = currentTotal + savedCountOffset
          const localIncrement = currentTotal - lastTotalCount.current
          if (localIncrement > 0) {
            localIncrementSinceSync.current += localIncrement
            lastTotalCount.current = currentTotal
            // Save adjusted total to localStorage
            saveTotalCount(adjustedTotal)
          }
          
          // Sync with server every 5 seconds
          const nowIncrement = Date.now()
          if (nowIncrement - lastIncrementTime.current > 5000 && localIncrementSinceSync.current > 0) {
            incrementGlobalCounter(localIncrementSinceSync.current)
            localIncrementSinceSync.current = 0 // Reset local counter after sync
            lastIncrementTime.current = nowIncrement
          }
          break

        case 'current':
          // Track best in the current second
          if (data.sse !== undefined && data.similarity !== undefined) {
            if (bestInSecondRef.current === null || data.sse < bestInSecondRef.current.sse) {
              bestInSecondRef.current = {
                seed: data.seed,
                similarity: data.similarity,
                sse: data.sse,
                bytes: data.bytes
              }
            }
          }
          break

        case 'best':
          // Update local top 12 (include username)
          setTop10((prev) => {
            const newEntry = { 
              seed: data.seed, 
              sse: data.sse, 
              mse: data.mse, 
              similarity: data.similarity,
              ...(twitterHandle && { username: twitterHandle })
            }
            const newTop12 = [...prev, newEntry]
              .sort((a, b) => a.sse - b.sse)
              .slice(0, 12)
            saveTop10(newTop12)
            return newTop12
          })

          // Submit to global (server stores top 12 automatically)
          submitIfGlobalBest(data.seed, data.sse, data.mse, data.similarity, twitterHandle || undefined)
          break
      }
    }

    return () => {
      workerRef.current?.terminate()
    }
  }, [gpuEnabled])

  const handleStart = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'start' })
      setIsRunning(true)
    }
  }

  const handlePause = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'pause' })
      setIsRunning(false)
    }
  }

  const handleTop10Click = (entry: Top10Entry) => {
    if (workerRef.current && currentCanvasRef.current) {
      workerRef.current.postMessage({ type: 'generate', seed: entry.seed })
    }
  }

  return (
    <div className={styles.container}>
      {/* Header Section - Simple Row */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          {/* Controls */}
          <div className={styles.controlSection}>
            <button 
              onClick={handleStart} 
              disabled={isRunning}
              className={styles.startButton}
            >
              <span style={{ fontSize: '18px' }}>▶</span> Start
            </button>
            <button 
              onClick={handlePause} 
              disabled={!isRunning}
              className={styles.pauseButton}
            >
              <span style={{ fontSize: '18px' }}>⏸</span> Pause
            </button>

            <button
              onClick={() => {
                setTempUsername(twitterHandle)
                setShowUsernameModal(true)
              }}
              disabled={isRunning}
              className={styles.usernameButton}
            >
              {twitterHandle ? (
                <>
                  <img 
                    src={`https://unavatar.io/twitter/${twitterHandle}`}
                    alt={twitterHandle}
                    className={styles.usernamePfp}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  @{twitterHandle}
                </>
              ) : (
                <>
                  👤 Set Username
                </>
              )}
            </button>

            <div className={styles.controlGroup}>
              <label className={styles.controlLabel}>
                <Switch
                  checked={gpuEnabled}
                  onCheckedChange={(checked) => {
                    const wasRunning = isRunning
                    
                    // Pause current worker
                    if (workerRef.current && wasRunning) {
                      workerRef.current.postMessage({ type: 'pause' })
                    }
                    
                    // Update state and localStorage
                    setGpuEnabled(checked)
                    localStorage.setItem('obama-gpu-enabled', checked.toString())
                    
                    // Terminate old worker
                    if (workerRef.current) {
                      workerRef.current.terminate()
                    }
                    
                    // Worker will be recreated by useEffect when gpuEnabled changes
                    console.log(checked ? '🎮 Switching to GPU...' : '💻 Switching to CPU...')
                    
                    // Resume if was running
                    if (wasRunning) {
                      setTimeout(() => {
                        if (workerRef.current) {
                          workerRef.current.postMessage({ type: 'start' })
                          setIsRunning(true)
                        }
                      }, 100)
                    }
                  }}
                />
                GPU Acceleration
              </label>
            </div>
          </div>

          {/* Stats - Horizontal (Middle) */}
          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>IMAGES EXPLORED</div>
              <div className={styles.statValue}>
                {animatedLocalCount.toLocaleString()}
              </div>
            </div>

            <div className={styles.statBox}>
              <div className={styles.statLabel}>GLOBAL EXPLORED</div>
              <div className={styles.statValue}>
                {animatedGlobalCount.toLocaleString()}
              </div>
            </div>

            <div className={styles.statBox}>
              <div className={styles.statLabel}>RATE</div>
              <div className={styles.statValue}>{animatedRate.toFixed(0).toLocaleString()}/s</div>
            </div>

            <div className={styles.statBox}>
              <div className={styles.statLabel}>YOUR BEST</div>
              <div className={styles.statValue}>
                {top10.length > 0 ? `${top10[0].similarity?.toFixed(2) || '0.00'}%` : '0.00%'}
              </div>
            </div>

            <div className={styles.statBox}>
              <div className={styles.statLabel}>GLOBAL BEST</div>
              <div className={styles.statValue}>
                {globalStats?.best_similarity ? `${globalStats.best_similarity.toFixed(2)}%` : '0.00%'}
              </div>
            </div>
          </div>

          {/* Canvases - Full Height (Right) */}
          <div className={styles.headerCanvases}>
            <div className={styles.headerCanvasItem}>
              <div className={styles.canvasWrapper}>
                <canvas 
                  ref={targetCanvasRef} 
                  width={IMAGE_SIZE} 
                  height={IMAGE_SIZE}
                  className={styles.headerCanvas}
                />
                <div className={styles.canvasLabel}>
                  <h3>Target</h3>
                  <div className={styles.similarity}>100%</div>
                </div>
              </div>
            </div>

            <div className={styles.headerCanvasItem}>
              <div className={styles.canvasWrapper}>
                <canvas 
                  ref={bestCanvasRef} 
                  width={IMAGE_SIZE} 
                  height={IMAGE_SIZE}
                  className={styles.headerCanvas}
                />
                <div className={styles.canvasLabel}>
                  <h3>Best (Global)</h3>
                  <div className={styles.similarity}>
                    {globalStats?.best_similarity?.toFixed(2) || '0.00'}%
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.headerCanvasItem}>
              <div className={styles.canvasWrapper}>
                <canvas 
                  ref={currentCanvasRef} 
                  width={IMAGE_SIZE} 
                  height={IMAGE_SIZE}
                  className={styles.headerCanvas}
                />
                <div className={styles.canvasLabel}>
                  <h3>Current</h3>
                  <div className={styles.similarity}>
                    {currentBestInSecond ? currentBestInSecond.similarity.toFixed(2) : '0.00'}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Section */}
      <div className={styles.mainContent}>
        {/* Your Discoveries */}
        <div className={styles.leaderboardSection}>
          <div className={styles.sectionHeader}>
            <h2>Your Discoveries</h2>
            <span className={styles.sectionLabel}>LOCAL TOP 12</span>
          </div>
          {top10.length === 0 ? (
            <div className={styles.emptyState}>No discoveries yet</div>
          ) : (
            <div className={styles.discoveryGrid}>
              {top10.map((entry, index) => (
                <Top10Thumbnail
                  key={entry.seed}
                  entry={entry}
                  rank={index + 1}
                  onClick={() => handleTop10Click(entry)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Global Top 12 */}
        <div className={styles.leaderboardSection}>
          <div className={styles.sectionHeader}>
            <h2>Global Top 12</h2>
            <span className={styles.sectionLabel}>WORLDWIDE</span>
          </div>
          {globalTop10Loading ? (
            <div className={styles.emptyState}>Loading global matches...</div>
          ) : globalTop10.length === 0 ? (
            <div className={styles.emptyState}>
              No global matches yet. Start generating to contribute!
            </div>
          ) : (
            <div className={styles.discoveryGrid}>
              {globalTop10.map((match, index) => (
                <GlobalThumbnail
                  key={match.seed}
                  match={match}
                  rank={index + 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Top Obama Finders */}
        <div className={styles.userLeaderboard}>
          <div className={styles.sectionHeader}>
            <h2>Top Obama Finders</h2>
          </div>
          {!topUsers || topUsers.length === 0 ? (
            <div className={styles.emptyState}>No users yet</div>
          ) : (
            <div className={styles.userList}>
              {topUsers.filter(user => user && user.username).map((user, index) => (
                <div 
                  key={`user-${user.username}-${index}`}
                  className={styles.userItem}
                  onClick={() => user.username && window.open(`https://twitter.com/${user.username}`, '_blank')}
                >
                  <div className={styles.userRank}>#{index + 1}</div>
                  <img 
                    src={`https://unavatar.io/twitter/${user.username}`}
                    alt={user.username}
                    className={styles.userAvatar}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                  <div className={styles.userInfo}>
                    <div className={styles.userHandle}>@{user.username || 'unknown'}</div>
                    <div className={styles.userStats}>
                      <span className={styles.similarity}>{(user.bestSimilarity || 0).toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Username Modal */}
      {showUsernameModal && (
        <div className={styles.modalOverlay} onClick={() => setShowUsernameModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className={styles.modalHeader}>
              <h2>Set Twitter Handle</h2>
              <button onClick={() => setShowUsernameModal(false)} className={styles.closeButton}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '20px', color: '#aaa' }}>
                Your handle will be displayed with your discoveries in the Global Top 10.
              </p>
              
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                <span style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6366f1',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  pointerEvents: 'none'
                }}>
                  @
                </span>
                <input
                  type="text"
                  value={tempUsername}
                  onChange={(e) => setTempUsername(e.target.value.replace('@', ''))}
                  placeholder="username"
                  className={styles.textInput}
                  maxLength={15}
                  autoFocus
                  style={{ 
                    width: '100%', 
                    padding: '12px 12px 12px 28px',
                    fontSize: '16px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => {
                    setTwitterHandle(tempUsername)
                    localStorage.setItem('obama-twitter-handle', tempUsername)
                    setShowUsernameModal(false)
                  }}
                  style={{
                    flex: 1,
                    background: '#6366f1',
                    color: '#000',
                    border: 'none',
                    padding: '12px',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  Save
                </button>
                <button 
                  onClick={() => {
                    setTwitterHandle('')
                    setTempUsername('')
                    localStorage.removeItem('obama-twitter-handle')
                    setShowUsernameModal(false)
                  }}
                  style={{
                    background: '#555',
                    color: '#fff',
                    border: 'none',
                    padding: '12px 20px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPU Setup Modal */}
      {showGPUModal && (
        <div className={styles.modalOverlay} onClick={() => setShowGPUModal(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>WebGPU Setup Required</h2>
              <button onClick={() => setShowGPUModal(false)} className={styles.closeButton}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ marginBottom: '20px', fontSize: '16px' }}>
                GPU Acceleration requires WebGPU to be enabled in your browser.
              </p>
              
              <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                <h3 style={{ color: '#00d4ff', marginBottom: '15px', fontSize: '18px' }}>Chrome / Edge:</h3>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>Open a new tab and go to: <code style={{ background: '#000', padding: '4px 8px', borderRadius: '4px', color: '#4caf50' }}>chrome://flags</code></li>
                  <li>Search for: <strong>"WebGPU"</strong></li>
                  <li>Find <strong>"Unsafe WebGPU"</strong> and set to <strong>Enabled</strong></li>
                  <li>Click <strong>"Relaunch"</strong> button</li>
                  <li>Come back and enable GPU Acceleration again!</li>
                </ol>
              </div>

              <p style={{ color: '#888', fontSize: '14px', marginTop: '20px' }}>
                <strong>Note:</strong> Firefox and Safari don't support WebGPU yet. Use Chrome or Edge for GPU mode.
              </p>

              <button 
                onClick={() => setShowGPUModal(false)}
                style={{
                  background: '#00d4ff',
                  color: '#000',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  marginTop: '20px'
                }}
              >
                Got It!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Component for global top 12 thumbnail
const GlobalThumbnail = memo(function GlobalThumbnail({ match, rank }: { match: GlobalMatch; rank: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../worker/generator.worker.ts', import.meta.url))
    workerRef.current = worker

    worker.onmessage = (e) => {
      if (e.data.type === 'current' && canvasRef.current) {
        renderGrayscaleToCanvas(canvasRef.current, e.data.data.bytes, IMAGE_SIZE, IMAGE_SIZE)
        worker.terminate()
      }
    }

    worker.postMessage({ type: 'generate', seed: match.seed })

    return () => {
      worker.terminate()
    }
  }, [match.seed])

  const handleClick = () => {
    if (match.username) {
      window.open(`https://twitter.com/${match.username}`, '_blank')
    }
  }

  return (
    <div 
      className={styles.top10Item} 
      onClick={handleClick}
      style={{ cursor: match.username ? 'pointer' : 'default' }}
    >
      <canvas 
        ref={canvasRef} 
        width={IMAGE_SIZE} 
        height={IMAGE_SIZE}
        className={styles.top10Thumbnail}
      />
      <div className={styles.top10Stats}>
        {match.username && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
            <img 
              src={`https://unavatar.io/twitter/${match.username}`}
              alt={match.username}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '1px solid #6366f1',
                objectFit: 'cover',
                flexShrink: 0
              }}
              onError={(e) => e.currentTarget.style.display = 'none'}
            />
            <span className={styles.username}>@{match.username}</span>
          </div>
        )}
        <div>Seed: {match.seed}</div>
        <div className={styles.similarity}>{match.similarity.toFixed(2)}%</div>
      </div>
    </div>
  )
})
