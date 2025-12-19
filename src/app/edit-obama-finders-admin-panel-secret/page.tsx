'use client'

import { useState, useEffect } from 'react'

interface TopUser {
  username: string
  bestSimilarity: number
  bestSeed: number
  matchCount: number
  lastUpdated: number
}

export default function EditFindersPage() {
  const [users, setUsers] = useState<TopUser[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/global/users', { cache: 'no-store' })
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      setStatus('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveUser = async (username: string) => {
    if (!confirm(`Remove @${username} from leaderboard?`)) return

    setStatus('Removing user...')
    try {
      const response = await fetch('/api/global/users/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })

      if (response.ok) {
        setStatus(`✅ Removed @${username}`)
        loadUsers()
      } else {
        setStatus('❌ Failed to remove user')
      }
    } catch (error) {
      setStatus('❌ Error: ' + error)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'monospace',
      padding: '40px'
    }}>
      <h1 style={{ marginBottom: '30px', fontSize: '32px', color: '#6366f1' }}>
        Edit Top Obama Finders
      </h1>
      
      <p style={{ marginBottom: '30px', color: '#888' }}>
        Manage the Top Obama Finders leaderboard. Remove users or run backfill to rebuild.
      </p>

      {status && (
        <div style={{
          marginBottom: '20px',
          padding: '12px 20px',
          background: status.includes('✅') ? '#1a4d1a' : '#4d1a1a',
          borderRadius: '6px',
          fontSize: '14px'
        }}>
          {status}
        </div>
      )}

      <div style={{ marginBottom: '30px', display: 'flex', gap: '10px' }}>
        <button
          onClick={loadUsers}
          style={{
            background: '#6366f1',
            color: '#fff',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          🔄 Refresh
        </button>
        <a
          href="/backfill-users-from-matches-secretly"
          style={{
            background: '#4f46e5',
            color: '#fff',
            textDecoration: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        >
          🔄 Backfill from Matches
        </a>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : users.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
          No users in leaderboard
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '600px' }}>
          {users.map((user, index) => (
            <div
              key={user.username}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                background: '#1a1a1a',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #333'
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6366f1', minWidth: '30px' }}>
                #{index + 1}
              </div>
              <img
                src={`https://unavatar.io/twitter/${user.username}`}
                alt={user.username}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: '2px solid #6366f1'
                }}
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold' }}>@{user.username}</div>
                <div style={{ fontSize: '14px', color: '#888' }}>
                  {user.bestSimilarity.toFixed(2)}% • Seed: {user.bestSeed}
                </div>
              </div>
              <button
                onClick={() => handleRemoveUser(user.username)}
                style={{
                  background: '#dc8c8c',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <a
        href="/"
        style={{
          marginTop: '50px',
          color: '#6366f1',
          textDecoration: 'none',
          fontSize: '16px',
          display: 'inline-block'
        }}
      >
        ← Back to App
      </a>
    </div>
  )
}

