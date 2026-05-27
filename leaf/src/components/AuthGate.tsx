import { useState, useEffect } from 'react';
import { Leaf, Loader } from 'lucide-react';
import {
  verifyTokenAndGetUser, isAuthenticated,
  type SaxoUser,
} from '../services/saxoApiService';

interface AuthGateProps {
  onAuthenticated: (user: SaxoUser) => void;
}

export default function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [, setAutoLogging] = useState(true);

  useEffect(() => {
    // ── 1. Check for token in URL hash (redirect from Saxo dashboard) ──
    const hash = window.location.hash;
    const match = hash.match(/[#&]token=([^&]+)/);
    if (match) {
      const token = decodeURIComponent(match[1]);
      window.history.replaceState(null, '', window.location.pathname); // Clean URL
      setAutoLogging(true);
      verifyTokenAndGetUser(token)
        .then(user => {
          const lastUser = localStorage.getItem('leaf_last_user');
          if (lastUser && lastUser !== user.id) {
            localStorage.removeItem('leaf-trading-v16');
          }
          localStorage.setItem('leaf_last_user', user.id);
          onAuthenticated(user);
        })
        .catch(() => {
          setAutoLogging(false);
          window.location.href = '/join.html';
        });
      return;
    }

    // ── 2. Check localStorage for existing session ──
    if (isAuthenticated()) {
      setAutoLogging(true);
      import('../services/saxoApiService').then(({ getMe }) =>
        getMe()
          .then(user => {
            const lastUser = localStorage.getItem('leaf_last_user');
            if (lastUser && lastUser !== user.id) {
              localStorage.removeItem('leaf-trading-v16');
            }
            localStorage.setItem('leaf_last_user', user.id);
            onAuthenticated(user);
          })
          .catch(() => {
            setAutoLogging(false);
            import('../services/saxoApiService').then(({ logout }) => logout());
            window.location.href = '/join.html';
          })
      );
    } else {
      // No token at all: immediately redirect to join.html
      setAutoLogging(false);
      window.location.href = '/join.html';
    }
  }, []);

  return (
    <div style={styles.overlay}>
      <div style={styles.blob1} />
      <div style={styles.blob2} />
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.leafBadge}><Leaf size={22} color="#26a69a" /></div>
          <div>
            <div style={styles.brand}>LEAF PRO</div>
            <div style={styles.tagline}>Advanced Trading Terminal</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <Loader size={32} color="#26a69a" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#7d8590', fontSize: 14 }}>Connecting to your account...</p>
        </div>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes blobMove { 0%, 100% { transform: scale(1) translate(0,0); } 50% { transform: scale(1.1) translate(20px, -20px); } }
      `}</style>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, background: '#0d1117',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, fontFamily: "'Inter', sans-serif",
    overflow: 'hidden',
  },
  blob1: {
    position: 'absolute', width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(38,166,154,0.12) 0%, transparent 70%)',
    top: '-100px', left: '-100px', animation: 'blobMove 8s ease-in-out infinite',
    pointerEvents: 'none',
  },
  blob2: {
    position: 'absolute', width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(41,98,255,0.08) 0%, transparent 70%)',
    bottom: '-150px', right: '-150px', animation: 'blobMove 10s ease-in-out infinite reverse',
    pointerEvents: 'none',
  },
  card: {
    background: 'rgba(22, 27, 34, 0.95)',
    border: '1px solid #21262d',
    borderRadius: 20,
    padding: '36px 32px',
    width: '100%', maxWidth: 420,
    boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
    animation: 'fadeInUp 0.4s ease',
    position: 'relative', zIndex: 1,
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
  },
  leafBadge: {
    width: 44, height: 44, borderRadius: 12,
    background: 'rgba(38,166,154,0.12)', border: '1px solid rgba(38,166,154,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brand: { fontSize: 22, fontWeight: 800, color: '#e6edf3', letterSpacing: '-0.5px' },
  tagline: { fontSize: 11, color: '#26a69a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', marginTop: 2 },
};
