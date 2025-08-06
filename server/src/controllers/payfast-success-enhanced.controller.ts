import { Request, Response } from 'express';
import SupabaseService from '../services/supabase.service';

/**
 * Enhanced PayFast Success Handler with Invoice PDF Generation
 * 
 * This controller handles PayFast payment success and automatically generates
 * invoice PDFs with proper integration to the existing system.
 */

class PayFastSuccessEnhancedController {
  /**
   * Handle PayFast payment success with invoice PDF generation
   */
  async handlePaymentSuccess(req: Request, res: Response): Promise<void> {
    try {
      console.log('🚀 PayFast Success Handler Started');
      console.log('📋 Request Method:', req.method);
      console.log('📋 Request Body:', req.body);
      console.log('📋 Request Query:', req.query);

      // Get quoteId from query parameter
      const quoteId = req.query.quoteId as string;
      
      if (!quoteId) {
        // Simple success page without quote data
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Payment Successful - HDS</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
              .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
              .success-icon { font-size: 60px; color: #4CAF50; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 10px; }
              p { color: #666; margin-bottom: 30px; }
              .btn { display: inline-block; padding: 12px 24px; margin: 10px; border: none; border-radius: 5px; text-decoration: none; font-size: 16px; cursor: pointer; }
              .btn-primary { background: #1976D2; color: white; }
              .btn-secondary { background: #25D366; color: white; }
              .btn:hover { opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Payment Successful!</h1>
              <p>Thank you for your payment. Your order has been confirmed.</p>
              
              <a href="/api/invoices/download/${quoteId || 'latest'}" class="btn btn-primary" download>
                Download Invoice
              </a>
              
              <a href="https://wa.me/?text=Payment%20confirmed!%20Your%20invoice%20is%20ready.%20Download%20from:%20https://hds.co.za/invoice/${quoteId || 'latest'}" 
                 class="btn btn-secondary" target="_blank">
                Share on WhatsApp
              </a>
            </div>
          </body>
          </html>
        `);
        return;
      }

      console.log('📋 Quote ID:', quoteId);

      // Fetch quote details
      const quoteResult = await SupabaseService.fetchQuoteByNumber(quoteId);
      
      if (!quoteResult.success) {
        // Show success page even if quote not found
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Payment Successful - HDS</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
              .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
              .success-icon { font-size: 60px; color: #4CAF50; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 10px; }
              p { color: #666; margin-bottom: 30px; }
              .btn { display: inline-block; padding: 12px 24px; margin: 10px; border: none; border-radius: 5px; text-decoration: none; font-size: 16px; cursor: pointer; }
              .btn-primary { background: #1976D2; color: white; }
              .btn-secondary { background: #25D366; color: white; }
              .btn:hover { opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Payment Successful!</h1>
              <p>Thank you for your payment. Your order has been confirmed.</p>
              
              <a href="/api/invoices/download/${quoteId}" class="btn btn-primary" download>
                Download Invoice
              </a>
              
              <a href="https://wa.me/?text=Payment%20confirmed!%20Your%20invoice%20is%20ready.%20Download%20from:%20https://hds.co.za/invoice/${quoteId}" 
                 class="btn btn-secondary" target="_blank">
                Share on WhatsApp
              </a>
            </div>
          </body>
          </html>
        `);
        return;
      }

      const quote = quoteResult.data;

      // Create payment details object
      const paymentDetails = {
        method: 'PayFast',
        reference: req.query.pf_payment_id || req.body.pf_payment_id,
        date: new Date().toISOString(),
        amount: req.query.amount_gross || req.body.amount_gross,
        payment_id: req.query.m_payment_id || req.body.m_payment_id
      };

      console.log('💳 Creating invoice...');

      // Create invoice record
      const invoiceResult = await SupabaseService.createInvoice(quoteId, paymentDetails);
      
      if (invoiceResult.success && invoiceResult.data?.invoiceNumber) {
        console.log('✅ Invoice created:', invoiceResult.data.invoiceNumber);
        
        // Update invoice status to paid
        await SupabaseService.updateInvoiceStatus(invoiceResult.data.invoiceNumber, 'paid');
        
        // Generate and upload invoice PDF
        try {
          const pdfResult = await SupabaseService.generateAndUploadInvoicePdf(quoteId, invoiceResult.data.invoiceNumber);
          if (pdfResult.success && pdfResult.publicUrl) {
            console.log('✅ Invoice PDF uploaded:', pdfResult.publicUrl);
          }
        } catch (pdfError) {
          console.error('PDF generation error:', pdfError);
        }
      }

      // Update quote status to approved
      await SupabaseService.updateQuoteStatus(quoteId, 'approved');
      console.log('✅ Quote status updated to approved');

      // Prepare success response
      const responseData = {
        success: true,
        message: 'Payment processed successfully',
        paymentId: paymentDetails.reference,
        quoteNumber: quoteId,
        invoiceNumber: invoiceResult.data.invoiceNumber,
        pdfUrl: `/api/invoices/download/${quoteId}`,
        customerName: quote.customer_name,
        customerEmail: quote.customer_email,
        projectName: quote.project_name,
        totalAmount: quote.total,
        branchName: quote.branch_name
      };

      // Send response based on request type
      if (req.xhr || req.headers.accept?.includes('json')) {
        res.json(responseData);
        return;
      } else {
        // For browser requests, render simple success page
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Payment Successful - HDS</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
              .container { max-width: 600px; margin: 50px auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
              .success-icon { font-size: 60px; color: #4CAF50; margin-bottom: 20px; }
              h1 { color: #333; margin-bottom: 10px; }
              p { color: #666; margin-bottom: 30px; }
              .btn { display: inline-block; padding: 12px 24px; margin: 10px; border: none; border-radius: 5px; text-decoration: none; font-size: 16px; cursor: pointer; }
              .btn-primary { background: #1976D2; color: white; }
              .btn-secondary { background: #25D366; color: white; }
              .btn:hover { opacity: 0.9; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✅</div>
              <h1>Payment Successful!</h1>
              <p>Thank you for your payment. Your order has been confirmed.</p>
              
              <a href="/api/invoices/download/${quoteId}" class="btn btn-primary" download>
                Download Invoice
              </a>
              
              <a href="https://wa.me/?text=Payment%20confirmed!%20Your%20invoice%20is%20ready.%20Download%20from:%20https://hds.co.za/invoice/${quoteId}" 
                 class="btn btn-secondary" target="_blank">
                Share on WhatsApp
              </a>
            </div>
          </body>
          </html>
        `);
        return;
      }

    } catch (error: any) {
      console.error('❌ PayFast success handler error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error: ' + error.message
      });
      return;
    }
  }

  /**
   * Extract quote number from PayFast payment data
   */
  extractQuoteNumber(paymentData: any): string | null {
    try {
      // Try m_payment_id first
      const paymentId = paymentData.m_payment_id || paymentData['m_payment_id'];
      if (paymentId) {
        const parts = paymentId.split('-');
        if (parts.length >= 4 && parts[0] === 'QUOTE') {
          // Handle different formats:
          // 1. QUOTE-Q-YYYYMMDD-NNNN-1754311399090 (without branch)
          // 2. QUOTE-Q-YYYYMMDD-NNNN-BRANCH-1754311399090 (with branch)
          // 3. QUOTE-Q-YYYYMMDD-NNNN-BRANCHNAME-1754311399090 (with branch name)
          if (parts.length >= 4) {
            // For format 1: QUOTE-Q-YYYYMMDD-NNNN-timestamp
            if (parts.length === 5) {
              return `${parts[1]}-${parts[2]}-${parts[3]}`;
            }
            // For format 2 & 3: QUOTE-Q-YYYYMMDD-NNNN-BRANCH-timestamp or QUOTE-Q-YYYYMMDD-NNNN-BRANCHNAME-timestamp
            if (parts.length >= 6) {
              return `${parts[1]}-${parts[2]}-${parts[3]}`;
            }
          }
        }
      }

      // Try item_name as fallback
      const itemName = paymentData.item_name || paymentData['item_name'];
      if (itemName) {
        // Updated regex to handle both old and new formats with branch names
        const match = itemName.match(/HDS Quote (Q-\d{8}-\d{4}(?:-[A-Z]{1,6})?)/);
        if (match) {
          return match[1];
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Quote number extraction error:', error);
      return null;
    }
  }

  /**
   * Render enhanced success page with invoice download
   */
  async renderSuccessPage(res: Response, data: any): Promise<void> {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Successful - HDS Group</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        .container {
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 500px;
            width: 100%;
            text-align: center;
        }
        .success-icon {
            color: #4CAF50;
            font-size: 48px;
            margin-bottom: 20px;
        }
        .success-title {
            color: #333;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .success-message {
            color: #666;
            margin-bottom: 30px;
        }
        .action-buttons {
            margin: 30px 0;
        }
        .btn {
            display: inline-block;
            padding: 12px 24px;
            margin: 5px;
            border-radius: 5px;
            text-decoration: none;
            font-weight: bold;
            transition: background-color 0.3s;
        }
        .btn-primary {
            background: #007bff;
            color: white;
        }
        .btn-primary:hover {
            background: #0056b3;
        }
        .btn-whatsapp {
            background: #25D366;
            color: white;
        }
        .btn-whatsapp:hover {
            background: #128C7E;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">✅</div>
        <h1 class="success-title">Payment Successful!</h1>
        <p class="success-message">Thank you for your payment. Your invoice has been generated and is ready for download.</p>
        
        <div class="action-buttons">
            <a href="${data.pdfUrl}" class="btn btn-primary" target="_blank" rel="noopener">
                📄 Download Invoice
            </a>
            <a href="https://wa.me/?text=My%20invoice%20${data.invoiceNumber}%20is%20ready%20for%20download%20at%20${encodeURIComponent(data.pdfUrl)}" 
               class="btn btn-whatsapp" target="_blank" rel="noopener">
                💬 Share on WhatsApp
            </a>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
            A confirmation email has been sent to ${data.customerEmail}
        </p>
    </div>
</body>
</html>`;

    res.send(html);
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(req: Request, res: Response) {
    try {
      const paymentData = { ...req.query, ...req.body };
      const quoteNumber = this.extractQuoteNumber(paymentData);

      console.log('❌ Payment failed for quote:', quoteNumber);

      return res.json({
        success: false,
        message: 'Payment failed',
        quoteNumber: quoteNumber,
        error: paymentData.err_msg || 'Payment was unsuccessful'
      });

    } catch (error: any) {
      console.error('❌ Payment failure handler error:', error);
      return res.status(500).json({
        success: false,
        error: 'Payment processing error'
      });
    }
  }

  /**
   * Handle payment cancellation
   */
  async handlePaymentCancel(req: Request, res: Response) {
    try {
      const paymentData = { ...req.query, ...req.body };
      const quoteNumber = this.extractQuoteNumber(paymentData);

      console.log('⚠️ Payment cancelled for quote:', quoteNumber);

      return res.json({
        success: false,
        message: 'Payment was cancelled',
        quoteNumber: quoteNumber
      });

    } catch (error: any) {
      console.error('❌ Payment cancellation handler error:', error);
      return res.status(500).json({
        success: false,
        error: 'Payment cancellation error'
      });
    }
  }
}

export default new PayFastSuccessEnhancedController();
