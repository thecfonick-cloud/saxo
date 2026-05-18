// models/WatchlistItem.js
const mongoose = require('mongoose');

const watchlistItemSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    changePercent: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        enum: ['Stocks', 'Crypto', 'Indices'],
        default: 'Stocks'
    },
    volume: {
        type: Number,
        default: 0
    },
    marketCap: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('WatchlistItem', watchlistItemSchema);