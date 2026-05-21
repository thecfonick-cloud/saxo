// routes/admin.js
const express = require('express');
const DepositProof = require('../models/DepositProof');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { protect, adminOnly } = require('../middleware/auth');
const UpgradeRequest = require('../models/UpgradeRequest');

const router = express.Router();

// Apply authentication middleware to all admin routes
router.use(protect);

// Apply admin check middleware
router.use(adminOnly);

// Get all deposits with filters
router.get('/deposits', async (req, res) => {
    try {
        const { status, limit = 100, skip = 0 } = req.query;
        
        let query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        
        const deposits = await DepositProof.find(query)
            .populate('userId', 'fullName email buyingPower')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));
        
        const total = await DepositProof.countDocuments(query);
        
        res.json({
            success: true,
            deposits,
            total,
            hasMore: skip + deposits.length < total
        });
    } catch (error) {
        console.error('Error fetching deposits:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get deposit statistics
router.get('/deposits/stats', async (req, res) => {
    try {
        const stats = await DepositProof.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayDeposits = await DepositProof.aggregate([
            {
                $match: {
                    createdAt: { $gte: today },
                    status: { $in: ['verified', 'credited'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        res.json({
            success: true,
            overall: stats,
            today: {
                totalAmount: todayDeposits[0]?.totalAmount || 0,
                count: todayDeposits[0]?.count || 0
            }
        });
    } catch (error) {
        console.error('Error fetching deposit stats:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get pending deposits count
router.get('/deposits/pending/count', async (req, res) => {
    try {
        const count = await DepositProof.countDocuments({ status: 'pending' });
        res.json({ success: true, count });
    } catch (error) {
        console.error('Error fetching pending count:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify and credit deposit
router.post('/deposits/:id/verify', async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;
        
        const deposit = await DepositProof.findById(id);
        if (!deposit) {
            return res.status(404).json({ message: 'Deposit request not found' });
        }
        
        if (deposit.status !== 'pending') {
            return res.status(400).json({ 
                message: `Deposit already ${deposit.status}. Cannot verify again.` 
            });
        }
        
        // Update deposit status
        deposit.status = 'verified';
        deposit.verifiedAt = new Date();
        deposit.adminNotes = adminNotes || deposit.adminNotes;
        deposit.verifiedBy = req.user.email;
        await deposit.save();
        
        // Credit the user's balance atomically
        const user = await User.findByIdAndUpdate(
            deposit.userId,
            { $inc: { buyingPower: deposit.amount, totalPortfolioValue: deposit.amount } },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        // Update or create transaction
        let transaction = await Transaction.findOne({ 
            userId: deposit.userId, 
            'metadata.referenceId': deposit.referenceId 
        });
        
        if (transaction) {
            transaction.status = 'Completed';
            transaction.description = `Deposit via ${deposit.method} - Verified by ${req.user.email}`;
            transaction.metadata = {
                ...transaction.metadata,
                verifiedAt: new Date(),
                verifiedBy: req.user.email,
                verified: true
            };
            await transaction.save();
        } else {
            transaction = await Transaction.create({
                userId: deposit.userId,
                type: 'Deposit',
                amountUSD: deposit.amount,
                description: `Deposit via ${deposit.method} - Verified by ${req.user.email}`,
                status: 'Completed',
                metadata: {
                    method: deposit.method,
                    referenceId: deposit.referenceId,
                    depositProofId: deposit._id,
                    verifiedBy: req.user.email,
                    verifiedAt: new Date()
                }
            });
        }
        
        deposit.status = 'credited';
        deposit.creditedAt = new Date();
        await deposit.save();
        
        res.json({
            success: true,
            message: 'Deposit verified and credited successfully',
            deposit: {
                id: deposit._id,
                referenceId: deposit.referenceId,
                amount: deposit.amount,
                user: {
                    id: user._id,
                    fullName: user.fullName,
                    email: user.email
                },
                newBalance: user.buyingPower
            }
        });
        
    } catch (error) {
        console.error('Admin verification error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Reject deposit
router.post('/deposits/:id/reject', async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        
        if (!reason) {
            return res.status(400).json({ message: 'Rejection reason is required' });
        }
        
        const deposit = await DepositProof.findById(id);
        if (!deposit) {
            return res.status(404).json({ message: 'Deposit request not found' });
        }
        
        if (deposit.status !== 'pending') {
            return res.status(400).json({ 
                message: `Deposit already ${deposit.status}. Cannot reject.` 
            });
        }
        
        deposit.status = 'rejected';
        deposit.adminNotes = reason;
        deposit.rejectedBy = req.user.email;
        deposit.rejectedAt = new Date();
        await deposit.save();
        
        // Update transaction to failed
        await Transaction.findOneAndUpdate(
            { 
                userId: deposit.userId, 
                'metadata.referenceId': deposit.referenceId 
            },
            { 
                status: 'Failed',
                description: `Deposit via ${deposit.method} - Rejected: ${reason} (by ${req.user.email})`
            }
        );
        
        res.json({
            success: true,
            message: 'Deposit rejected',
            deposit: {
                id: deposit._id,
                referenceId: deposit.referenceId,
                amount: deposit.amount,
                status: deposit.status,
                reason: deposit.adminNotes
            }
        });
        
    } catch (error) {
        console.error('Admin rejection error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// routes/admin.js - Keep only these upgrade-related endpoints (admin only)
// Make sure these are AFTER the adminOnly middleware

// GET all upgrade requests (admin only)
router.get('/upgrade-requests', async (req, res) => {
    try {
        const requests = await UpgradeRequest.find().sort({ createdAt: -1 });
        res.json({ requests });
    } catch (error) {
        console.error('Error fetching upgrade requests:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// In admin.js - POST approve upgrade request
router.post('/upgrade-requests/:id/approve', async (req, res) => {
    try {
        const request = await UpgradeRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }
        
        const upgradeCost = request.upgradeCost;
        const isDowngrade = request.isDowngrade;
        const oldTier = request.currentTier; // Fetch from request directly since we didn't load user yet
        
        let user;
        // Process payment only for upgrades (not downgrades)
        if (upgradeCost > 0) {
            // Deduct the upgrade cost atomically
            user = await User.findOneAndUpdate(
                { _id: request.userId, buyingPower: { $gte: upgradeCost } },
                { 
                    $inc: { buyingPower: -upgradeCost, totalPortfolioValue: -upgradeCost },
                    $set: { memberTier: request.requestedTier }
                },
                { new: true }
            );
            
            if (!user) {
                return res.status(400).json({ 
                    message: `User no longer has sufficient funds or concurrent transaction processing. Need $${upgradeCost}`,
                    success: false
                });
            }
        } else {
            // Update user's tier directly
            user = await User.findByIdAndUpdate(
                request.userId,
                { $set: { memberTier: request.requestedTier } },
                { new: true }
            );
            
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
        }
        
        // Update request status
        request.status = 'approved';
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        request.adminNotes = req.body.notes || 'Approved by admin';
        await request.save();
        
        // Create transaction record for the upgrade/downgrade
        if (upgradeCost > 0) {
            await Transaction.create({
                userId: user._id,
                type: 'Upgrade',
                amountUSD: upgradeCost,
                description: `Membership upgrade from ${oldTier} to ${request.requestedTier} - Charged $${upgradeCost}`,
                status: 'Completed',
                metadata: {
                    oldTier: oldTier,
                    newTier: request.requestedTier,
                    approvedBy: req.user.email,
                    approvedAt: new Date(),
                    upgradeRequestId: request._id,
                    isDowngrade: false
                }
            });
        } else if (isDowngrade) {
            // Create a record for downgrade (no charge)
            await Transaction.create({
                userId: user._id,
                type: 'Upgrade',
                amountUSD: 0,
                description: `Membership downgrade from ${oldTier} to ${request.requestedTier} (No refund)`,
                status: 'Completed',
                metadata: {
                    oldTier: oldTier,
                    newTier: request.requestedTier,
                    approvedBy: req.user.email,
                    approvedAt: new Date(),
                    upgradeRequestId: request._id,
                    isDowngrade: true
                }
            });
        }
        
        let message = `User ${user.fullName} ${isDowngrade ? 'downgraded' : 'upgraded'} from ${oldTier} to ${request.requestedTier}.`;
        if (upgradeCost > 0) {
            message += ` Charged $${upgradeCost}. New balance: $${user.buyingPower}`;
        } else if (isDowngrade) {
            message += ` No refund issued.`;
        }
        
        res.json({ 
            success: true, 
            message: message,
            requestedTier: request.requestedTier,
            userEmail: user.email,
            userName: user.fullName,
            oldTier: oldTier,
            newTier: request.requestedTier,
            amountCharged: upgradeCost,
            isDowngrade: isDowngrade,
            newBalance: user.buyingPower
        });
    } catch (error) {
        console.error('Approve upgrade error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// POST reject upgrade request (admin only)
router.post('/upgrade-requests/:id/reject', async (req, res) => {
    try {
        const request = await UpgradeRequest.findById(req.params.id);
        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }
        
        if (request.status !== 'pending') {
            return res.status(400).json({ message: 'Request already processed' });
        }
        
        request.status = 'rejected';
        request.reviewedBy = req.user._id;
        request.reviewedAt = new Date();
        request.rejectionReason = req.body.reason || 'Rejected by admin';
        await request.save();
        
        res.json({ 
            success: true, 
            message: 'Upgrade request rejected',
            reason: request.rejectionReason
        });
    } catch (error) {
        console.error('Reject upgrade error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET upgrade requests statistics (admin only)
router.get('/upgrade-requests/stats', async (req, res) => {
    try {
        const stats = await UpgradeRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        const pendingCount = await UpgradeRequest.countDocuments({ status: 'pending' });
        const approvedCount = await UpgradeRequest.countDocuments({ status: 'approved' });
        const rejectedCount = await UpgradeRequest.countDocuments({ status: 'rejected' });
        
        res.json({
            success: true,
            pending: pendingCount,
            approved: approvedCount,
            rejected: rejectedCount,
            details: stats
        });
    } catch (error) {
        console.error('Upgrade stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;