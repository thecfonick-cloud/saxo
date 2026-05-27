import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, TrendingUp, TrendingDown, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'long' | 'short';
  title: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: { toast: ToastMessage; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(toast.id), 350);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  const colors: Record<ToastMessage['type'], { bg: string; border: string; icon: React.ReactNode }> = {
    success: { bg: 'rgba(38,166,154,0.15)', border: '#26a69a44', icon: <CheckCircle size={16} color="#26a69a" /> },
    error:   { bg: 'rgba(239,83,80,0.15)',  border: '#ef535044', icon: <XCircle size={16} color="#ef5350" /> },
    warning: { bg: 'rgba(255,167,38,0.15)', border: '#ffa72644', icon: <AlertCircle size={16} color="#ffa726" /> },
    long:    { bg: 'rgba(38,166,154,0.15)', border: '#26a69a44', icon: <TrendingUp size={16} color="#26a69a" /> },
    short:   { bg: 'rgba(239,83,80,0.15)',  border: '#ef535044', icon: <TrendingDown size={16} color="#ef5350" /> },
  };

  const c = colors[toast.type];

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: '10px',
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '10px', padding: '12px 14px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      transition: 'all 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateX(0) scale(1)' : 'translateX(40px) scale(0.95)',
      minWidth: '280px', maxWidth: '340px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, height: '2px',
        background: c.border.replace('44', 'aa'),
        animation: 'toast-shrink 4s linear forwards',
      }} />
      <div style={{ flexShrink: 0, marginTop: 1 }}>{c.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>{toast.title}</div>
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{toast.message}</div>
      </div>
      <button onClick={() => { setVisible(false); setTimeout(() => onRemove(toast.id), 350); }}
        style={{ flexShrink: 0, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0', marginTop: '1px' }}>
        <X size={13} />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onRemove }: ToastProps) {
  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      zIndex: 99999, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: 'all' }}>
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}
