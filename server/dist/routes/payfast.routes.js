"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payfast_controller_1 = require("../controllers/payfast.controller");
const router = express_1.default.Router();
// Generate payment form for a quote
router.get('/pay', payfast_controller_1.generatePaymentForm);
// Handle payment success return
router.get('/success', payfast_controller_1.handlePaymentSuccess);
// Handle payment cancellation return
router.get('/cancel', payfast_controller_1.handlePaymentCancel);
// Handle PayFast ITN (Instant Transaction Notification)
router.post('/notify', payfast_controller_1.handlePaymentNotification);
exports.default = router;
