// reset-db.js
const mongoose = require('mongoose');
require('dotenv').config();

const Transaction = require('./models/Transaction');
const User = require('./models/User');
const Holding = require('./models/Holding');
const WatchlistItem = require('./models/WatchlistItem');

async function resetDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');
        
        // Drop collections to recreate with new schemas
        await Transaction.collection.drop().catch(() => console.log('No transactions to drop'));
        await Holding.collection.drop().catch(() => console.log('No holdings to drop'));
        
        console.log('Database reset complete. Transactions and holdings collections recreated.');
        console.log('Restart your server to continue.');
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

resetDatabase();