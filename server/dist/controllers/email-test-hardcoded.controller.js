"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.quickTestEmail = exports.testPaymentEmailHardcoded = void 0;
const email_service_1 = require("../services/email.service");
/**
 * Test endpoint with hardcoded email for sifosman@gmail.com
 */
const testPaymentEmailHardcoded = async (req, res) => {
    try {
        const { quoteNumber, amount, invoicePath } = req.body;
        if (!quoteNumber || !amount) {
            res.status(400).json({
                success: false,
                message: 'Missing required fields: quoteNumber, amount'
            });
            return;
        }
        // Hardcoded test email
        const customerEmail = 'sifosman@gmail.com';
        const emailService = new email_service_1.EmailService();
        // Send payment confirmation email to hardcoded email
        await emailService.sendPaymentConfirmationEmail({
            customerName: 'Test Customer',
            customerEmail,
            quoteNumber,
            amount: parseFloat(amount),
            invoicePath: invoicePath || './test-invoice.pdf',
            optimizationDetails: {
                totalBoards: 5,
                totalLength: 2400,
                wastage: 8.5,
                cutlistUrl: 'https://example.com/cutlist'
            }
        });
        res.json({
            success: true,
            message: 'Test email sent successfully to sifosman@gmail.com',
            details: {
                recipient: customerEmail,
                quoteNumber,
                amount: parseFloat(amount)
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Unknown error occurred'
        });
    }
};
exports.testPaymentEmailHardcoded = testPaymentEmailHardcoded;
/**
 * Quick test endpoint - just send a test email
 */
const quickTestEmail = async (req, res) => {
    try {
        const emailService = new email_service_1.EmailService();
        await emailService.sendPaymentConfirmationEmail({
            customerName: 'Quick Test Customer',
            customerEmail: 'sifosman@gmail.com',
            quoteNumber: 'QT-001',
            amount: 100.00,
            invoicePath: './test-invoice.pdf',
            optimizationDetails: {
                totalBoards: 3,
                totalLength: 1200,
                wastage: 5.2,
                cutlistUrl: 'https://example.com/quicktest'
            }
        });
        res.json({
            success: true,
            message: 'Quick test email sent successfully to sifosman@gmail.com'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error.message || 'Unknown error occurred'
        });
    }
};
exports.quickTestEmail = quickTestEmail;
