// routes/transactions.js
const express = require('express');
const { protect } = require('../middleware/auth');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Get recent transactions
router.get('/recent', protect, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id })
            .sort({ date: -1 })
            .limit(10);
        
        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all transactions with pagination
router.get('/all', protect, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const transactions = await Transaction.find({ userId: req.user._id })
            .sort({ date: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Transaction.countDocuments({ userId: req.user._id });
        
        res.json({
            transactions,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;