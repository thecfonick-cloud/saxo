const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const https = require('https');

const JSON_BLOB_URL = 'https://jsonblob.com/api/jsonBlob/019e5101-793f-7f9e-90c2-4cef02c8536e';

global.MOCK_DB = {
    users: [{
        _id: '507f1f0873e7900000000001',
        fullName: 'VirexonCapital Admin',
        email: 'admin@virexoncapital.com',
        password: 'adminpassword123',
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

let dbLoadingPromise = null;
let lastDbLoadTime = 0;
const DB_LOAD_CACHE_MS = 2500;

// Safe HTTPS request helper for environment safety (handles raw http/https or fetch)
async function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        
        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                } else {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Invalid JSON response'));
                    }
                }
            });
        });
        
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

const ensureDbLoaded = async () => {
    const now = Date.now();
    if (now - lastDbLoadTime < DB_LOAD_CACHE_MS) {
        return;
    }

    if (dbLoadingPromise) {
        return dbLoadingPromise;
    }

    dbLoadingPromise = (async () => {
        let lastError = null;
        const maxAttempts = 3;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const nocacheUrl = `${JSON_BLOB_URL}?nocache=${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const savedDb = await fetchJson(nocacheUrl);
                if (savedDb && Array.isArray(savedDb.users)) {
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
                    return;
                } else {
                    throw new Error('Fetched database structure is invalid');
                }
            } catch (err) {
                lastError = err;
                console.warn(`⚠️ [Mock DB] Attempt ${attempt}/${maxAttempts} failed: ${err.message}`);
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 250));
                }
            }
        }
        console.error('❌ Critical: Failed to load database from JsonBlob. Using local state.', lastError);
    })().finally(() => {
        dbLoadingPromise = null;
    });

    return dbLoadingPromise;
};

const modifyDb = async (fn) => {
    try {
        fn(global.MOCK_DB);
        
        await fetchJson(JSON_BLOB_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(global.MOCK_DB)
        });
        console.log('💾 DB successfully updated on JsonBlob.');
    } catch (e) {
        console.error('Failed to sync database modifications to JsonBlob:', e);
        fn(global.MOCK_DB);
    }
};

const initMockDB = () => {
    console.log('🚀 Initializing persistent JsonBlob Mock DB Fallback layer...');
    
    // Override mongoose states
    mongoose.connection.readyState = 1;
    mongoose.set('bufferCommands', false);

    const makeMockModel = (ModelClass, collectionName, defaultProps = {}) => {
        if (!global.MOCK_DB[collectionName]) {
            global.MOCK_DB[collectionName] = [];
        }

        const mockQueryChain = (result) => {
            const promise = Promise.resolve(result);
            const methods = ['select', 'populate', 'sort', 'limit', 'skip', 'exec'];
            methods.forEach(method => {
                promise[method] = function() { return this; };
            });
            return promise;
        };

        const wrapInstance = (obj) => {
            if (!obj) return null;
            
            const instance = new ModelClass(obj);
            
            // Populate relations
            if (['depositProofs', 'upgradeRequests', 'transactions'].includes(collectionName)) {
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
            
            instance.save = async function() {
                if (!this._id) {
                    this._id = new mongoose.Types.ObjectId().toString();
                }
                const plain = this.toObject ? this.toObject() : JSON.parse(JSON.stringify(this));
                
                // Hash password if this is a user and has password modified/set
                if (collectionName === 'users' && plain.password && !plain.password.startsWith('$2a$') && !plain.password.startsWith('$2b$')) {
                    plain.password = await bcrypt.hash(plain.password, 12);
                    this.password = plain.password;
                }

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

            instance.deleteOne = async function() {
                const plain = this.toObject ? this.toObject() : JSON.parse(JSON.stringify(this));
                await modifyDb(db => {
                    const idx = db[collectionName].findIndex(item => item._id?.toString() === plain._id?.toString());
                    if (idx >= 0) {
                        db[collectionName].splice(idx, 1);
                    }
                });
                return { deletedCount: 1 };
            };

            if (collectionName === 'users') {
                instance.comparePassword = async function(candidate) {
                    try {
                        return await bcrypt.compare(candidate, this.password);
                    } catch (e) {
                        return candidate === this.password;
                    }
                };
            }

            return instance;
        };

        // Monkey-patch queries
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

        ModelClass.countDocuments = function() {
            const results = global.MOCK_DB[collectionName];
            return mockQueryChain(results.length);
        };

        ModelClass.create = async function(doc) {
            const list = Array.isArray(doc) ? doc : [doc];
            const created = [];
            for (const item of list) {
                const copy = { _id: new mongoose.Types.ObjectId().toString(), ...defaultProps, ...item };
                
                // Hash password if this is a user
                if (collectionName === 'users' && copy.password && !copy.password.startsWith('$2a$') && !copy.password.startsWith('$2b$')) {
                    copy.password = await bcrypt.hash(copy.password, 12);
                }

                await modifyDb(db => {
                    db[collectionName].push(copy);
                });
                created.push(wrapInstance(copy));
            }
            return Array.isArray(doc) ? created : created[0];
        };

        ModelClass.deleteOne = async function(query) {
            await modifyDb(db => {
                const idx = db[collectionName].findIndex(item => {
                    let matches = true;
                    if (query && query._id) matches = matches && (item._id?.toString() === query._id.toString());
                    return matches;
                });
                if (idx >= 0) {
                    db[collectionName].splice(idx, 1);
                }
            });
            return { deletedCount: 1 };
        };

        ModelClass.deleteMany = async function(query) {
            await modifyDb(db => {
                if (!query || Object.keys(query).length === 0) {
                    db[collectionName] = [];
                } else {
                    db[collectionName] = db[collectionName].filter(item => {
                        let matches = true;
                        if (query.userId) matches = matches && ((item.userId || item.user)?.toString() === query.userId.toString());
                        return !matches;
                    });
                }
            });
            return { deletedCount: 0 };
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
    };

    // Monkey-patch all imported Mongoose Models
    makeMockModel(require('../models/User'), 'users', {
        buyingPower: 50000,
        totalPortfolioValue: 50000,
        memberTier: 'Standard',
        totalRealEstateValue: 0,
        monthlyRentalIncome: 0,
        totalAppreciation: 0,
        propertyCount: 0
    });
    makeMockModel(require('../models/Holding'), 'holdings');
    makeMockModel(require('../models/Transaction'), 'transactions');
    makeMockModel(require('../models/DepositProof'), 'depositProofs');
    makeMockModel(require('../models/UpgradeRequest'), 'upgradeRequests');
    makeMockModel(require('../models/WatchlistItem'), 'watchlist');
    makeMockModel(require('../models/Property'), 'properties');
    makeMockModel(require('../models/RentalIncome'), 'rentalIncome');
};

module.exports = { initMockDB, ensureDbLoaded };
