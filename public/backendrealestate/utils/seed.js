// utils/seed.js
const User = require('../models/User');
const Property = require('../models/Property');
const Transaction = require('../models/Transaction');
const RentalIncome = require('../models/RentalIncome');
const Portfolio = require('../models/Portfolio');

async function seedDatabase() {
    try {
        // Check if data already exists
        const userCount = await User.countDocuments();
        if (userCount > 0) {
            console.log('📊 Database already seeded, skipping...');
            return;
        }
        
        console.log('🌱 Seeding database with real estate portfolio data...');
        
        // Create default user
        const user = await User.create({
            fullName: 'Alexander Hunt',
            email: 'alexander@globalvest.com',
            password: 'password123',
            buyingPower: 50000.00,
            totalPortfolioValue: 140000.00,
            totalRealEstateValue: 45000.00,
            memberTier: 'Pro',
            monthlyRentalIncome: 1240.00,
            totalAppreciation: 3410.00,
            propertyCount: 6
        });
        
        console.log('✅ User created:', user.fullName);
        
        // Create properties
        const properties = await Property.insertMany([
            {
                userId: user._id,
                name: 'The Skyline Residences',
                location: {
                    city: 'Dubai',
                    country: 'UAE',
                    address: 'Dubai Marina'
                },
                type: 'Residential',
                investmentAmount: 12500,
                currentValue: 14200,
                ownershipPercentage: 2.5,
                status: 'Generating Income',
                monthlyRentalIncome: 425,
                rentalYield: 8.2,
                appreciation: 1700,
                purchaseDate: new Date('2023-01-15'),
                lastValuation: new Date('2024-05-01')
            },
            {
                userId: user._id,
                name: 'Oakwood Apartments',
                location: {
                    city: 'London',
                    country: 'UK',
                    address: 'Kensington'
                },
                type: 'Residential',
                investmentAmount: 25000,
                currentValue: 26850,
                ownershipPercentage: 5.0,
                status: 'Generating Income',
                monthlyRentalIncome: 815,
                rentalYield: 7.5,
                appreciation: 1850,
                purchaseDate: new Date('2023-03-20'),
                lastValuation: new Date('2024-05-01')
            },
            {
                userId: user._id,
                name: 'Harbor Tech Center',
                location: {
                    city: 'Singapore',
                    country: 'Singapore',
                    address: 'Central Business District'
                },
                type: 'Commercial',
                investmentAmount: 7500,
                currentValue: 7500,
                ownershipPercentage: 1.2,
                status: 'Under Construction',
                monthlyRentalIncome: 0,
                rentalYield: 0,
                appreciation: 0,
                purchaseDate: new Date('2024-01-10'),
                lastValuation: new Date('2024-01-10')
            }
        ]);
        
        console.log('✅ Properties seeded:', properties.length);
        
        // Create rental income records
        const rentalRecords = [
            {
                userId: user._id,
                propertyId: properties[0]._id,
                propertyName: 'The Skyline Residences',
                amount: 425,
                yieldPercentage: 8.2,
                payoutDate: new Date('2024-05-12'),
                status: 'Paid',
                transactionId: 'RENT-001'
            },
            {
                userId: user._id,
                propertyId: properties[1]._id,
                propertyName: 'Oakwood Apartments',
                amount: 815,
                yieldPercentage: 7.5,
                payoutDate: new Date('2024-05-10'),
                status: 'Paid',
                transactionId: 'RENT-002'
            },
            {
                userId: user._id,
                propertyId: properties[0]._id,
                propertyName: 'The Skyline Residences',
                amount: 412,
                yieldPercentage: 8.1,
                payoutDate: new Date('2024-04-12'),
                status: 'Paid',
                transactionId: 'RENT-003'
            }
        ];
        
        await RentalIncome.insertMany(rentalRecords);
        console.log('✅ Rental records seeded:', rentalRecords.length);
        
        // Create portfolio record
        await Portfolio.create({
            userId: user._id,
            totalValue: user.totalPortfolioValue,
            totalRealEstateValue: user.totalRealEstateValue,
            totalInvested: 45000,
            totalAppreciation: 3410,
            totalRentalIncome: 1652,
            averageYield: 7.8,
            diversification: {
                residential: 65,
                commercial: 25,
                industrial: 10
            },
            monthlyPerformance: [
                { month: 'Jan', value: 38250, rentalIncome: 0 },
                { month: 'Feb', value: 39600, rentalIncome: 0 },
                { month: 'Mar', value: 40950, rentalIncome: 0 },
                { month: 'Apr', value: 42300, rentalIncome: 412 },
                { month: 'May', value: 43650, rentalIncome: 1240 },
                { month: 'Jun', value: 45000, rentalIncome: 0 }
            ]
        });
        
        // Create transactions
        const transactions = [
            {
                userId: user._id,
                propertyId: properties[0]._id,
                type: 'Investment',
                amount: 12500,
                description: 'Invested in The Skyline Residences',
                status: 'Completed',
                date: new Date('2023-01-15')
            },
            {
                userId: user._id,
                propertyId: properties[1]._id,
                type: 'Investment',
                amount: 25000,
                description: 'Invested in Oakwood Apartments',
                status: 'Completed',
                date: new Date('2023-03-20')
            },
            {
                userId: user._id,
                propertyId: properties[2]._id,
                type: 'Investment',
                amount: 7500,
                description: 'Invested in Harbor Tech Center',
                status: 'Completed',
                date: new Date('2024-01-10')
            },
            {
                userId: user._id,
                type: 'Deposit',
                amount: 5000,
                description: 'Initial deposit',
                status: 'Completed',
                date: new Date('2023-01-01')
            },
            {
                userId: user._id,
                propertyId: properties[0]._id,
                type: 'Rental Payout',
                amount: 425,
                description: 'Rental income from The Skyline Residences',
                status: 'Completed',
                date: new Date('2024-05-12')
            }
        ];
        
        await Transaction.insertMany(transactions);
        console.log('✅ Transactions seeded:', transactions.length);
        
        console.log('🎉 Real estate portfolio seeding completed successfully!');
        console.log('📝 Login with: alexander@globalvest.com / password123');
        
    } catch (error) {
        console.error('❌ Seeding error:', error);
    }
}

module.exports = seedDatabase;