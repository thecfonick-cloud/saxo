// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    buyingPower: {
        type: Number,
        default: 0.00
    },
    totalPortfolioValue: {
        type: Number,
        default: 0.00
    },
    memberTier: {
        type: String,
        enum: ['Standard', 'Pro', 'Elite'],
        default: 'Standard'
    },
    profitLoss30d: {
        type: Number,
        default: 0.0
    },
    activeTrades: {
        type: Number,
        default: 0
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    totalRealEstateValue: {
        type: Number,
        default: 0
    },
    monthlyRentalIncome: {
        type: Number,
        default: 0
    },
    totalAppreciation: {
        type: Number,
        default: 0
    },
    propertyCount: {
        type: Number,
        default: 0
    },
    // Add to User schema
    role: {
        type: String,
        enum: ['user', 'admin', 'support'],
        default: 'user'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);