// models/UpgradeRequest.js
const mongoose = require('mongoose');

const upgradeRequestSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    userEmail: {
        type: String,
        required: true
    },
    userName: {
        type: String,
        required: true
    },
    currentTier: {
        type: String,
        enum: ['Standard', 'Pro', 'Elite'],
        required: true
    },
    requestedTier: {
        type: String,
        enum: ['Standard', 'Pro', 'Elite'],
        required: true
    },
    upgradeCost: {
        type: Number,
        required: true,
        default: 0
    },
    isDowngrade: {
        type: Boolean,
        default: false
    },
    reason: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: Date,
    rejectionReason: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('UpgradeRequest', upgradeRequestSchema);