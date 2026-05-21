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

// Create uploads directory if it doesn't exist (with writeable fallback for serverless read-only filesystems)
let uploadDir = path.join(__dirname, 'uploads/proofs');
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
        console.log('✅ Created uploads directory');
    }
} catch (e) {
    uploadDir = '/tmp/uploads/proofs';
    try {
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        console.log('📂 Configured writeable uploads directory at:', uploadDir);
    } catch (err) {
        console.error('❌ Critical: Could not create writeable uploads directory anywhere:', err.message);
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

// Serve Saxo frontend static files
app.use('/', express.static(path.join(__dirname, 'public')));

app.use(morgan('dev'));

// Serverless Netlify Path Normalization Middleware
app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
        req.url = req.url.replace('/.netlify/functions/api', '/api');
    }
    next();
});

// ── PERSISTENT MOCK STORAGE MANAGER FOR SERVERLESS DEPLOYMENTS ──
let mockModeEnabled = true;

global.MOCK_DB = {
    users: [{
        _id: '507f1f0873e7900000000001',
        fullName: 'SaxoLeaf Admin',
        email: 'admin@saxoleaf.com',
        password: 'hashed_password',
        buyingPower: 50000,
        totalPortfolioValue: 50000,
        memberTier: 'Elite',
        isAdmin: true
    }],
    holdings: [],
    transactions: [],
    watchlist: [],
    upgradeRequests: [],
    depositProofs: [],
    properties: [],
    rentalIncome: []
};

const JSON_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019e44dd-cdd6-76e5-b720-cefcc458309e';

let dbLoadingPromise = null;
let lastDbLoadTime = 0;
const DB_LOAD_CACHE_MS = 2500; // Cache database state for 2.5 seconds to prevent rate-limiting on parallel requests

const ensureDbLoaded = async () => {
    if (!mockModeEnabled) return;

    const now = Date.now();
    // If database was successfully loaded very recently, reuse it
    if (now - lastDbLoadTime < DB_LOAD_CACHE_MS) {
        return;
    }

    // If a request is already loading the database, join that promise
    if (dbLoadingPromise) {
        return dbLoadingPromise;
    }

    dbLoadingPromise = (async () => {
        const nocacheUrl = `${JSON_BLOB_URL}?nocache=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const response = await globalThis.fetch(nocacheUrl);
        if (!response.ok) {
            throw new Error(`Failed to load database from JsonBlob: ${response.statusText} (${response.status})`);
        }
        const savedDb = await response.json();
        if (savedDb && Array.isArray(savedDb.users) && savedDb.users.length > 0) {
            global.MOCK_DB = {
                users: savedDb.users || [],
                holdings: savedDb.holdings || [],
                transactions: savedDb.transactions || [],
                watchlist: savedDb.watchlist || [],
                upgradeRequests: savedDb.upgradeRequests || [],
                depositProofs: savedDb.depositProofs || [],
                properties: savedDb.properties || [],
                rentalIncome: savedDb.rentalIncome || [],
                ...savedDb
            };
            lastDbLoadTime = Date.now();
        } else {
            throw new Error('Database fetched from JsonBlob is invalid or empty');
        }
    })().finally(() => {
        dbLoadingPromise = null;
    });

    return dbLoadingPromise;
};

// Middleware to block request resolution until local database load is complete
app.use(async (req, res, next) => {
    // Only load database for actual API endpoints, not static assets like HTML/JS/CSS/images
    const isApiRequest = req.url.startsWith('/api') || req.url.startsWith('/.netlify/functions/api');
    if (!isApiRequest) {
        return next();
    }
    
    try {
        await ensureDbLoaded();
        next();
    } catch (err) {
        console.error('Database connection error in middleware:', err);
        res.status(503).json({ 
            message: 'Database is temporarily unavailable. Please refresh or try again in a few seconds.',
            error: err.message 
        });
    }
});

// Helper for atomic database updates across serverless instances
const modifyDb = async (fn) => {
    try {
        // Directly modify the in-memory DB 
        fn(global.MOCK_DB);
        
        if (global.disableBlobSync) {
            return;
        }
        
        await globalThis.fetch(JSON_BLOB_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(global.MOCK_DB)
        });
        console.log('💾 DB updated and persisted to JsonBlob.');
    } catch (e) {
        console.error('Failed to modify and persist DB:', e);
        fn(global.MOCK_DB);
    }
};

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
    let blobsWorking = false;
    let blobsError = null;
    try {
        const store = getBlobStoreLazy();
        blobsWorking = store !== null;
    } catch (e) {
        blobsError = e.message;
    }
    res.json({ 
        status: 'OK', 
        message: 'SaxoInvestment API is running', 
        timestamp: new Date(),
        blobsWorking,
        blobsError,
        dbMode: mockModeEnabled ? 'mock' : 'mongodb'
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

// Connect to MongoDB with In-Memory fallback for local development/testing
mongoose.set('bufferCommands', false);
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 500 // Ultra-fast timeout to fallback to mock mode instantly
})
.then(() => {
    console.log('✅ MongoDB Connected Successfully');
    const seedDatabase = require('./utils/seed');
    seedDatabase();
})
.catch(err => {
    console.warn('⚠️ Cloud MongoDB Connection Failed. Enabling In-Memory Mock Storage Mode for LEAF PRO SSO...');
    mockModeEnabled = true;

    // Override mongoose connection state to prevent route crashes
    mongoose.connection.readyState = 1; 

    const makeMockModel = (ModelClass, collectionName, defaultProps = {}) => {
        // Setup collection in mock db if not already present
        if (!global.MOCK_DB[collectionName]) {
            global.MOCK_DB[collectionName] = [];
        }

        // Custom query chain builder
        const mockQueryChain = (result) => {
            const promise = Promise.resolve(result);
            const methods = ['select', 'populate', 'sort', 'limit', 'skip', 'exec'];
            methods.forEach(method => {
                promise[method] = function() { return this; };
            });
            return promise;
        };

        // Helper to wrap raw object into a genuine ModelClass instance with mocked save
        const wrapInstance = (obj) => {
            if (!obj) return null;
            
            // Construct a genuine document instance
            const instance = new ModelClass(obj);
            
            // Manually populate fields in mock mode
            if (collectionName === 'depositProofs' || collectionName === 'upgradeRequests' || collectionName === 'transactions') {
                const userIdVal = obj.userId || obj.user;
                if (userIdVal && (!userIdVal.fullName || !userIdVal.email)) {
                    const userIdStr = (userIdVal && typeof userIdVal === 'object') ? (userIdVal._id || userIdVal.id || userIdVal).toString() : userIdVal.toString();
                    const userObj = global.MOCK_DB.users.find(u => u._id?.toString() === userIdStr);
                    if (userObj) {
                        instance.userId = userObj;
                        instance.user = userObj;
                    }
                }
            }
            
            // Add custom save method to intercept DB calls
            instance.save = async function() {
                const plain = this.toObject ? this.toObject() : JSON.parse(JSON.stringify(this));
                if (plain.userId && typeof plain.userId === 'object') {
                    plain.userId = plain.userId._id || plain.userId.id;
                }
                if (plain.user && typeof plain.user === 'object') {
                    plain.user = plain.user._id || plain.user.id;
                }
                await modifyDb(db => {
                    const idx = db[collectionName].findIndex(item => item._id?.toString() === plain._id?.toString());
                    if (idx >= 0) {
                        db[collectionName][idx] = plain;
                    } else {
                        db[collectionName].push(plain);
                    }
                });
                return this;
            };

            // Add custom deleteOne to intercept DB calls
            instance.deleteOne = async function() {
                const plain = this.toObject ? this.toObject() : JSON.parse(JSON.stringify(this));
                if (plain.userId && typeof plain.userId === 'object') {
                    plain.userId = plain.userId._id || plain.userId.id;
                }
                if (plain.user && typeof plain.user === 'object') {
                    plain.user = plain.user._id || plain.user.id;
                }
                await modifyDb(db => {
                    const idx = db[collectionName].findIndex(item => item._id?.toString() === plain._id?.toString());
                    if (idx >= 0) {
                        db[collectionName].splice(idx, 1);
                    }
                });
                return { deletedCount: 1 };
            };

            // Add User specific comparePassword if it's User model
            if (collectionName === 'users') {
                instance.comparePassword = async function(candidate) {
                    return true; // Auto-pass for local simulation
                };
            }

            return instance;
        };

        // Monkey-patch static methods
        ModelClass.find = function(query) {
            let results = global.MOCK_DB[collectionName];
            if (query) {
                results = results.filter(item => {
                    let matches = true;
                    for (const key of Object.keys(query)) {
                        if (key === 'userId' || key === 'user') {
                            const targetUserId = (query[key] && typeof query[key] === 'object') ? (query[key]._id || query[key].id || query[key]).toString() : query[key].toString();
                            const itemUserId = item.userId || item.user;
                            const itemUserIdStr = (itemUserId && typeof itemUserId === 'object') ? (itemUserId._id || itemUserId.id || itemUserId).toString() : itemUserId?.toString();
                            matches = matches && (itemUserIdStr === targetUserId);
                        } else if (key === '_id' || key === 'id') {
                            const idVal = query[key];
                            const targetId = (idVal && typeof idVal === 'object') ? (idVal._id || idVal.id || idVal).toString() : idVal.toString();
                            matches = matches && (item._id?.toString() === targetId);
                        } else {
                            // Support dot notation like metadata.status
                            let itemVal = item;
                            const parts = key.split('.');
                            for (const part of parts) {
                                itemVal = itemVal ? itemVal[part] : undefined;
                            }
                            matches = matches && (itemVal === query[key]);
                        }
                    }
                    return matches;
                });
            }
            return mockQueryChain(results.map(wrapInstance));
        };

        ModelClass.findOne = function(query) {
            let results = global.MOCK_DB[collectionName];
            if (query) {
                results = results.filter(item => {
                    let matches = true;
                    for (const key of Object.keys(query)) {
                        if (key === 'userId' || key === 'user') {
                            const targetUserId = (query[key] && typeof query[key] === 'object') ? (query[key]._id || query[key].id || query[key]).toString() : query[key].toString();
                            const itemUserId = item.userId || item.user;
                            const itemUserIdStr = (itemUserId && typeof itemUserId === 'object') ? (itemUserId._id || itemUserId.id || itemUserId).toString() : itemUserId?.toString();
                            matches = matches && (itemUserIdStr === targetUserId);
                        } else if (key === '_id' || key === 'id') {
                            const idVal = query[key];
                            const targetId = (idVal && typeof idVal === 'object') ? (idVal._id || idVal.id || idVal).toString() : idVal.toString();
                            matches = matches && (item._id?.toString() === targetId);
                        } else {
                            // Support dot notation like metadata.status
                            let itemVal = item;
                            const parts = key.split('.');
                            for (const part of parts) {
                                itemVal = itemVal ? itemVal[part] : undefined;
                            }
                            matches = matches && (itemVal === query[key]);
                        }
                    }
                    return matches;
                });
            }
            const result = results.length > 0 ? results[0] : null;
            return mockQueryChain(result ? wrapInstance(result) : null);
        };

        ModelClass.findById = function(id) {
            const targetId = (id && typeof id === 'object') ? (id._id || id.id || id).toString() : id?.toString();
            const found = global.MOCK_DB[collectionName].find(item => item._id?.toString() === targetId);
            return mockQueryChain(wrapInstance(found || null));
        };

        ModelClass.create = async function(data) {
            const newObj = {
                _id: new mongoose.Types.ObjectId().toString(),
                createdAt: new Date(),
                ...defaultProps,
                ...data
            };
            const instance = wrapInstance(newObj);
            await instance.save();
            return instance;
        };

        ModelClass.countDocuments = function(query) {
            const results = global.MOCK_DB[collectionName];
            return mockQueryChain(results.length);
        };

        ModelClass.insertMany = async function(arr) {
            const results = [];
            for (const item of arr) {
                const res = await ModelClass.create(item);
                results.push(res);
            }
            return results;
        };

        ModelClass.deleteMany = async function(query) {
            await modifyDb(db => {
                db[collectionName] = [];
            });
            return { deletedCount: 0 };
        };

        ModelClass.deleteOne = async function(query) {
            await modifyDb(db => {
                const idx = db[collectionName].findIndex(item => {
                    let matches = true;
                    if (query) {
                        if (query._id) matches = matches && (item._id?.toString() === query._id.toString());
                        if (query.userId) matches = matches && ((item.userId || item.user)?.toString() === query.userId.toString());
                        if (query.symbol) matches = matches && (item.symbol === query.symbol);
                    }
                    return matches;
                });
                if (idx >= 0) {
                    db[collectionName].splice(idx, 1);
                }
            });
            return { deletedCount: 1 };
        };

        ModelClass.updateMany = async function(query, update) {
            const fields = update.$set || update;
            await modifyDb(db => {
                db[collectionName].forEach(item => {
                    let matches = true;
                    if (query && query.symbol) {
                        matches = matches && (item.symbol === query.symbol);
                    }
                    if (matches) {
                        Object.keys(fields).forEach(key => {
                            item[key] = fields[key];
                        });
                    }
                });
            });
            return { matchedCount: 0, modifiedCount: 0 };
        };

        ModelClass.findOneAndUpdate = async function(query, update, options) {
            const setFields = update.$set || update;
            const incFields = update.$inc || {};
            let result = null;
            await modifyDb(db => {
                let found = db[collectionName].find(item => {
                    let matches = true;
                    if (query) {
                        if (query.symbol) matches = matches && (item.symbol === query.symbol);
                        if (query.userId) matches = matches && ((item.userId || item.user)?.toString() === query.userId.toString());
                        if (query._id) matches = matches && (item._id?.toString() === query._id.toString());
                    }
                    return matches;
                });
                if (!found && options && options.upsert) {
                    found = { _id: new mongoose.Types.ObjectId().toString(), ...query };
                    db[collectionName].push(found);
                }
                if (found) {
                    Object.keys(setFields).forEach(key => {
                        if (key !== '$inc') found[key] = setFields[key];
                    });
                    Object.keys(incFields).forEach(key => {
                        found[key] = (found[key] || 0) + incFields[key];
                    });
                    result = JSON.parse(JSON.stringify(found));
                }
            });
            return wrapInstance(result);
        };

        ModelClass.findByIdAndUpdate = async function(id, update, options) {
            const setFields = update.$set || update;
            const incFields = update.$inc || {};
            let result = null;
            await modifyDb(db => {
                let found = db[collectionName].find(item => item._id?.toString() === id?.toString());
                if (found) {
                    Object.keys(setFields).forEach(key => {
                        if (key !== '$inc') found[key] = setFields[key];
                    });
                    Object.keys(incFields).forEach(key => {
                        found[key] = (found[key] || 0) + incFields[key];
                    });
                    result = JSON.parse(JSON.stringify(found));
                }
            });
            return wrapInstance(result);
        };

        ModelClass.aggregate = async function(pipeline) {
            let results = global.MOCK_DB[collectionName] || [];
            
            for (const stage of pipeline) {
                if (stage.$match) {
                    const matchObj = stage.$match;
                    results = results.filter(item => {
                        for (const key of Object.keys(matchObj)) {
                            let matchVal = matchObj[key];
                            if (matchVal && typeof matchVal === 'object' && matchVal._id) {
                                matchVal = matchVal._id.toString();
                            }
                            
                            let itemVal = item[key];
                            if (itemVal && typeof itemVal === 'object' && itemVal._id) {
                                itemVal = itemVal._id.toString();
                            }
                            
                            if (key === 'createdAt') {
                                if (matchVal && matchVal.$gte) {
                                    if (new Date(item.createdAt) < new Date(matchVal.$gte)) return false;
                                }
                            } else if (key === 'status' && matchVal && matchVal.$in) {
                                if (!matchVal.$in.includes(itemVal)) return false;
                            } else if (itemVal?.toString() !== matchVal?.toString()) {
                                return false;
                            }
                        }
                        return true;
                    });
                } else if (stage.$group) {
                    const groupObj = stage.$group;
                    const idField = groupObj._id;
                    
                    const groups = {};
                    results.forEach(item => {
                        let keyVal = null;
                        if (typeof idField === 'string' && idField.startsWith('$')) {
                            const fieldName = idField.substring(1);
                            keyVal = item[fieldName];
                        }
                        
                        const keyStr = keyVal === null || keyVal === undefined ? 'null' : keyVal.toString();
                        if (!groups[keyStr]) {
                            groups[keyStr] = {
                                _id: keyVal,
                                count: 0,
                                totalAmount: 0,
                                total: 0
                            };
                        }
                        
                        groups[keyStr].count += 1;
                        
                        Object.keys(groupObj).forEach(resKey => {
                            if (resKey !== '_id') {
                                const aggOp = groupObj[resKey];
                                if (aggOp && aggOp.$sum) {
                                    const sumField = aggOp.$sum;
                                    let val = 0;
                                    if (typeof sumField === 'string' && sumField.startsWith('$')) {
                                        const fieldName = sumField.substring(1);
                                        let valRaw = item[fieldName];
                                        if (valRaw === undefined && fieldName === 'amount') {
                                            valRaw = item['amountUSD'];
                                        }
                                        val = parseFloat(valRaw) || 0;
                                    } else if (typeof sumField === 'number') {
                                        val = sumField;
                                    }
                                    groups[keyStr][resKey] = (groups[keyStr][resKey] || 0) + val;
                                }
                            }
                        });
                    });
                    
                    results = Object.values(groups);
                }
            }
            return results;
        };

        ModelClass.prototype.save = async function() {
            if (!this._id) {
                this._id = new mongoose.Types.ObjectId().toString();
            }
            const plain = this.toObject ? this.toObject() : JSON.parse(JSON.stringify(this));
            await modifyDb(db => {
                const idx = db[collectionName].findIndex(item => item._id?.toString() === plain._id?.toString());
                if (idx >= 0) {
                    db[collectionName][idx] = plain;
                } else {
                    db[collectionName].push(plain);
                }
            });
            return this;
        };
    };

    // Monkey-patch all imported Mongoose Models
    makeMockModel(require('./models/User'), 'users', {
        buyingPower: 0,
        totalPortfolioValue: 0,
        memberTier: 'Standard'
    });
    makeMockModel(require('./models/Holding'), 'holdings');
    makeMockModel(require('./models/Transaction'), 'transactions');
    makeMockModel(require('./models/DepositProof'), 'depositProofs');
    makeMockModel(require('./models/UpgradeRequest'), 'upgradeRequests');
    makeMockModel(require('./models/WatchlistItem'), 'watchlist');
    makeMockModel(require('./models/Property'), 'properties');
    makeMockModel(require('./models/RentalIncome'), 'rentalIncome');

    // Seed mock database with default user and baseline holdings for offline simulation
    // Removed unconditional seed that wiped the database on lambda cold starts.
});

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📍 http://localhost:${PORT}`);
        console.log(`📁 Uploads directory: ${uploadDir}`);
    });
}

module.exports = app;
