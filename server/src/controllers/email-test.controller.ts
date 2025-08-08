import { Request, Response } from 'express';
import { EmailService } from '../services/email.service';

/**
 * Test email service connection
 */
export const testEmailConnection = async (req: Request, res: Response): Promise<void> => {
  try {
    const emailService = new EmailService();
    const isConnected = await emailService.testConnection();
    
    res.json({
      success: true,
      connected: isConnected,
      message: isConnected ? 'Email service is properly configured' : 'Email service configuration issue'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred'
    });
  }
};

/**
 * Test sending a payment confirmation email
 */
export const testPaymentEmail = async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({
        success: false,
        message: 'Missing required fields: customerEmail, quoteNumber, amount'
      });
      return;
    }

    const emailService = new EmailService();
    
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
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred'
    });
  }
};
