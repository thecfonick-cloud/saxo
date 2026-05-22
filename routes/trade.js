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
            const defaultPrice = 100.00;
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

        // --- LEAF MARGIN TRADES ---
        if (req.body.isMarginTrade) {
            if (req.user.buyingPower < amountUSD) {
                return res.status(400).json({ message: 'Insufficient buying power' });
            }
            // Always deduct margin cost
            req.user.buyingPower -= amountUSD;
            await req.user.save();
            
            const quantityStr = (amountUSD / currentPrice).toFixed(4);
            const positionType = type.toLowerCase() === 'buy' ? 'Long' : 'Short';
            const quantity = positionType === 'Long' ? parseFloat(quantityStr) : -parseFloat(quantityStr);

            // Create holding for LEAF Margin trade
            await Holding.create({
                userId: req.user._id,
                symbol: symbol.toUpperCase(),
                assetName: asset.name,
                shares: quantity,
                averagePrice: currentPrice,
                currentPrice: currentPrice,
                isMarginTrade: true,
                positionType: positionType,
                marginCost: amountUSD
            });

            await Transaction.create({
                userId: req.user._id,
                symbol: symbol.toUpperCase(),
                assetName: asset.name,
                type: type.toLowerCase() === 'buy' ? 'Buy' : 'Sell',
                quantity: quantityStr,
                amountUSD: amountUSD,
                pricePerUnit: currentPrice,
                status: 'Completed',
                description: `LEAF Margin - Opened ${positionType} ${quantityStr} ${symbol.toUpperCase()} at $${currentPrice.toFixed(2)}`,
                metadata: { symbol: symbol.toUpperCase(), isMarginTrade: true, marginCost: amountUSD }
            });
            
            return res.json({
                message: 'Margin trade processed',
                remainingBuyingPower: req.user.buyingPower
            });
        }
        
        const quantity = amountUSD / currentPrice;
        
        // Rest of your trade logic remains the same...
        if (type.toLowerCase() === 'buy') {
            // Check buying power
            if (req.user.buyingPower < amountUSD) {
                return res.status(400).json({ message: 'Insufficient buying power' });
            }
            
            // Update user's buying power
            req.user.buyingPower -= amountUSD;
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
            if (holding.isMarginTrade) {
                const diff = holding.currentPrice - holding.averagePrice;
                const absoluteShares = Math.abs(holding.shares);
                const pnl = holding.positionType === 'Long' ? diff * absoluteShares : -diff * absoluteShares;
                totalValue += (holding.marginCost || 0) + pnl;
                totalCost += (holding.marginCost || 0);
            } else {
                totalValue += holding.shares * holding.currentPrice;
                totalCost += holding.shares * holding.averagePrice;
            }
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

// Close entire holding
router.post('/close', protect, async (req, res) => {
    try {
        const { symbol } = req.body;
        if (!symbol) return res.status(400).json({ message: 'Missing symbol' });
        
        // Note: For LEAF, if there are multiple positions of the same symbol, this closes the oldest one or merges them.
        // For now we assume a single holding per symbol.
        const holding = await Holding.findOne({ userId: req.user._id, symbol: symbol.toUpperCase() });
        if (!holding) return res.status(400).json({ message: 'Holding not found' });
        
        const asset = await WatchlistItem.findOne({ symbol: symbol.toUpperCase() });
        const currentPrice = asset ? asset.price : holding.currentPrice;
        
        let amountUSD;
        let pnl;
        
        if (holding.isMarginTrade) {
            // Margin Trade PnL logic
            const diff = currentPrice - holding.averagePrice;
            const absoluteShares = Math.abs(holding.shares);
            pnl = holding.positionType === 'Long' ? diff * absoluteShares : -diff * absoluteShares;
            // Return margin cost + PnL
            amountUSD = (holding.marginCost || 0) + pnl;
        } else {
            amountUSD = holding.shares * currentPrice;
            pnl = amountUSD - (holding.shares * holding.averagePrice);
        }
        
        // Update user's buying power
        req.user.buyingPower += amountUSD;
        await req.user.save();
        
        const quantityStr = Math.abs(holding.shares).toFixed(4);
        
        // Delete holding
        await holding.deleteOne();
        
        // Create transaction
        await Transaction.create({
            userId: req.user._id,
            symbol: symbol.toUpperCase(),
            assetName: holding.assetName,
            type: holding.isMarginTrade ? 'Close Position' : 'Sell',
            quantity: quantityStr,
            amountUSD: amountUSD, // This is Margin + PnL for margin trades, or total value for spot
            pricePerUnit: currentPrice,
            status: 'Completed',
            description: holding.isMarginTrade 
                ? `LEAF Margin - Closed ${holding.positionType} ${quantityStr} ${symbol.toUpperCase()} at $${currentPrice.toFixed(2)} (PnL: $${pnl.toFixed(2)})`
                : `Sold all ${quantityStr} shares of ${symbol.toUpperCase()} at $${currentPrice.toFixed(2)}`,
            metadata: { symbol: symbol.toUpperCase(), price: currentPrice, shares: holding.shares, isClose: true, pnl, isMarginTrade: holding.isMarginTrade }
        });
        
        res.json({ 
            message: 'Position closed successfully',
            remainingBuyingPower: req.user.buyingPower
        });
    } catch(err) {
        console.error('Close error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;