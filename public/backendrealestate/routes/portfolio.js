// routes/portfolio.js
const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Property = require('../models/Property');
const Portfolio = require('../models/Portfolio');
const RentalIncome = require('../models/RentalIncome');

const router = express.Router();

// Get portfolio summary
router.get('/summary', protect, async (req, res) => {
    try {
        const properties = await Property.find({ userId: req.user._id, isActive: true });
        
        const totalValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
        const totalInvested = properties.reduce((sum, p) => sum + p.investmentAmount, 0);
        const totalAppreciation = totalValue - totalInvested;
        
        // Calculate diversification
        const residentialValue = properties.filter(p => p.type === 'Residential').reduce((sum, p) => sum + p.currentValue, 0);
        const commercialValue = properties.filter(p => p.type === 'Commercial').reduce((sum, p) => sum + p.currentValue, 0);
        const industrialValue = properties.filter(p => p.type === 'Industrial').reduce((sum, p) => sum + p.currentValue, 0);
        
        const total = residentialValue + commercialValue + industrialValue;
        const diversification = {
            residential: total > 0 ? (residentialValue / total * 100).toFixed(1) : 65,
            commercial: total > 0 ? (commercialValue / total * 100).toFixed(1) : 25,
            industrial: total > 0 ? (industrialValue / total * 100).toFixed(1) : 10
        };
        
        // Get recent rental income
        const recentRentals = await RentalIncome.find({ userId: req.user._id })
            .sort({ payoutDate: -1 })
            .limit(3);
        
        res.json({
            totalRealEstateValue: totalValue,
            totalInvested: totalInvested,
            totalAppreciation: totalAppreciation,
            monthlyRentalIncome: req.user.monthlyRentalIncome,
            propertyCount: properties.length,
            diversification: diversification,
            recentRentals: recentRentals.map(r => ({
                payoutDate: r.payoutDate,
                propertyName: r.propertyName,
                amount: r.amount,
                yieldPercentage: r.yieldPercentage
            })),
            growthData: [
                { month: 'Jan', value: totalValue * 0.85 },
                { month: 'Feb', value: totalValue * 0.88 },
                { month: 'Mar', value: totalValue * 0.91 },
                { month: 'Apr', value: totalValue * 0.94 },
                { month: 'May', value: totalValue * 0.97 },
                { month: 'Jun', value: totalValue }
            ]
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get KPI metrics
router.get('/kpis', protect, async (req, res) => {
    try {
        const properties = await Property.find({ userId: req.user._id });
        
        const totalREValue = properties.reduce((sum, p) => sum + p.currentValue, 0);
        const totalMonthlyRental = properties.reduce((sum, p) => sum + (p.monthlyRentalIncome || 0), 0);
        const totalAppreciation = properties.reduce((sum, p) => sum + (p.appreciation || 0), 0);
        
        res.json({
            totalREValue,
            monthlyRentalIncome: totalMonthlyRental,
            totalAppreciation,
            propertyCount: properties.length,
            portfolioAllocation: (totalREValue / req.user.totalPortfolioValue * 100).toFixed(1),
            averageYield: (totalMonthlyRental / totalREValue * 12 * 100).toFixed(1)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;