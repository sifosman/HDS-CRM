import express from 'express';
import { EmailService } from '../services/email.service';
import { Request, Response } from 'express';

const router = express.Router();

// Test endpoint with hardcoded email for sifosman@gmail.com
router.post('/test-payment-email-hardcoded', async (req: Request, res: Response) => {
  try {
    const { quoteNumber, amount, invoicePath } = req.body;

    if (!quoteNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: quoteNumber, amount'
      });
    }

    const emailService = new EmailService();
    
    // Hardcoded email for testing
    const customerEmail = 'sifosman@gmail.com';
    const customerName = 'Test Customer';
    
    await emailService.sendPaymentConfirmationEmail({
      customerName,
      customerEmail,
      quoteNumber,
      amount: parseFloat(amount),
      invoicePath: invoicePath || './test-invoice.pdf',
      optimizationDetails: {
        totalBoards: 8,
        totalLength: 2400,
        wastage: 12.5,
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Quick test endpoint - just send a test email
router.get('/quick-test', async (req: Request, res: Response) => {
  try {
    const emailService = new EmailService();
    
    await emailService.sendPaymentConfirmationEmail({
      customerName: 'Test User',
      customerEmail: 'sifosman@gmail.com',
      quoteNumber: 'TEST-001',
      amount: 250.00,
      invoicePath: './test-invoice.pdf',
      optimizationDetails: {
        totalBoards: 5,
        totalLength: 2400,
        wastage: 8.5
      }
    });

    res.json({
      success: true,
      message: 'Quick test email sent to sifosman@gmail.com'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
