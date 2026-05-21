// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'virexonleaf_super_secure_fallback_key_9988';

const protect = async (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if this is an admin token (has isAdmin flag and no valid MongoDB ID)
        if (decoded.isAdmin === true) {
            // This is an admin login, create a virtual admin user
            req.user = {
                id: decoded.id,
                email: decoded.email,
                isAdmin: true,
                adminRole: decoded.adminRole,
                fullName: decoded.email === 'admin@virexoncapital.com' ? 'Super Admin' : 'Support Admin'
            };
            return next();
        }
        
        // Regular user - find in database
        let user = await User.findById(decoded.id).select('-password');
        
        // AUTO-RECREATE USER ON MOCK SERVER RESTART (Stateless Resilience)
        if (!user && decoded.email) {
            user = await User.create({
                _id: decoded.id,
                email: decoded.email,
                fullName: decoded.fullName || 'Re-synced User',
                password: 'recreated_mock_password',
                buyingPower: decoded.buyingPower || 0,
                totalPortfolioValue: decoded.totalPortfolioValue || 0,
                memberTier: 'Standard'
            });
        }
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

// Admin only middleware
const adminOnly = async (req, res, next) => {
    try {
        // First check if user is authenticated
        if (!req.user) {
            return res.status(401).json({ message: 'Not authenticated' });
        }
        
        // Check if user has admin flag (from JWT or database)
        if (req.user.isAdmin === true) {
            return next();
        }
        
        // Check hardcoded admin emails for database users
        const adminEmails = [
            'admin@virexoncapital.com',
            'support@virexoncapital.com',
            'superadmin@virexoncapital.com',
            'admin@virexonleaf.com',
            'support@virexonleaf.com',
            'admin@globalvest.com',
            'support@globalvest.com'
        ];
        
        // Check if user's email is in admin list
        if (req.user.email && adminEmails.includes(req.user.email.toLowerCase())) {
            req.user.isAdmin = true;
            return next();
        }
        
        console.log(`Access denied for ${req.user.email || req.user.id} - Not an admin`);
        return res.status(403).json({ 
            message: 'Access denied. Admin privileges required.',
            yourEmail: req.user.email || 'unknown'
        });
        
    } catch (error) {
        console.error('Admin middleware error:', error);
        res.status(500).json({ message: 'Server error in admin authorization' });
    }
};

// Hardcoded admin credentials
const ADMIN_CREDENTIALS = {
    email: 'admin@virexonleaf.com',
    password: 'virexonleafinvestment',
    name: 'Super Admin'
};

const SUPPORT_ADMIN_CREDENTIALS = {
    email: 'support@virexonleaf.com',
    password: 'virexonleafinvestment',
    name: 'Support Admin'
};

// Admin login function
const adminLogin = (email, password) => {
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        return {
            success: true,
            admin: {
                email: ADMIN_CREDENTIALS.email,
                name: ADMIN_CREDENTIALS.name,
                role: 'super_admin'
            }
        };
    }
    
    if (email === SUPPORT_ADMIN_CREDENTIALS.email && password === SUPPORT_ADMIN_CREDENTIALS.password) {
        return {
            success: true,
            admin: {
                email: SUPPORT_ADMIN_CREDENTIALS.email,
                name: SUPPORT_ADMIN_CREDENTIALS.name,
                role: 'support_admin'
            }
        };
    }
    
    return { success: false, error: 'Invalid admin credentials' };
};

module.exports = { protect, adminOnly, adminLogin, ADMIN_CREDENTIALS };