// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    symbol: {
        type: String,
        uppercase: true,
        default: null,
        required: false
    },
    assetName: {
        type: String,
        default: null,
        required: false
    },
    type: {
        type: String,
        required: true
    },
    quantity: {
        type: String,
        default: null,
        required: false
    },
    amountUSD: {
        type: Number,
        required: true
    },
    pricePerUnit: {
        type: Number,
        default: null
    },
    description: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Completed'
    },
    date: {
        type: String,
        default: () => {
            const now = new Date();
            return now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Add indexes for better query performance
transactionSchema.index({ userId: 1, timestamp: -1 });
transactionSchema.index({ userId: 1, type: 1 });
transactionSchema.index({ userId: 1, symbol: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);