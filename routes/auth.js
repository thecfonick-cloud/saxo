// routes/auth.js
const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'virexoncapital_super_secure_fallback_key_9988';
const { protect } = require('../middleware/auth');
const { adminLogin, ADMIN_CREDENTIALS, SUPPORT_ADMIN_CREDENTIALS } = require('../middleware/auth');

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
        
        const token = jwt.sign({ 
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            buyingPower: user.buyingPower,
            totalPortfolioValue: user.totalPortfolioValue
        }, JWT_SECRET, { expiresIn: '30d' });
        
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                buyingPower: user.buyingPower,
                totalPortfolioValue: user.totalPortfolioValue
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
        
        let user = await User.findOne({ email });
        
        // MOCK DB RESILIENCE: If user vanished due to server restart, auto-recreate them!
        if (!user) {
            console.log(`[Mock DB] User ${email} not found, auto-creating fresh account...`);
            user = await User.create({ 
                fullName: email.split('@')[0], 
                email, 
                password,
                buyingPower: 50000,
                totalPortfolioValue: 50000,
                totalRealEstateValue: 0,
                monthlyRentalIncome: 0,
                totalAppreciation: 0,
                propertyCount: 0
            });
        } else if (!(await user.comparePassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }
        
        const token = jwt.sign({ 
            id: user._id,
            email: user.email,
            fullName: user.fullName,
            buyingPower: user.buyingPower,
            totalPortfolioValue: user.totalPortfolioValue
        }, JWT_SECRET, { expiresIn: '30d' });
        
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                buyingPower: user.buyingPower,
                totalPortfolioValue: user.totalPortfolioValue,
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
        memberTier: req.user.memberTier,
        profitLoss30d: req.user.profitLoss30d,
        activeTrades: req.user.activeTrades
    });
});

// Admin login endpoint
router.post('/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = adminLogin(email, password);
        
        if (!result.success) {
            return res.status(401).json({ message: result.error });
        }
        
        // Create a special admin token with isAdmin flag
        const token = jwt.sign(
            { 
                id: 'admin_' + Date.now(),
                email: result.admin.email,
                isAdmin: true,
                adminRole: result.admin.role,
                name: result.admin.name
            }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            token: token,
            admin: {
                email: result.admin.email,
                name: result.admin.name,
                role: result.admin.role
            }
        });
        
    } catch (error) {
        console.error('Admin login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Alternative: Simple admin verification endpoint
router.post('/admin/verify', async (req, res) => {
    try {
        const { email, password, adminKey } = req.body;
        
        // Check if it's the hardcoded admin
        if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
            const token = jwt.sign(
                { 
                    id: 'admin_' + Date.now(),
                    email: ADMIN_CREDENTIALS.email,
                    isAdmin: true,
                    adminRole: 'super_admin',
                    name: ADMIN_CREDENTIALS.name
                },
                JWT_SECRET,
                { expiresIn: '1d' }
            );
            
            return res.json({
                success: true,
                token,
                admin: {
                    email: ADMIN_CREDENTIALS.email,
                    name: ADMIN_CREDENTIALS.name
                }
            });
        }
        
        // Check support admin
        if (email === SUPPORT_ADMIN_CREDENTIALS.email && password === SUPPORT_ADMIN_CREDENTIALS.password) {
            const token = jwt.sign(
                { 
                    id: 'admin_' + Date.now(),
                    email: 'support@virexoncapital.com',
                    isAdmin: true,
                    adminRole: 'support_admin',
                    name: 'Support Admin'
                },
                JWT_SECRET,
                { expiresIn: '1d' }
            );
            
            return res.json({
                success: true,
                token,
                admin: {
                    email: 'support@virexoncapital.com',
                    name: 'Support Admin'
                }
            });
        }
        
        res.status(401).json({ success: false, message: 'Invalid admin credentials' });
        
    } catch (error) {
        console.error('Admin verify error:', error);
        res.status(500).json({ message: 'Server error in admin verify' });
    }
});

// Check if user is admin (using email check)
router.get('/admin/check', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ isAdmin: false });
        }
        
        const decoded = jwt.verify(token, JWT_SECRET);
        const adminEmails = [
            'admin@virexoncapital.com', 'support@virexoncapital.com', 'superadmin@virexoncapital.com',
            'admin@globalvest.com', 'support@globalvest.com'
        ];
        const isAdmin = adminEmails.includes(decoded.email?.toLowerCase());
        
        res.json({
            isAdmin,
            email: decoded.email,
            role: isAdmin ? (decoded.email === 'admin@virexoncapital.com' ? 'super_admin' : 'support_admin') : null
        });
        
    } catch (error) {
        res.status(401).json({ isAdmin: false });
    }
});

module.exports = router;