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

        // Check if data already exists for user profile
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('📊 Database already seeded, skipping user/holding creation...');
            return;
        }
        
        console.log('🌱 Seeding database with initial user data...');
        
        // Create default user
        const user = await User.create({
            fullName: 'Alexander Hunt',
            email: 'alexander@globalvest.com',
            password: 'password123',
            buyingPower: 12045.30,
            totalPortfolioValue: 124592.00,
            memberTier: 'Pro',
            profitLoss30d: 8240.11,
            activeTrades: 14
        });
        
        console.log('✅ User created:', user.fullName);
        
        // Create holdings for user
        await Holding.create([
            {
                userId: user._id,
                symbol: 'AAPL',
                assetName: 'Apple Inc.',
                shares: 250,
                averagePrice: 165.30,
                currentPrice: 185.50
            },
            {
                userId: user._id,
                symbol: 'NVDA',
                assetName: 'NVIDIA Corp.',
                shares: 85,
                averagePrice: 420.15,
                currentPrice: 922.20
            },
            {
                userId: user._id,
                symbol: 'BTC',
                assetName: 'Bitcoin',
                shares: 0.5,
                averagePrice: 38000,
                currentPrice: 67500
            }
        ]);
        console.log('✅ Holdings created');
        
        // Create recent transactions
        const transactions = [
            {
                userId: user._id,
                symbol: 'AAPL',
                assetName: 'Apple Inc.',
                type: 'Buy',
                quantity: '12.50 Shares',
                amountUSD: 2187.50,
                pricePerUnit: 175.00,
                status: 'Completed',
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            },
            {
                userId: user._id,
                symbol: 'BTC',
                assetName: 'Bitcoin',
                type: 'Transfer',
                quantity: '0.024 BTC',
                amountUSD: 1038.00,
                status: 'Pending',
                date: new Date(Date.now() - 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            },
            {
                userId: user._id,
                symbol: 'TSLA',
                assetName: 'Tesla, Inc.',
                type: 'Sell',
                quantity: '5.00 Shares',
                amountUSD: 1229.00,
                pricePerUnit: 245.80,
                status: 'Completed',
                date: 'Oct 24, 2023'
            },
            {
                userId: user._id,
                symbol: 'MSFT',
                assetName: 'Microsoft',
                type: 'Buy',
                quantity: '8.00 Shares',
                amountUSD: 2660.00,
                pricePerUnit: 332.50,
                status: 'Completed',
                date: 'Oct 22, 2023'
            }
        ];
        
        await Transaction.insertMany(transactions);
        console.log('✅ Transactions seeded:', transactions.length, 'records');
        
        console.log('🎉 Database seeding completed successfully!');
        
    } catch (error) {
        console.error('❌ Seeding error:', error);
    }
}

module.exports = seedDatabase;