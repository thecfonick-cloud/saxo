// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', [
    body('fullName').notEmpty().trim().withMessage('Full name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const { fullName, email, password } = req.body;
        
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ message: 'User already exists' });
        }
        
        const user = await User.create({ fullName, email, password });
        
        // Create initial portfolio
        await Portfolio.create({
            userId: user._id,
            totalValue: user.totalPortfolioValue,
            totalRealEstateValue: user.totalRealEstateValue,
            totalInvested: user.totalRealEstateValue,
            totalRentalIncome: 0,
            averageYield: 7.8
        });
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                buyingPower: user.buyingPower,
                totalPortfolioValue: user.totalPortfolioValue,
                totalRealEstateValue: user.totalRealEstateValue
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login
router.post('/login', [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    
    try {
        const { email, password } = req.body;
        
        const user = await User.findOne({ email });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                buyingPower: user.buyingPower,
                totalPortfolioValue: user.totalPortfolioValue,
                totalRealEstateValue: user.totalRealEstateValue,
                monthlyRentalIncome: user.monthlyRentalIncome,
                totalAppreciation: user.totalAppreciation,
                propertyCount: user.propertyCount,
                memberTier: user.memberTier
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get current user
router.get('/me', protect, async (req, res) => {
    res.json({
        id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email,
        buyingPower: req.user.buyingPower,
        totalPortfolioValue: req.user.totalPortfolioValue,
        totalRealEstateValue: req.user.totalRealEstateValue,
        monthlyRentalIncome: req.user.monthlyRentalIncome,
        totalAppreciation: req.user.totalAppreciation,
        propertyCount: req.user.propertyCount,
        memberTier: req.user.memberTier
    });
});

module.exports = router;