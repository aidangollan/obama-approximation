'use client'

import { useState } from 'react'

export default function ResetPage() {
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset ALL data (global AND local)? This cannot be undone!')) {
      return
    }

    setLoading(true)
    setStatus('Resetting...')

    try {
      // Clear global data via API
      const response = await fetch('/api/global/reset', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.success) {
        // Also clear local storage
        localStorage.removeItem('obama-approximation-top10')
        localStorage.removeItem('obama-approximation-total-count')
        localStorage.removeItem('obama-approximation-progress')
        
        setStatus('✅ All data reset (global + local + progress)!')
      } else {
        setStatus('❌ Error: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      setStatus('❌ Failed to reset: ' + error)
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
      <h1 style={{ marginBottom: '30px', fontSize: '32px' }}>
        Reset Global Leaderboard
      </h1>
      
      <p style={{ marginBottom: '40px', color: '#888', textAlign: 'center', maxWidth: '600px' }}>
        This will delete:
        <br />• Global Top 10
        <br />• Global Best Match
        <br />• Total Global Explored Counter
        <br />• Global Progress Graph Data
        <br />• Your Local Top 10
        <br />• Your Local Image Count
        <br />• Local Progress Data
        <br /><br />
        <strong style={{ color: '#f00' }}>Everything will be reset!</strong>
      </p>

      <button
        onClick={handleReset}
        disabled={loading}
        style={{
          background: loading ? '#555' : '#e00',
          color: '#fff',
          border: 'none',
          padding: '15px 40px',
          fontSize: '18px',
          borderRadius: '8px',
          cursor: loading ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
          transition: 'background 0.2s'
        }}
        onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#f00')}
        onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#e00')}
      >
        {loading ? '⏳ Resetting...' : '🗑️  RESET GLOBAL DATA'}
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
          color: '#00d4ff',
          textDecoration: 'none',
          fontSize: '16px'
        }}
      >
        ← Back to App
      </a>
    </div>
  )
}

