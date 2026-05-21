// routes/watchlist.js
const express = require('express');
const { protect } = require('../middleware/auth');
const WatchlistItem = require('../models/WatchlistItem');
const Holding = require('../models/Holding');

const router = express.Router();

// Get watchlist
router.get('/', protect, async (req, res) => {
    try {
        let watchlist = await WatchlistItem.find();
        
        // If no data, seed default watchlist (aligned with dynamic base prices)
        if (watchlist.length === 0) {
            const defaults = [
                { symbol: 'AAPL', name: 'Apple Inc.', price: 185.50, changePercent: 0.45, category: 'Stocks' },
                { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 138.42, changePercent: -0.85, category: 'Stocks' },
                { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 922.20, changePercent: 2.80, category: 'Stocks' },
                { symbol: 'AMZN', name: 'Amazon.com', price: 181.30, changePercent: 0.90, category: 'Stocks' },
                { symbol: 'MSFT', name: 'Microsoft', price: 421.90, changePercent: -0.35, category: 'Stocks' },
                { symbol: 'TSLA', name: 'Tesla, Inc.', price: 174.80, changePercent: -1.25, category: 'Stocks' },
                { symbol: 'BTC', name: 'Bitcoin', price: 67500.00, changePercent: 2.50, category: 'Crypto' },
                { symbol: 'ETH', name: 'Ethereum', price: 3520.00, changePercent: 1.20, category: 'Crypto' }
            ];
            for (const item of defaults) {
                await WatchlistItem.create(item);
            }
            watchlist = await WatchlistItem.find();
        }
        
        res.json(watchlist);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update asset price in watchlist dynamically (and sync user holdings)
router.post('/update-price', protect, async (req, res) => {
    try {
        const { symbol, price, changePercent } = req.body;
        if (!symbol || price === undefined) {
            return res.status(400).json({ message: 'Symbol and price are required' });
        }
        const cleanSymbol = symbol.toUpperCase();
        
        // 1. Update the WatchlistItem database record
        const watchlistItem = await WatchlistItem.findOneAndUpdate(
            { symbol: cleanSymbol },
            { price: Number(price), changePercent: Number(changePercent || 0) },
            { new: true, upsert: true }
        );
        
        // 2. Synchronize all active user Holdings for this asset in real-time
        await Holding.updateMany(
            { symbol: cleanSymbol },
            { currentPrice: Number(price) }
        );
        
        res.json({ message: 'Watchlist price and active user holdings synced successfully', watchlistItem });
    } catch (error) {
        console.error('Failed to sync price:', error);
        res.status(500).json({ message: 'Failed to update asset price' });
    }
});

// Add to watchlist (admin only in production)
router.post('/add', protect, async (req, res) => {
    try {
        const { symbol, name, price, changePercent, category } = req.body;
        
        const existing = await WatchlistItem.findOne({ symbol });
        if (existing) {
            return res.status(400).json({ message: 'Symbol already in watchlist' });
        }
        
        const item = await WatchlistItem.create({
            symbol,
            name,
            price,
            changePercent,
            category
        });
        
        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;