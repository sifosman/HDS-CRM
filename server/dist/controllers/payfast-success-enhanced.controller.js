"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_service_1 = __importDefault(require("../services/supabase.service"));
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
    async handlePaymentSuccess(req, res) {
        var _a;
        try {
            console.log('🚀 PayFast Success Handler Started');
            console.log('📋 Request Method:', req.method);
            console.log('📋 Request Body:', req.body);
            console.log('📋 Request Query:', req.query);
            // Get quoteId from query parameter
            const quoteId = req.query.quoteId;
            if (!quoteId) {
                // Simple success page without quote data
                res.send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <title>Payment Successful - HDS</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                line-height: 1.6;
              }
              
              .container {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 24px;
                padding: 48px 40px;
                max-width: 500px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2);
                animation: slideUp 0.6s ease-out;
                position: relative;
                overflow: hidden;
              }
              
              .container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #4CAF50, #45a049);
                border-radius: 24px 24px 0 0;
              }
              
              @keyframes slideUp {
                from {
                  opacity: 0;
                  transform: translateY(30px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              
              .success-icon {
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #4CAF50, #45a049);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                animation: checkmark 0.8s ease-out 0.3s both;
                box-shadow: 0 8px 20px rgba(76, 175, 80, 0.3);
              }
              
              .success-icon i {
                font-size: 36px;
                color: white;
              }
              
              @keyframes checkmark {
                0% {
                  transform: scale(0) rotate(45deg);
                  opacity: 0;
                }
                50% {
                  transform: scale(1.2) rotate(45deg);
                }
                100% {
                  transform: scale(1) rotate(0deg);
                  opacity: 1;
                }
              }
              
              h1 {
                font-size: 28px;
                font-weight: 700;
                color: #1a1a1a;
                margin-bottom: 12px;
                animation: fadeInUp 0.6s ease-out 0.4s both;
              }
              
              .subtitle {
                font-size: 16px;
                color: #666;
                margin-bottom: 32px;
                font-weight: 400;
                animation: fadeInUp 0.6s ease-out 0.5s both;
              }
              
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              
              .actions {
                display: flex;
                flex-direction: column;
                gap: 16px;
                animation: fadeInUp 0.6s ease-out 0.6s both;
              }
              
              .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 16px 24px;
                border: none;
                border-radius: 12px;
                text-decoration: none;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                font-family: inherit;
              }
              
              .btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transition: left 0.5s;
              }
              
              .btn:hover::before {
                left: 100%;
              }
              
              .btn-primary {
                background: linear-gradient(135deg, #1976D2, #1565C0);
                color: white;
                box-shadow: 0 4px 15px rgba(25, 118, 210, 0.3);
              }
              
              .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(25, 118, 210, 0.4);
              }
              
              .btn-secondary {
                background: linear-gradient(135deg, #25D366, #128C7E);
                color: white;
                box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
              }
              
              .btn-secondary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(37, 211, 102, 0.4);
              }
              
              .btn:active {
                transform: translateY(0);
              }
              
              .divider {
                margin: 24px 0;
                position: relative;
                text-align: center;
                color: #999;
                font-size: 14px;
              }
              
              .divider::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
              }
              
              .divider span {
                background: rgba(255, 255, 255, 0.95);
                padding: 0 16px;
                position: relative;
              }
              
              @media (max-width: 480px) {
                .container {
                  padding: 32px 24px;
                  margin: 16px;
                }
                
                h1 {
                  font-size: 24px;
                }
                
                .subtitle {
                  font-size: 15px;
                }
                
                .btn {
                  padding: 14px 20px;
                  font-size: 15px;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">
                <i class="fas fa-check"></i>
              </div>
              <h1>Payment Successful!</h1>
              <p class="subtitle">Thank you for your payment. Your order has been confirmed and is being processed.</p>
              
              <div class="actions">
                <a href="/api/invoices/download/${quoteId || 'latest'}" class="btn btn-primary" target="_blank" rel="noopener">
                  <i class="fas fa-file-invoice"></i>
                  Download Invoice
                </a>
                
                <div class="divider">
                  <span>or</span>
                </div>
                
                <a href="https://wa.me/?text=Payment%20confirmed!%20Your%20invoice%20is%20ready.%20Download%20from:%20https://hds-nine.vercel.app/invoice/${quoteId || 'latest'}" 
                   class="btn btn-secondary" target="_blank">
                  <i class="fab fa-whatsapp"></i>
                  Share on WhatsApp
                </a>
              </div>
            </div>
          </body>
          </html>
        `);
                return;
            }
            console.log('🔍 Searching for quote with identifier:', quoteId);
            console.log('📋 Request query params:', JSON.stringify(req.query, null, 2));
            console.log('📋 Request body params:', JSON.stringify(req.body, null, 2));
            // Fetch quote details
            const quoteResult = await supabase_service_1.default.fetchQuoteByNumber(quoteId);
            if (!quoteResult.success) {
                // Show success page even if quote not found
                res.send(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <title>Payment Successful - HDS</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                line-height: 1.6;
              }
              
              .container {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(10px);
                border-radius: 24px;
                padding: 48px 40px;
                max-width: 500px;
                width: 100%;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2);
                animation: slideUp 0.6s ease-out;
                position: relative;
                overflow: hidden;
              }
              
              .container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(90deg, #4CAF50, #45a049);
                border-radius: 24px 24px 0 0;
              }
              
              @keyframes slideUp {
                from {
                  opacity: 0;
                  transform: translateY(30px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              
              .success-icon {
                width: 80px;
                height: 80px;
                background: linear-gradient(135deg, #4CAF50, #45a049);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 24px;
                animation: checkmark 0.8s ease-out 0.3s both;
                box-shadow: 0 8px 20px rgba(76, 175, 80, 0.3);
              }
              
              .success-icon i {
                font-size: 36px;
                color: white;
              }
              
              @keyframes checkmark {
                0% {
                  transform: scale(0) rotate(45deg);
                  opacity: 0;
                }
                50% {
                  transform: scale(1.2) rotate(45deg);
                }
                100% {
                  transform: scale(1) rotate(0deg);
                  opacity: 1;
                }
              }
              
              h1 {
                font-size: 28px;
                font-weight: 700;
                color: #1a1a1a;
                margin-bottom: 12px;
                animation: fadeInUp 0.6s ease-out 0.4s both;
              }
              
              .subtitle {
                font-size: 16px;
                color: #666;
                margin-bottom: 32px;
                font-weight: 400;
                animation: fadeInUp 0.6s ease-out 0.5s both;
              }
              
              @keyframes fadeInUp {
                from {
                  opacity: 0;
                  transform: translateY(20px);
                }
                to {
                  opacity: 1;
                  transform: translateY(0);
                }
              }
              
              .actions {
                display: flex;
                flex-direction: column;
                gap: 16px;
                animation: fadeInUp 0.6s ease-out 0.6s both;
              }
              
              .btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
                padding: 16px 24px;
                border: none;
                border-radius: 12px;
                text-decoration: none;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
                font-family: inherit;
              }
              
              .btn::before {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                transition: left 0.5s;
              }
              
              .btn:hover::before {
                left: 100%;
              }
              
              .btn-primary {
                background: linear-gradient(135deg, #1976D2, #1565C0);
                color: white;
                box-shadow: 0 4px 15px rgba(25, 118, 210, 0.3);
              }
              
              .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(25, 118, 210, 0.4);
              }
              
              .btn-secondary {
                background: linear-gradient(135deg, #25D366, #128C7E);
                color: white;
                box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
              }
              
              .btn-secondary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(37, 211, 102, 0.4);
              }
              
              .btn:active {
                transform: translateY(0);
              }
              
              .divider {
                margin: 24px 0;
                position: relative;
                text-align: center;
                color: #999;
                font-size: 14px;
              }
              
              .divider::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
              }
              
              .divider span {
                background: rgba(255, 255, 255, 0.95);
                padding: 0 16px;
                position: relative;
              }
              
              @media (max-width: 480px) {
                .container {
                  padding: 32px 24px;
                  margin: 16px;
                }
                
                h1 {
                  font-size: 24px;
                }
                
                .subtitle {
                  font-size: 15px;
                }
                
                .btn {
                  padding: 14px 20px;
                  font-size: 15px;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">
                <i class="fas fa-check"></i>
              </div>
              <h1>Payment Successful!</h1>
              <p class="subtitle">Thank you for your payment. Your order has been confirmed and is being processed.</p>
              
              <div class="actions">
                <a href="/api/invoices/download/${quoteId}" class="btn btn-primary" target="_blank" rel="noopener">
                  <i class="fas fa-file-invoice"></i>
                  Download Invoice
              </a>
              
              <a href="https://wa.me/?text=Payment%20confirmed!%20Your%20invoice%20is%20ready.%20Download%20from:%20https://hds-nine.vercel.app/invoice/${quoteId}" 
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
            // Safely extract payment details with null checks
            const queryParams = req.query || {};
            const bodyParams = req.body || {};
            console.log('💰 Extracting payment details...');
            console.log('💰 Query pf_payment_id:', queryParams.pf_payment_id);
            console.log('💰 Body pf_payment_id:', bodyParams.pf_payment_id);
            console.log('💰 Query amount_gross:', queryParams.amount_gross);
            console.log('💰 Body amount_gross:', bodyParams.amount_gross);
            console.log('💰 Query m_payment_id:', queryParams.m_payment_id);
            console.log('💰 Body m_payment_id:', bodyParams.m_payment_id);
            // Create payment details object with safe property access
            const paymentDetails = {
                method: 'PayFast',
                reference: queryParams.pf_payment_id || bodyParams.pf_payment_id || 'N/A',
                date: new Date().toISOString(),
                amount: queryParams.amount_gross || bodyParams.amount_gross || '0',
                payment_id: queryParams.m_payment_id || bodyParams.m_payment_id || 'N/A'
            };
            console.log('💳 Payment details created:', JSON.stringify(paymentDetails, null, 2));
            console.log('💳 Updating existing invoice with payment details...');
            // Find existing invoice for this quote
            const existingInvoiceResult = await supabase_service_1.default.fetchInvoiceByQuoteId(quoteId);
            let invoiceNumber = '';
            let pdfUrl = `/api/invoices/download/${quoteId}`; // Default fallback URL
            if (existingInvoiceResult.success && existingInvoiceResult.data) {
                // Use the correct database field name from schema
                invoiceNumber = existingInvoiceResult.data.invoice_number || '';
                console.log('✅ Existing invoice found. Raw data:', JSON.stringify(existingInvoiceResult.data, null, 2));
                console.log('✅ Extracted invoice number:', invoiceNumber);
                if (!invoiceNumber) {
                    console.error('❌ Invoice number is empty or undefined. Cannot update invoice.');
                    console.log('Available fields in invoice data:', Object.keys(existingInvoiceResult.data));
                }
                else {
                    // Update invoice status to paid
                    await supabase_service_1.default.updateInvoiceStatus(invoiceNumber, 'paid');
                    // Update invoice payment details
                    await supabase_service_1.default.updateInvoicePaymentDetails(invoiceNumber, paymentDetails);
                }
                // Generate and upload updated invoice PDF
                try {
                    const pdfResult = await supabase_service_1.default.generateAndUploadInvoicePdf(quoteId, invoiceNumber);
                    if (pdfResult.success && pdfResult.publicUrl) {
                        pdfUrl = pdfResult.publicUrl;
                        console.log('✅ Invoice PDF uploaded:', pdfResult.publicUrl);
                    }
                    else {
                        // Fallback to download endpoint if direct URL not available
                        pdfUrl = `/api/invoices/download/${invoiceNumber}`;
                    }
                }
                catch (pdfError) {
                    console.error('PDF generation error:', pdfError);
                    // Fallback to download endpoint on error
                    pdfUrl = `/api/invoices/download/${invoiceNumber}`;
                }
            }
            else {
                // Fallback: Create new invoice if none exists (backward compatibility)
                console.log('⚠️ No existing invoice found, creating new one...');
                const invoiceResult = await supabase_service_1.default.createInvoice(quoteId, paymentDetails);
                if (invoiceResult.success && ((_a = invoiceResult.data) === null || _a === void 0 ? void 0 : _a.invoiceNumber)) {
                    invoiceNumber = invoiceResult.data.invoiceNumber;
                    console.log('✅ New invoice created:', invoiceNumber);
                    // Generate and upload invoice PDF
                    console.log('📄 Generating invoice PDF...');
                    const pdfResult = await supabase_service_1.default.generateAndUploadInvoicePdf(quoteId, invoiceNumber);
                    if (pdfResult.success) {
                        pdfUrl = pdfResult.publicUrl || '';
                        console.log('✅ Invoice PDF generated:', pdfUrl);
                    }
                    else {
                        pdfUrl = `/api/invoices/download/${invoiceNumber}`;
                        console.error('❌ Failed to generate invoice PDF:', pdfResult.error);
                    }
                }
                else {
                    // Ultimate fallback
                    res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <title>Payment Successful - HDS</title>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <meta charset="UTF-8">
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
              <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
              <style>
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }
                
                body {
                  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                  min-height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  padding: 20px;
                  line-height: 1.6;
                }
                
                .container {
                  background: rgba(255, 255, 255, 0.95);
                  backdrop-filter: blur(10px);
                  border-radius: 24px;
                  padding: 48px 40px;
                  max-width: 500px;
                  width: 100%;
                  text-align: center;
                  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2);
                  animation: slideUp 0.6s ease-out;
                  position: relative;
                  overflow: hidden;
                }
                
                .container::before {
                  content: '';
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  height: 4px;
                  background: linear-gradient(90deg, #4CAF50, #45a049);
                  border-radius: 24px 24px 0 0;
                }
                
                @keyframes slideUp {
                  from {
                    opacity: 0;
                    transform: translateY(30px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                
                .success-icon {
                  width: 80px;
                  height: 80px;
                  background: linear-gradient(135deg, #4CAF50, #45a049);
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  margin: 0 auto 24px;
                  animation: checkmark 0.8s ease-out 0.3s both;
                  box-shadow: 0 8px 20px rgba(76, 175, 80, 0.3);
                }
                
                .success-icon i {
                  font-size: 36px;
                  color: white;
                }
                
                @keyframes checkmark {
                  0% {
                    transform: scale(0) rotate(45deg);
                    opacity: 0;
                  }
                  50% {
                    transform: scale(1.2) rotate(45deg);
                  }
                  100% {
                    transform: scale(1) rotate(0deg);
                    opacity: 1;
                  }
                }
                
                h1 {
                  font-size: 28px;
                  font-weight: 700;
                  color: #1a1a1a;
                  margin-bottom: 12px;
                  animation: fadeInUp 0.6s ease-out 0.4s both;
                }
                
                .subtitle {
                  font-size: 16px;
                  color: #666;
                  margin-bottom: 16px;
                  font-weight: 400;
                  animation: fadeInUp 0.6s ease-out 0.5s both;
                }
                
                .note {
                  font-size: 14px;
                  color: #888;
                  margin-bottom: 32px;
                  font-weight: 400;
                  animation: fadeInUp 0.6s ease-out 0.6s both;
                }
                
                @keyframes fadeInUp {
                  from {
                    opacity: 0;
                    transform: translateY(20px);
                  }
                  to {
                    opacity: 1;
                    transform: translateY(0);
                  }
                }
                
                @media (max-width: 480px) {
                  .container {
                    padding: 32px 24px;
                    margin: 16px;
                  }
                  
                  h1 {
                    font-size: 24px;
                  }
                  
                  .subtitle {
                    font-size: 15px;
                  }
                  
                  .note {
                    font-size: 13px;
                  }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="success-icon">
                  <i class="fas fa-check"></i>
                </div>
                <h1>Payment Successful!</h1>
                <p class="subtitle">Thank you for your payment. Your order has been confirmed.</p>
                <p class="note">Invoice details will be sent to you shortly.</p>
              </div>
            </body>
            </html>
          `);
                    return;
                }
            }
            // Send success response with download button
            res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <title>Payment Successful - HDS</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta charset="UTF-8">
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
              line-height: 1.6;
            }
            
            .container {
              background: rgba(255, 255, 255, 0.95);
              backdrop-filter: blur(10px);
              border-radius: 24px;
              padding: 48px 40px;
              max-width: 500px;
              width: 100%;
              text-align: center;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.2);
              animation: slideUp 0.6s ease-out;
              position: relative;
              overflow: hidden;
            }
            
            .container::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 4px;
              background: linear-gradient(90deg, #4CAF50, #45a049);
              border-radius: 24px 24px 0 0;
            }
            
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(30px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            .success-icon {
              width: 80px;
              height: 80px;
              background: linear-gradient(135deg, #4CAF50, #45a049);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 24px;
              animation: checkmark 0.8s ease-out 0.3s both;
              box-shadow: 0 8px 20px rgba(76, 175, 80, 0.3);
            }
            
            .success-icon i {
              font-size: 36px;
              color: white;
            }
            
            @keyframes checkmark {
              0% {
                transform: scale(0) rotate(45deg);
                opacity: 0;
              }
              50% {
                transform: scale(1.2) rotate(45deg);
              }
              100% {
                transform: scale(1) rotate(0deg);
                opacity: 1;
              }
            }
            
            h1 {
              font-size: 28px;
              font-weight: 700;
              color: #1a1a1a;
              margin-bottom: 12px;
              animation: fadeInUp 0.6s ease-out 0.4s both;
            }
            
            .subtitle {
              font-size: 16px;
              color: #666;
              margin-bottom: 32px;
              font-weight: 400;
              animation: fadeInUp 0.6s ease-out 0.5s both;
            }
            
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            .actions {
              display: flex;
              flex-direction: column;
              gap: 16px;
              animation: fadeInUp 0.6s ease-out 0.6s both;
            }
            
            .btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
              padding: 16px 24px;
              border: none;
              border-radius: 12px;
              text-decoration: none;
              font-size: 16px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
              position: relative;
              overflow: hidden;
              font-family: inherit;
            }
            
            .btn::before {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
              transition: left 0.5s;
            }
            
            .btn:hover::before {
              left: 100%;
            }
            
            .btn-primary {
              background: linear-gradient(135deg, #1976D2, #1565C0);
              color: white;
              box-shadow: 0 4px 15px rgba(25, 118, 210, 0.3);
            }
            
            .btn-primary:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(25, 118, 210, 0.4);
            }
            
            .btn-secondary {
              background: linear-gradient(135deg, #25D366, #128C7E);
              color: white;
              box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
            }
            
            .btn-secondary:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(37, 211, 102, 0.4);
            }
            
            .btn:active {
              transform: translateY(0);
            }
            
            .divider {
              margin: 24px 0;
              position: relative;
              text-align: center;
              color: #999;
              font-size: 14px;
            }
            
            .divider::before {
              content: '';
              position: absolute;
              top: 50%;
              left: 0;
              right: 0;
              height: 1px;
              background: linear-gradient(90deg, transparent, #e0e0e0, transparent);
            }
            
            .divider span {
              background: rgba(255, 255, 255, 0.95);
              padding: 0 16px;
              position: relative;
            }
            
            @media (max-width: 480px) {
              .container {
                padding: 32px 24px;
                margin: 16px;
              }
              
              h1 {
                font-size: 24px;
              }
              
              .subtitle {
                font-size: 15px;
              }
              
              .btn {
                padding: 14px 20px;
                font-size: 15px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">
              <i class="fas fa-check"></i>
            </div>
            <h1>Payment Successful!</h1>
            <p class="subtitle">Thank you for your payment. Your order has been confirmed and is being processed.</p>
            
            <div class="actions">
              <a href="${pdfUrl}" class="btn btn-primary" target="_blank" rel="noopener">
                <i class="fas fa-file-invoice"></i>
                Download Invoice
              </a>
              
              <div class="divider">
                <span>or</span>
              </div>
              
              <a href="https://wa.me/?text=Payment%20confirmed!%20Your%20invoice%20is%20ready.%20Download%20from:%20${encodeURIComponent(pdfUrl)}" 
                 class="btn btn-secondary" target="_blank">
                <i class="fab fa-whatsapp"></i>
                Share on WhatsApp
              </a>
            </div>
          </div>
        </body>
        </html>
      `);
            return;
        }
        catch (error) {
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
    extractQuoteNumber(paymentData) {
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
        }
        catch (error) {
            console.error('❌ Quote number extraction error:', error);
            return null;
        }
    }
    /**
     * Render enhanced success page with invoice download
     */
    async renderSuccessPage(res, data) {
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
    async handlePaymentFailure(req, res) {
        try {
            const paymentData = Object.assign(Object.assign({}, req.query), req.body);
            const quoteNumber = this.extractQuoteNumber(paymentData);
            console.log('❌ Payment failed for quote:', quoteNumber);
            return res.json({
                success: false,
                message: 'Payment failed',
                quoteNumber: quoteNumber,
                error: paymentData.err_msg || 'Payment was unsuccessful'
            });
        }
        catch (error) {
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
    async handlePaymentCancel(req, res) {
        try {
            const paymentData = Object.assign(Object.assign({}, req.query), req.body);
            const quoteNumber = this.extractQuoteNumber(paymentData);
            console.log('⚠️ Payment cancelled for quote:', quoteNumber);
            return res.json({
                success: false,
                message: 'Payment was cancelled',
                quoteNumber: quoteNumber
            });
        }
        catch (error) {
            console.error('❌ Payment cancellation handler error:', error);
            return res.status(500).json({
                success: false,
                error: 'Payment cancellation error'
            });
        }
    }
}
exports.default = new PayFastSuccessEnhancedController();
