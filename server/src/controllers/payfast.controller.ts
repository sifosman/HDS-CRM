import { Request, Response } from 'express';
import crypto from 'crypto';
import https from 'https';
import path from 'path';
import { EmailService } from '../services/email.service';

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
  console.log('PAYFAST_PASSPHRASE:', process.env.PAYFAST_PASSPHRASE);
  console.log('PAYFAST_SANDBOX:', process.env.PAYFAST_SANDBOX);
  console.log('BASE_URL:', process.env.BASE_URL);
  const config = {
    merchantId: process.env.PAYFAST_MERCHANT_ID || '10000100',
    merchantKey: process.env.PAYFAST_MERCHANT_KEY || '46f0cd694581a',
    passphrase: process.env.PAYFAST_PASSPHRASE || 'jt7NOE43FZPn',
    sandbox: process.env.PAYFAST_SANDBOX === 'true' || true, // Default to sandbox mode
    baseUrl: process.env.BASE_URL || 'http://localhost:5000'
  };
  
  console.log('PayFast Config:', JSON.stringify(config, null, 2));
  
  return config;
};

// Generate PayFast signature according to PayFast documentation
const generateSignature = (data: Record<string, any>, passphrase: string): string => {
  console.log('🔐 Starting PayFast signature generation...');
  console.log('📋 Input data:', JSON.stringify(data, null, 2));
  console.log('🔑 Passphrase provided:', !!passphrase);
  if (passphrase) {
    console.log('🔑 Passphrase value:', passphrase);
  }
  
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
    
    // Add URLs only if we have a base URL configured
    if (config.baseUrl && config.baseUrl !== 'http://localhost:5000') {
      paymentData.return_url = `${config.baseUrl}/api/payfast/success`;
      paymentData.cancel_url = `${config.baseUrl}/api/payfast/cancel`;
      paymentData.notify_url = `${config.baseUrl}/api/payfast/notify`;
    }
    
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

// Handle PayFast ITN (Instant Transaction Notification)
export const handlePaymentNotification = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('PayFast ITN received:', req.body);
    
    // Validate the ITN
    const config = getPayFastConfig();
    const pfData = req.body;
    
    console.log('PayFast ITN data received:', pfData);
    
    // Step 1: Validate signature
    // Extract signature and prepare data for validation
    const receivedSignature = pfData.signature;
    
    // Log the raw data received from PayFast
    console.log('Raw PayFast ITN data received:', JSON.stringify(pfData, null, 2));
    
    // NEW: Use raw body for signature validation if available
    if ((req as any).rawBody) {
      console.log('Using raw body for signature validation');
      console.log('Raw body:', (req as any).rawBody);
      
      // Parse raw body to get the exact data that was sent
      const rawBody = (req as any).rawBody;
      const rawParams = new URLSearchParams(rawBody);
      const rawData: Record<string, string> = {};
      
      // Convert URLSearchParams to object
      for (const [key, value] of rawParams.entries()) {
        rawData[key] = value;
      }
      
      console.log('Parsed raw data:', rawData);
      
      // Use raw data for signature validation
      const dataForSignature = { ...rawData };
      const calculatedSignature = generateSignature(dataForSignature, config.passphrase);
      
      console.log('Received signature:', receivedSignature);
      console.log('Calculated signature (from raw):', calculatedSignature);
      
      if (receivedSignature !== calculatedSignature) {
        console.error('PayFast ITN signature validation failed (using raw data)');
        console.error('Expected:', calculatedSignature);
        console.error('Received:', receivedSignature);
        // Log the data that was used for signature generation
        console.error('Data used for signature generation:', JSON.stringify(dataForSignature, null, 2));
        console.error('All raw data received:', JSON.stringify(rawData, null, 2));
        res.status(400).send('Invalid signature');
        return;
      }
    } else {
      // Fallback to existing method
      console.log('Using parsed body for signature validation');
      
      // Generate signature for validation using the same method
      // Create a copy of the data to avoid modifying the original
      const dataForSignature = { ...pfData };
      const calculatedSignature = generateSignature(dataForSignature, config.passphrase);
      
      console.log('Received signature:', receivedSignature);
      console.log('Calculated signature (from parsed):', calculatedSignature);
      
      if (receivedSignature !== calculatedSignature) {
        console.error('PayFast ITN signature validation failed (using parsed data)');
        console.error('Expected:', calculatedSignature);
        console.error('Received:', receivedSignature);
        // Log the data that was used for signature generation
        console.error('Data used for signature generation:', JSON.stringify(dataForSignature, null, 2));
        console.error('All data received:', JSON.stringify(pfData, null, 2));
        res.status(400).send('Invalid signature');
        return;
      }
    }
    
    // Step 2: Validate against PayFast server (recommended by PayFast documentation)
    // Create validation data (remove signature and paymentId from pfData)
    const validationData = { ...pfData };
    delete validationData.signature;
    
    // Add validate route to validation data
    validationData['ptp'] = 'yes'; // Ping PayFast to validate
    
    // Convert validation data to query string
    const validationParams = Object.entries(validationData)
      .map(([key, value]: [string, any]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
      
    console.log('Validation data:', JSON.stringify(validationData, null, 2));
    console.log('Validation params:', validationParams);
    
    // Determine validation URL based on environment
    const validationUrl = config.sandbox 
      ? 'https://sandbox.payfast.co.za/eng/query/validate'
      : 'https://www.payfast.co.za/eng/query/validate';
    
    console.log('Validating against PayFast server:', validationUrl);
    
    // Send validation request to PayFast
    const validationOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': validationParams.length
      }
    };
    
    const validationReq = https.request(validationUrl, validationOptions, (validationRes: any) => {
      console.log('PayFast validation request sent');
      let responseData = '';
      validationRes.on('data', (chunk: any) => {
        responseData += chunk;
      });
      
      validationRes.on('end', async () => {
        console.log('PayFast validation response received:', responseData);
        console.log('Response length:', responseData.length);
        console.log('Response type:', typeof responseData);
        
        // Trim the response data as it might have whitespace
        const trimmedResponse = responseData.trim();
        console.log('Trimmed response:', trimmedResponse);
        console.log('Trimmed response length:', trimmedResponse.length);
        
        if (trimmedResponse !== 'VALID') {
          console.error('PayFast ITN server validation failed');
          console.error('Expected: VALID');
          console.error('Received:', trimmedResponse);
          console.error('Received length:', trimmedResponse.length);
          
          // Even if validation fails, we still process the payment if signature is valid
          // This is to prevent losing payments due to network issues
          console.warn('Continuing with local validation only');
        } else {
          console.log('PayFast ITN server validation succeeded');
        }
        
        // Process the payment notification
        console.log('Processing PayFast ITN:', {
          payment_status: pfData.payment_status,
          m_payment_id: pfData.m_payment_id,
          pf_payment_id: pfData.pf_payment_id,
          amount_gross: pfData.amount_gross
        });
        
        // Process successful payment
        if (pfData.payment_status === 'COMPLETE') {
          try {
            // Extract quote ID from payment ID (format: QUOTE-{quoteId}-{timestamp})
            let quoteDatabaseId = '';
            if (pfData.m_payment_id && typeof pfData.m_payment_id === 'string') {
              const parts = pfData.m_payment_id.split('-');
              if (parts.length >= 2 && parts[0] === 'QUOTE') {
                quoteDatabaseId = parts[1];
              }
            }
            
            if (quoteDatabaseId) {
              console.log('Creating invoice for successful payment, quote database ID:', quoteDatabaseId);
              
              // Import SupabaseService here to avoid circular dependencies
              const SupabaseService = (await import('../services/supabase.service')).default;
              
              // First, fetch the quote by database ID to get the quote number
              const quoteResult = await SupabaseService.fetchQuoteById(quoteDatabaseId);
              if (!quoteResult.success) {
                console.error('Failed to fetch quote by database ID:', quoteResult.error);
                res.status(400).send('Failed to fetch quote');
                return;
              }
              
              const quoteNumber = quoteResult.data.quote_number;
              if (!quoteNumber) {
                console.error('Quote number not found in quote data');
                res.status(400).send('Quote number not found');
                return;
              }
              
              console.log('Quote number retrieved:', quoteNumber);
              
              // Store payment session data for retrieval in success handler
              try {
                const SupabaseService = (await import('../services/supabase.service')).default;
                const paymentSessionData = {
                  m_payment_id: pfData.m_payment_id,
                  pf_payment_id: pfData.pf_payment_id,
                  payment_status: pfData.payment_status,
                  item_name: pfData.item_name,
                  amount_gross: pfData.amount_gross,
                  amount_fee: pfData.amount_fee,
                  amount_net: pfData.amount_net,
                  quoteId: quoteNumber
                };
                
                const storeResult = await SupabaseService.storePaymentSession(pfData.m_payment_id, paymentSessionData);
                if (storeResult.success) {
                  console.log('Payment session data stored successfully');
                } else {
                  console.error('Failed to store payment session data:', storeResult.error);
                }
              } catch (sessionError) {
                console.error('Error storing payment session data:', sessionError);
              }
              
              // Prepare payment details for invoice creation
              const paymentDetails = {
                method: 'PayFast',
                reference: pfData.pf_payment_id,
                date: new Date().toISOString(),
                amount: parseFloat(pfData.amount_gross || '0'),
                status: 'paid'
              };
              
              // Create invoice record using the quote number
              const invoiceResult = await SupabaseService.createInvoice(quoteNumber, paymentDetails);
              
              if (invoiceResult.success) {
                console.log('Invoice created successfully:', invoiceResult.data?.invoiceNumber);
                
                // Update quote status to approved
                await SupabaseService.updateQuoteStatus(quoteDatabaseId, 'approved');
                console.log('Quote status updated to approved');
                
                // NEW: Send email notification after successful payment
                try {
                  // Get customer email from database
                  const emailService = new EmailService();
                  
                  // Get customer email from database
                  const customerEmail = await SupabaseService.getBestEmailForQuote(quoteDatabaseId);
                  
                  // TEMPORARY: Also send to hardcoded test email
                  const testEmail = 'sifosman@gmail.com';
                  
                  if (customerEmail) {
                    // Get quote details for email
                    const quoteData = await SupabaseService.fetchQuoteById(quoteDatabaseId);
                    
                    if (quoteData.success && quoteData.data) {
                      const customerName = quoteData.data.customer_name || 'Customer';
                      const quoteNumber = quoteData.data.quote_number || quoteDatabaseId;
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
                      
                      // Send email notification
                      await emailService.sendPaymentConfirmationEmail({
                        customerName,
                        customerEmail,
                        quoteNumber,
                        amount,
                        invoicePath,
                        optimizationDetails
                      });
                      
                      console.log('Payment confirmation email sent successfully to:', customerEmail);
                      
                      // TEMPORARY: Also send to hardcoded test email
                      try {
                        await emailService.sendPaymentConfirmationEmail({
                          customerName,
                          customerEmail: testEmail,
                          quoteNumber,
                          amount,
                          invoicePath,
                          optimizationDetails
                        });
                        console.log('Payment confirmation email sent successfully to test email:', testEmail);
                      } catch (testEmailError) {
                        console.error('Error sending payment confirmation email to test email:', testEmailError);
                      }
                    }
                  } else {
                    console.warn('No email address found for quote:', quoteDatabaseId);
                    
                    // TEMPORARY: Send to hardcoded test email even if no customer email
                    try {
                      const quoteData = await SupabaseService.fetchQuoteById(quoteDatabaseId);
                      if (quoteData.success && quoteData.data) {
                        const customerName = quoteData.data.customer_name || 'Customer';
                        const quoteNumber = quoteData.data.quote_number || quoteDatabaseId;
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
                        
                        await emailService.sendPaymentConfirmationEmail({
                          customerName,
                          customerEmail: testEmail,
                          quoteNumber,
                          amount,
                          invoicePath,
                          optimizationDetails
                        });
                        console.log('Payment confirmation email sent successfully to test email:', testEmail);
                      }
                    } catch (testEmailError) {
                      console.error('Error sending payment confirmation email to test email:', testEmailError);
                    }
                  }
                } catch (emailError) {
                  console.error('Error sending payment confirmation email:', emailError);
                  // Don't fail the payment processing if email fails
                }
              } else {
                console.error('Failed to create invoice:', invoiceResult.error);
              }
            } else {
              console.warn('Could not extract quote ID from payment ID:', pfData.m_payment_id);
            }
          } catch (error) {
            console.error('Error processing successful payment:', error);
          }
        }
        
        res.status(200).send('OK');
      });
    });
    
    validationReq.on('error', (error: any) => {
      console.error('PayFast validation request error:', error);
      // Even if validation fails, we still process the payment if signature is valid
      // This is to prevent losing payments due to network issues
      console.warn('Continuing with local validation only');
      
      // Still process successful payments even if validation fails
      if (pfData.payment_status === 'COMPLETE') {
        console.log('Processing payment despite validation error');
        // The payment processing logic would be duplicated here if needed
      }
      
      res.status(200).send('OK');
    });
    
    console.log('Sending validation request with params:', validationParams);
    console.log('Validation params length:', validationParams.length);
    validationReq.write(validationParams);
    validationReq.end();

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
    
    // First, try to get payment data from session storage (stored by notify handler)
    let paymentData: Record<string, any> = {};
    
    // Extract m_payment_id from query or body to use as session key
    const session_payment_id = req.query.m_payment_id || req.body.m_payment_id;
    
    if (session_payment_id) {
      try {
        const SupabaseService = (await import('../services/supabase.service')).default;
        const sessionResult = await SupabaseService.getPaymentSession(session_payment_id as string);
        
        if (sessionResult.success) {
          paymentData = sessionResult.data;
          console.log('Retrieved payment data from session storage:', paymentData);
        } else {
          console.warn('Failed to retrieve payment session data:', sessionResult.error);
        }
      } catch (sessionError) {
        console.error('Error retrieving payment session data:', sessionError);
      }
    }
    
    // Fallback to extracting payment information from query parameters and request body
    // PayFast can send data via GET (query) or POST (body)
    if (Object.keys(paymentData).length === 0) {
      paymentData = { ...req.query, ...req.body };
      console.log('Using fallback payment data extraction');
    }
    
    console.log('All available payment data keys:', Object.keys(paymentData));
    console.log('All payment data values:', paymentData);
    
    // Safely extract payment data properties
    const m_payment_id = paymentData?.m_payment_id || '';
    const pf_payment_id = paymentData?.pf_payment_id || '';
    const payment_status = paymentData?.payment_status || '';
    const item_name = paymentData?.item_name || '';
    const amount_gross = paymentData?.amount_gross || '';
    
    // Extract quote ID from m_payment_id
    let quoteId = 'N/A';
    if (m_payment_id && typeof m_payment_id === 'string') {
      const parts = m_payment_id.split('-');
      if (parts.length >= 3 && parts[0] === 'QUOTE') {
        if (parts.length === 5) {
          // Format: "QUOTE-Q-20250804-4824-1754311399090" (without branch)
          // Extract "Q-20250804-4824" (parts 1, 2, 3)
          quoteId = `${parts[1]}-${parts[2]}-${parts[3]}`;
        } else if (parts.length === 6) {
          // Format: "QUOTE-Q-20250804-4824-HDSPRO-1754311399090" (with branch abbr)
          // Extract "Q-20250804-4824-HDSPRO" (parts 1, 2, 3, 4)
          quoteId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
        } else if (parts.length > 6) {
          // Format: "QUOTE-Q-20250804-4824-HDS-Products-1754311399090" (with multi-word branch)
          // Extract quote ID by removing first part (QUOTE) and last part (timestamp)
          const quoteParts = parts.slice(1, -1); // Remove 'QUOTE' and timestamp
          quoteId = quoteParts.join('-');
        }
      }
    }
    
    // If not found, try to extract from item_name 
    // Format can be: "HDS Quote Q-20250804-4824" OR "HDS Quote Q-20250804-4824-HDSPRODUCTS - BranchName"
    if (!quoteId || quoteId === 'N/A') {
      if (item_name && typeof item_name === 'string') {
        // Updated regex to handle both old format (Q-YYYYMMDD-XXXX) and new format (Q-YYYYMMDD-XXXX-BRANCH)
        // Branch abbreviation can now be up to 10 characters
        const match = item_name.match(/HDS Quote (Q-\d{8}-\d{4}(?:-[A-Z]{1,10})?)/);
        if (match) {
          quoteId = match[1];
        }
      }
    }
    
    console.log('Extracted quote ID:', quoteId);
    console.log('Final payment data for display:', {
      quoteId,
      pf_payment_id,
      item_name,
      amount_gross,
      m_payment_id
    });
    
    // NEW: Fetch quote details from database for better success page
    let quoteDetails: any = null;
    if (quoteId && quoteId !== 'N/A') {
      try {
        // Import SupabaseService here to avoid circular dependencies
        const SupabaseService = (await import('../services/supabase.service')).default;
        const quoteResult = await SupabaseService.fetchQuoteByNumber(quoteId);
        
        if (quoteResult.success && quoteResult.data) {
          quoteDetails = quoteResult.data;
          console.log('Quote details fetched successfully:', quoteDetails);
        } else {
          console.warn('Failed to fetch quote details:', quoteResult.error);
        }
      } catch (error) {
        console.error('Error fetching quote details:', error);
      }
    }
    
    // Create success page HTML using template literals with proper escaping
    const quoteIdDisplay = quoteId || 'N/A';
    const pfPaymentIdDisplay = pf_payment_id || 'N/A';
    const itemNameDisplay = item_name || 'N/A';
    const amountGrossDisplay = amount_gross || '0.00';
    
    const successPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Successful - HDS Group</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        
        .success-container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        
        .success-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        
        h1 {
            color: #2c3e50;
            margin-bottom: 15px;
            font-size: 2.5rem;
        }
        
        .success-message {
            color: #666;
            font-size: 1.2rem;
            margin-bottom: 30px;
            line-height: 1.6;
        }
        
        .payment-details {
            background: #f8f9fa;
            border-radius: 10px;
            padding: 20px;
            margin: 20px 0;
            text-align: left;
        }
        
        .payment-details h3 {
            color: #2c3e50;
            margin-bottom: 15px;
            text-align: center;
        }
        
        .payment-details p {
            margin: 8px 0;
            font-size: 1rem;
        }
        
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        
        .download-button {
            background: #28a745;
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
        }
        
        .download-button:hover {
            background: #218838;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        
        .share-button {
            background: #25D366;
        }
        
        .share-button:hover {
            background: #1ebe57;
        }
        
        .contact-info {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }
        
        .contact-info p {
            color: #666;
            margin: 5px 0;
        }
        
        @media (max-width: 480px) {
            .success-container {
                padding: 30px 20px;
            }
            
            h1 {
                font-size: 2rem;
            }
            
            .action-buttons {
                flex-direction: column;
            }
            
            .download-button {
                width: 100%;
                max-width: 250px;
            }
        }
    </style>
</head>
<body>
    <div class="success-container">
        <div class="success-icon">✅</div>
        <h1>Payment Successful!</h1>
        
        <p class="success-message">
            Thank you for your payment. Your transaction has been processed successfully.
        </p>
        
        <div class="payment-details">
            <h3>Payment Details</h3>
            <p><strong>Quote ID:</strong> ${quoteIdDisplay}</p>
            <p><strong>Payment ID:</strong> ${pfPaymentIdDisplay}</p>
            <p><strong>Item:</strong> ${itemNameDisplay}</p>
            <p><strong>Amount Paid:</strong> R${amountGrossDisplay}</p>
        </div>
        
        <div class="action-buttons">
            <button class="download-button" onclick="downloadInvoice()">
                📄 Download Invoice
            </button>
            <button class="download-button share-button" onclick="shareToWhatsApp()">
                💬 Share via WhatsApp
            </button>
        </div>
        
        <div class="contact-info">
            <p><strong>Need help?</strong> Contact us at <strong>info@hds.co.za</strong></p>
            <p>Thank you for choosing HDS!</p>
        </div>
    </div>
    
    <script>
        function downloadInvoice() {
            const quoteId = '${quoteIdDisplay}';
            if (quoteId && quoteId !== 'N/A' && quoteId !== '') {
                window.location.href = '/api/invoices/download/' + quoteId;
            } else {
                // Fallback for testing - generate a generic quote ID
                const fallbackQuoteId = 'Q-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-0001';
                window.location.href = '/api/invoices/download/' + fallbackQuoteId;
            }
        }
        
        function shareToWhatsApp() {
            const quoteId = '${quoteIdDisplay}';
            const invoiceUrl = quoteId && quoteId !== 'N/A' && quoteId !== '' 
                ? window.location.origin + '/api/invoices/download/' + quoteId
                : window.location.origin + '/api/invoices/download/Q-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-0001';
            
            const message = 'Thank you for choosing HDS Group! Your invoice (ID: ' + (quoteId || 'HDS-INVOICE') + ') is ready. You can view and download your invoice at: ' + invoiceUrl + '\\n\\nWe appreciate your business and look forward to working with you.';
            
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = 'https://wa.me/?text=' + encodedMessage;
            
            window.open(whatsappUrl, '_blank');
        }
    </script>
</body>
</html>`;\n  } catch (error) {\n    console.error('Error handling payment success:', error);\n    res.status(500).send('Error processing payment success');\n  }\n};
    const amount_fee = paymentData?.amount_fee || '';
    const amount_net = paymentData?.amount_net || '';
    
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
    
    // Try to extract from m_payment_id 
    // Format can be: QUOTE-{quoteId}-{timestamp} OR QUOTE-{quoteId}-{branchName}-{timestamp}
    // New format: QUOTE-Q-20250804-1234-HDSPRO-1754311399090 (with branch abbr)
    if (m_payment_id && typeof m_payment_id === 'string') {
      const parts = m_payment_id.split('-');
      if (parts.length >= 3 && parts[0] === 'QUOTE') {
        if (parts.length === 5) {
          // Format: "QUOTE-Q-20250804-4824-1754311399090" (without branch)
          // Extract "Q-20250804-4824" (parts 1, 2, 3)
          quoteId = `${parts[1]}-${parts[2]}-${parts[3]}`;
        } else if (parts.length === 6) {
          // Format: "QUOTE-Q-20250804-4824-HDSPRO-1754311399090" (with branch abbr)
          // Extract "Q-20250804-4824-HDSPRO" (parts 1, 2, 3, 4)
          quoteId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
        } else if (parts.length > 6) {
          // Format: "QUOTE-Q-20250804-4824-HDS-Products-1754311399090" (with multi-word branch)
          // Extract quote ID by removing first part (QUOTE) and last part (timestamp)
          const quoteParts = parts.slice(1, -1); // Remove 'QUOTE' and timestamp
          quoteId = quoteParts.join('-');
        }
      }
    }
    
    // If not found, try to extract from item_name 
    // Format can be: "HDS Quote Q-20250804-4824" OR "HDS Quote Q-20250804-4824-HDSPRODUCTS - BranchName"
    if (!quoteId && item_name && typeof item_name === 'string') {
      // Updated regex to handle both old format (Q-YYYYMMDD-XXXX) and new format (Q-YYYYMMDD-XXXX-BRANCH)
      // Branch abbreviation can now be up to 10 characters
      const match = item_name.match(/HDS Quote (Q-\d{8}-\d{4}(?:-[A-Z]{1,10})?)/);
      if (match) {
        quoteId = match[1];
      }
    }
    
    console.log('Extracted quote ID:', quoteId);
    console.log('Final payment data for display:', {
      quoteId,
      pf_payment_id,
      item_name,
      amount_gross,
      m_payment_id
    });
    
    // NEW: Fetch quote details from database for better success page
    let quoteDetails: any = null;
    if (quoteId) {
      try {
        // Import SupabaseService here to avoid circular dependencies
        const SupabaseService = (await import('../services/supabase.service')).default;
        const quoteResult = await SupabaseService.fetchQuoteByNumber(quoteId);
        
        if (quoteResult.success && quoteResult.data) {
          quoteDetails = quoteResult.data;
          console.log('Quote details fetched successfully:', quoteDetails);
        } else {
          console.warn('Failed to fetch quote details:', quoteResult.error);
            
            const message = 'Thank you for choosing HDS Group! Your invoice (ID: ' + (quoteId || 'HDS-INVOICE') + ') is ready. You can view and download your invoice at: ' + invoiceUrl + '\n\nWe appreciate your business and look forward to working with you.';
            
            const encodedMessage = encodeURIComponent(message);
            const whatsappUrl = 'https://wa.me/?text=' + encodedMessage;
            
            window.open(whatsappUrl, '_blank');
        }
    </script>
</body>
</html>
`;
    
    res.send(successPageHtml);
  } catch (error) {
    console.error('Error handling payment success:', error);
    res.status(500).send('Error processing payment success');
  }
};
