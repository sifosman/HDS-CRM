import { Request, Response } from 'express';
import { EmailService } from '../services/email.service';

// Manual test endpoint to simulate PayFast ITN webhook for testing emails
export const simulatePayFastITN = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🧪 MANUAL ITN SIMULATION - Testing PayFast email workflow');
    
    // Get quote ID from query parameter
    const quoteId = req.query.quoteId as string || 'Q-20250808-0882-HDSCHUSTR';
    
    console.log('📋 Simulating ITN for quote:', quoteId);
    
    // Import SupabaseService dynamically to avoid circular dependencies
    const SupabaseService = (await import('../services/supabase.service')).default;
    
    // Simulate successful payment data
    const mockPaymentData = {
      m_payment_id: `QUOTE-${quoteId}-1754640748814`,
      pf_payment_id: '1234567',
      payment_status: 'COMPLETE',
      amount_gross: '2527.09',
      amount_fee: '25.27',
      amount_net: '2501.82',
      item_name: `HDS Quote ${quoteId}`,
      signature: 'mock_signature_for_testing'
    };
    
    console.log('💰 Mock payment data:', mockPaymentData);
    
    // Get quote data from database
    console.log('🔍 Fetching quote data for:', quoteId);
    const quoteData = await SupabaseService.fetchQuoteByNumber(quoteId);
    
    if (!quoteData.success || !quoteData.data) {
      console.error('❌ Quote not found:', quoteId);
      res.status(404).json({
        success: false,
        message: 'Quote not found',
        quoteId
      });
      return;
    }
    
    console.log('✅ Quote found:', quoteData.data.quote_number);
    
    // Create invoice record
    const paymentDetails = {
      method: 'PayFast',
      reference: mockPaymentData.pf_payment_id,
      date: new Date().toISOString(),
      amount: parseFloat(mockPaymentData.amount_gross || '0'),
      status: 'paid'
    };
    
    console.log('📄 Creating invoice with payment details:', paymentDetails);
    const invoiceResult = await SupabaseService.createInvoice(quoteId, paymentDetails);
    
    if (invoiceResult.success) {
      console.log('✅ Invoice created successfully:', invoiceResult.data?.invoiceNumber);
      
      // Update invoice status to paid
      if (invoiceResult.data?.invoiceNumber) {
        await SupabaseService.updateInvoiceStatus(invoiceResult.data.invoiceNumber, 'paid');
        console.log('✅ Invoice status updated to paid');
        
        // Generate and upload invoice PDF
        try {
          console.log('📄 Generating invoice PDF for quote:', quoteId, 'invoice number:', invoiceResult.data.invoiceNumber);
          const pdfResult = await SupabaseService.generateAndUploadInvoicePdf(quoteId, invoiceResult.data.invoiceNumber);
          if (pdfResult.success && pdfResult.publicUrl) {
            console.log('✅ Invoice PDF generated and uploaded successfully:', pdfResult.publicUrl);
          } else {
            console.error('❌ Failed to generate or upload invoice PDF:', pdfResult.error);
          }
        } catch (pdfError) {
          console.error('❌ Error generating/uploading invoice PDF:', pdfError);
        }
      }
      
      // Update quote status to approved
      await SupabaseService.updateQuoteStatus(quoteId, 'approved');
      console.log('✅ Quote status updated to approved');
      
      // Send email notification
      try {
        console.log('📧 EMAIL SENDING STARTED - Manual ITN simulation');
        const emailService = new EmailService();
        
        const testEmail = 'sifosman@gmail.com';
        console.log('📧 Test email address:', testEmail);
        
        const customerName = quoteData.data.customer_name || 'Test Customer';
        const customerPhone = quoteData.data.customer_phone || '+27 82 123 4567';
        const quoteNumber = quoteData.data.quote_number || quoteId;
        const amount = parseFloat(mockPaymentData.amount_gross || '0');
        
        // Get PDF URLs from Supabase storage
        // 1. Invoice PDF: Generate the URL based on invoice number
        let invoicePdfUrl = '';
        if (invoiceResult.data?.invoiceNumber) {
          // Invoice PDFs are stored in invoices bucket with format: invoice-{invoiceNumber}.pdf
          invoicePdfUrl = `https://xzsibbbghotreolzwnyk.supabase.co/storage/v1/object/public/invoices/invoice-${invoiceResult.data.invoiceNumber}.pdf`;
        }
        
        // 2. Cutlist PDF: Get from cutlist_id field, not cutlist_url (which points to quote PDF)
        let cutlistPdfUrl = '';
        if (quoteData.data.cutlist_id) {
          // Cutlist PDFs are stored in cutlists bucket with format: solution_{cutlist_id}.pdf
          cutlistPdfUrl = `https://xzsibbbghotreolzwnyk.supabase.co/storage/v1/object/public/cutlists/solution_${quoteData.data.cutlist_id}.pdf`;
        }
        
        console.log('📎 PDF URLs determined:', {
          invoicePdfUrl,
          cutlistPdfUrl,
          invoiceNumber: invoiceResult.data?.invoiceNumber,
          cutlistId: quoteData.data.cutlist_id
        });
        
        console.log('📧 Email data:', {
          customerName,
          customerPhone,
          testEmail,
          quoteNumber,
          amount,
          invoicePdfUrl,
          cutlistPdfUrl
        });
        
        // Prepare optimization details
        const optimizationDetails = {
          totalBoards: quoteData.data.total_boards,
          totalLength: quoteData.data.total_length,
          wastage: quoteData.data.wastage_percentage,
          cutlistUrl: quoteData.data.cutlist_url
        };
        
        await emailService.sendPaymentConfirmationEmail({
          customerName,
          customerPhone,
          customerEmail: testEmail,
          quoteNumber,
          amount,
          invoicePdfUrl,
          cutlistPdfUrl,
          optimizationDetails
        });
        
        console.log('✅ Payment confirmation email sent successfully to:', testEmail);
        
        res.status(200).json({
          success: true,
          message: 'Manual ITN simulation completed successfully',
          data: {
            quoteId,
            invoiceNumber: invoiceResult.data?.invoiceNumber,
            emailSent: true,
            recipient: testEmail,
            customerName,
            customerPhone,
            amount,
            attachments: {
              invoice: !!invoicePdfUrl,
              cutlist: !!cutlistPdfUrl
            }
          }
        });
        
      } catch (emailError) {
        console.error('❌ Error sending email:', emailError);
        res.status(500).json({
          success: false,
          message: 'Invoice created but email failed',
          error: emailError instanceof Error ? emailError.message : 'Unknown email error'
        });
      }
      
    } else {
      console.error('❌ Failed to create invoice:', invoiceResult.error);
      res.status(500).json({
        success: false,
        message: 'Failed to create invoice',
        error: invoiceResult.error
      });
    }
    
  } catch (error) {
    console.error('❌ Error in manual ITN simulation:', error);
    res.status(500).json({
      success: false,
      message: 'Manual ITN simulation failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
