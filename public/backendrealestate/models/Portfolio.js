// models/Portfolio.js
const mongoose = require('mongoose');

const portfolioSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    totalValue: {
        type: Number,
        default: 0
    },
    totalRealEstateValue: {
        type: Number,
        default: 0
    },
    totalInvested: {
        type: Number,
        default: 0
    },
    totalAppreciation: {
        type: Number,
        default: 0
    },
    totalRentalIncome: {
        type: Number,
        default: 0
    },
    averageYield: {
        type: Number,
        default: 0
    },
    diversification: {
        residential: { type: Number, default: 65 },
        commercial: { type: Number, default: 25 },
        industrial: { type: Number, default: 10 }
    },
    monthlyPerformance: [{
        month: String,
        value: Number,
        rentalIncome: Number
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Portfolio', portfolioSchema);