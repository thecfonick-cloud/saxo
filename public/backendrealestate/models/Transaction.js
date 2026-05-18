// models/Transaction.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property'
    },
    type: {
        type: String,
        enum: ['Investment', 'Withdrawal', 'Rental Payout', 'Dividend', 'Deposit'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Completed'
    },
    date: {
        type: Date,
        default: Date.now
    },
    reference: String
});

module.exports = mongoose.model('Transaction', transactionSchema);