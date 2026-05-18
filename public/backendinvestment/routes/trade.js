// routes/trade.js
const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Holding = require('../models/Holding');
const Transaction = require('../models/Transaction');
const WatchlistItem = require('../models/WatchlistItem');

const router = express.Router();

// Execute trade
router.post('/', protect, async (req, res) => {
    try {
        const { symbol, amountUSD, type } = req.body;
        
        if (!symbol || !amountUSD || !type) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        if (amountUSD <= 0) {
            return res.status(400).json({ message: 'Amount must be positive' });
        }
        
        // Get current price from watchlist or create default
        let asset = await WatchlistItem.findOne({ symbol });
        
        // If asset not found, create a default one
        if (!asset) {
            // Default prices for common symbols
            const defaultPrices = {
                'AAPL': 175.50,
                'GOOGL': 138.42,
                'NVDA': 485.20,
                'AMZN': 126.15,
                'MSFT': 378.85,
                'TSLA': 248.50,
                'META': 342.80,
                'BTC': 43250.00,
                'ETH': 2250.00
            };
            
            const defaultPrice = defaultPrices[symbol.toUpperCase()] || 100.00;
            
            asset = await WatchlistItem.create({
                symbol: symbol.toUpperCase(),
                name: symbol.toUpperCase(),
                price: defaultPrice,
                changePercent: 0,
                category: 'Stocks'
            });
            
            console.log(`Created new watchlist item for ${symbol} with price ${defaultPrice}`);
        }
        
        const currentPrice = asset.price;
        const quantity = amountUSD / currentPrice;
        
        // Rest of your trade logic remains the same...
        if (type.toLowerCase() === 'buy') {
            // Check buying power
            if (req.user.buyingPower < amountUSD) {
                return res.status(400).json({ message: 'Insufficient buying power' });
            }
            
            // Update user's buying power
            req.user.buyingPower -= amountUSD;
            req.user.totalPortfolioValue += amountUSD;
            await req.user.save();
            
            // Update or create holding
            let holding = await Holding.findOne({ userId: req.user._id, symbol: symbol.toUpperCase() });
            if (holding) {
                const totalShares = holding.shares + quantity;
                const totalCost = (holding.shares * holding.averagePrice) + amountUSD;
                holding.averagePrice = totalCost / totalShares;
                holding.shares = totalShares;
                holding.currentPrice = currentPrice;
                await holding.save();
            } else {
                holding = await Holding.create({
                    userId: req.user._id,
                    symbol: symbol.toUpperCase(),
                    assetName: asset.name,
                    shares: quantity,
                    averagePrice: currentPrice,
                    currentPrice
                });
            }
            
            // Create transaction
            await Transaction.create({
                userId: req.user._id,
                symbol: symbol.toUpperCase(),
                assetName: asset.name,
                type: 'Buy',
                quantity: quantity.toFixed(4),
                amountUSD: amountUSD,
                pricePerUnit: currentPrice,
                status: 'Completed',
                description: `Bought ${quantity.toFixed(4)} shares of ${symbol.toUpperCase()} at $${currentPrice}`,
                metadata: {
                    symbol: symbol.toUpperCase(),
                    price: currentPrice,
                    shares: quantity
                }
            });
            
            res.json({
                message: 'Buy order executed',
                shares: quantity.toFixed(4),
                symbol: symbol.toUpperCase(),
                price: currentPrice,
                remainingBuyingPower: req.user.buyingPower
            });
            
        } else if (type.toLowerCase() === 'sell') {
            // Check if user owns the asset
            const holding = await Holding.findOne({ userId: req.user._id, symbol: symbol.toUpperCase() });
            if (!holding || holding.shares < quantity) {
                return res.status(400).json({ message: 'Insufficient shares to sell' });
            }
            
            // Update holding
            holding.shares -= quantity;
            if (holding.shares <= 0.001) {
                await holding.deleteOne();
            } else {
                await holding.save();
            }
            
            // Update user's buying power and portfolio
            req.user.buyingPower += amountUSD;
            req.user.totalPortfolioValue -= amountUSD;
            await req.user.save();
            
            // Create transaction
            await Transaction.create({
                userId: req.user._id,
                symbol: symbol.toUpperCase(),
                assetName: asset.name,
                type: 'Sell',
                quantity: quantity.toFixed(4),
                amountUSD: amountUSD,
                pricePerUnit: currentPrice,
                status: 'Completed',
                description: `Sold ${quantity.toFixed(4)} shares of ${symbol.toUpperCase()} at $${currentPrice}`,
                metadata: {
                    symbol: symbol.toUpperCase(),
                    price: currentPrice,
                    shares: quantity
                }
            });
            
            res.json({
                message: 'Sell order executed',
                shares: quantity.toFixed(4),
                symbol: symbol.toUpperCase(),
                price: currentPrice,
                remainingBuyingPower: req.user.buyingPower
            });
            
        } else {
            return res.status(400).json({ message: 'Invalid trade type. Use "buy" or "sell"' });
        }
        
    } catch (error) {
        console.error('Trade error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user's holdings
router.get('/holdings', protect, async (req, res) => {
    try {
        const holdings = await Holding.find({ userId: req.user._id });
        res.json(holdings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get portfolio performance
router.get('/performance', protect, async (req, res) => {
    try {
        const holdings = await Holding.find({ userId: req.user._id });
        
        let totalValue = 0;
        let totalCost = 0;
        
        holdings.forEach(holding => {
            totalValue += holding.shares * holding.currentPrice;
            totalCost += holding.shares * holding.averagePrice;
        });
        
        const totalProfitLoss = totalValue - totalCost;
        const profitLossPercent = totalCost > 0 ? (totalProfitLoss / totalCost) * 100 : 0;
        
        res.json({
            totalValue,
            totalCost,
            totalProfitLoss,
            profitLossPercent,
            holdingsCount: holdings.length
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;