import express from 'express';
import { EmailService } from '../services/email.service';
import { Request, Response } from 'express';

const router = express.Router();

// Test email service connection
router.get('/test-email-connection', async (req: Request, res: Response) => {
  try {
    const emailService = new EmailService();
    const isConnected = await emailService.testConnection();
    
    res.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'Email service is properly configured' : 'Email service configuration issue'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test sending a payment confirmation email
router.post('/test-payment-email', async (req: Request, res: Response) => {
  try {
    const { 
      customerName, 
      customerEmail, 
      quoteNumber, 
      amount, 
      invoicePath, 
      optimizationDetails 
    } = req.body;

    if (!customerEmail || !quoteNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: customerEmail, quoteNumber, amount'
      });
    }

    const emailService = new EmailService();
    
    await emailService.sendPaymentConfirmationEmail({
      customerName: customerName || 'Test Customer',
      customerEmail,
      quoteNumber,
      amount: parseFloat(amount),
      invoicePath: invoicePath || './test-invoice.pdf',
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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
