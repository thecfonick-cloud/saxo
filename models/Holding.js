// models/Holding.js
const mongoose = require('mongoose');

const holdingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    assetName: {
        type: String,
        required: true
    },
    shares: {
        type: Number,
        required: true
    },
    averagePrice: {
        type: Number,
        required: true
    },
    currentPrice: {
        type: Number,
        required: true
    },
    isMarginTrade: {
        type: Boolean,
        default: false
    },
    positionType: {
        type: String,
        enum: ['Long', 'Short'],
        required: false
    },
    marginCost: {
        type: Number,
        required: false
    }
});

module.exports = mongoose.model('Holding', holdingSchema);