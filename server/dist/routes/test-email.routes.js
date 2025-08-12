"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const test_email_controller_1 = require("../controllers/test-email.controller");
const router = (0, express_1.Router)();
// Test endpoint to send payment confirmation email
router.get('/send-payment-email', test_email_controller_1.sendTestPaymentEmail);
exports.default = router;
