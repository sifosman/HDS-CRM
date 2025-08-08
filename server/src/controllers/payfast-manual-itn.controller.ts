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
        // 1. Invoice PDF: Generate and get the actual PDF URL with timestamp
        let invoicePdfUrl = '';
        if (invoiceResult.data?.invoiceNumber) {
          try {
            const pdfResult = await SupabaseService.generateAndUploadInvoicePdf(quoteId, invoiceResult.data.invoiceNumber);
            if (pdfResult.success && pdfResult.publicUrl) {
              // Use the actual uploaded PDF URL with timestamp
              invoicePdfUrl = pdfResult.publicUrl;
              console.log('✅ Using actual invoice PDF URL with timestamp:', invoicePdfUrl);
            }
          } catch (error) {
            console.error('❌ Could not get invoice PDF URL:', error);
          }
        }
        
        // 2. Cutlist PDF: Look up the actual PDF file in storage
        let cutlistPdfUrl = '';
        console.log('🔍 Quote data cutlist_id:', quoteData.data.cutlist_id);
        console.log('🔍 Quote data keys:', Object.keys(quoteData.data));
        
        if (quoteData.data.cutlist_id) {
          const cutlistId = quoteData.data.cutlist_id;
          console.log('🔍 Looking up cutlist PDF for ID:', cutlistId);
          
          try {
            // Check if it's a UUID format (like 94552cfd-34ec-401a-9123-ea35c80e5a07)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            
            if (uuidRegex.test(cutlistId)) {
              // Direct UUID - use solution_{uuid}.pdf format
              cutlistPdfUrl = `https://xzsibbbghotreolzwnyk.supabase.co/storage/v1/object/public/cutlists/solution_${cutlistId}.pdf`;
              console.log('🔍 Using UUID format for cutlist PDF:', cutlistPdfUrl);
            } else {
              // Not a UUID - this is likely a reference ID, not the actual PDF UUID
              // For now, we'll need to implement a lookup mechanism
              // Try the most common patterns:
              
              console.log('⚠️ Cutlist ID is not a UUID, attempting pattern matching...');
              
              // Use the cutlist_id directly as filename (our new approach)
              cutlistPdfUrl = `https://xzsibbbghotreolzwnyk.supabase.co/storage/v1/object/public/cutlists/${cutlistId}.pdf`;
              console.log('🔍 Using cutlist_id as direct filename:', cutlistPdfUrl);
            }
          } catch (error) {
            console.error('❌ Error looking up cutlist PDF:', error);
            cutlistPdfUrl = ''; // Leave empty if lookup fails
          }
        }
        
        // Check cutlist ID format for logging
        const uuidRegexForLogging = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        console.log('📎 Final PDF URLs determined:', {
          invoicePdfUrl,
          cutlistPdfUrl,
          invoiceNumber: invoiceResult.data?.invoiceNumber,
          cutlistId: quoteData.data.cutlist_id,
          cutlistIdFormat: quoteData.data.cutlist_id ? (uuidRegexForLogging.test(quoteData.data.cutlist_id) ? 'UUID' : 'filename') : 'none'
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
