const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const DepositProof = require('../models/DepositProof');
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const UpgradeRequest = require('../models/UpgradeRequest');

const router = express.Router();

// Ensure upload directory exists (with writeable fallback for serverless read-only filesystems)
const isServerless = process.env.VERCEL || process.env.NOW_REGION || process.env.LAMBDA_TASK_ROOT;
let uploadDir;
if (isServerless) {
    uploadDir = '/tmp/uploads/proofs';
} else {
    uploadDir = path.join(__dirname, '../uploads/proofs');
}
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (e) {
    uploadDir = '/tmp/uploads/proofs';
    try {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
    } catch (err) {
        console.error('❌ Critical: Could not create writeable uploads directory anywhere in user routes:', err.message);
    }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function(req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'proof-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images and PDF files are allowed'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Get user profile
router.get('/profile', protect, async (req, res) => {
    try {
        res.json({
            id: req.user._id,
            fullName: req.user.fullName,
            email: req.user.email,
            buyingPower: req.user.buyingPower,
            totalPortfolioValue: req.user.totalPortfolioValue,
            totalRealEstateValue: req.user.totalRealEstateValue || 0,
            monthlyRentalIncome: req.user.monthlyRentalIncome || 0,
            totalAppreciation: req.user.totalAppreciation || 0,
            propertyCount: req.user.propertyCount || 0,
            memberTier: req.user.memberTier
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Deposit funds (direct - for instant deposits)
router.post('/deposit', protect, async (req, res) => {
    try {
        const { amount, method = 'Bank Transfer' } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid deposit amount' });
        }

        if (amount > 100000) {
            return res.status(400).json({ message: 'Deposit amount exceeds the maximum limit of $100,000' });
        }
        
        // Add funds to user's buying power atomically
        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { buyingPower: amount, totalPortfolioValue: amount } },
            { new: true }
        );
        
        // Create deposit transaction
        const transaction = await Transaction.create({
            userId: req.user._id,
            type: 'Deposit',
            amountUSD: amount,
            description: `Deposit via ${method}`,
            status: 'Completed',
            metadata: {
                method: method,
                depositType: 'wallet_funding'
            }
        });
        
        res.json({
            message: 'Deposit successful',
            buyingPower: updatedUser.buyingPower,
            totalPortfolioValue: updatedUser.totalPortfolioValue,
            transaction: transaction
        });
    } catch (error) {
        console.error('Deposit error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Submit deposit proof for verification
router.post('/deposit-proof', protect, upload.single('proofImage'), async (req, res) => {
    try {
        const { amount, method, referenceId, transactionId, notes } = req.body;
        
        // Validate required fields
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid deposit amount' });
        }

        if (parseFloat(amount) > 100000) {
            return res.status(400).json({ message: 'Deposit amount exceeds the maximum limit of $100,000' });
        }
        
        if (!referenceId) {
            return res.status(400).json({ message: 'Reference ID is required' });
        }
        
        if (!method) {
            return res.status(400).json({ message: 'Payment method is required' });
        }
        
        // Check if proof already exists
        const existingProof = await DepositProof.findOne({ referenceId });
        if (existingProof) {
            return res.status(400).json({ message: 'This deposit request already exists' });
        }
        
        let proofImageUrl = null;
        if (req.file) {
            try {
                const fs = require('fs');
                const fileData = fs.readFileSync(req.file.path);
                const base64Data = fileData.toString('base64');
                proofImageUrl = `data:${req.file.mimetype};base64,${base64Data}`;
            } catch (err) {
                console.error('Error converting file to base64:', err);
                proofImageUrl = `/uploads/proofs/${req.file.filename}`;
            }
        }

        // Create deposit proof record
        const depositProof = await DepositProof.create({
            userId: req.user._id,
            amount: parseFloat(amount),
            method,
            referenceId,
            transactionId: transactionId || '',
            proofImageUrl: proofImageUrl,
            notes: notes || '',
            status: 'pending'
        });
        
        // Create a pending transaction record
        const pendingTransaction = await Transaction.create({
            userId: req.user._id,
            type: 'Deposit',
            amountUSD: parseFloat(amount),
            description: `Deposit via ${method} - Pending verification (Ref: ${referenceId})`,
            status: 'Pending',
            metadata: {
                method: method,
                referenceId: referenceId,
                depositProofId: depositProof._id,
                pending: true,
                submittedAt: new Date()
            }
        });
        
        res.status(201).json({
            message: 'Deposit proof submitted successfully. Funds will be credited after verification.',
            depositRequest: {
                id: depositProof._id,
                referenceId: depositProof.referenceId,
                amount: depositProof.amount,
                method: depositProof.method,
                status: depositProof.status,
                createdAt: depositProof.createdAt
            },
            transaction: pendingTransaction
        });
        
    } catch (error) {
        console.error('Deposit proof submission error:', error);
        
        // Clean up uploaded file if there was an error
        if (req.file) {
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Error deleting file:', err);
            });
        }
        
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get user's deposit requests
router.get('/deposit-requests', protect, async (req, res) => {
    try {
        const { status, limit = 20, skip = 0 } = req.query;
        
        let query = { userId: req.user._id };
        if (status && status !== 'all') {
            query.status = status;
        }
        
        const deposits = await DepositProof.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));
        
        const total = await DepositProof.countDocuments(query);
        
        res.json({
            deposits,
            total,
            hasMore: skip + deposits.length < total
        });
    } catch (error) {
        console.error('Error fetching deposit requests:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get specific deposit request
router.get('/deposit-request/:id', protect, async (req, res) => {
    try {
        const deposit = await DepositProof.findOne({ 
            _id: req.params.id, 
            userId: req.user._id 
        });
        
        if (!deposit) {
            return res.status(404).json({ message: 'Deposit request not found' });
        }
        
        res.json(deposit);
    } catch (error) {
        console.error('Error fetching deposit request:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create withdrawal request (pending admin approval)
router.post('/withdraw-request', protect, async (req, res) => {
    try {
        const { amount, method, methodName, withdrawalDetails } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid withdrawal amount' });
        }
        
        // Check if user has sufficient funds
        if (req.user.buyingPower < amount) {
            return res.status(400).json({ 
                message: 'Insufficient funds',
                available: req.user.buyingPower,
                requested: amount
            });
        }
        
        // Check daily withdrawal limit
        const dailyLimit = 50000;
        if (amount > dailyLimit) {
            return res.status(400).json({ 
                message: `Daily withdrawal limit is $${dailyLimit.toLocaleString()}. Please contact support for larger withdrawals.`,
                limit: dailyLimit
            });
        }
        
        // Create pending withdrawal transaction (funds are held until admin approves)
        const transaction = await Transaction.create({
            userId: req.user._id,
            type: 'Withdrawal',
            amountUSD: amount,
            description: `Withdrawal request to ${methodName} - Pending admin approval`,
            status: 'Pending',
            metadata: {
                method: method,
                methodName: methodName,
                withdrawalDetails: withdrawalDetails,
                requestedAt: new Date(),
                status: 'pending_review'
            }
        });
        
        // Don't deduct funds yet - only deduct when admin approves
        // This ensures users don't lose money if request is rejected
        
        res.json({
            message: 'Withdrawal request submitted successfully. Admin will review and process your request.',
            transactionId: transaction._id,
            status: 'pending',
            estimatedProcessingTime: method === 'crypto' ? '24 hours' : (method === 'wire' ? '2-5 business days' : '1-3 business days')
        });
        
    } catch (error) {
        console.error('Withdrawal request error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Admin: Get all pending withdrawal requests
router.get('/admin/withdrawal-requests', protect, adminOnly, async (req, res) => {
    try {
        
        const pendingWithdrawals = await Transaction.find({
            type: 'Withdrawal',
            status: 'Pending',
            'metadata.status': 'pending_review'
        }).populate('userId', 'fullName email buyingPower').sort({ createdAt: -1 });
        
        res.json({
            success: true,
            withdrawals: pendingWithdrawals
        });
    } catch (error) {
        console.error('Error fetching withdrawal requests:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin: Approve withdrawal request
router.post('/admin/withdraw-request/:id/approve', protect, adminOnly, async (req, res) => {
    try {
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        
        if (transaction.status !== 'Pending') {
            return res.status(400).json({ message: 'Transaction already processed' });
        }
        
        // Deduct funds from user atomically
        const user = await User.findOneAndUpdate(
            { _id: transaction.userId, buyingPower: { $gte: transaction.amountUSD } },
            { $inc: { buyingPower: -transaction.amountUSD, totalPortfolioValue: -transaction.amountUSD } },
            { new: true }
        );
        
        if (!user) {
            return res.status(400).json({ message: 'Insufficient user funds or concurrent transaction' });
        }
        
        // Update transaction status
        transaction.status = 'Completed';
        transaction.description = `Withdrawal to ${transaction.metadata.methodName} - Approved by admin`;
        transaction.metadata.approvedBy = req.user.email;
        transaction.metadata.approvedAt = new Date();
        transaction.metadata.status = 'approved';
        await transaction.save();
        
        res.json({
            success: true,
            message: 'Withdrawal approved and processed',
            transaction: transaction
        });
        
    } catch (error) {
        console.error('Error approving withdrawal:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Admin: Reject withdrawal request
router.post('/admin/withdraw-request/:id/reject', protect, adminOnly, async (req, res) => {
    try {
        const { reason } = req.body;
        
        const transaction = await Transaction.findById(req.params.id);
        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }
        
        if (transaction.status !== 'Pending') {
            return res.status(400).json({ message: 'Transaction already processed' });
        }
        
        // Update transaction status
        transaction.status = 'Failed';
        transaction.description = `Withdrawal request rejected: ${reason || 'No reason provided'}`;
        transaction.metadata.rejectedBy = req.user.email;
        transaction.metadata.rejectedAt = new Date();
        transaction.metadata.rejectionReason = reason;
        transaction.metadata.status = 'rejected';
        await transaction.save();
        
        res.json({
            success: true,
            message: 'Withdrawal request rejected',
            transaction: transaction
        });
        
    } catch (error) {
        console.error('Error rejecting withdrawal:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get wallet balance and limits
router.get('/wallet', protect, async (req, res) => {
    try {
        const dailyLimit = 50000;
        
        // Get today's withdrawals for limit checking
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayWithdrawals = await Transaction.find({
            userId: req.user._id,
            type: 'Withdrawal',
            timestamp: { $gte: today },
            status: 'Completed'
        });
        
        const todayTotal = todayWithdrawals.reduce((sum, t) => sum + t.amountUSD, 0);
        const remainingDaily = Math.max(0, dailyLimit - todayTotal);
        
        // Get pending deposit proofs
        const pendingDeposits = await DepositProof.find({
            userId: req.user._id,
            status: 'pending'
        });
        
        // Get recent transactions for quick view
        const recentTransactions = await Transaction.find({ userId: req.user._id })
            .sort({ timestamp: -1 })
            .limit(5);
        
        res.json({
            buyingPower: req.user.buyingPower,
            totalPortfolioValue: req.user.totalPortfolioValue,
            limits: {
                daily: dailyLimit,
                remainingDaily: remainingDaily,
                usedToday: todayTotal
            },
            pendingDeposits: pendingDeposits.map(d => ({
                id: d._id,
                amount: d.amount,
                referenceId: d.referenceId,
                status: d.status,
                createdAt: d.createdAt
            })),
            recentTransactions: recentTransactions
        });
    } catch (error) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get transaction history
router.get('/transactions', protect, async (req, res) => {
    try {
        const { limit = 20, skip = 0, type } = req.query;
        
        let query = { userId: req.user._id };
        if (type && type !== 'all') {
            query.type = type;
        }
        
        const transactions = await Transaction.find(query)
            .sort({ timestamp: -1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));
        
        const total = await Transaction.countDocuments(query);
        
        res.json({
            transactions,
            total,
            hasMore: skip + transactions.length < total
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add these endpoints to your routes/user.js file

// Search user by email (for transfer)
router.get('/search-user', protect, async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }
        
        // Don't return the user themselves
        if (email === req.user.email) {
            return res.status(400).json({ message: 'You cannot send money to yourself' });
        }
        
        const user = await User.findOne({ email: email.toLowerCase() }).select('fullName email');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        res.json({
            success: true,
            user: {
                fullName: user.fullName,
                email: user.email
            }
        });
    } catch (error) {
        console.error('Search user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Send money to another user
router.post('/send-money', protect, async (req, res) => {
    try {
        const { recipientEmail, amount, note = '' } = req.body;
        
        if (!recipientEmail || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid recipient or amount' });
        }
        
        // Check if sending to self
        if (recipientEmail.toLowerCase() === req.user.email.toLowerCase()) {
            return res.status(400).json({ message: 'You cannot send money to yourself' });
        }
        
        // Find recipient
        const recipient = await User.findOne({ email: recipientEmail.toLowerCase() });
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient user not found' });
        }
        
        // Check if sender has sufficient funds
        if (req.user.buyingPower < amount) {
            return res.status(400).json({ 
                message: 'Insufficient funds',
                available: req.user.buyingPower,
                requested: amount
            });
        }
        
        // Deduct from sender atomically
        const updatedSender = await User.findOneAndUpdate(
            { _id: req.user._id, buyingPower: { $gte: amount } },
            { $inc: { buyingPower: -amount, totalPortfolioValue: -amount } },
            { new: true }
        );
        
        if (!updatedSender) {
            return res.status(400).json({ 
                message: 'Insufficient funds or concurrent transaction' 
            });
        }
        
        // Add to recipient atomically
        await User.findByIdAndUpdate(recipient._id, {
            $inc: { buyingPower: amount, totalPortfolioValue: amount }
        });
        
        // Create transaction record for sender (debit)
        const senderTransaction = await Transaction.create({
            userId: req.user._id,
            type: 'Transfer',
            amountUSD: amount,
            description: `Sent money to ${recipient.fullName} (${recipient.email})${note ? ` - Note: ${note}` : ''}`,
            status: 'Completed',
            metadata: {
                transferType: 'outgoing',
                recipientId: recipient._id,
                recipientEmail: recipient.email,
                recipientName: recipient.fullName,
                note: note
            }
        });
        
        // Create transaction record for recipient (credit)
        const recipientTransaction = await Transaction.create({
            userId: recipient._id,
            type: 'Transfer',
            amountUSD: amount,
            description: `Received money from ${req.user.fullName} (${req.user.email})${note ? ` - Note: ${note}` : ''}`,
            status: 'Completed',
            metadata: {
                transferType: 'incoming',
                senderId: req.user._id,
                senderEmail: req.user.email,
                senderName: req.user.fullName,
                note: note
            }
        });
        
        res.json({
            success: true,
            message: `Successfully sent $${amount.toLocaleString()} to ${recipient.fullName}`,
            newBalance: updatedSender.buyingPower,
            transaction: {
                id: senderTransaction._id,
                amount: amount,
                recipient: recipient.fullName,
                recipientEmail: recipient.email,
                note: note,
                timestamp: senderTransaction.createdAt
            }
        });
        
    } catch (error) {
        console.error('Send money error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Get transfer history
router.get('/transfer-history', protect, async (req, res) => {
    try {
        const { limit = 20, skip = 0 } = req.query;
        
        const transfers = await Transaction.find({
            userId: req.user._id,
            type: 'Transfer'
        }).sort({ createdAt: -1 }).limit(parseInt(limit)).skip(parseInt(skip));
        
        const total = await Transaction.countDocuments({
            userId: req.user._id,
            type: 'Transfer'
        });
        
        res.json({
            success: true,
            transfers,
            total,
            hasMore: skip + transfers.length < total
        });
    } catch (error) {
        console.error('Transfer history error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// In your upgrade routes file
router.post('/upgrade-request', protect, async (req, res) => {
    try {
        const { requestedTier, reason } = req.body;
        const currentTier = req.user.memberTier || 'Standard';
        
        // Validate requested tier
        const validTiers = ['Standard', 'Pro', 'Elite'];
        if (!validTiers.includes(requestedTier)) {
            return res.status(400).json({ message: 'Invalid tier requested' });
        }
        
        // Check if user already has a pending request
        const existingRequest = await UpgradeRequest.findOne({
            userId: req.user._id,
            status: 'pending'
        });
        
        if (existingRequest) {
            return res.status(400).json({ 
                message: 'You already have a pending upgrade request. Please wait for it to be processed.' 
            });
        }
        
        // Check if user is trying to upgrade to the same tier
        if (currentTier === requestedTier) {
            return res.status(400).json({ message: 'You are already on this tier' });
        }
        
        // Define pricing
        const pricing = {
            'Standard': 0,
            'Pro': 49,
            'Elite': 149
        };
        
        const currentPrice = pricing[currentTier] || 0;
        const requestedPrice = pricing[requestedTier] || 0;
        
        // Calculate upgrade cost (only charge for moving to higher tier)
        let upgradeCost = 0;
        let isDowngrade = false;
        
        if (requestedPrice > currentPrice) {
            // UPGRADE to higher tier - charge the difference
            upgradeCost = requestedPrice - currentPrice;
            isDowngrade = false;
        } else if (requestedPrice < currentPrice) {
            // DOWNGRADE to lower tier - no charge (no refunds)
            upgradeCost = 0;
            isDowngrade = true;
        }
        
        // For upgrades, check if user has sufficient funds
        if (upgradeCost > 0 && req.user.buyingPower < upgradeCost) {
            return res.status(400).json({ 
                message: `Insufficient funds for upgrade. Need $${upgradeCost} but you have $${req.user.buyingPower}. Please deposit funds first.`,
                required: upgradeCost,
                available: req.user.buyingPower
            });
        }
        
        // For downgrades, warn the user (optional)
        if (isDowngrade) {
            // You can add a warning here but still allow the downgrade
            console.log(`User ${req.user.email} is downgrading from ${currentTier} to ${requestedTier} (no charge)`);
        }
        
        const upgradeRequest = await UpgradeRequest.create({
            userId: req.user._id,
            userEmail: req.user.email,
            userName: req.user.fullName,
            currentTier: currentTier,
            requestedTier: requestedTier,
            upgradeCost: upgradeCost,
            isDowngrade: isDowngrade,
            reason: reason || '',
            status: 'pending'
        });
        
        let responseMessage = `Upgrade request submitted successfully.`;
        if (upgradeCost > 0) {
            responseMessage += ` Amount to be charged: $${upgradeCost}.`;
        } else if (isDowngrade) {
            responseMessage += ` This is a downgrade. No refund will be issued.`;
        } else {
            responseMessage += ` No payment required.`;
        }
        
        res.json({
            success: true,
            message: responseMessage,
            requestId: upgradeRequest._id,
            upgradeCost: upgradeCost,
            isDowngrade: isDowngrade
        });
    } catch (error) {
        console.error('Upgrade request error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// Admin: Get all pending upgrade requests
router.get('/admin/upgrade-requests', protect, adminOnly, async (req, res) => {
  try {
    const pending = await UpgradeRequest.find({ status: 'pending' }).populate('userId', 'fullName email buyingPower');
    res.json({ success: true, requests: pending });
  } catch (error) {
    console.error('Error fetching upgrade requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Approve an upgrade request
router.post('/admin/upgrade-requests/:id/approve', protect, adminOnly, async (req, res) => {
  try {
    const upgradeReq = await UpgradeRequest.findById(req.params.id);
    if (!upgradeReq) {
      return res.status(404).json({ message: 'Upgrade request not found' });
    }
    if (upgradeReq.status !== 'pending') {
      return res.status(400).json({ message: 'Upgrade request already processed' });
    }
    
    let user;
    if (upgradeReq.upgradeCost > 0) {
      // Deduct upgrade cost atomically
      user = await User.findOneAndUpdate(
        { _id: upgradeReq.userId, buyingPower: { $gte: upgradeReq.upgradeCost } },
        { 
          $inc: { buyingPower: -upgradeReq.upgradeCost, totalPortfolioValue: -upgradeReq.upgradeCost },
          $set: { memberTier: upgradeReq.requestedTier }
        },
        { new: true }
      );
      if (!user) {
        return res.status(400).json({ message: 'User has insufficient funds for upgrade or concurrent transaction' });
      }
    } else {
      // Just update tier
      user = await User.findByIdAndUpdate(
        upgradeReq.userId,
        { $set: { memberTier: upgradeReq.requestedTier } },
        { new: true }
      );
    }
    
    // Update upgrade request status
    upgradeReq.status = 'approved';
    upgradeReq.reviewedBy = req.user._id;
    upgradeReq.reviewedAt = new Date();
    await upgradeReq.save();
    
    // Record transaction for the upgrade charge (if any)
    if (upgradeReq.upgradeCost > 0) {
      await Transaction.create({
        userId: user._id,
        type: 'Upgrade',
        amountUSD: upgradeReq.upgradeCost,
        description: `Upgrade to ${upgradeReq.requestedTier}`,
        status: 'Completed',
        metadata: { upgradeRequestId: upgradeReq._id }
      });
    }
    res.json({ success: true, message: 'Upgrade approved and applied', userTier: user.memberTier });
  } catch (error) {
    console.error('Error approving upgrade request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;