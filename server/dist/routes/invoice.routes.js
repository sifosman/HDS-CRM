"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const invoice_controller_1 = require("../controllers/invoice.controller");
const router = express_1.default.Router();
// Download invoice PDF for a quote
router.get('/download/:quoteId', invoice_controller_1.downloadInvoice);
// Create invoice from payment (used by PayFast ITN handler)
router.post('/create-from-payment', invoice_controller_1.createInvoiceFromPayment);
exports.default = router;
