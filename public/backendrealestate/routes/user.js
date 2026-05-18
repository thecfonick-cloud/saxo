// routes/user.js
const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Get user profile
router.get('/profile', protect, async (req, res) => {
    try {
        res.json({
            fullName: req.user.fullName,
            email: req.user.email,
            buyingPower: req.user.buyingPower,
            totalPortfolioValue: req.user.totalPortfolioValue,
            totalRealEstateValue: req.user.totalRealEstateValue,
            monthlyRentalIncome: req.user.monthlyRentalIncome,
            totalAppreciation: req.user.totalAppreciation,
            propertyCount: req.user.propertyCount,
            memberTier: req.user.memberTier
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Deposit funds
router.post('/deposit', protect, async (req, res) => {
    try {
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid deposit amount' });
        }
        
        req.user.buyingPower += amount;
        req.user.totalPortfolioValue += amount;
        await req.user.save();
        
        // Create deposit transaction
        await Transaction.create({
            userId: req.user._id,
            type: 'Deposit',
            amount: amount,
            description: `Deposit of $${amount.toFixed(2)}`,
            status: 'Completed'
        });
        
        res.json({
            message: 'Deposit successful',
            buyingPower: req.user.buyingPower,
            totalPortfolioValue: req.user.totalPortfolioValue
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;