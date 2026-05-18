// models/RentalIncome.js
const mongoose = require('mongoose');

const rentalIncomeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Property',
        required: true
    },
    propertyName: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    yieldPercentage: {
        type: Number,
        required: true
    },
    payoutDate: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Paid'
    },
    transactionId: {
        type: String,
        unique: true
    },
    notes: String
}, {
    timestamps: true
});

module.exports = mongoose.model('RentalIncome', rentalIncomeSchema);