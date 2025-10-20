"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const email_test_hardcoded_controller_1 = require("../controllers/email-test-hardcoded.controller");
const router = express_1.default.Router();
// Test endpoint with hardcoded email for sifosman@gmail.com
router.post('/test-payment-email-hardcoded', (req, res) => (0, email_test_hardcoded_controller_1.testPaymentEmailHardcoded)(req, res));
// Quick test endpoint - just send a test email
router.get('/quick-test', (req, res) => (0, email_test_hardcoded_controller_1.quickTestEmail)(req, res));
exports.default = router;
