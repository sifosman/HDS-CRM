"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const email_test_controller_1 = require("../controllers/email-test.controller");
const router = express_1.default.Router();
// Test email service connection
router.get('/test-email-connection', (req, res) => (0, email_test_controller_1.testEmailConnection)(req, res));
// Test sending a payment confirmation email
router.post('/test-payment-email', (req, res) => (0, email_test_controller_1.testPaymentEmail)(req, res));
exports.default = router;
