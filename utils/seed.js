// utils/seed.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const WatchlistItem = require('../models/WatchlistItem');
const Holding = require('../models/Holding');

async function seedDatabase() {
    try {
        // Always reset watchlist items to match LEAF base prices exactly
        await WatchlistItem.deleteMany({});
        console.log('🧹 Cleared watchlist items for synchronization');
        
        const watchlistData = [
            { symbol: 'AAPL', name: 'Apple Inc.', price: 185.50, changePercent: 0.45, category: 'Stocks' },
            { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 138.42, changePercent: -0.85, category: 'Stocks' },
            { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 922.20, changePercent: 2.80, category: 'Stocks' },
            { symbol: 'AMZN', name: 'Amazon.com', price: 181.30, changePercent: 0.90, category: 'Stocks' },
            { symbol: 'TSLA', name: 'Tesla, Inc.', price: 174.80, changePercent: -1.25, category: 'Stocks' },
            { symbol: 'MSFT', name: 'Microsoft', price: 421.90, changePercent: -0.35, category: 'Stocks' },
            { symbol: 'BTC', name: 'Bitcoin', price: 67500.00, changePercent: 2.50, category: 'Crypto' },
            { symbol: 'ETH', name: 'Ethereum', price: 3520.00, changePercent: 1.20, category: 'Crypto' },
            { symbol: 'SOL', name: 'Solana', price: 168.00, changePercent: -0.50, category: 'Crypto' },
            { symbol: 'BNB', name: 'Binance Coin', price: 605.00, changePercent: 0.80, category: 'Crypto' },
            { symbol: 'XRP', name: 'Ripple', price: 0.54, changePercent: -1.10, category: 'Crypto' },
            { symbol: 'GOLD', name: 'Gold', price: 2320.50, changePercent: 0.35, category: 'Commodity' },
            { symbol: 'CARESS', name: 'Caress (Sim)', price: 67500.00, changePercent: 2.50, category: 'Crypto' }
        ];
        
        await WatchlistItem.insertMany(watchlistData);
        console.log('✅ Watchlist seeded:', watchlistData.length, 'items');

        // Align existing user holdings prices with synchronized base values
        await Holding.updateMany({ symbol: 'AAPL' }, { currentPrice: 185.50 });
        await Holding.updateMany({ symbol: 'NVDA' }, { currentPrice: 922.20 });
        await Holding.updateMany({ symbol: 'BTC' }, { currentPrice: 67500.00 });
        await Holding.updateMany({ symbol: 'ETH' }, { currentPrice: 3520.00 });
        console.log('📈 Aligned existing user holdings prices with synchronized base values');

        // Clean slate: Wipe all users, holdings, and transactions
        await User.deleteMany({});
        await Holding.deleteMany({});
        await Transaction.deleteMany({});
        console.log('🧹 Cleared all users, holdings, and transaction history');
        
        console.log('🌱 Database prepared as a fresh clean environment. No prefilled users exist!');
        
    } catch (error) {
        console.error('❌ Seeding error:', error);
    }
}

module.exports = seedDatabase;