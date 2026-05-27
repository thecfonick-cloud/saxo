import { useEffect } from 'react';
import ChartComponent from './components/ChartComponent';
import { useTradingStore, ALL_ASSETS } from './store/tradingStore';
import './App.css';

export default function App() {
  const { currentAsset, setCurrentAsset, timeframe, setTimeframe } = useTradingStore();

  // Read URL parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sym = params.get('symbol');
    if (sym && ALL_ASSETS.find(a => a.symbol === sym.toUpperCase())) {
      setCurrentAsset(sym.toUpperCase());
    }
  }, [setCurrentAsset]);

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#0d1117' }}>
      {/* Minimal Topbar */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '50px', borderBottom: '1px solid #21262d', background: '#0d1117', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <select 
            value={currentAsset.symbol} 
            onChange={(e) => setCurrentAsset(e.target.value)}
            style={{ background: '#161b22', color: '#e6edf3', border: '1px solid #30363d', borderRadius: '4px', padding: '4px 8px', fontSize: '14px', fontWeight: 'bold' }}
          >
            {ALL_ASSETS.map(a => <option key={a.symbol} value={a.symbol}>{a.name} ({a.symbol.replace('USDT', '')})</option>)}
          </select>
          <span style={{ color: '#39d353', fontWeight: 'bold', fontSize: '14px' }}>
            ${currentAsset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['1m', '5m', '15m', '1h', '4h', '1d'].map(tf => (
            <button 
              key={tf} 
              onClick={() => setTimeframe(tf)}
              style={{ 
                background: timeframe === tf ? '#21262d' : 'transparent', 
                color: timeframe === tf ? '#e6edf3' : '#7d8590',
                border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </header>

      {/* Chart fills the rest */}
      <div style={{ flex: 1, position: 'relative', width: '100%', minHeight: 0 }}>
        <ChartComponent />
      </div>
    </div>
  );
}
