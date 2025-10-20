"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotsailorSyncLog = exports.BotsailorStockPiece = exports.BotsailorMaterial = exports.BotsailorConnection = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Schema for Botsailor connection settings
const BotsailorConnectionSchema = new mongoose_1.Schema({
    apiUrl: { type: String, required: true },
    apiKey: { type: String, required: true },
    isConnected: { type: Boolean, default: false },
    lastSyncTime: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Schema for Botsailor material
const BotsailorMaterialSchema = new mongoose_1.Schema({
    externalId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, required: true },
    thickness: { type: Number, required: true },
    properties: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Schema for Botsailor stock piece
const BotsailorStockPieceSchema = new mongoose_1.Schema({
    externalId: { type: String, required: true, unique: true },
    materialId: { type: String, required: true },
    width: { type: Number, required: true },
    length: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    properties: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Schema for Botsailor sync log
const BotsailorSyncLogSchema = new mongoose_1.Schema({
    direction: { type: String, enum: ['push', 'pull'], required: true },
    entityType: { type: String, enum: ['project', 'material', 'stock', 'cutlist'], required: true },
    entityId: { type: String, required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    message: { type: String },
    details: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now }
});
// Create and export models
exports.BotsailorConnection = mongoose_1.default.model('BotsailorConnection', BotsailorConnectionSchema);
exports.BotsailorMaterial = mongoose_1.default.model('BotsailorMaterial', BotsailorMaterialSchema);
exports.BotsailorStockPiece = mongoose_1.default.model('BotsailorStockPiece', BotsailorStockPieceSchema);
exports.BotsailorSyncLog = mongoose_1.default.model('BotsailorSyncLog', BotsailorSyncLogSchema);
