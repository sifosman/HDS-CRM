"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const payfast_controller_1 = require("../controllers/payfast.controller");
const router = express_1.default.Router();
// Generate payment form for a quote
router.get('/pay', (req, res) => (0, payfast_controller_1.generatePaymentForm)(req, res));
// Handle payment success return
router.get('/success', (req, res) => (0, payfast_controller_1.handlePaymentSuccess)(req, res));
// Handle payment cancellation return
router.get('/cancel', (req, res) => (0, payfast_controller_1.handlePaymentCancel)(req, res));
// Handle PayFast ITN (Instant Transaction Notification)
router.post('/notify', (req, res) => (0, payfast_controller_1.handlePaymentNotification)(req, res));
exports.default = router;
