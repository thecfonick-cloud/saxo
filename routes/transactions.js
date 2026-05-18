// routes/transactions.js
const express = require('express');
const { protect } = require('../middleware/auth');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Get recent transactions
router.get('/recent', protect, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user._id })
            .sort({ timestamp: -1 })
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
        const { page = 1, limit = 20, type } = req.query;
        
        let query = { userId: req.user._id };
        if (type && type !== 'all') {
            query.type = type;
        }
        
        const transactions = await Transaction.find(query)
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);
        
        const total = await Transaction.countDocuments(query);
        
        // Get summary statistics
        const deposits = await Transaction.aggregate([
            { $match: { userId: req.user._id, type: 'Deposit', status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        const withdrawals = await Transaction.aggregate([
            { $match: { userId: req.user._id, type: 'Withdrawal', status: 'Completed' } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        res.json({
            transactions,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page),
            total,
            summary: {
                totalDeposits: deposits[0]?.total || 0,
                totalWithdrawals: withdrawals[0]?.total || 0,
                netDeposits: (deposits[0]?.total || 0) - (withdrawals[0]?.total || 0)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get transaction by ID
router.get('/:id', protect, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({ 
            _id: req.params.id, 
            userId: req.user._id 
        });
        
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        
        res.json(transaction);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;