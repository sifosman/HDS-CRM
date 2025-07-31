import { Request, Response } from 'express';
import crypto from 'crypto';

interface PayFastConfig {
  merchantId: string;
  merchantKey: string;
  passphrase: string;
  sandbox: boolean;
  baseUrl: string;
}

interface PaymentData {
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  amount: string;
  item_name: string;
  item_description: string;
  m_payment_id: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  signature: string;
}

// Get PayFast configuration from environment variables
const getPayFastConfig = (): PayFastConfig => {
  return {
    merchantId: process.env.PAYFAST_MERCHANT_ID || '10000100',
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a',
    passphrase: process.env.PAYFAST_PASSPHRASE || 'jt7NOE43FZPn',
    sandbox: process.env.PAYFAST_SANDBOX === 'true',
    baseUrl: process.env.BASE_URL || 'http://localhost:5000'
  };
};

// Generate PayFast signature
const generateSignature = (data: Record<string, string>, passphrase: string): string => {
  // Remove signature field if it exists
  const { signature: existingSignature, ...dataForSignature } = data;
  
  // PayFast requires fields in the order they appear in the form, NOT alphabetical
  // Order: merchant_id, merchant_key, return_url, cancel_url, notify_url, 
  //        name_first, name_last, email_address, m_payment_id, amount, item_name, item_description
  const fieldOrder = [
    'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
    'name_first', 'name_last', 'email_address', 'cell_number',
    'm_payment_id', 'amount', 'item_name', 'item_description',
    'custom_int1', 'custom_int2', 'custom_int3', 'custom_int4', 'custom_int5',
    'custom_str1', 'custom_str2', 'custom_str3', 'custom_str4', 'custom_str5',
    'email_confirmation', 'confirmation_address', 'payment_method'
  ];
  
  // Create parameter string in the correct order
  const paramPairs: string[] = [];
  
  // Add fields in the specified order
  fieldOrder.forEach(key => {
    if (dataForSignature[key] && dataForSignature[key] !== '' && dataForSignature[key] !== undefined) {
      paramPairs.push(`${key}=${dataForSignature[key].toString().trim()}`);
    }
  });
  
  // Add any remaining fields not in the standard order (shouldn't happen but just in case)
  Object.keys(dataForSignature).forEach(key => {
    if (!fieldOrder.includes(key) && dataForSignature[key] && dataForSignature[key] !== '' && dataForSignature[key] !== undefined) {
      paramPairs.push(`${key}=${dataForSignature[key].toString().trim()}`);
    }
  });
  
  const paramString = paramPairs.join('&');
  
  // Add passphrase if provided
  const stringToHash = passphrase ? `${paramString}&passphrase=${passphrase}` : paramString;
  
  console.log('PayFast signature string:', stringToHash);
  
  // Generate MD5 hash
  const generatedSignature = crypto.createHash('md5').update(stringToHash).digest('hex');
  console.log('Generated signature:', generatedSignature);
  
  return generatedSignature;
};

// Generate payment form for a quote
export const generatePaymentForm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { quoteId, amount, customerName, projectName, customerEmail } = req.query;
    
    if (!quoteId || !amount) {
      res.status(400).json({ 
        error: 'Missing required parameters: quoteId and amount are required' 
      });
      return;
    }

    const config = getPayFastConfig();
    const paymentId = `QUOTE-${quoteId}-${Date.now()}`;
    
    // Prepare payment data
    const paymentData: Record<string, string> = {
      merchant_id: config.merchantId,
      merchant_key: config.merchantKey,
      return_url: `${config.baseUrl}/api/payfast/success?quote_id=${quoteId}`,
      cancel_url: `${config.baseUrl}/api/payfast/cancel?quote_id=${quoteId}`,
      notify_url: `${config.baseUrl}/api/payfast/notify`,
      amount: amount.toString(),
      item_name: `HDS Quote ${quoteId}`,
      item_description: projectName ? `Quote for project: ${projectName}` : `HDS Group Quotation ${quoteId}`,
      m_payment_id: paymentId
    };

    // Add customer details if provided
    if (customerName) {
      const nameParts = customerName.toString().split(' ');
      paymentData.name_first = nameParts[0] || '';
      paymentData.name_last = nameParts.slice(1).join(' ') || '';
    }
    
    if (customerEmail) {
      paymentData.email_address = customerEmail.toString();
    }

    // Generate signature
    const signature = generateSignature(paymentData, config.passphrase);
    paymentData.signature = signature;

    // Determine PayFast URL
    const payfastUrl = config.sandbox 
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';

    // Generate HTML payment form
    const htmlForm = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>HDS Payment - Quote ${quoteId}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .payment-container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 500px;
                width: 100%;
                text-align: center;
            }
            .header {
                background-color: #003366;
                color: white;
                padding: 20px;
                margin: -40px -40px 30px -40px;
                border-radius: 10px 10px 0 0;
            }
            .amount {
                font-size: 2em;
                color: #003366;
                font-weight: bold;
                margin: 20px 0;
            }
            .details {
                text-align: left;
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 5px;
                margin: 20px 0;
            }
            .pay-button {
                background-color: #28a745;
                color: white;
                padding: 15px 30px;
                border: none;
                border-radius: 5px;
                font-size: 1.1em;
                cursor: pointer;
                width: 100%;
                margin-top: 20px;
            }
            .pay-button:hover {
                background-color: #218838;
            }
            .loading {
                display: none;
                margin-top: 20px;
            }
            .security-note {
                font-size: 0.9em;
                color: #666;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="payment-container">
            <div class="header">
                <h1>HDS Group Payment</h1>
                <p>Secure Payment Processing</p>
            </div>
            
            <div class="amount">R ${parseFloat(amount.toString()).toFixed(2)}</div>
            
            <div class="details">
                <p><strong>Quote ID:</strong> ${quoteId}</p>
                ${projectName ? `<p><strong>Project:</strong> ${projectName}</p>` : ''}
                ${customerName ? `<p><strong>Customer:</strong> ${customerName}</p>` : ''}
                <p><strong>Payment ID:</strong> ${paymentId}</p>
            </div>

            <form id="payfast-form" action="${payfastUrl}" method="post">
                ${Object.entries(paymentData).map(([key, value]) => 
                    `<input type="hidden" name="${key}" value="${value}">`
                ).join('\n                ')}
                
                <button type="submit" class="pay-button" onclick="showLoading()">
                    Pay with PayFast
                </button>
            </form>
            
            <div class="loading" id="loading">
                <p>Redirecting to PayFast secure payment page...</p>
                <p>Please wait...</p>
            </div>
            
            <div class="security-note">
                <p>🔒 Your payment is processed securely by PayFast</p>
                <p>You will be redirected to PayFast to complete your payment</p>
            </div>
        </div>

        <script>
            function showLoading() {
                document.querySelector('.pay-button').style.display = 'none';
                document.getElementById('loading').style.display = 'block';
            }
            
            // Auto-submit form after 3 seconds if user doesn't click
            setTimeout(() => {
                if (confirm('Ready to proceed to PayFast payment page?')) {
                    showLoading();
                    document.getElementById('payfast-form').submit();
                }
            }, 3000);
        </script>
    </body>
    </html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlForm);

  } catch (error) {
    console.error('PayFast payment form generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate payment form',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
};

// Handle successful payment return
export const handlePaymentSuccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { quote_id } = req.query;
    
    const successHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .success-container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 500px;
                width: 100%;
                text-align: center;
            }
            .success-icon {
                font-size: 4em;
                color: #28a745;
                margin-bottom: 20px;
            }
            .header {
                color: #003366;
                margin-bottom: 20px;
            }
            .message {
                color: #666;
                margin-bottom: 30px;
                line-height: 1.6;
            }
            .quote-id {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 1.1em;
                margin: 20px 0;
            }
        </style>
    </head>
    <body>
        <div class="success-container">
            <div class="success-icon">✅</div>
            <div class="header">
                <h1>Payment Successful!</h1>
            </div>
            <div class="message">
                <p>Thank you for your payment. Your transaction has been processed successfully.</p>
                ${quote_id ? `<div class="quote-id">Quote ID: ${quote_id}</div>` : ''}
                <p>You will receive a confirmation email shortly. If you have any questions, please contact HDS Group.</p>
            </div>
        </div>
    </body>
    </html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(successHtml);

  } catch (error) {
    console.error('Payment success handler error:', error);
    res.status(500).json({ error: 'Failed to process payment success' });
    return;
  }
};

// Handle cancelled payment return
export const handlePaymentCancel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { quote_id } = req.query;
    
    const cancelHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Cancelled</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }
            .cancel-container {
                background: white;
                padding: 40px;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                max-width: 500px;
                width: 100%;
                text-align: center;
            }
            .cancel-icon {
                font-size: 4em;
                color: #dc3545;
                margin-bottom: 20px;
            }
            .header {
                color: #003366;
                margin-bottom: 20px;
            }
            .message {
                color: #666;
                margin-bottom: 30px;
                line-height: 1.6;
            }
            .quote-id {
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                font-family: monospace;
                font-size: 1.1em;
                margin: 20px 0;
            }
            .retry-button {
                background-color: #007bff;
                color: white;
                padding: 12px 24px;
                border: none;
                border-radius: 5px;
                text-decoration: none;
                display: inline-block;
                margin-top: 20px;
            }
        </style>
    </head>
    <body>
        <div class="cancel-container">
            <div class="cancel-icon">❌</div>
            <div class="header">
                <h1>Payment Cancelled</h1>
            </div>
            <div class="message">
                <p>Your payment was cancelled. No charges have been made to your account.</p>
                ${quote_id ? `<div class="quote-id">Quote ID: ${quote_id}</div>` : ''}
                <p>If you wish to complete the payment, please try again or contact HDS Group for assistance.</p>
            </div>
        </div>
    </body>
    </html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(cancelHtml);

  } catch (error) {
    console.error('Payment cancel handler error:', error);
    res.status(500).json({ error: 'Failed to process payment cancellation' });
    return;
  }
};

// Handle PayFast ITN (Instant Transaction Notification)
export const handlePaymentNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('PayFast ITN received:', req.body);
    
    // Validate the ITN
    const config = getPayFastConfig();
    const pfData = req.body;
    
    console.log('PayFast ITN data received:', pfData);
    
    // Extract signature and prepare data for validation
    const receivedSignature = pfData.signature;
    
    // Generate signature for validation using the same method
    const calculatedSignature = generateSignature(pfData, config.passphrase);
    
    console.log('Received signature:', receivedSignature);
    console.log('Calculated signature:', calculatedSignature);
    
    if (receivedSignature !== calculatedSignature) {
      console.error('PayFast ITN signature validation failed');
      console.error('Expected:', calculatedSignature);
      console.error('Received:', receivedSignature);
      res.status(400).send('Invalid signature');
      return;
    }
    
    // Process the payment notification
    console.log('PayFast ITN validated successfully:', {
      payment_status: pfData.payment_status,
      m_payment_id: pfData.m_payment_id,
      pf_payment_id: pfData.pf_payment_id,
      amount_gross: pfData.amount_gross
    });
    
    // Here you can add logic to update your database, send emails, etc.
    // For example:
    // - Update quote payment status
    // - Send confirmation emails
    // - Log the transaction
    
    res.status(200).send('OK');

  } catch (error) {
    console.error('PayFast ITN handler error:', error);
    res.status(500).send('Error processing notification');
    return;
  }
};
