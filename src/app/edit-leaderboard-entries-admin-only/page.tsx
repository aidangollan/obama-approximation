'use client'

import { useState, useEffect } from 'react'

interface LeaderboardEntry {
  seed: number
  sse: number
  mse: number
  similarity: number
  timestamp: number
  username?: string
}

export default function EditLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('')
  
  // Form state for adding new entry
  const [newEntry, setNewEntry] = useState({
    seed: '',
    sse: '',
    mse: '',
    similarity: '',
    username: ''
  })

  // Load current leaderboard
  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/global/top10')
      const data = await response.json()
      setEntries(data.matches || [])
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
      setStatus('❌ Failed to load leaderboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLeaderboard()
  }, [])

  const handleAddEntry = async () => {
    const seed = parseInt(newEntry.seed)
    const sse = parseFloat(newEntry.sse)
    const mse = parseFloat(newEntry.mse)
    const similarity = parseFloat(newEntry.similarity)

    if (isNaN(seed) || isNaN(sse) || isNaN(mse) || isNaN(similarity)) {
      setStatus('❌ Please enter valid numbers for all fields')
      return
    }

    setStatus('Adding entry...')
    try {
      const response = await fetch('/api/global/leaderboard/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed,
          sse,
          mse,
          similarity,
          username: newEntry.username || undefined
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setStatus('✅ Entry added successfully!')
        setNewEntry({ seed: '', sse: '', mse: '', similarity: '', username: '' })
        await loadLeaderboard()
      } else {
        setStatus('❌ Error: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      setStatus('❌ Failed to add entry: ' + error)
    }
  }

  const handleDeleteEntry = async (seed: number) => {
    if (!confirm(`Delete entry with seed ${seed}?`)) {
      return
    }

    setStatus('Deleting entry...')
    try {
      const response = await fetch('/api/global/leaderboard/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed })
      })

      const data = await response.json()
      
      if (data.success) {
        setStatus('✅ Entry deleted successfully!')
        await loadLeaderboard()
      } else {
        setStatus('❌ Error: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      setStatus('❌ Failed to delete entry: ' + error)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'monospace',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '10px', fontSize: '32px', color: '#6366f1' }}>
          Edit Leaderboard Entries
        </h1>
        <p style={{ marginBottom: '40px', color: '#888' }}>
          Admin panel to manage Global Top 12 entries
        </p>

        {/* Add New Entry Section */}
        <div style={{
          background: '#1a1a1a',
          padding: '30px',
          borderRadius: '12px',
          marginBottom: '40px',
          border: '2px solid #222'
        }}>
          <h2 style={{ marginBottom: '20px', fontSize: '24px', color: '#4caf50' }}>
            Add New Entry
          </h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                Seed (number)
              </label>
              <input
                type="text"
                value={newEntry.seed}
                onChange={(e) => setNewEntry({ ...newEntry, seed: e.target.value })}
                placeholder="123456789"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                SSE (number)
              </label>
              <input
                type="text"
                value={newEntry.sse}
                onChange={(e) => setNewEntry({ ...newEntry, sse: e.target.value })}
                placeholder="1234567.89"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                MSE (number)
              </label>
              <input
                type="text"
                value={newEntry.mse}
                onChange={(e) => setNewEntry({ ...newEntry, mse: e.target.value })}
                placeholder="75.5"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                Similarity (%)
              </label>
              <input
                type="text"
                value={newEntry.similarity}
                onChange={(e) => setNewEntry({ ...newEntry, similarity: e.target.value })}
                placeholder="41.05"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', color: '#aaa', fontSize: '12px' }}>
                Username (optional)
              </label>
              <input
                type="text"
                value={newEntry.username}
                onChange={(e) => setNewEntry({ ...newEntry, username: e.target.value })}
                placeholder="twitter_handle"
                style={{
                  width: '100%',
                  padding: '10px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>

          <button
            onClick={handleAddEntry}
            style={{
              background: '#4caf50',
              color: '#fff',
              border: 'none',
              padding: '12px 30px',
              fontSize: '16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#5ec963'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#4caf50'}
          >
            ➕ Add Entry
          </button>
        </div>

        {/* Current Entries Section */}
        <div style={{
          background: '#1a1a1a',
          padding: '30px',
          borderRadius: '12px',
          border: '2px solid #222'
        }}>
          <h2 style={{ marginBottom: '20px', fontSize: '24px', color: '#6366f1' }}>
            Current Entries ({entries.length})
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              Loading...
            </div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              No entries yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {entries.map((entry, index) => (
                <div
                  key={`${entry.seed}-${entry.timestamp}`}
                  style={{
                    background: '#0a0a0a',
                    padding: '20px',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '10px' }}>
                      <div>
                        <span style={{ color: '#888', fontSize: '12px' }}>RANK: </span>
                        <span style={{ color: '#6366f1', fontWeight: 'bold', fontSize: '18px' }}>
                          #{index + 1}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: '#888', fontSize: '12px' }}>SEED: </span>
                        <span style={{ color: '#fff' }}>{entry.seed}</span>
                      </div>
                      <div>
                        <span style={{ color: '#888', fontSize: '12px' }}>SSE: </span>
                        <span style={{ color: '#fff' }}>{entry.sse.toFixed(2)}</span>
                      </div>
                      <div>
                        <span style={{ color: '#888', fontSize: '12px' }}>MSE: </span>
                        <span style={{ color: '#fff' }}>{entry.mse.toFixed(2)}</span>
                      </div>
                      <div>
                        <span style={{ color: '#888', fontSize: '12px' }}>SIMILARITY: </span>
                        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>
                          {entry.similarity.toFixed(2)}%
                        </span>
                      </div>
                      {entry.username && (
                        <div>
                          <span style={{ color: '#888', fontSize: '12px' }}>USER: </span>
                          <span style={{ color: '#6366f1' }}>@{entry.username}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ color: '#666', fontSize: '11px' }}>
                      Added: {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteEntry(entry.seed)}
                    style={{
                      background: '#e00',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      fontSize: '14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      marginLeft: '20px'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f00'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#e00'}
                  >
                    🗑️ Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Message */}
        {status && (
          <div style={{
            marginTop: '30px',
            padding: '15px 30px',
            background: status.includes('✅') ? '#1a4d1a' : '#4d1a1a',
            borderRadius: '8px',
            fontSize: '16px',
            textAlign: 'center'
          }}>
            {status}
          </div>
        )}

        {/* Back Link */}
        <a
          href="/"
          style={{
            display: 'block',
            marginTop: '50px',
            color: '#6366f1',
            textDecoration: 'none',
            fontSize: '16px',
            textAlign: 'center'
          }}
        >
          ← Back to App
        </a>
      </div>
    </div>
  )
}

