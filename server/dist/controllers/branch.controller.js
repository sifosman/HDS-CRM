"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBranchByTradingAs = void 0;
const branch_model_1 = __importDefault(require("../models/branch.model"));
// GET /api/branches/by-trading-as/:tradingAs
const getBranchByTradingAs = async (req, res) => {
    try {
        const { tradingAs } = req.params;
        if (!tradingAs) {
            return res.status(400).json({ success: false, message: 'Missing tradingAs parameter' });
        }
        const branch = await branch_model_1.default.findOne({ trading_as: tradingAs });
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }
        return res.json({ success: true, branch });
    }
    catch (error) {
        console.error('Error fetching branch by trading_as:', error);
        return res.status(500).json({ success: false, message: 'Server error', error });
    }
};
exports.getBranchByTradingAs = getBranchByTradingAs;
