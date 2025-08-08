import { Request, Response } from 'express';
import { EmailService } from '../services/email.service';

// Test endpoint to send payment confirmation email
export const sendTestPaymentEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🧪 TEST EMAIL ENDPOINT - Sending test payment confirmation email');
    
    const emailService = new EmailService();
    
    // Mock data for testing
    const testData = {
      customerName: 'John Smith',
      customerPhone: '+27 82 123 4567',
      customerEmail: 'sifosman@gmail.com',
      quoteNumber: 'Q-20250108-TEST',
      amount: 2527.09,
      invoicePdfUrl: 'https://example.com/invoice-Q-20250108-TEST.pdf',
      cutlistPdfUrl: 'https://example.com/cutlist-Q-20250108-TEST.pdf',
      optimizationDetails: {
        totalBoards: 8,
        totalLength: 15600,
        wastage: 12.5,
        cutlistUrl: 'https://example.com/cutlist-view'
      }
    };
    
    console.log('📧 Sending test email with data:', testData);
    
    await emailService.sendPaymentConfirmationEmail(testData);
    
    console.log('✅ Test email sent successfully!');
    
    res.status(200).json({
      success: true,
      message: 'Test payment confirmation email sent successfully',
      data: {
        recipient: testData.customerEmail,
        quoteNumber: testData.quoteNumber,
        amount: testData.amount,
        attachments: [
          'Invoice PDF',
          'Cutlist PDF'
        ]
      }
    });
    
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
