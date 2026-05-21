// routes/portfolio.js
const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Holding = require('../models/Holding');

const router = express.Router();

// Get portfolio summary
router.get('/summary', protect, async (req, res) => {
    try {
        const holdings = await Holding.find({ userId: req.user._id });
        
        // Dynamically compute absolute portfolio valuation: cash + active holdings
        const totalHoldingsValue = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);
        const computedTotalValue = req.user.buyingPower + totalHoldingsValue + (req.user.totalRealEstateValue || 0);
        
        // Persist computed value to prevent db drift
        await User.findByIdAndUpdate(req.user._id, { totalPortfolioValue: computedTotalValue });
        
        res.json({
            totalValue: computedTotalValue,
            buyingPower: req.user.buyingPower,
            activeTrades: req.user.activeTrades,
            profitLoss30d: req.user.profitLoss30d,
            holdings: holdings.map(h => ({
                symbol: h.symbol,
                name: h.assetName,
                shares: h.shares,
                averagePrice: h.averagePrice,
                currentPrice: h.currentPrice,
                value: h.shares * h.currentPrice,
                profitLoss: (h.currentPrice - h.averagePrice) * h.shares
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get holdings
router.get('/holdings', protect, async (req, res) => {
    try {
        const holdings = await Holding.find({ userId: req.user._id });
        res.json(holdings);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;