"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testPaymentEmail = exports.testEmailConnection = void 0;
const email_service_1 = require("../services/email.service");
/**
 * Test email service connection
 */
const testEmailConnection = async (req, res) => {
    try {
        const emailService = new email_service_1.EmailService();
        const isConnected = await emailService.testConnection();
        res.json({
            success: true,
            connected: isConnected,
            message: isConnected ? 'Email service is properly configured' : 'Email service configuration issue'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Unknown error occurred'
        });
    }
};
exports.testEmailConnection = testEmailConnection;
/**
 * Test sending a payment confirmation email
 */
const testPaymentEmail = async (req, res) => {
    try {
        const { customerName, customerEmail, quoteNumber, amount, invoicePath, optimizationDetails } = req.body;
        if (!customerEmail || !quoteNumber || !amount) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields: customerEmail, quoteNumber, amount'
            });
            return;
        }
        const emailService = new email_service_1.EmailService();
        await emailService.sendPaymentConfirmationEmail({
            customerName: customerName || 'Test Customer',
            customerEmail,
            quoteNumber,
            amount: parseFloat(amount),
            invoicePdfUrl: invoicePath || './test-invoice.pdf',
            cutlistPdfUrl: './test-cutlist.pdf',
            optimizationDetails: optimizationDetails || {
                totalBoards: 5,
                totalLength: 2400,
                wastage: 8.5,
                cutlistUrl: 'https://example.com/cutlist'
            }
        });
        res.json({
            success: true,
            message: 'Test email sent successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Unknown error occurred'
        });
    }
};
exports.testPaymentEmail = testPaymentEmail;
