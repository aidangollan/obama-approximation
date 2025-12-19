'use client'

import { useState } from 'react'

export default function BackfillPage() {
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handleBackfill = async () => {
    setLoading(true)
    setStatus('Backfilling user leaderboard...')

    try {
      const response = await fetch('/api/global/users/backfill', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        setStatus(`✅ Backfilled ${data.usersAdded} users successfully!`)
      } else {
        setStatus('❌ Error: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      setStatus('❌ Failed to backfill: ' + error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: 'monospace',
      padding: '20px'
    }}>
      <h1 style={{ marginBottom: '30px', fontSize: '32px', color: '#6366f1' }}>
        Backfill User Leaderboard
      </h1>
      
      <p style={{ marginBottom: '40px', color: '#888', textAlign: 'center', maxWidth: '600px' }}>
        This will scan the Global Top 10 and create/update the Top Obama Finders leaderboard.
        <br /><br />
        Use this if:
        <br />• User leaderboard is empty but Global Top 10 has matches with usernames
        <br />• User rankings seem outdated
        <br /><br />
        This is safe to run multiple times.
      </p>

      <button
        onClick={handleBackfill}
        disabled={loading}
        style={{
          background: loading ? '#555' : '#6366f1',
          color: '#fff',
          border: 'none',
          padding: '15px 40px',
          fontSize: '18px',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#818cf8')}
        onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#6366f1')}
      >
        {loading ? '⏳ Backfilling...' : '🔄 BACKFILL USER LEADERBOARD'}
      </button>

      {status && (
        <div style={{
          marginTop: '30px',
          padding: '15px 30px',
          background: status.includes('✅') ? '#1a4d1a' : '#4d1a1a',
          borderRadius: '8px',
          fontSize: '16px'
        }}>
          {status}
        </div>
      )}

      <a
        href="/"
        style={{
          marginTop: '50px',
          color: '#6366f1',
          textDecoration: 'none',
          fontSize: '16px'
        }}
      >
        ← Back to App
      </a>
    </div>
  )
}

