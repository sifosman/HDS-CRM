import { Request, Response } from 'express';

// Test ITN controller to manually trigger email sending
export const testITN = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🧪 TEST ITN ENDPOINT - Directly testing email sending logic');
    
    // Test data
    const quoteId = 'Q-20250806-7633-HDSCHUSTR';
    const pfData = {
      payment_status: 'COMPLETE',
      m_payment_id: `QUOTE-${quoteId}-1733515200000`,
      pf_payment_id: 'TEST_123456',
      amount_gross: '1500.00'
    };
    
    console.log('🧪 Test Payment Data:', pfData);
    console.log('🧪 Directly calling email sending logic...');
    
    // Import services
    const SupabaseService = (await import('../services/supabase.service')).default;
    const { EmailService } = await import('../services/email.service');
    
    // Process successful payment directly (bypass signature validation)
    if (pfData.payment_status === 'COMPLETE') {
      try {
        console.log('📧 EMAIL SENDING STARTED - This is where emails are sent!');
        const emailService = new EmailService();
        
        // TESTING: Send emails only to test email address for production testing
        const testEmail = 'sifosman@gmail.com';
        console.log('📧 Test email address:', testEmail);
        
        // Get quote details for email
        const quoteData = await SupabaseService.fetchQuoteByNumber(quoteId);
        
        if (quoteData.success && quoteData.data) {
          const customerName = quoteData.data.customer_name || 'Customer';
          const quoteNumber = quoteData.data.quote_number || quoteId;
          const amount = parseFloat(pfData.amount_gross || '0');
          
          // Note: In serverless environments like Vercel, we can't generate PDF files directly
          // The invoice PDF should be generated and stored in Supabase storage or sent as an attachment
          const invoicePath = '';
          
          // Prepare optimization details
          const optimizationDetails = {
            totalBoards: quoteData.data.total_boards,
            totalLength: quoteData.data.total_length,
            wastage: quoteData.data.wastage_percentage,
            cutlistUrl: quoteData.data.cutlist_url
          };
          
          // Send email to test address for production testing
          console.log('📧 Attempting to send email with data:', {
            customerName,
            testEmail,
            quoteNumber,
            amount,
            invoicePath,
            optimizationDetails
          });
          
          await emailService.sendPaymentConfirmationEmail({
            customerName,
            customerEmail: testEmail,
            quoteNumber,
            amount,
            invoicePath,
            optimizationDetails
          });
          
          console.log('✅ Payment confirmation email sent successfully to test email:', testEmail);
          
          res.json({ 
            success: true, 
            message: 'Test email sent successfully!',
            emailData: {
              recipient: testEmail,
              customerName,
              quoteNumber,
              amount,
              optimizationDetails
            }
          });
        } else {
          console.error('❌ Could not fetch quote data for email');
          res.status(400).json({ 
            success: false, 
            error: 'Could not fetch quote data'
          });
        }
      } catch (emailError: any) {
        console.error('❌ EMAIL SENDING FAILED:', emailError);
        console.error('❌ Email error details:', {
          message: emailError?.message,
          stack: emailError?.stack,
          name: emailError?.name
        });
        res.status(500).json({ 
          success: false, 
          error: 'Email sending failed: ' + (emailError?.message || 'Unknown error')
        });
      }
    } else {
      res.status(400).json({ 
        success: false, 
        error: 'Payment status not COMPLETE'
      });
    }
    
  } catch (error: any) {
    console.error('🧪 Test ITN Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error?.message || 'Unknown error' 
    });
  }
};
