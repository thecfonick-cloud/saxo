import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, HistogramSeries, CandlestickSeries } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, CandlestickData, Time, HistogramData } from 'lightweight-charts';
import { useTradingStore } from '../store/tradingStore';
import { Leaf } from 'lucide-react';

// Generates initial baseline history so the chart isn't empty
function generateInitialHistory(basePrice: number, numCandles: number = 500): { candles: CandlestickData[], vols: HistogramData[] } {
  const candles: CandlestickData[] = [];
  const vols: HistogramData[] = [];
  let currentPrice = basePrice * 0.8;
  let currentTime = Math.floor(Date.now() / 1000) - (numCandles * 60);

  for (let i = 0; i < numCandles; i++) {
    const volatility = currentPrice * 0.002;
    const open = currentPrice;
    const close = open + (Math.random() - 0.48) * volatility;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.random() * 10000 + 1000;

    candles.push({ time: currentTime as Time, open, high, low, close });
    vols.push({ time: currentTime as Time, value: volume, color: close >= open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)' });
    currentPrice = close;
    currentTime += 60;
  }
  candles[candles.length - 1].close = basePrice;
  return { candles, vols };
}

export default function ChartComponent() {
  const mainEl = useRef<HTMLDivElement>(null);
  const mainChart = useRef<IChartApi|null>(null);
  const candleS   = useRef<ISeriesApi<'Candlestick'>|null>(null);
  const volS      = useRef<ISeriesApi<'Histogram'>|null>(null);

  const [legendData, setLegendData] = useState<{o:number,h:number,l:number,c:number,v:number}|null>(null);
  const { currentAsset, timeframe, updateAssetPrice } = useTradingStore();

  useEffect(() => {
    if (!mainEl.current) return;
    const mc = createChart(mainEl.current, {
      layout: { background:{type:ColorType.Solid,color:'#0d1117'}, textColor:'#7d8590', fontFamily:"'Inter',sans-serif", fontSize:11 },
      grid: { vertLines:{color:'#161b22'}, horzLines:{color:'#161b22'} },
      crosshair: { mode:1, vertLine:{color:'#373e47',width:1,style:3,labelBackgroundColor:'#1c2128'}, horzLine:{color:'#373e47',width:1,style:3,labelBackgroundColor:'#1c2128'} },
      timeScale: { borderColor:'#21262d', timeVisible:true, secondsVisible:false },
      rightPriceScale: { borderColor:'#21262d', scaleMargins:{top:0.1,bottom:0.28} },
    });
    mainChart.current = mc;

    candleS.current = mc.addSeries(CandlestickSeries, {upColor:'#26a69a',downColor:'#ef5350',borderVisible:false,wickUpColor:'#26a69a',wickDownColor:'#ef5350'});
    const vs = mc.addSeries(HistogramSeries, {priceFormat:{type:'volume'},priceScaleId:''});
    vs.priceScale().applyOptions({scaleMargins:{top:0.8,bottom:0}});
    volS.current = vs;

    mc.subscribeCrosshairMove((param) => {
      if (param.time && candleS.current) {
        const data = param.seriesData.get(candleS.current);
        const vData = volS.current ? param.seriesData.get(volS.current) : null;
        if (data) {
          setLegendData({ o: (data as any).open ?? 0, h: (data as any).high ?? 0, l: (data as any).low ?? 0, c: (data as any).close ?? 0, v: vData ? (vData as any).value : 0 });
        }
      } else {
        setLegendData(null);
      }
    });

    const onResize = () => { if(mainEl.current) mc.applyOptions({width:mainEl.current.clientWidth, height:mainEl.current.clientHeight}); };
    window.addEventListener('resize', onResize);
    setTimeout(onResize, 50);
    return () => { window.removeEventListener('resize',onResize); mc.remove(); };
  }, []);

  useEffect(() => {
    if (!candleS.current || !volS.current) return;
    const sym = currentAsset.symbol;

    // Load initial fake history so the chart looks populated
    const { candles, vols } = generateInitialHistory(currentAsset.price || 100);
    candleS.current.setData(candles);
    volS.current.setData(vols);
    
    let lastCandle = candles[candles.length - 1];
    let lastVol = vols[vols.length - 1];

    // Listen for EXACT live data sent from the parent website (virexoncapital.com)
    const handlePostMessage = (event: MessageEvent) => {
      // Security/Origin check would go here in production
      const data = event.data;
      if (data && data.type === 'MARKET_TICK' && data.symbol === sym) {
        const newClose = data.price;
        
        // Update the live chart with the exact price from the website
        const newHigh = Math.max(lastCandle.high, newClose);
        const newLow = Math.min(lastCandle.low, newClose);
        
        lastCandle = { ...lastCandle, close: newClose, high: newHigh, low: newLow };
        lastVol = { ...lastVol, value: lastVol.value + Math.random() * 50, color: newClose >= lastCandle.open ? 'rgba(38,166,154,0.45)' : 'rgba(239,83,80,0.45)' };
        
        candleS.current?.update(lastCandle);
        volS.current?.update(lastVol);
        updateAssetPrice(sym, newClose);
      }
    };

    window.addEventListener('message', handlePostMessage);
    return () => window.removeEventListener('message', handlePostMessage);

  }, [currentAsset.symbol, currentAsset.type, timeframe, updateAssetPrice]);

  return (
    <div style={{width:'100%',height:'100%',position:'relative'}}>
      {/* OHLC Legend */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 20, display: 'flex', gap: 12, fontSize: 13, fontFamily: "'Inter', sans-serif", color: '#7d8590', pointerEvents: 'none' }}>
        <div style={{ fontWeight: 700, color: '#e6edf3' }}>{currentAsset.symbol.replace('USDT', '')}</div>
        <div style={{ fontWeight: 600, color: '#e6edf3' }}>{timeframe}</div>
        {legendData ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <div>O <span style={{color: legendData.c >= legendData.o ? '#26a69a' : '#ef5350', fontWeight: 600}}>{legendData.o.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:4})}</span></div>
            <div>H <span style={{color: legendData.c >= legendData.o ? '#26a69a' : '#ef5350', fontWeight: 600}}>{legendData.h.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:4})}</span></div>
            <div>L <span style={{color: legendData.c >= legendData.o ? '#26a69a' : '#ef5350', fontWeight: 600}}>{legendData.l.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:4})}</span></div>
            <div>C <span style={{color: legendData.c >= legendData.o ? '#26a69a' : '#ef5350', fontWeight: 600}}>{legendData.c.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:4})}</span></div>
            <div style={{ marginLeft: 8 }}>Vol <span style={{color: '#e6edf3', fontWeight: 600}}>{legendData.v > 1000 ? (legendData.v/1000).toFixed(2)+'K' : legendData.v.toFixed(2)}</span></div>
          </div>
        ) : null}
      </div>

      <div ref={mainEl} style={{width:'100%',height:'100%'}} />

      {/* LEAF watermark */}
      <div style={{position:'absolute',bottom:'36px',left:12,display:'flex',alignItems:'center',gap:6,opacity:0.28,pointerEvents:'none',zIndex:5}}>
        <div style={{width:22,height:22,background:'linear-gradient(135deg,#39d353,#20b040)',borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <Leaf size={13} color="#0d1117" strokeWidth={2.5} />
        </div>
        <span style={{fontSize:14,fontWeight:700,color:'#e6edf3',fontFamily:"'Inter',sans-serif"}}>LEAF<span style={{color:'#39d353'}}>CHART</span></span>
      </div>
    </div>
  );
}
