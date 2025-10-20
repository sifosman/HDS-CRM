"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webhook_direct_controller_1 = require("../controllers/webhook-direct.controller");
const router = express_1.default.Router();
// Test the webhook directly
router.get('/test', webhook_direct_controller_1.webhookDirectController.testWebhook);
// Process n8n data directly
router.post('/n8n-direct', webhook_direct_controller_1.webhookDirectController.processN8n);
exports.default = router;
