"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Define the dimension schema
const DimensionSchema = new mongoose_1.default.Schema({
    id: {
        type: String,
        default: () => `dim-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    },
    width: {
        type: Number,
        required: true
    },
    length: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    material: {
        type: String
    },
    description: {
        type: String,
        default: ''
    }
});
// Define the material schema
const MaterialSchema = new mongoose_1.default.Schema({
    id: {
        type: String,
        default: () => `mat-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        default: 'melamine'
    },
    thickness: {
        type: Number,
        default: 16
    }
});
// Define the cutting list schema
const CutlistSchema = new mongoose_1.default.Schema({
    rawText: {
        type: String,
        required: true
    },
    dimensions: [DimensionSchema], // Cut pieces
    stockPieces: [DimensionSchema], // Stock pieces (sheets of material)
    materials: [MaterialSchema], // Materials available
    unit: {
        type: String,
        default: 'mm'
    },
    customerName: {
        type: String,
        default: 'Customer'
    },
    projectName: {
        type: String,
        default: 'Cutting List Project'
    },
    phoneNumber: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});
// Update the updatedAt field on save
CutlistSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
const Cutlist = mongoose_1.default.model('Cutlist', CutlistSchema);
exports.default = Cutlist;
