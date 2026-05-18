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
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    buyingPower: {
        type: Number,
        default: 50000.00
    },
    totalPortfolioValue: {
        type: Number,
        default: 45000.00
    },
    totalRealEstateValue: {
        type: Number,
        default: 45000.00
    },
    memberTier: {
        type: String,
        enum: ['Standard', 'Pro', 'Elite'],
        default: 'Pro'
    },
    monthlyRentalIncome: {
        type: Number,
        default: 1240.00
    },
    totalAppreciation: {
        type: Number,
        default: 3410.00
    },
    propertyCount: {
        type: Number,
        default: 6
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);