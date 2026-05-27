import { create } from 'zustand';

export interface Asset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  type: 'crypto' | 'stock';
}

export const ALL_ASSETS: Asset[] = [
  // Crypto (Real Binance Data)
  { symbol: 'BTCUSDT', name: 'Bitcoin', price: 75718.00, change: 0, type: 'crypto' },
  { symbol: 'ETHUSDT', name: 'Ethereum', price: 2071.28, change: 0, type: 'crypto' },
  { symbol: 'BNBUSDT', name: 'BNB', price: 605.00, change: 0, type: 'crypto' },
  { symbol: 'SOLUSDT', name: 'Solana', price: 63.68, change: 0, type: 'crypto' },
  { symbol: 'XRPUSDT', name: 'XRP', price: 1.23, change: 0, type: 'crypto' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin', price: 0.16, change: 0, type: 'crypto' },
  { symbol: 'ADAUSDT', name: 'Cardano', price: 0.25, change: 0, type: 'crypto' },
  { symbol: 'LINKUSDT', name: 'Chainlink', price: 9.49, change: 0, type: 'crypto' },
  { symbol: 'TONUSDT', name: 'Toncoin', price: 1.05, change: 0, type: 'crypto' },
  { symbol: 'AVAXUSDT', name: 'Avalanche', price: 34.15, change: 0, type: 'crypto' },
  { symbol: 'TRXUSDT', name: 'TRON', price: 0.37, change: 0, type: 'crypto' },
  { symbol: 'DOTUSDT', name: 'Polkadot', price: 3.25, change: 0, type: 'crypto' },
  { symbol: 'UNIUSDT', name: 'Uniswap', price: 3.24, change: 0, type: 'crypto' },
  { symbol: 'LTCUSDT', name: 'Litecoin', price: 51.00, change: 0, type: 'crypto' },
  { symbol: 'SHIBUSDT', name: 'Shiba Inu', price: 0.000008, change: 0, type: 'crypto' },
  { symbol: 'PEPEUSDT', name: 'Pepe', price: 0.000003, change: 0, type: 'crypto' },

  // Stocks & Commodities (Simulated Live Data)
  { symbol: 'AAPL', name: 'Apple Inc.', price: 175.50, change: 0, type: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.85, change: 0, type: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 153.25, change: 0, type: 'stock' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 128.15, change: 0, type: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 485.20, change: 0, type: 'stock' },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.50, change: 0, type: 'stock' },
  { symbol: 'META', name: 'Meta Platforms Inc.', price: 342.80, change: 0, type: 'stock' },
  { symbol: 'BRKB', name: 'Berkshire Hathaway', price: 362.10, change: 0, type: 'stock' },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 155.25, change: 0, type: 'stock' },
  { symbol: 'V', name: 'Visa Inc.', price: 265.81, change: 0, type: 'stock' },
  { symbol: 'WMT', name: 'Walmart Inc.', price: 144.45, change: 0, type: 'stock' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', price: 160.20, change: 0, type: 'stock' },
  { symbol: 'PG', name: 'Procter & Gamble', price: 152.60, change: 0, type: 'stock' },
  { symbol: 'UNH', name: 'UnitedHealth Group', price: 525.80, change: 0, type: 'stock' },
  { symbol: 'HD', name: 'Home Depot Inc.', price: 330.25, change: 0, type: 'stock' },
  { symbol: 'DIS', name: 'Walt Disney Co.', price: 93.40, change: 0, type: 'stock' },
  { symbol: 'MA', name: 'Mastercard Inc.', price: 405.30, change: 0, type: 'stock' },
  { symbol: 'NFLX', name: 'Netflix Inc.', price: 475.90, change: 0, type: 'stock' },
  { symbol: 'XAUUSD', name: 'Gold', price: 2156.20, change: 0, type: 'stock' },
  { symbol: 'F', name: 'Ford Motor Co.', price: 12.35, change: 0, type: 'stock' },
  { symbol: 'GM', name: 'General Motors Co.', price: 34.85, change: 0, type: 'stock' },
  { symbol: 'GE', name: 'General Electric Co.', price: 128.60, change: 0, type: 'stock' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', price: 250.40, change: 0, type: 'stock' },
  { symbol: 'AXP', name: 'American Express Co.', price: 173.20, change: 0, type: 'stock' },
  { symbol: 'GS', name: 'Goldman Sachs Group', price: 338.80, change: 0, type: 'stock' },
  { symbol: 'MMM', name: '3M Co.', price: 108.30, change: 0, type: 'stock' },
  { symbol: 'MCD', name: 'McDonald\'s Corp.', price: 281.75, change: 0, type: 'stock' },
  { symbol: 'ABBV', name: 'AbbVie Inc.', price: 155.00, change: 0, type: 'stock' },
  { symbol: 'MRK', name: 'Merck & Co.', price: 104.40, change: 0, type: 'stock' },
  { symbol: 'LLY', name: 'Eli Lilly and Co.', price: 615.50, change: 0, type: 'stock' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', price: 145.30, change: 0, type: 'stock' },
  { symbol: 'MU', name: 'Micron Technology Inc.', price: 84.60, change: 0, type: 'stock' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', price: 908.40, change: 0, type: 'stock' },
  { symbol: 'TXN', name: 'Texas Instruments Inc.', price: 167.80, change: 0, type: 'stock' },
  { symbol: 'SHOP', name: 'Shopify Inc.', price: 68.75, change: 0, type: 'stock' },
  { symbol: 'PYPL', name: 'PayPal Holdings Inc.', price: 67.30, change: 0, type: 'stock' },
  { symbol: 'SQ', name: 'Block Inc.', price: 59.45, change: 0, type: 'stock' },
  { symbol: 'UBER', name: 'Uber Technologies Inc.', price: 61.50, change: 0, type: 'stock' },
  { symbol: 'LYFT', name: 'Lyft Inc.', price: 13.25, change: 0, type: 'stock' },
  { symbol: 'SNOW', name: 'Snowflake Inc.', price: 172.40, change: 0, type: 'stock' },
  { symbol: 'ZM', name: 'Zoom Video', price: 68.50, change: 0, type: 'stock' },
  { symbol: 'DOCU', name: 'DocuSign Inc.', price: 57.60, change: 0, type: 'stock' },
  { symbol: 'RIVN', name: 'Rivian Automotive Inc.', price: 18.50, change: 0, type: 'stock' },
  { symbol: 'FVRR', name: 'Fiverr International', price: 26.40, change: 0, type: 'stock' },
  { symbol: 'PINS', name: 'Pinterest Inc.', price: 34.25, change: 0, type: 'stock' },
  { symbol: 'SNAP', name: 'Snap Inc.', price: 12.40, change: 0, type: 'stock' },
  { symbol: 'DDOG', name: 'Datadog Inc.', price: 115.80, change: 0, type: 'stock' },
  { symbol: 'NET', name: 'Cloudflare Inc.', price: 79.20, change: 0, type: 'stock' },
  { symbol: 'TEAM', name: 'Atlassian Corp.', price: 205.50, change: 0, type: 'stock' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', price: 224.70, change: 0, type: 'stock' },
  { symbol: 'ZS', name: 'Zscaler Inc.', price: 188.30, change: 0, type: 'stock' },
  { symbol: 'MDB', name: 'MongoDB Inc.', price: 388.20, change: 0, type: 'stock' },
  { symbol: 'PANW', name: 'Palo Alto Networks', price: 282.40, change: 0, type: 'stock' },
  { symbol: 'OKTA', name: 'Okta Inc.', price: 86.50, change: 0, type: 'stock' },
  { symbol: 'WDAY', name: 'Workday Inc.', price: 266.00, change: 0, type: 'stock' },
  { symbol: 'ADSK', name: 'Autodesk Inc.', price: 220.40, change: 0, type: 'stock' },
  { symbol: 'NOW', name: 'ServiceNow Inc.', price: 725.40, change: 0, type: 'stock' },
  { symbol: 'FAKE', name: 'Fake Stock', price: 123.45, change: 0, type: 'stock' },
  { symbol: 'PENGU', name: 'Pudgy Penguins', price: 0.000043, change: 0, type: 'stock' },
];

interface TradingStore {
  currentAsset: Asset;
  timeframe: string;
  chartType: 'Candlestick' | 'Line';
  setCurrentAsset: (symbol: string) => void;
  setTimeframe: (tf: string) => void;
  updateAssetPrice: (symbol: string, price: number) => void;
}

export const useTradingStore = create<TradingStore>((set) => ({
  currentAsset: ALL_ASSETS[0],
  timeframe: '1m',
  chartType: 'Candlestick',
  setCurrentAsset: (symbol) => set((state) => {
    const asset = ALL_ASSETS.find(a => a.symbol === symbol);
    if (asset) return { currentAsset: { ...asset, price: state.currentAsset.price } };
    return state;
  }),
  setTimeframe: (tf) => set({ timeframe: tf }),
  updateAssetPrice: (symbol, price) => set((state) => {
    if (state.currentAsset.symbol === symbol) {
      return { currentAsset: { ...state.currentAsset, price } };
    }
    return state;
  }),
}));
