// routes/rental.js
const express = require('express');
const { protect } = require('../middleware/auth');
const RentalIncome = require('../models/RentalIncome');
const Property = require('../models/Property');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Get rental history
router.get('/history', protect, async (req, res) => {
    try {
        const rentals = await RentalIncome.find({ userId: req.user._id })
            .sort({ payoutDate: -1 })
            .limit(10);
        res.json(rentals);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Record rental payout (admin/automated)
router.post('/record', protect, async (req, res) => {
    try {
        const { propertyId, amount, payoutDate, notes } = req.body;
        
        const property = await Property.findOne({ _id: propertyId, userId: req.user._id });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }
        
        const yieldPercentage = (amount / property.currentValue * 100).toFixed(1);
        
        const rental = await RentalIncome.create({
            userId: req.user._id,
            propertyId,
            propertyName: property.name,
            amount,
            yieldPercentage,
            payoutDate: new Date(payoutDate),
            notes,
            transactionId: `RENT-${Date.now()}`
        });
        
        // Update user's monthly rental income (average), buying power, and portfolio value
        const allRentals = await RentalIncome.find({ userId: req.user._id });
        const avgMonthly = allRentals.reduce((sum, r) => sum + r.amount, 0) / Math.min(3, allRentals.length);
        req.user.monthlyRentalIncome = avgMonthly || 0;
        req.user.buyingPower = (req.user.buyingPower || 0) + amount;
        req.user.totalPortfolioValue = (req.user.totalPortfolioValue || 0) + amount;
        await req.user.save();
        
        // Create transaction record
        await Transaction.create({
            userId: req.user._id,
            propertyId,
            type: 'Rental Payout',
            amount,
            description: `Rental income from ${property.name}`,
            status: 'Completed'
        });
        
        res.status(201).json({
            message: 'Rental payout recorded',
            rental
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get distribution summary
router.get('/distribution', protect, async (req, res) => {
    try {
        const rentals = await RentalIncome.find({ userId: req.user._id })
            .sort({ payoutDate: -1 });
        
        const byProperty = {};
        rentals.forEach(rental => {
            if (!byProperty[rental.propertyName]) {
                byProperty[rental.propertyName] = {
                    total: 0,
                    count: 0,
                    averageYield: 0
                };
            }
            byProperty[rental.propertyName].total += rental.amount;
            byProperty[rental.propertyName].count += 1;
        });
        
        Object.keys(byProperty).forEach(key => {
            byProperty[key].averageYield = (byProperty[key].total / byProperty[key].count / 100).toFixed(1);
        });
        
        res.json({
            recentPayments: rentals.slice(0, 5),
            byProperty,
            totalYearToDate: rentals.reduce((sum, r) => sum + r.amount, 0)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;