// routes/property.js
const express = require('express');
const { protect } = require('../middleware/auth');
const Property = require('../models/Property');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

const router = express.Router();

// Get all properties
router.get('/', protect, async (req, res) => {
    try {
        const properties = await Property.find({ userId: req.user._id, isActive: true })
            .sort({ createdAt: -1 });
        res.json(properties);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Get marketplace properties
router.get('/marketplace', protect, async (req, res) => {
    res.json([
        {
            _id: '607f1f0873e7900000000101',
            title: 'High-Yield London Luxury Suite',
            location: 'Kensington, London, UK',
            image: 'https://images.unsplash.com/photo-1560520653-9e0e4c89eb11?w=800&fit=crop&auto=format',
            price: 850000,
            tokenPrice: 50,
            totalTokens: 17000,
            availableTokens: 8240,
            expectedYield: 8.4,
            monthlyRentalIncome: 5950
        },
        {
            _id: '607f1f0873e7900000000102',
            title: 'Silicon Valley Premium Tech Space',
            location: 'Palo Alto, California, USA',
            image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&fit=crop&auto=format',
            price: 2400000,
            tokenPrice: 100,
            totalTokens: 24000,
            availableTokens: 11950,
            expectedYield: 9.2,
            monthlyRentalIncome: 18400
        },
        {
            _id: '607f1f0873e7900000000103',
            title: 'Metropolitan Dubai Fractional Penthouse',
            location: 'Downtown Dubai, UAE',
            image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&fit=crop&auto=format',
            price: 1500000,
            tokenPrice: 75,
            totalTokens: 20000,
            availableTokens: 16500,
            expectedYield: 7.9,
            monthlyRentalIncome: 9875
        }
    ]);
});

// Get single property
router.get('/:id', protect, async (req, res) => {
    try {
        const property = await Property.findOne({ _id: req.params.id, userId: req.user._id });
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }
        res.json(property);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Invest in new property
router.post('/invest', protect, async (req, res) => {
    try {
        const {
            name,
            location,
            type,
            investmentAmount,
            ownershipPercentage,
            monthlyRentalIncome,
            rentalYield
        } = req.body;
        
        if (!name || !investmentAmount) {
            return res.status(400).json({ message: 'Missing required fields' });
        }
        
        // Check buying power
        if (req.user.buyingPower < investmentAmount) {
            return res.status(400).json({ message: 'Insufficient buying power' });
        }
        
        // Calculate current value (investment + estimated appreciation)
        const currentValue = investmentAmount * 1.05; // 5% initial appreciation
        
        // Create property
        const property = await Property.create({
            userId: req.user._id,
            name,
            location: {
                city: location?.city || 'Unknown',
                country: location?.country || 'Global',
                address: location?.address
            },
            type: type || 'Residential',
            investmentAmount,
            currentValue,
            ownershipPercentage,
            monthlyRentalIncome: monthlyRentalIncome || 0,
            rentalYield: rentalYield || (monthlyRentalIncome ? (monthlyRentalIncome * 12 / investmentAmount * 100) : 0),
            status: 'Generating Income'
        });
        
        // Update user's buying power and portfolio
        req.user.buyingPower -= investmentAmount;
        req.user.totalRealEstateValue += currentValue;
        req.user.totalPortfolioValue = req.user.buyingPower + req.user.totalRealEstateValue;
        req.user.propertyCount += 1;
        req.user.monthlyRentalIncome += (monthlyRentalIncome || 0);
        await req.user.save();
        
        // Create transaction
        await Transaction.create({
            userId: req.user._id,
            propertyId: property._id,
            type: 'Investment',
            amount: investmentAmount,
            description: `Invested in ${name}`,
            status: 'Completed'
        });
        
        res.status(201).json({
            message: 'Investment successful',
            property,
            remainingBuyingPower: req.user.buyingPower
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update property value (for appreciation)
router.put('/:id/update-value', protect, async (req, res) => {
    try {
        const { newValue } = req.body;
        const property = await Property.findOne({ _id: req.params.id, userId: req.user._id });
        
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }
        
        const appreciation = newValue - property.currentValue;
        property.currentValue = newValue;
        property.appreciation = (property.appreciation || 0) + appreciation;
        property.lastValuation = new Date();
        await property.save();
        
        // Update user's total real estate value
        req.user.totalRealEstateValue += appreciation;
        req.user.totalPortfolioValue = req.user.buyingPower + req.user.totalRealEstateValue;
        req.user.totalAppreciation += appreciation;
        await req.user.save();
        
        res.json({
            message: 'Property value updated',
            property,
            appreciation
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;