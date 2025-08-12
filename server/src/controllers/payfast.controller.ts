import { Request, Response } from 'express';
import crypto from 'crypto';
import https from 'https';
import path from 'path';
import { EmailService } from '../services/email.service';
import SupabaseService from '../services/supabase.service';

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
  console.log('Environment variables:');
  console.log('PAYFAST_MERCHANT_ID:', process.env.PAYFAST_MERCHANT_ID);
  console.log('PAYFAST_MERCHANT_KEY:', process.env.PAYFAST_MERCHANT_KEY);
  console.log('PAYFAST_PASSPHRASE set:', typeof process.env.PAYFAST_PASSPHRASE === 'string' && process.env.PAYFAST_PASSPHRASE.length > 0);

  console.log('PAYFAST_SANDBOX:', process.env.PAYFAST_SANDBOX);
  console.log('BASE_URL:', process.env.BASE_URL);
  const config = {
    merchantId: process.env.PAYFAST_MERCHANT_ID || '10000100',
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a',
    passphrase: process.env.PAYFAST_PASSPHRASE || '',

    sandbox: (process.env.PAYFAST_SANDBOX ?? 'true') === 'true', // Default true only if unset
    baseUrl: process.env.BASE_URL || 'http://localhost:5000'
  };
  
  console.log('PayFast Config:', JSON.stringify(config, null, 2));
  
  return config;
};

// Generate PayFast signature according to PayFast documentation
const generateSignature = (data: Record<string, any>, passphrase: string): string => {
  console.log('🔐 Starting PayFast signature generation...');
  console.log('📋 Input data:', JSON.stringify(data, null, 2));
  console.log('🔑 Passphrase provided:', !!(passphrase && passphrase.trim() !== ''));

  // Remove existing signature if present
  const { signature: existingSignature, ...dataForSignature } = data;
  
  console.log('📋 Data for signature (after removing existing signature):', JSON.stringify(dataForSignature, null, 2));

  
  // PayFast requires exact field order - NOT alphabetical
  // This is the correct field order according to PayFast documentation
  const fieldOrder = [
    // Merchant Details
    'merchant_id',
    'merchant_key',
    'return_url',
    'cancel_url',
    'notify_url',
    // Buyer Detail
    'name_first',
    'name_last',
    'email_address',
    'cell_number',
    // Transaction Details
    'm_payment_id',
    'amount',
    'item_name',
    'item_description',
    'custom_int1',
    'custom_int2',
    'custom_int3',
    'custom_int4',
    'custom_int5',
    'custom_str1',
    'custom_str2',
    'custom_str3',
    'custom_str4',
    'custom_str5',
    // Transaction Options
    'email_confirmation',
    'confirmation_address',
    // Set Payment Method
    'payment_method',
    // Recurring Billing Details
    'subscription_type',
    'billing_date',
    'recurring_amount',
    'frequency',
    'cycles'
  ];
  
  const paramPairs: string[] = [];
  
  // Build parameter string in exact order, only including non-empty values
  // First, filter out blank values and remove surrounding spaces
  const filteredData: Record<string, string> = {};
  Object.entries(dataForSignature).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      filteredData[key] = String(value).trim();
    }
  });
  
  // Build parameter string in exact order
  fieldOrder.forEach(key => {
    const value = filteredData[key];
    if (value !== undefined) {
      // URL encode the value according to PayFast requirements
      // Using encodeURIComponent and then replacing spaces with + to match Python's quote_plus
      const encodedValue = encodeURIComponent(value).replace(/%20/g, '+');
      paramPairs.push(`${key}=${encodedValue}`);
    }
  });
  
  // Create parameter string
  let paramString = paramPairs.join('&');
  
  // Remove the trailing '&' if it exists
  if (paramString.endsWith('&')) {
    paramString = paramString.slice(0, -1);
  }
  
  console.log('Param pairs:', paramPairs);
  console.log('Param string:', paramString);
  
  // Add passphrase if provided
  let stringToHash = paramString;
  if (passphrase && passphrase.trim() !== '') {
    // Remove the trailing '&' if it exists
    if (stringToHash.endsWith('&')) {
      stringToHash = stringToHash.slice(0, -1);
    }
    // Append passphrase
    stringToHash += `&passphrase=${passphrase.trim()}`;
    console.log('Adding passphrase to signature string');
  } else {
    // Remove the trailing '&' if it exists
    if (stringToHash.endsWith('&')) {
      stringToHash = stringToHash.slice(0, -1);
    }
  }
  
  console.log('PayFast signature string:', stringToHash);
  
  // Generate MD5 hash (must be lowercase)
  const generatedSignature = crypto.createHash('md5').update(stringToHash).digest('hex').toLowerCase();
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
    
    // Generate payment ID with quote ID (branch name is now included in quote ID itself)
    const paymentId = `QUOTE-${quoteId}-${Date.now()}`;
    console.log('Generated payment ID:', paymentId);
    
    // Prepare payment data - ensure all values are strings and properly formatted
    const paymentData: Record<string, string> = {
      merchant_id: config.merchantId,
      merchant_key: config.merchantKey,
      amount: parseFloat(amount.toString()).toFixed(2),
      item_name: `HDS Quote ${quoteId}`
    };
    
    // Always set URLs. If BASE_URL is not configured or is localhost, infer from request
    const forwardedProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = req.get('host');
    const inferredBaseUrl = `${forwardedProto}://${host}`;
    const baseUrlToUse = (config.baseUrl && config.baseUrl !== 'http://localhost:5000') ? config.baseUrl : inferredBaseUrl;
    // Include quoteId in the return URL so we can access it in the success page
    paymentData.return_url = `${baseUrlToUse}/api/payfast/success?quoteId=${encodeURIComponent(quoteId.toString())}`;
    paymentData.cancel_url = `${baseUrlToUse}/api/payfast/cancel`;
    paymentData.notify_url = `${baseUrlToUse}/api/payfast/notify`;
    
    // Add payment ID
    if (paymentId) {
      paymentData.m_payment_id = paymentId;
    }
    
    // Add project name as item description
    if (projectName) {
      paymentData.item_description = projectName.toString();
    }
    
    // Add customer details if provided
    if (customerName) {
      const nameParts = customerName.toString().split(' ');
      paymentData.name_first = nameParts[0] || '';
      paymentData.name_last = nameParts.slice(1).join(' ') || '';
    }
    
    if (customerEmail) {
      paymentData.email_address = customerEmail.toString();
    }
    
    console.log('PayFast payment data before signature:', JSON.stringify(paymentData, null, 2));

    // Generate signature
    const signature = generateSignature(paymentData, config.passphrase);
    paymentData.signature = signature;
    
    console.log('Final PayFast payment data being sent:', JSON.stringify(paymentData, null, 2));

    // Determine PayFast URL
    const payfastUrl = config.sandbox 
      ? 'https://sandbox.payfast.co.za/eng/process'
      : 'https://www.payfast.co.za/eng/process';
    console.log('Using PayFast endpoint:', payfastUrl, 'sandbox=', config.sandbox);

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

// Internal background processing endpoint for ITN (invoice + email)
// NOTE: This is a minimal implementation to enable async flow without timeouts.
// Heavy processing (invoice creation, PDF generation, email sending) should run here.
export const processItnJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers['x-internal-token'];
    const expected = process.env.ITN_PROCESS_TOKEN || 'local-dev-token';
    if (!token || token !== expected) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { pfData } = req.body || {};
    if (!pfData) {
      res.status(400).json({ error: 'Missing pfData' });
      return;
    }

    const startTs = Date.now();
    const triggerSource = (req.headers['x-trigger-source'] as string) || 'itn';
    console.log('🧰 Received ITN for background processing (source:', triggerSource + '):', pfData);

    // Only handle complete payments
    if (pfData.payment_status !== 'COMPLETE') {
      console.log('⏭️ Skipping ITN processing: payment_status is not COMPLETE:', pfData.payment_status);
      res.status(200).json({ ok: true, skipped: true, reason: 'Not COMPLETE' });
      return;
    }

    // Extract quoteId (reuse logic similar to success handler)
    let quoteId = '';
    if (pfData.m_payment_id && typeof pfData.m_payment_id === 'string') {
      const parts = pfData.m_payment_id.split('-');
      if (parts.length >= 3 && parts[0] === 'QUOTE') {
        if (parts.length === 5) {
          quoteId = `${parts[1]}-${parts[2]}-${parts[3]}`;
        } else if (parts.length === 6) {
          quoteId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
        } else if (parts.length > 6) {
          const quoteParts = parts.slice(1, -1);
          quoteId = quoteParts.join('-');
        }
      }
    }
    if (!quoteId && pfData.item_name && typeof pfData.item_name === 'string') {
      const match = pfData.item_name.match(/HDS Quote (Q-\d{8}-\d{4}(?:-[A-Z]{1,10})?)/);
      if (match) quoteId = match[1];
    }
    console.log('🧾 Extracted quoteId:', quoteId);

    // Resolve recipient (branch email first, then customer, then default)
    let recipient = '';
    try {
      if (quoteId) {
        console.log('🔎 Resolving best recipient for quote:', quoteId);
        const best = await SupabaseService.getBestEmailForQuote(quoteId);
        if (best) recipient = best;
      }
    } catch (e) {
      console.error('Error resolving best email for quote:', e);
    }
    const hardcodedTest = process.env.TEST_NOTIFICATION_EMAIL; // optional testing override
    const defaultRecipient = process.env.DEFAULT_NOTIFICATION_EMAIL || '';
    const customerEmail = pfData.email_address || '';
    recipient = (hardcodedTest && hardcodedTest.trim()) || recipient || customerEmail || defaultRecipient;
    if (!recipient) {
      console.warn('⚠️ No recipient email resolved. Set DEFAULT_NOTIFICATION_EMAIL or ensure branch/customer email present.');
    }
    console.log('📨 Resolved recipient:', recipient || '(none)');

    // Compute amount (fallback to PayFast amount_gross)
    let amount = 0;
    if (pfData.amount_gross) {
      const parsed = parseFloat(String(pfData.amount_gross));
      if (!Number.isNaN(parsed)) amount = parsed;
    }
    console.log('💰 Email amount (gross fallback):', amount);

    // Prepare email data
    const customerName = [pfData.name_first, pfData.name_last].filter(Boolean).join(' ').trim() || 'Customer';
    const emailService = new EmailService();

    try {
      console.log('📧 Sending payment confirmation email...');
      await emailService.sendPaymentConfirmationEmail({
        customerName,
        customerEmail: recipient,
        quoteNumber: quoteId || (pfData.m_payment_id || 'UNKNOWN'),
        amount,
        optimizationDetails: {}
      });
      console.log('✅ Email sent successfully to', recipient);
    } catch (mailErr) {
      console.error('❌ Email send failed:', mailErr);
      // Do not fail the HTTP response due to email failure; just log
    }

    const ms = Date.now() - startTs;
    console.log(`🏁 ITN background job finished in ${ms}ms`);
    res.status(200).json({ ok: true, received: true, tookMs: ms });
  } catch (err) {
    console.error('processItnJob error:', err);
    res.status(500).json({ error: 'Failed to process ITN job' });
  }
};

// Handle PayFast ITN (Instant Transaction Notification)
export const handlePaymentNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🔔 PayFast ITN Handler Started');
    // Always ACK immediately to prevent Vercel timeouts
    res.status(200).send('OK');
    const pfData = req.body || {};
    // Trigger background processing asynchronously without blocking the handler
    setTimeout(() => {
      try {
        const forwardedProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = req.get('host');
        const baseUrl = `${forwardedProto}://${host}`;
        const processUrl = `${baseUrl}/api/payfast/process-itn`;
        const payload = JSON.stringify({ pfData });
        const token = process.env.ITN_PROCESS_TOKEN || 'local-dev-token';
        void fetch(processUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': token,
            'x-trigger-source': 'itn'
          },
          body: payload
        }).then(async (r) => {
          try { const t = await r.text(); console.log('Background ITN processing response:', r.status, t); } catch {}
        }).catch((e) => console.error('Background ITN processing error:', e));
      } catch (bgErr) {
        console.error('Failed to trigger background ITN processing:', bgErr);
      }
    }, 0);
    return;

  } catch (error) {
    console.error('PayFast ITN handler error:', error);
    res.status(500).send('Error processing notification');
    return;
  }
};



// Handle successful payment return from PayFast
export const handlePaymentSuccess = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('PayFast payment success callback received');
    console.log('Query parameters:', req.query);
    console.log('Request body:', req.body);
    console.log('Request method:', req.method);
    
    // Extract payment information from both query parameters and request body
    // PayFast can send data via GET (query) or POST (body)
    const paymentData = { ...req.query, ...req.body };
    
    console.log('All available payment data keys:', Object.keys(paymentData));
    console.log('All payment data values:', paymentData);
    
    const { 
      m_payment_id, 
      pf_payment_id, 
      payment_status, 
      item_name, 
      amount_gross,
      amount_fee,
      amount_net
    } = paymentData;
    
    console.log('Payment success details:', {
      m_payment_id,
      pf_payment_id,
      payment_status,
      item_name,
      amount_gross,
      amount_fee,
      amount_net
    });
    
    // Extract quote ID from payment ID or item name
    let quoteId = '';
    
    console.log('Attempting to extract quote ID from m_payment_id:', m_payment_id);
    console.log('Attempting to extract quote ID from item_name:', item_name);
    console.log('Attempting to extract quote ID from query parameters:', req.query.quoteId);
    
    // First, try to get quoteId from query parameters (added to return_url)
    if (req.query.quoteId && typeof req.query.quoteId === 'string') {
      quoteId = req.query.quoteId;
      console.log('Extracted quoteId from query parameters:', quoteId);
    }
    
    // If not found in query parameters, try to extract from m_payment_id 
    // Format can be: QUOTE-{quoteId}-{timestamp} OR QUOTE-{quoteId}-{branchName}-{timestamp}
    // New format: QUOTE-Q-20250804-1234-HDSPRO-1754311399090 (with branch abbr)
    if (!quoteId && m_payment_id && typeof m_payment_id === 'string') {
      const parts = m_payment_id.split('-');
      console.log('m_payment_id parts:', parts);
      console.log('Number of parts:', parts.length);
      if (parts.length >= 3 && parts[0] === 'QUOTE') {
        if (parts.length === 5) {
          // Format: "QUOTE-Q-20250804-4824-1754311399090" (without branch)
          // Extract "Q-20250804-4824" (parts 1, 2, 3)
          quoteId = `${parts[1]}-${parts[2]}-${parts[3]}`;
          console.log('Extracted quoteId from 5-part format:', quoteId);
        } else if (parts.length === 6) {
          // Format: "QUOTE-Q-20250804-4824-HDSPRO-1754311399090" (with branch abbr)
          // Extract "Q-20250804-4824-HDSPRO" (parts 1, 2, 3, 4)
          quoteId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
          console.log('Extracted quoteId from 6-part format:', quoteId);
        } else if (parts.length > 6) {
          // Format: "QUOTE-Q-20250804-4824-HDS-Products-1754311399090" (with multi-word branch)
          // Extract quote ID by removing first part (QUOTE) and last part (timestamp)
          const quoteParts = parts.slice(1, -1); // Remove 'QUOTE' and timestamp
          quoteId = quoteParts.join('-');
          console.log('Extracted quoteId from multi-part format:', quoteId);
        } else {
          console.log('m_payment_id format not recognized, parts length:', parts.length);
        }
      } else {
        console.log('m_payment_id does not start with QUOTE or has less than 3 parts');
      }
    } else if (quoteId) {
      console.log('Skipping m_payment_id extraction as quoteId already found from query parameters');
    } else {
      console.log('m_payment_id is not a valid string:', m_payment_id);
    }
    
    // If not found, try to extract from item_name 
    // Format can be: "HDS Quote Q-20250804-4824" OR "HDS Quote Q-20250804-4824-HDSPRODUCTS - BranchName"
    if (!quoteId && item_name && typeof item_name === 'string') {
      console.log('Trying to extract from item_name');
      // Updated regex to handle both old format (Q-YYYYMMDD-XXXX) and new format (Q-YYYYMMDD-XXXX-BRANCH)
      // Branch abbreviation can now be up to 10 characters
      const match = item_name.match(/HDS Quote (Q-\d{8}-\d{4}(?:-[A-Z]{1,10})?)/);
      console.log('Regex match result:', match);
      if (match) {
        quoteId = match[1];
        console.log('Extracted quoteId from item_name:', quoteId);
      } else {
        console.log('No match found in item_name');
      }
    } else if (quoteId) {
      console.log('Skipping item_name extraction as quoteId already found');
    }
    
    console.log('Final extracted quote ID:', quoteId);
    console.log('Final payment data for display:', {
      quoteId,
      pf_payment_id,
      item_name,
      amount_gross,
      m_payment_id
    });
    
    // Optional fallback: trigger background email/invoice processing from success route
    // Controlled by env TRIGGER_ITN_FROM_SUCCESS to avoid duplicates if ITN also arrives
    if ((process.env.TRIGGER_ITN_FROM_SUCCESS || 'false') === 'true') {
      try {
        const forwardedProto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
        const host = req.get('host');
        const baseUrl = `${forwardedProto}://${host}`;
        const processUrl = `${baseUrl}/api/payfast/process-itn`;

        const pfData: any = {
          payment_status: 'COMPLETE',
          m_payment_id: m_payment_id || (quoteId ? `QUOTE-${quoteId}-${Date.now()}` : undefined),
          item_name: item_name || (quoteId ? `HDS Quote ${quoteId}` : undefined),
          email_address: (req.query?.email as string) || (req.body?.email as string) || undefined,
          name_first: (req.query?.name_first as string) || (req.body?.name_first as string) || undefined,
          name_last: (req.query?.name_last as string) || (req.body?.name_last as string) || undefined,
          amount_gross: amount_gross || undefined
        };

        const token = process.env.ITN_PROCESS_TOKEN || 'local-dev-token';
        // Fire-and-forget; do not await to keep success page fast
        // Node 18+ on Vercel has global fetch
        void fetch(processUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-token': token,
            'x-trigger-source': 'success'
          },
          body: JSON.stringify({ pfData })
        }).then(async (r) => {
          try { const t = await r.text(); console.log('🔁 Success fallback trigger response:', r.status, t); } catch {}
        }).catch((e) => console.error('Success fallback trigger failed:', e));
        console.log('🔁 Success handler triggered background process-itn (fallback)');
      } catch (e) {
        console.error('Failed to trigger background from success handler:', e);
      }
    }

    // Skip database lookup - quote details will be handled by invoice controller
    // The success page only needs the quote ID for download functionality
    
    // Create simplified success page HTML with just success message and buttons
    const successPageHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful - HDS</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            
            .success-container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                padding: 40px;
                text-align: center;
                max-width: 500px;
                width: 100%;
                position: relative;
                overflow: hidden;
            }
            
            .success-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 5px;
                background: linear-gradient(90deg, #28a745, #20c997, #17a2b8);
            }
            
            .success-icon {
                width: 80px;
                height: 80px;
                background: #28a745;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 30px;
                animation: pulse 2s infinite;
            }
            
            .success-icon::after {
                content: '✓';
                color: white;
                font-size: 40px;
                font-weight: bold;
            }
            
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); }
            }
            
            h1 {
                color: #28a745;
                font-size: 2.5rem;
                margin-bottom: 20px;
                font-weight: 700;
            }
            
            .subtitle {
                color: #6c757d;
                font-size: 1.2rem;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            
            .action-buttons {
                display: flex;
                flex-direction: column;
                gap: 15px;
                margin: 30px 0;
            }
            
            .btn {
                background: linear-gradient(135deg, #28a745, #20c997);
                color: white;
                border: none;
                padding: 15px 30px;
                border-radius: 50px;
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                display: block;
                text-align: center;
                box-shadow: 0 4px 15px rgba(40, 167, 69, 0.3);
            }
            
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
            }
            
            .btn-whatsapp {
                background: linear-gradient(135deg, #25D366, #128C7E);
                box-shadow: 0 4px 15px rgba(37, 211, 102, 0.3);
            }
            
            .btn-whatsapp:hover {
                box-shadow: 0 6px 20px rgba(37, 211, 102, 0.4);
            }
            
            .footer-text {
                color: #6c757d;
                font-size: 0.9rem;
                margin-top: 30px;
                line-height: 1.4;
            }
            
            @media (max-width: 768px) {
                .success-container {
                    padding: 30px 20px;
                }
                
                h1 {
                    font-size: 2rem;
                }
                
                .btn {
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <script>
            function shareOnWhatsApp(quoteId) {
                const button = event.target;
                const originalText = button.textContent;
                
                // Show loading state
                button.textContent = 'Preparing...';
                button.disabled = true;
                
                // Get the invoice PDF URL
                const pdfUrl = window.location.origin + '/api/invoices/download/' + quoteId;
                
                // Create a thank you message from HDS stating that the invoice is ready
                var thankYouMessage = 'Thank you for your payment! Your invoice (ID: ' + quoteId + ') is now ready.';
                
                // Always include the PDF link
                thankYouMessage += ' You can view and download your invoice at: ' + pdfUrl + '\n\nWe appreciate your business and look forward to working with you.';
                
                // Encode the message for the WhatsApp URL
                var encodedMessage = encodeURIComponent(thankYouMessage);
                
                // Create the WhatsApp URL with the encoded message
                var whatsappUrl = 'https://wa.me/?text=' + encodedMessage;
                
                // Open the URL in a new window/tab
                window.open(whatsappUrl, '_blank');
                
                // Reset button state
                button.textContent = originalText;
                button.disabled = false;
            }
        </script>
        <div class="success-container">
            <div class="success-icon"></div>
            
            <h1>Payment Successful!</h1>
            <p class="subtitle">
                Thank you for your payment. Your transaction has been processed successfully.
            </p>
            
            <div class="action-buttons">
                ${quoteId ? '<a href="/api/invoices/download/' + quoteId + '" class="btn" target="_blank" rel="noopener">📥 Download Invoice</a>' : ''}
                ${quoteId ? '<a href="/api/invoices/download/' + quoteId + '" class="btn btn-secondary" target="_blank" rel="noopener">📄 Download PDF</a>' : ''}
                ${quoteId ? '<button onclick="shareOnWhatsApp(\'' + quoteId + '\')" class="btn btn-whatsapp">💬 Share on WhatsApp</button>' : ''}
            </div>
            
            <p class="footer-text">
                A confirmation email will be sent to you shortly. If you have any questions, 
                please contact our support team.
            </p>
        </div>
    </body>
    </html>
    `;
    
    res.send(successPageHtml);
    
  } catch (error) {
    console.error('Error handling payment success:', error);
    res.status(500).send('Error processing payment success');
  }
};

// Handle payment cancellation return from PayFast
export const handlePaymentCancel = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('PayFast payment cancellation callback received');
    console.log('Query parameters:', req.query);
    
    // Create cancellation page HTML
    const cancelPageHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Cancelled - HDS</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #ffeaa7 0%, #fab1a0 100%);
                min-height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 20px;
            }
            
            .cancel-container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
                padding: 40px;
                text-align: center;
                max-width: 500px;
                width: 100%;
                position: relative;
                overflow: hidden;
            }
            
            .cancel-container::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 5px;
                background: linear-gradient(90deg, #ffc107, #fd7e14, #dc3545);
            }
            
            .cancel-icon {
                width: 80px;
                height: 80px;
                background: #ffc107;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 30px;
            }
            
            .cancel-icon::after {
                content: '⚠';
                color: white;
                font-size: 40px;
                font-weight: bold;
            }
            
            h1 {
                color: #dc3545;
                font-size: 2.5rem;
                margin-bottom: 20px;
                font-weight: 700;
            }
            
            .subtitle {
                color: #6c757d;
                font-size: 1.2rem;
                margin-bottom: 30px;
                line-height: 1.5;
            }
            
            .action-btn {
                background: linear-gradient(135deg, #007bff, #0056b3);
                color: white;
                border: none;
                padding: 15px 40px;
                border-radius: 50px;
                font-size: 1.1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                display: inline-block;
                margin: 10px;
                box-shadow: 0 4px 15px rgba(0, 123, 255, 0.3);
            }
            
            .action-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 6px 20px rgba(0, 123, 255, 0.4);
            }
            
            .secondary-btn {
                background: linear-gradient(135deg, #6c757d, #495057);
                box-shadow: 0 4px 15px rgba(108, 117, 125, 0.3);
            }
            
            .secondary-btn:hover {
                box-shadow: 0 6px 20px rgba(108, 117, 125, 0.4);
            }
            
            @media (max-width: 768px) {
                .cancel-container {
                    padding: 30px 20px;
                }
                
                h1 {
                    font-size: 2rem;
                }
                
                .action-btn {
                    display: block;
                    margin: 10px 0;
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="cancel-container">
            <div class="cancel-icon"></div>
            
            <h1>Payment Cancelled</h1>
            <p class="subtitle">
                Your payment was cancelled. No charges have been made to your account.
            </p>
            
            <div class="action-buttons">
                <a href="javascript:history.back()" class="action-btn">Try Again</a>
                <a href="/" class="action-btn secondary-btn">Return to Home</a>
            </div>
        </div>
        
        <script>
            function downloadInvoice(quoteId) {
                console.log('Downloading invoice for quote:', quoteId);
                
                // Create download link
                const link = document.createElement('a');
                link.href = '/api/invoices/download/' + quoteId;
                link.download = 'invoice-' + quoteId + '.pdf';
                link.target = '_blank';
                
                // Show loading state
                const btn = event.target;
                const originalText = btn.textContent;
                btn.textContent = 'Downloading...';
                btn.disabled = true;
                
                // Start download
                link.click();
                
                // Reset button after delay
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, 2000);
            }
        </script>
    </body>
    </html>
    `;
    
    res.send(cancelPageHtml);
    
  } catch (error) {
    console.error('Error handling payment cancellation:', error);
    res.status(500).send('Error processing payment cancellation');
  }
};
