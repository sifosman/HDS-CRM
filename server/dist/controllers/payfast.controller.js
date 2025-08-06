"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePaymentCancel = exports.handlePaymentSuccess = exports.handlePaymentNotification = exports.generatePaymentForm = void 0;
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const email_service_1 = require("../services/email.service");
// Get PayFast configuration from environment variables
const getPayFastConfig = () => {
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
const generateSignature = (data, passphrase) => {
    console.log('🔐 Starting PayFast signature generation...');
    console.log('📋 Input data:', JSON.stringify(data, null, 2));
    console.log('🔑 Passphrase provided:', !!passphrase);
    if (passphrase) {
        console.log('🔑 Passphrase value:', passphrase);
    }
    // Remove existing signature if present
    const { signature: existingSignature } = data, dataForSignature = __rest(data, ["signature"]);
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
    const paramPairs = [];
    // Build parameter string in exact order, only including non-empty values
    // First, filter out blank values and remove surrounding spaces
    const filteredData = {};
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
    }
    else {
        // Remove the trailing '&' if it exists
        if (stringToHash.endsWith('&')) {
            stringToHash = stringToHash.slice(0, -1);
        }
    }
    console.log('PayFast signature string:', stringToHash);
    // Generate MD5 hash (must be lowercase)
    const generatedSignature = crypto_1.default.createHash('md5').update(stringToHash).digest('hex').toLowerCase();
    console.log('Generated signature:', generatedSignature);
    return generatedSignature;
};
// Generate payment form for a quote
const generatePaymentForm = async (req, res) => {
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
        const paymentData = {
            merchant_id: config.merchantId,
            merchant_key: config.merchantKey,
            amount: parseFloat(amount.toString()).toFixed(2),
            item_name: `HDS Quote ${quoteId}`
        };
        // Add URLs only if we have a base URL configured
        if (config.baseUrl && config.baseUrl !== 'http://localhost:5000') {
            // Include quoteId in the return URL so we can access it in the success page
            paymentData.return_url = `${config.baseUrl}/api/payfast/success?quoteId=${encodeURIComponent(quoteId.toString())}`;
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
                ${Object.entries(paymentData).map(([key, value]) => `<input type="hidden" name="${key}" value="${value}">`).join('\n                ')}
                
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
    }
    catch (error) {
        console.error('PayFast payment form generation error:', error);
        res.status(500).json({
            error: 'Failed to generate payment form',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
    }
};
exports.generatePaymentForm = generatePaymentForm;
// Handle PayFast ITN (Instant Transaction Notification)
const handlePaymentNotification = async (req, res) => {
    try {
        console.log('🔔 PayFast ITN Handler Started - Email sending happens here!');
        console.log('📋 Request Method:', req.method);
        console.log('📋 Request Headers:', req.headers);
        console.log('📋 Request Body:', req.body);
        console.log('📋 Raw Body Available:', !!req.rawBody);
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
        if (req.rawBody) {
            console.log('Using raw body for signature validation');
            console.log('Raw body:', req.rawBody);
            // Parse raw body to get the exact data that was sent
            const rawBody = req.rawBody;
            const rawParams = new URLSearchParams(rawBody);
            const rawData = {};
            // Convert URLSearchParams to object
            for (const [key, value] of rawParams.entries()) {
                rawData[key] = value;
            }
            console.log('Parsed raw data:', rawData);
            // Use raw data for signature validation
            const dataForSignature = Object.assign({}, rawData);
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
        }
        else {
            // Fallback to existing method
            console.log('Using parsed body for signature validation');
            // Generate signature for validation using the same method
            // Create a copy of the data to avoid modifying the original
            const dataForSignature = Object.assign({}, pfData);
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
        const validationData = Object.assign({}, pfData);
        delete validationData.signature;
        // Add validate route to validation data
        validationData['ptp'] = 'yes'; // Ping PayFast to validate
        // Convert validation data to query string
        const validationParams = Object.entries(validationData)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
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
        const validationReq = https_1.default.request(validationUrl, validationOptions, (validationRes) => {
            console.log('PayFast validation request sent');
            let responseData = '';
            validationRes.on('data', (chunk) => {
                responseData += chunk;
            });
            validationRes.on('end', async () => {
                var _a, _b;
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
                }
                else {
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
                        let quoteId = '';
                        if (pfData.m_payment_id && typeof pfData.m_payment_id === 'string') {
                            const parts = pfData.m_payment_id.split('-');
                            if (parts.length >= 3 && parts[0] === 'QUOTE') {
                                // Extract the quote ID which is everything between QUOTE- and the timestamp
                                // e.g., QUOTE-Q-20250805-4235-HDSEMPA-1722845798000
                                // quoteId should be Q-20250805-4235-HDSEMPA
                                quoteId = parts.slice(1, parts.length - 1).join('-');
                            }
                        }
                        if (quoteId) {
                            console.log('Creating invoice for successful payment, quote ID:', quoteId);
                            // Import SupabaseService here to avoid circular dependencies
                            const SupabaseService = (await Promise.resolve().then(() => __importStar(require('../services/supabase.service')))).default;
                            // Use the quoteId directly (which is the quote_number) to create the invoice
                            console.log('Using quote ID as quote number:', quoteId);
                            // Prepare payment details for invoice creation
                            const paymentDetails = {
                                method: 'PayFast',
                                reference: pfData.pf_payment_id,
                                date: new Date().toISOString(),
                                amount: parseFloat(pfData.amount_gross || '0'),
                                status: 'paid'
                            };
                            // Create invoice record using the quote ID (which is the quote_number)
                            const invoiceResult = await SupabaseService.createInvoice(quoteId, paymentDetails);
                            if (invoiceResult.success) {
                                console.log('Invoice created successfully:', (_a = invoiceResult.data) === null || _a === void 0 ? void 0 : _a.invoiceNumber);
                                // Update invoice status to paid
                                if ((_b = invoiceResult.data) === null || _b === void 0 ? void 0 : _b.invoiceNumber) {
                                    await SupabaseService.updateInvoiceStatus(invoiceResult.data.invoiceNumber, 'paid');
                                    console.log('Invoice status updated to paid');
                                    // Generate and upload invoice PDF
                                    try {
                                        console.log('Starting invoice PDF generation for quote:', quoteId, 'invoice number:', invoiceResult.data.invoiceNumber);
                                        const pdfResult = await SupabaseService.generateAndUploadInvoicePdf(quoteId, invoiceResult.data.invoiceNumber);
                                        if (pdfResult.success && pdfResult.publicUrl) {
                                            console.log('Invoice PDF generated and uploaded successfully:', pdfResult.publicUrl);
                                        }
                                        else {
                                            console.error('Failed to generate or upload invoice PDF:', pdfResult.error);
                                        }
                                    }
                                    catch (pdfError) {
                                        console.error('Error generating/uploading invoice PDF:', pdfError);
                                    }
                                }
                                // Update quote status to approved
                                await SupabaseService.updateQuoteStatus(quoteId, 'approved');
                                console.log('Quote status updated to approved');
                                // NEW: Send email notification after successful payment
                                try {
                                    console.log('📧 EMAIL SENDING STARTED - This is where emails are sent!');
                                    const emailService = new email_service_1.EmailService();
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
                                        /* ORIGINAL LOGIC - COMMENTED FOR TESTING
                                        // Get customer email from database
                                        const customerEmail = await SupabaseService.getBestEmailForQuote(quoteId);
                                        
                                        if (customerEmail) {
                                          // Send email notification to branch/customer
                                          await emailService.sendPaymentConfirmationEmail({
                                            customerName,
                                            customerEmail,
                                            quoteNumber,
                                            amount,
                                            invoicePath,
                                            optimizationDetails
                                          });
                                          
                                          console.log('Payment confirmation email sent successfully to:', customerEmail);
                                        } else {
                                          console.warn('No email address found for quote:', quoteId);
                                        }
                                        */
                                    }
                                }
                                catch (emailError) {
                                    console.error('❌ EMAIL SENDING FAILED:', emailError);
                                    console.error('❌ Email error details:', {
                                        message: emailError === null || emailError === void 0 ? void 0 : emailError.message,
                                        stack: emailError === null || emailError === void 0 ? void 0 : emailError.stack,
                                        name: emailError === null || emailError === void 0 ? void 0 : emailError.name
                                    });
                                    // Don't fail the payment processing if email fails
                                }
                            }
                            else {
                                console.error('Failed to create invoice:', invoiceResult.error);
                            }
                        }
                        else {
                            console.warn('Could not extract quote ID from payment ID:', pfData.m_payment_id);
                        }
                    }
                    catch (error) {
                        console.error('Error processing successful payment:', error);
                    }
                }
                res.status(200).send('OK');
            });
        });
        validationReq.on('error', (error) => {
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
    }
    catch (error) {
        console.error('PayFast ITN handler error:', error);
        res.status(500).send('Error processing notification');
        return;
    }
};
exports.handlePaymentNotification = handlePaymentNotification;
// Handle successful payment return from PayFast
const handlePaymentSuccess = async (req, res) => {
    try {
        console.log('PayFast payment success callback received');
        console.log('Query parameters:', req.query);
        console.log('Request body:', req.body);
        console.log('Request method:', req.method);
        // Extract payment information from both query parameters and request body
        // PayFast can send data via GET (query) or POST (body)
        const paymentData = Object.assign(Object.assign({}, req.query), req.body);
        console.log('All available payment data keys:', Object.keys(paymentData));
        console.log('All payment data values:', paymentData);
        const { m_payment_id, pf_payment_id, payment_status, item_name, amount_gross, amount_fee, amount_net } = paymentData;
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
                }
                else if (parts.length === 6) {
                    // Format: "QUOTE-Q-20250804-4824-HDSPRO-1754311399090" (with branch abbr)
                    // Extract "Q-20250804-4824-HDSPRO" (parts 1, 2, 3, 4)
                    quoteId = `${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`;
                    console.log('Extracted quoteId from 6-part format:', quoteId);
                }
                else if (parts.length > 6) {
                    // Format: "QUOTE-Q-20250804-4824-HDS-Products-1754311399090" (with multi-word branch)
                    // Extract quote ID by removing first part (QUOTE) and last part (timestamp)
                    const quoteParts = parts.slice(1, -1); // Remove 'QUOTE' and timestamp
                    quoteId = quoteParts.join('-');
                    console.log('Extracted quoteId from multi-part format:', quoteId);
                }
                else {
                    console.log('m_payment_id format not recognized, parts length:', parts.length);
                }
            }
            else {
                console.log('m_payment_id does not start with QUOTE or has less than 3 parts');
            }
        }
        else if (quoteId) {
            console.log('Skipping m_payment_id extraction as quoteId already found from query parameters');
        }
        else {
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
            }
            else {
                console.log('No match found in item_name');
            }
        }
        else if (quoteId) {
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
    }
    catch (error) {
        console.error('Error handling payment success:', error);
        res.status(500).send('Error processing payment success');
    }
};
exports.handlePaymentSuccess = handlePaymentSuccess;
// Handle payment cancellation return from PayFast
const handlePaymentCancel = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error handling payment cancellation:', error);
        res.status(500).send('Error processing payment cancellation');
    }
};
exports.handlePaymentCancel = handlePaymentCancel;
