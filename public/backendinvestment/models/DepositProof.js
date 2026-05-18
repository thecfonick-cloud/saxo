// models/DepositProof.js
const mongoose = require('mongoose');

const depositProofSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referenceId: {
        type: String,
        required: true,
        unique: true
    },
    amount: {
        type: Number,
        required: true
    },
    method: {
        type: String,
        enum: ['Bank Transfer', 'Credit/Debit Card', 'Wire Transfer', 'Crypto'],
        default: 'Bank Transfer'
    },
    proofImageUrl: {
        type: String
    },
    transactionId: {
        type: String
    },
    notes: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'verified', 'credited', 'rejected'],
        default: 'pending'
    },
    adminNotes: {
        type: String
    },
    verifiedBy: {
        type: String
    },
    verifiedAt: {
        type: Date
    },
    creditedAt: {
        type: Date
    },
    rejectedBy: {
        type: String
    },
    rejectedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('DepositProof', depositProofSchema);