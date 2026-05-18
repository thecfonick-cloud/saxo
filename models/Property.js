// models/Property.js
const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    location: {
        city: String,
        country: String,
        address: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    type: {
        type: String,
        enum: ['Residential', 'Commercial', 'Industrial', 'Mixed-Use'],
        required: true
    },
    investmentAmount: {
        type: Number,
        required: true
    },
    currentValue: {
        type: Number,
        required: true
    },
    ownershipPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    status: {
        type: String,
        enum: ['Generating Income', 'Under Construction', 'Renovation', 'Pending Sale'],
        default: 'Generating Income'
    },
    rentalYield: {
        type: Number,
        default: 0
    },
    monthlyRentalIncome: {
        type: Number,
        default: 0
    },
    appreciation: {
        type: Number,
        default: 0
    },
    images: [{
        type: String,
        url: String,
        caption: String
    }],
    documents: [{
        name: String,
        url: String,
        type: String
    }],
    purchaseDate: {
        type: Date,
        default: Date.now
    },
    lastValuation: {
        type: Date,
        default: Date.now
    },
    tags: [String],
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Property', propertySchema);