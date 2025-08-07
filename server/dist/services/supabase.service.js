"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
/**
 * Supabase service for database operations
 */
const SupabaseService = {
    /**
     * Test connection to Supabase
     */
    async checkConnection() {
        try {
            const { data, error } = await supabase.from('products').select('count', { count: 'exact', head: true });
            if (error) {
                console.error('Supabase connection error:', error);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Error checking Supabase connection:', error);
            return false;
        }
    },
    /**
     * Get product details by product code
     */
    async getProductDetails(productCode) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('product_code', productCode)
                .single();
            if (error) {
                console.error(`Error fetching product details for ${productCode}:`, error);
                return { success: false, error: error.message };
            }
            if (!data) {
                return { success: false, error: 'Product not found' };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in getProductDetails for ${productCode}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get product pricing by product code (legacy method)
     */
    async getProductPricing(productCode) {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('product_code, description, price, unit')
                .eq('product_code', productCode)
                .single();
            if (error) {
                console.error(`Error fetching product pricing for ${productCode}:`, error);
                return { success: false, error: error.message };
            }
            if (!data) {
                return { success: false, error: 'Product pricing not found' };
            }
            return {
                success: true,
                data: {
                    productCode: data.product_code,
                    description: data.description,
                    price: data.price,
                    unit: data.unit
                }
            };
        }
        catch (error) {
            console.error(`Error in getProductPricing for ${productCode}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get product pricing by description from hds_prices table
     */
    async getProductPricingByDescription(description, includeSizes = false) {
        try {
            console.log(`Fetching product pricing for description: "${description}" from hds_prices table`);
            // Select columns based on whether dimensions are needed
            let selectColumns = 'description, price';
            if (includeSizes) {
                selectColumns = 'description, price, dimensions'; // Include dimensions column if requested
            }
            // Log the exact query we're about to run for debugging
            console.log(`Running exact match query on 'hds_prices' table for description: "${description}"`);
            console.log(`Select columns: ${selectColumns}`);
            // First try an exact match
            let { data, error } = await supabase
                .from('hds_prices')
                .select(selectColumns)
                .eq('description', description.trim());
            // If no match, try with explicit column ILIKE for an exact match (handles case insensitivity)
            if (!data || data.length === 0 || error) {
                console.log(`No exact match with .eq(), trying with .ilike() for exact match...`);
                ({ data, error } = await supabase
                    .from('hds_prices')
                    .select(selectColumns)
                    .ilike('description', description.trim()));
            }
            // If no exact match or direct ILIKE match, try an exact phrase LIKE search
            if (!data || data.length === 0 || error) {
                console.log(`No exact or case-insensitive match, trying exact phrase with wildcards...`);
                // Surround with % to find the exact phrase anywhere in the description
                const exactPhrasePattern = `%${description.trim()}%`;
                ({ data, error } = await supabase
                    .from('hds_prices')
                    .select(selectColumns)
                    .ilike('description', exactPhrasePattern)
                    .order('description', { ascending: true }));
            }
            // If still no match, try a partial match using ILIKE with keywords
            if (!data || data.length === 0 || error) {
                console.log(`No exact phrase match found for "${description}", trying keyword partial match...`);
                const materialKeywords = description.split(' ');
                // Try to match the first two words which are usually the material type
                const searchPattern = `%${materialKeywords[0]}%${materialKeywords[1] || ''}%`;
                ({ data, error } = await supabase
                    .from('hds_prices')
                    .select(selectColumns)
                    .ilike('description', searchPattern)
                    .order('description', { ascending: true }));
            }
            if (error) {
                console.error(`Error fetching product details for pricing:`, error);
                return { success: false, error: error.message };
            }
            if (!data || data.length === 0) {
                return { success: false, error: `Product pricing not found for "${description}"` };
            }
            // Make sure data is an array to avoid TypeScript errors
            if (!data || !Array.isArray(data) || data.length === 0) {
                // If we got here with no results, try an even looser match
                console.log(`No results found for "${description}", trying looser match...`);
                // Try a looser match with just the first word
                const firstWord = description.split(' ')[0];
                const looseSearchPattern = `%${firstWord}%`;
                try {
                    const looseResult = await supabase
                        .from('hds_prices')
                        .select(selectColumns)
                        .ilike('description', looseSearchPattern)
                        .order('description', { ascending: true });
                    if (looseResult.error) {
                        console.error('Error in loose search:', looseResult.error);
                        return { success: false, error: `No matching product found for "${description}"` };
                    }
                    if (!looseResult.data || looseResult.data.length === 0) {
                        return { success: false, error: `No matching product found for "${description}"` };
                    }
                    // Use the loose search results
                    data = looseResult.data;
                    console.log(`Found ${data.length} matches with loose search`);
                }
                catch (error) {
                    console.error('Error in loose search:', error);
                    return { success: false, error: `No matching product found for "${description}"` };
                }
            }
            // Safe to work with data as an array now
            // If multiple matches found, log them for debugging
            if (data.length > 1) {
                const descriptions = data.map((item) => {
                    return typeof (item === null || item === void 0 ? void 0 : item.description) === 'string' ? item.description : '';
                });
                console.log(`Found ${data.length} potential matches:`, descriptions.join(', '));
            }
            // Use the first match
            const matchedProduct = data[0];
            console.log(`Using product match: ${JSON.stringify(matchedProduct)}`);
            // Extract fields with proper type checking
            const productDescription = typeof (matchedProduct === null || matchedProduct === void 0 ? void 0 : matchedProduct.description) === 'string' ? matchedProduct.description : description;
            const productPrice = typeof (matchedProduct === null || matchedProduct === void 0 ? void 0 : matchedProduct.price) === 'number' ? matchedProduct.price : 0;
            const productDimensions = typeof (matchedProduct === null || matchedProduct === void 0 ? void 0 : matchedProduct.dimensions) === 'string' ? matchedProduct.dimensions : null;
            // Return the data with transformed field names
            return {
                success: true,
                data: {
                    description: productDescription,
                    price: productPrice,
                    sizes: productDimensions, // We keep using 'sizes' as the field name in the returned object for compatibility
                    unit: 'piece' // Default unit
                }
            };
            // If we get here, no matching product was found
            return { success: false, error: `No matching product found for "${description}"` };
        }
        catch (error) {
            console.error(`Error in getProductPricingByDescription for "${description}":`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Create a new quote in the database
     *
     * Table schema:
     * - id (UUID, auto-generated)
     * - filename (text)
     * - created_at (timestamp, auto-generated)
     * - cutlist_id (text, foreign key)
     * - expires_at (timestamp, nullable)
     * - quote_number (text, nullable) - IMPORTANT: Must be populated for invoice downloads
     */
    async createQuote(quoteData) {
        try {
            console.log('Creating quote with data:', JSON.stringify({
                cutlistId: (quoteData === null || quoteData === void 0 ? void 0 : quoteData.cutlistId) || (quoteData === null || quoteData === void 0 ? void 0 : quoteData.cutlist_id),
                hasFilename: !!(quoteData === null || quoteData === void 0 ? void 0 : quoteData.filename),
                filename: quoteData === null || quoteData === void 0 ? void 0 : quoteData.filename
            }));
            // Validate required fields
            if (!(quoteData === null || quoteData === void 0 ? void 0 : quoteData.cutlistId) && !(quoteData === null || quoteData === void 0 ? void 0 : quoteData.cutlist_id)) {
                console.error('Error creating quote: Missing cutlist_id');
                return { success: false, error: 'Missing cutlist_id' };
            }
            if (!(quoteData === null || quoteData === void 0 ? void 0 : quoteData.filename)) {
                console.error('Error creating quote: Missing filename');
                return { success: false, error: 'Missing filename' };
            }
            // Extract quote number from filename
            // Filename format: "Q-20250806-4477-HDSCHUSTR" 
            // We need to extract the quote number part (everything before any file extension)
            let quoteNumber = quoteData.filename;
            // Remove file extension if present
            if (quoteNumber.includes('.')) {
                quoteNumber = quoteNumber.substring(0, quoteNumber.lastIndexOf('.'));
            }
            console.log(' Extracted quote number from filename:', {
                originalFilename: quoteData.filename,
                extractedQuoteNumber: quoteNumber
            });
            // Set expiry date (30 days from now)
            const expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + 30);
            // Create quote object that matches the actual database schema
            const quote = {
                filename: quoteData.filename,
                cutlist_id: quoteData.cutlistId || quoteData.cutlist_id,
                expires_at: expiryDate.toISOString(),
                quote_number: quoteNumber // Set the quote_number field for invoice downloads
                // id and created_at are auto-generated by the database
            };
            // Add all optional fields if they exist (map camelCase to snake_case)
            if (quoteData.customerName) {
                quote.customer_name = quoteData.customerName;
            }
            if (quoteData.customerPhone) {
                quote.customer_phone = quoteData.customerPhone;
            }
            if (quoteData.customerEmail) {
                quote.customer_email = quoteData.customerEmail;
            }
            if (quoteData.projectName) {
                quote.project_name = quoteData.projectName;
            }
            if (quoteData.quoteData) {
                quote.quote_data = JSON.stringify(quoteData.quoteData);
            }
            if (quoteData.subtotal !== undefined) {
                quote.subtotal = quoteData.subtotal;
            }
            if (quoteData.tax !== undefined) {
                quote.tax = quoteData.tax;
            }
            if (quoteData.total !== undefined) {
                quote.total = quoteData.total;
            }
            if (quoteData.status) {
                quote.status = quoteData.status;
            }
            if (quoteData.cutlistUrl) {
                quote.cutlist_url = quoteData.cutlistUrl;
            }
            console.log('Inserting quote with quote_number field populated:', JSON.stringify(quote));
            // Insert quote into database
            const { data, error } = await supabase
                .from('quotes')
                .insert([quote])
                .select()
                .single();
            if (error) {
                console.error('Error creating quote:', error);
                return { success: false, error: error.message };
            }
            console.log('Quote created successfully with quote_number:', data.quote_number);
            return {
                success: true,
                data: {
                    quoteNumber: data.quote_number,
                    quoteId: data.id,
                    createdAt: data.created_at
                }
            };
        }
        catch (error) {
            console.error('Error in createQuote:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Update quote status
     */
    async updateQuoteStatus(quoteNumber, status) {
        try {
            const { data, error } = await supabase
                .from('quotes')
                .update({ status })
                .eq('quote_number', quoteNumber)
                .select()
                .single();
            if (error) {
                console.error(`Error updating quote status for ${quoteNumber}:`, error);
                return { success: false, error: error.message };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in updateQuoteStatus for ${quoteNumber}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Create a new invoice from a quote
     */
    async createInvoice(quoteNumber, paymentDetails) {
        try {
            // First, get the quote
            const { data: quote, error: quoteError } = await supabase
                .from('quotes')
                .select('*')
                .eq('quote_number', quoteNumber)
                .single();
            if (quoteError || !quote) {
                console.error(`Error fetching quote ${quoteNumber}:`, quoteError);
                return { success: false, error: (quoteError === null || quoteError === void 0 ? void 0 : quoteError.message) || 'Quote not found' };
            }
            // Generate invoice number (format: INV-YYYYMMDD-XXXX)
            const today = new Date();
            const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
            const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
            const invoiceNumber = `INV-${datePart}-${randomPart}`;
            // Prepare invoice object
            const invoice = {
                invoice_number: invoiceNumber,
                quote_id: quote.id,
                quote_number: quote.quote_number,
                customer_name: quote.customer_name,
                customer_phone: quote.customer_phone,
                customer_email: quote.customer_email,
                items: quote.items,
                subtotal: quote.subtotal,
                tax: quote.tax,
                total: quote.total,
                payment_method: paymentDetails.method || 'Credit Card',
                payment_reference: paymentDetails.reference || `Ref-${Date.now()}`,
                payment_date: paymentDetails.date || new Date().toISOString(),
                status: 'pending',
                created_at: new Date().toISOString(),
                due_date: new Date(today.setDate(today.getDate() + 14)).toISOString() // 14 days to pay
            };
            // Insert invoice into database
            const { data, error } = await supabase
                .from('invoices')
                .insert([invoice])
                .select()
                .single();
            if (error) {
                console.error('Error creating invoice:', error);
                return { success: false, error: error.message };
            }
            // Update quote status to 'approved'
            await SupabaseService.updateQuoteStatus(quoteNumber, 'approved');
            return {
                success: true,
                data: {
                    invoiceNumber: data.invoice_number,
                    invoiceId: data.id,
                    createdAt: data.created_at
                }
            };
        }
        catch (error) {
            console.error('Error in createInvoice:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Update invoice status
     */
    async updateInvoiceStatus(invoiceNumber, status) {
        try {
            // First check if the invoice exists and get its current structure
            const { data: existingInvoice, error: fetchError } = await supabase
                .from('invoices')
                .select('*')
                .eq('invoice_number', invoiceNumber)
                .single();
            if (fetchError) {
                console.error(`Error fetching invoice for status update ${invoiceNumber}:`, fetchError);
                return { success: false, error: fetchError.message };
            }
            if (!existingInvoice) {
                console.error(`Invoice not found for status update: ${invoiceNumber}`);
                return { success: false, error: 'Invoice not found' };
            }
            // Try to update with only the status field (avoiding updated_at which may not exist)
            const { data, error } = await supabase
                .from('invoices')
                .update({ status })
                .eq('invoice_number', invoiceNumber)
                .select()
                .single();
            if (error) {
                console.error(`Error updating invoice status for ${invoiceNumber}:`, error);
                return { success: false, error: error.message };
            }
            console.log(`✅ Invoice status updated successfully for ${invoiceNumber}: ${status}`);
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in updateInvoiceStatus for ${invoiceNumber}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Fetch material options for cascading dropdowns from the hds_prices table
     */
    async getMaterialOptions() {
        try {
            const { data, error } = await supabase
                .from('hds_prices')
                .select('description, price')
                .order('description', { ascending: true });
            if (error) {
                console.error('Error fetching material options:', error);
                return { success: false, error: error.message };
            }
            if (!data || data.length === 0) {
                return { success: false, error: 'No material options found' };
            }
            return {
                success: true,
                data: data
            };
        }
        catch (error) {
            console.error('Error in getMaterialOptions:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get all product descriptions
     */
    async getProductDescriptions() {
        try {
            // Specifically log the table name we're querying
            console.log('Fetching product descriptions from hds_prices table...');
            // First verify if the table exists
            const { data: tablesData, error: tablesError } = await supabase
                .rpc('get_tables');
            if (tablesError) {
                console.error('Error checking tables:', tablesError);
            }
            else {
                console.log('Available tables in Supabase:', tablesData);
            }
            // Force use of hds_prices table
            const { data, error } = await supabase
                .from('hds_prices')
                .select('description')
                .order('description', { ascending: true });
            if (error) {
                console.error('Error fetching product descriptions:', error);
                return { success: false, error: error.message };
            }
            if (!data || data.length === 0) {
                console.warn('No product descriptions found in hds_prices table');
                return { success: false, error: 'No product descriptions found' };
            }
            console.log(`Found ${data.length} product descriptions from database:`, data.map(item => item.description));
            return {
                success: true,
                data: data
            };
        }
        catch (error) {
            console.error('Error in getProductDescriptions:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Save cutlist data to the cutlists table
     */
    async saveCutlist(cutlistData) {
        try {
            // Ensure the cutlist data has all required fields
            const cutlist = {
                id: cutlistData.id,
                customer_name: cutlistData.customerName || null,
                project_name: cutlistData.projectName || null,
                phone_number: cutlistData.phoneNumber || null,
                unit: cutlistData.unit || 'mm',
                ocr_text: cutlistData.ocrText || null,
                cut_pieces: cutlistData.cutPieces || [],
                stock_pieces: cutlistData.stockPieces || [],
                materials: cutlistData.materials || [],
                is_confirmed: cutlistData.isConfirmed || false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            // Insert cutlist into database
            const { data, error } = await supabase
                .from('cutlists')
                .insert([cutlist])
                .select()
                .single();
            if (error) {
                console.error('Error saving cutlist:', error);
                return { success: false, error: error.message };
            }
            return {
                success: true,
                data: {
                    id: data.id,
                    customerName: data.customer_name,
                    createdAt: data.created_at
                }
            };
        }
        catch (error) {
            console.error('Error in saveCutlist:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get cutlist data by ID from the cutlists table
     */
    async getCutlistById(cutlistId) {
        try {
            console.log(`Fetching cutlist with ID ${cutlistId} from Supabase`);
            const { data, error } = await supabase
                .from('cutlists')
                .select('*')
                .eq('id', cutlistId)
                .single();
            if (error) {
                console.error(`Error fetching cutlist with ID ${cutlistId}:`, error);
                return { success: false, error: error.message };
            }
            if (!data) {
                console.log(`Cutlist with ID ${cutlistId} not found in Supabase`);
                return { success: false, error: 'Cutlist not found' };
            }
            // Transform the data to match the expected format for the frontend
            const transformedData = {
                _id: data.id,
                cutPieces: data.cut_pieces || [],
                stockPieces: data.stock_pieces || [],
                materials: data.materials || [],
                unit: data.unit || 'mm',
                customerName: data.customer_name || '',
                projectName: data.project_name || '',
                phoneNumber: data.phone_number || '',
                ocrText: data.ocr_text || '',
                isConfirmed: data.is_confirmed || false,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };
            console.log(`Cutlist found in Supabase:`, transformedData);
            return { success: true, data: transformedData };
        }
        catch (error) {
            console.error(`Error in getCutlistById for ${cutlistId}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Fetch quote by ID
     * @param quoteId The ID of the quote to fetch
     * @returns Promise with quote data
     */
    async fetchQuoteById(quoteId) {
        try {
            const { data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('quote_id', quoteId)
                .single();
            if (error) {
                console.error(`Error fetching quote with ID ${quoteId}:`, error);
                return { success: false, error: error.message };
            }
            if (!data) {
                return { success: false, error: 'Quote not found' };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in fetchQuoteById for ${quoteId}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Update the PDF URL for a quote
     * @param quoteId The ID of the quote to update
     * @param pdfUrl The new PDF URL
     * @returns Promise with updated quote data
     */
    async updateQuotePdfUrl(quoteId, pdfUrl) {
        try {
            const { data, error } = await supabase
                .from('quotes')
                .update({ pdf_url: pdfUrl, updated_at: new Date().toISOString() })
                .eq('quote_id', quoteId)
                .select()
                .single();
            if (error) {
                console.error(`Error updating PDF URL for quote ${quoteId}:`, error);
                return { success: false, error: error.message };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in updateQuotePdfUrl for ${quoteId}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Upload a PDF buffer to the Supabase hdsquotes bucket
     * @param fileBuffer The PDF file buffer
     * @param fileName The name for the uploaded file
     * @returns Promise with the public URL or an error
     */
    async uploadQuotePdf(fileBuffer, fileName) {
        try {
            const { error: uploadError } = await supabase.storage
                .from('hdsquotes') // Assumes a bucket named 'quotes'
                .upload(fileName, fileBuffer, {
                contentType: 'application/pdf',
                upsert: true, // Overwrite if file exists
            });
            if (uploadError) {
                console.error('Error uploading PDF to Supabase Storage:', uploadError);
                return { success: false, error: uploadError.message };
            }
            const { data: urlData } = supabase.storage
                .from('hdsquotes')
                .getPublicUrl(fileName);
            if (!urlData.publicUrl) {
                return { success: false, error: 'Could not retrieve public URL for PDF.' };
            }
            return { success: true, publicUrl: urlData.publicUrl };
        }
        catch (error) {
            console.error('Error in uploadQuotePdf:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get the first available branch from branches table (fallback method)
     */
    getFirstAvailableBranch: async () => {
        try {
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .limit(1)
                .single();
            if (error) {
                console.error('Error fetching first available branch:', error);
                return { success: false, error: error.message };
            }
            if (!data) {
                return { success: false, error: 'No branches found in database' };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error('Error in getFirstAvailableBranch:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get branch by trading_as value from branches table
     */
    getBranchByTradingAs: async (tradingAs) => {
        try {
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .eq('trading_as', tradingAs)
                .single();
            if (error) {
                console.error(`Error fetching branch with trading_as ${tradingAs}:`, error);
                return { success: false, error: error.message };
            }
            if (!data) {
                return { success: false, error: 'Branch not found' };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in getBranchByTradingAs for ${tradingAs}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get banking details by fx_branch (match to trading_as of selected branch)
     */
    async getBankingDetailsByBranch(fxBranch) {
        try {
            const { data, error } = await supabase
                .from('banking_details')
                .select('*')
                .eq('fx_branch', fxBranch)
                .single();
            if (error) {
                console.error(`Error fetching banking details for fx_branch ${fxBranch}:`, error);
                return { success: false, error: error.message };
            }
            if (!data) {
                return { success: false, error: 'Banking details not found' };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in getBankingDetailsByBranch for ${fxBranch}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get customer email from quote
     */
    async getCustomerEmailFromQuote(quoteId) {
        try {
            const { data, error } = await supabase
                .from('quotes')
                .select('customer_email')
                .eq('id', quoteId)
                .single();
            if (error) {
                console.error('Error fetching customer email from quote:', error);
                return null;
            }
            return (data === null || data === void 0 ? void 0 : data.customer_email) || null;
        }
        catch (error) {
            console.error('Error in getCustomerEmailFromQuote:', error);
            return null;
        }
    },
    /**
     * Get branch email from branch_details table
     */
    async getBranchEmailByQuote(quoteId) {
        try {
            // First, get the quote to find the branch/trading name
            const { data: quoteData, error: quoteError } = await supabase
                .from('quotes')
                .select('customer_name, branch_name')
                .eq('id', quoteId)
                .single();
            if (quoteError) {
                console.error('Error fetching quote for branch email:', quoteError);
                return null;
            }
            // Try to get branch details using customer_name or branch_name
            const branchName = quoteData.branch_name || quoteData.customer_name;
            const { data: branchData, error: branchError } = await supabase
                .from('branch_details')
                .select('email')
                .eq('trading_as', branchName)
                .single();
            if (branchError) {
                console.error('Error fetching branch email:', branchError);
                return null;
            }
            return (branchData === null || branchData === void 0 ? void 0 : branchData.email) || null;
        }
        catch (error) {
            console.error('Error in getBranchEmailByQuote:', error);
            return null;
        }
    },
    /**
     * Get the best email address for a quote (priority: branch email, then customer email)
     */
    async getBestEmailForQuote(quoteId) {
        try {
            // Try branch email first
            const branchEmail = await this.getBranchEmailByQuote(quoteId);
            if (branchEmail) {
                return branchEmail;
            }
            // Fallback to customer email
            const customerEmail = await this.getCustomerEmailFromQuote(quoteId);
            return customerEmail;
        }
        catch (error) {
            console.error('Error in getBestEmailForQuote:', error);
            return null;
        }
    },
    /**
     * Fetch quote by number/identifier - searches by filename first, then quote_number as fallback
     * @param quoteNumber The quote number/identifier to search for
     * @returns Promise with quote data
     */
    async fetchQuoteByNumber(quoteNumber) {
        try {
            console.log(`🔍 Searching for quote with identifier: ${quoteNumber}`);
            console.log(`🔍 Quote ID details: type=${typeof quoteNumber}, length=${quoteNumber.length}`);
            // First try to find by filename (exact match)
            console.log(`🔍 Step 1: Trying exact filename match...`);
            let { data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('filename', quoteNumber);
            console.log(`🔍 Step 1 result: found ${(data === null || data === void 0 ? void 0 : data.length) || 0} quotes, error: ${(error === null || error === void 0 ? void 0 : error.message) || 'none'}`);
            if (data && data.length > 0) {
                console.log(`✅ Found quote by exact filename match`);
                return { success: true, data: data[0] };
            }
            // Try with .pdf extension
            console.log(`🔍 Step 2: Trying with .pdf extension...`);
            ({ data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('filename', `${quoteNumber}.pdf`));
            console.log(`🔍 Step 2 result: found ${(data === null || data === void 0 ? void 0 : data.length) || 0} quotes, error: ${(error === null || error === void 0 ? void 0 : error.message) || 'none'}`);
            if (data && data.length > 0) {
                console.log(`✅ Found quote by filename with .pdf extension`);
                return { success: true, data: data[0] };
            }
            // Try using LIKE pattern for various extensions
            console.log(`🔍 Step 3: Trying LIKE pattern for extensions...`);
            ({ data, error } = await supabase
                .from('quotes')
                .select('*')
                .like('filename', `${quoteNumber}.%`));
            console.log(`🔍 Step 3 result: found ${(data === null || data === void 0 ? void 0 : data.length) || 0} quotes, error: ${(error === null || error === void 0 ? void 0 : error.message) || 'none'}`);
            if (data && data.length > 0) {
                console.log(`✅ Found quote by filename LIKE pattern`);
                return { success: true, data: data[0] };
            }
            // Try the quote_number field as fallback
            console.log(`🔍 Step 4: Trying quote_number field as fallback...`);
            ({ data, error } = await supabase
                .from('quotes')
                .select('*')
                .eq('quote_number', quoteNumber));
            console.log(`🔍 Step 4 result: found ${(data === null || data === void 0 ? void 0 : data.length) || 0} quotes, error: ${(error === null || error === void 0 ? void 0 : error.message) || 'none'}`);
            if (data && data.length > 0) {
                console.log(`✅ Found quote by quote_number field`);
                return { success: true, data: data[0] };
            }
            // Try case-insensitive search as last resort
            console.log(`🔍 Step 5: Trying case-insensitive search...`);
            ({ data, error } = await supabase
                .from('quotes')
                .select('*')
                .or(`filename.ilike.${quoteNumber},filename.ilike.${quoteNumber}.pdf,quote_number.ilike.${quoteNumber}`));
            console.log(`🔍 Step 5 result: found ${(data === null || data === void 0 ? void 0 : data.length) || 0} quotes, error: ${(error === null || error === void 0 ? void 0 : error.message) || 'none'}`);
            if (data && data.length > 0) {
                console.log(`✅ Found quote by case-insensitive search`);
                return { success: true, data: data[0] };
            }
            // If we get here, the quote truly doesn't exist
            console.error(`❌ Quote not found after all search attempts for identifier: ${quoteNumber}`);
            // Get some recent quotes for debugging
            console.log(`🔍 Getting recent quotes for debugging...`);
            const { data: recentQuotes } = await supabase
                .from('quotes')
                .select('id, filename, quote_number, created_at')
                .order('created_at', { ascending: false })
                .limit(5);
            console.log(`🔍 Recent quotes in database:`, recentQuotes === null || recentQuotes === void 0 ? void 0 : recentQuotes.map(q => ({
                filename: q.filename,
                quote_number: q.quote_number,
                created_at: q.created_at
            })));
            return { success: false, error: 'Quote not found' };
        }
        catch (error) {
            console.error(`❌ Error in fetchQuoteByNumber for ${quoteNumber}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Generate invoice PDF from quote data and upload to invoices bucket
     * @param quoteNumber The quote number to generate invoice for
     * @param invoiceNumber The invoice number for the PDF filename
     * @returns Promise with the public URL of the generated PDF
     */
    async generateAndUploadInvoicePdf(quoteNumber, invoiceNumber) {
        try {
            console.log('Starting invoice PDF generation for quote:', quoteNumber, 'invoice:', invoiceNumber);
            // Import the PDF generation function
            const { generateInvoicePdf } = require('./optimizer.service');
            // Fetch the quote data
            console.log('Fetching quote data for:', quoteNumber);
            const quoteResult = await this.fetchQuoteByNumber(quoteNumber);
            if (!quoteResult.success || !quoteResult.data) {
                console.error('Quote not found for:', quoteNumber);
                return { success: false, error: 'Quote not found' };
            }
            const quote = quoteResult.data;
            console.log('Quote data fetched successfully:', {
                quoteNumber: quote.quote_number,
                customerName: quote.customer_name,
                total: quote.total
            });
            // Extract branch identifier from quote filename and find matching branch
            let branchData = {
                name: 'HDS Group',
                trading_as: 'HDS Group',
                branch_address: '',
                branch_telephone: '',
                email_address: ''
            };
            // Extract branch code from filename (pattern: Q-YYYYMMDD-NNNN-BRANCHCODE)
            const filename = quote.filename || quote.quote_number;
            console.log(`📋 Analyzing filename for branch: ${filename}`);
            const parts = filename.split('-');
            let branchFound = false;
            if (parts.length >= 4) {
                const branchCode = parts[3];
                console.log(`🔍 Extracted branch code: ${branchCode}`);
                // Get all branches to find the best match
                const { data: allBranches, error: branchesError } = await supabase
                    .from('branches')
                    .select('*');
                if (!branchesError && allBranches && allBranches.length > 0) {
                    console.log(`📊 Found ${allBranches.length} branches in database`);
                    // Try exact match first
                    let matchedBranch = allBranches.find(b => b.trading_as === branchCode);
                    if (!matchedBranch) {
                        // Try partial matches - look for branch names that contain parts of the code
                        matchedBranch = allBranches.find(b => b.trading_as.toLowerCase().includes(branchCode.toLowerCase()) ||
                            branchCode.toLowerCase().includes(b.trading_as.toLowerCase()));
                    }
                    if (!matchedBranch && branchCode.startsWith('HDS')) {
                        // Extract location code and try pattern matching
                        const locationCode = branchCode.substring(3);
                        console.log(`🔍 Trying location-based matching with: ${locationCode}`);
                        // Special case mappings for common patterns
                        const locationMappings = {
                            'DEDEU': 'HDS De Deur',
                            'LOUIS': 'HDS Louis Trichardt',
                            'BLOEM': 'HDS Bloemfontein',
                            'BRITS': 'HDS Brits',
                            'BURG': 'HDS Burgersfort',
                            'CHURCH': 'HDS Church Street',
                            'EMPAN': 'HDS Empangeni',
                            'HAMMAN': 'HDS Hammanskraal',
                            'KLERK': 'HDS Klerksdorp',
                            'KRUGER': 'HDS Krugersdorp',
                            'KYA': 'HDS Kya Sands',
                            'LADY': 'HDS Ladysmith',
                            'MAFIK': 'HDS Mafikeng',
                            'MARULA': 'HDS Marula',
                            'NELSP': 'HDS Nelspruit',
                            'NEWC': 'HDS Newcastle',
                            'PMB': 'HDS PMB',
                            'SECUN': 'HDS Secunda',
                            'SOUTH': 'HDS South Coast',
                            'SOWETO': 'HDS Soweto',
                            'SPRING': 'HDS Springs',
                            'SUNDER': 'HDS Sunderland',
                            'TEMBI': 'HDS Tembisa',
                            'VANDER': 'HDS Vanderbijlpark',
                            'WALTLOO': 'HDS Waltloo',
                            'MAIN': 'HDS Main Reef',
                            'WITBANK': 'HDS Witbank',
                            'WYNBERG': 'HDS Wynberg',
                            'ERMELO': 'HDS Ermelo',
                            'ALBER': 'HDS Alberton',
                            'WELKOM': 'HDS Welkom',
                            'PIET': 'HDS Piet Retief'
                        };
                        // Check if we have a direct mapping
                        if (locationMappings[locationCode]) {
                            matchedBranch = allBranches.find(b => b.trading_as === locationMappings[locationCode]);
                            if (matchedBranch) {
                                console.log(`✅ Found branch using location mapping: ${matchedBranch.trading_as}`);
                            }
                        }
                        // If no direct mapping, try fuzzy matching
                        if (!matchedBranch) {
                            matchedBranch = allBranches.find(b => {
                                const branchName = b.trading_as.toLowerCase().replace(/hds\s+/i, '');
                                return branchName.includes(locationCode.toLowerCase()) ||
                                    locationCode.toLowerCase().includes(branchName);
                            });
                        }
                    }
                    if (matchedBranch) {
                        branchData = {
                            name: matchedBranch.trading_as,
                            trading_as: matchedBranch.trading_as,
                            branch_address: matchedBranch.branch_address || '',
                            branch_telephone: matchedBranch.branch_telephone || '',
                            email_address: matchedBranch.email_address || ''
                        };
                        branchFound = true;
                        console.log(`✅ Successfully matched branch: ${matchedBranch.trading_as}`);
                        console.log(`📍 Branch details:`, {
                            address: branchData.branch_address,
                            phone: branchData.branch_telephone,
                            email: branchData.email_address
                        });
                    }
                }
            }
            if (!branchFound) {
                console.log(`⚠️ Could not determine branch from filename: ${filename}`);
                console.log(`⚠️ Using default branch data`);
            }
            // Generate the PDF
            console.log('Generating invoice PDF');
            let pdfResult;
            try {
                pdfResult = await generateInvoicePdf(quote, branchData);
                if (!pdfResult || !pdfResult.buffer) {
                    console.error('❌ Failed to generate PDF: No buffer returned');
                    return { success: false, error: 'Failed to generate PDF - no buffer returned' };
                }
                console.log('✅ PDF generated successfully, buffer size:', pdfResult.buffer.length);
            }
            catch (pdfError) {
                console.error('❌ PDF generation error:', pdfError);
                console.error('❌ PDF error message:', pdfError.message);
                return { success: false, error: `PDF generation failed: ${pdfError.message}` };
            }
            // Create filename with timestamp
            const timestamp = Date.now();
            const fileName = `invoice-${invoiceNumber}-${timestamp}.pdf`;
            console.log('Uploading invoice PDF with filename:', fileName);
            // Upload the PDF
            const uploadResult = await this.uploadInvoicePdf(pdfResult.buffer, fileName);
            if (!uploadResult.success) {
                console.error('Failed to upload PDF:', uploadResult.error);
                return { success: false, error: uploadResult.error };
            }
            console.log('Invoice PDF uploaded successfully:', uploadResult.publicUrl);
            return { success: true, publicUrl: uploadResult.publicUrl };
        }
        catch (error) {
            console.error('Error in generateAndUploadInvoicePdf:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Upload a PDF buffer to the Supabase invoices bucket
     * @param fileBuffer The PDF file buffer
     * @param fileName The name for the uploaded file
     * @returns Promise with the public URL or an error
     */
    async uploadInvoicePdf(fileBuffer, fileName) {
        try {
            console.log('Uploading invoice PDF to Supabase Storage:', {
                fileName: fileName,
                fileSize: fileBuffer.length,
                bucket: 'invoices'
            });
            const { error: uploadError } = await supabase.storage
                .from('invoices') // Use the new invoices bucket
                .upload(fileName, fileBuffer, {
                contentType: 'application/pdf',
                upsert: true, // Overwrite if file exists
            });
            if (uploadError) {
                console.error('Error uploading invoice PDF to Supabase Storage:', uploadError);
                return { success: false, error: uploadError.message };
            }
            console.log('Invoice PDF uploaded successfully to Supabase Storage');
            // Get the public URL for the uploaded file
            const { data: urlData } = supabase.storage
                .from('invoices')
                .getPublicUrl(fileName);
            console.log('Retrieved public URL for invoice PDF:', urlData === null || urlData === void 0 ? void 0 : urlData.publicUrl);
            if (!(urlData === null || urlData === void 0 ? void 0 : urlData.publicUrl)) {
                console.error('Could not retrieve public URL for invoice PDF');
                return { success: false, error: 'Could not retrieve public URL for invoice PDF.' };
            }
            return { success: true, publicUrl: urlData.publicUrl };
        }
        catch (error) {
            console.error('Error in uploadInvoicePdf:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * List invoice PDFs for an invoice number
     * @param invoiceNumber The invoice number to list PDFs for
     * @returns Promise with the list of files
     */
    async listInvoicePdfs(invoiceNumber) {
        try {
            const { data: files, error } = await supabase
                .storage
                .from('invoices')
                .list('', {
                search: `invoice-${invoiceNumber}-`
            });
            if (error) {
                console.error(`Error listing invoice PDFs for ${invoiceNumber}:`, error);
                return { success: false, error: error.message };
            }
            return { success: true, data: files };
        }
        catch (error) {
            console.error(`Error in listInvoicePdfs for ${invoiceNumber}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Download an invoice PDF from the invoices bucket
     * @param invoiceNumber The invoice number to download
     * @returns Promise with the PDF data
     */
    async downloadInvoicePdf(invoiceNumber) {
        try {
            // First, list files to find the most recent one
            const listResult = await this.listInvoicePdfs(invoiceNumber);
            if (!listResult.success || !listResult.data || listResult.data.length === 0) {
                return { success: false, error: 'No invoice PDF found' };
            }
            // Sort by name to get the most recent one (assuming timestamp is in the filename)
            const files = listResult.data;
            files.sort((a, b) => b.name.localeCompare(a.name));
            const latestFile = files[0];
            console.log('Found invoice PDF:', latestFile.name);
            // Download the PDF
            const { data: pdfData, error: pdfError } = await supabase
                .storage
                .from('invoices')
                .download(latestFile.name);
            if (pdfError) {
                console.error('Error downloading PDF:', pdfError);
                return { success: false, error: pdfError.message };
            }
            if (pdfData) {
                console.log('Successfully downloaded PDF from storage:', latestFile.name);
                return {
                    success: true,
                    data: Buffer.from(await pdfData.arrayBuffer()),
                    fileName: latestFile.name
                };
            }
            return { success: false, error: 'No PDF data received' };
        }
        catch (error) {
            console.error('Error in downloadInvoicePdf:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Upload a PDF buffer to the Supabase cutlists bucket
     * @param fileBuffer The PDF file buffer
     * @param fileName The name for the uploaded file
     * @returns Promise with the public URL or an error
     */
    async uploadCutlistPdf(fileBuffer, fileName) {
        try {
            const { error: uploadError } = await supabase.storage
                .from('cutlists') // Use the cutlists bucket
                .upload(fileName, fileBuffer, {
                contentType: 'application/pdf',
                upsert: true, // Overwrite if file exists
            });
            if (uploadError) {
                console.error('Error uploading cutlist PDF to Supabase Storage:', uploadError);
                return { success: false, error: uploadError.message };
            }
            const { data: urlData } = supabase.storage
                .from('cutlists')
                .getPublicUrl(fileName);
            if (!urlData.publicUrl) {
                return { success: false, error: 'Could not retrieve public URL for cutlist PDF.' };
            }
            return { success: true, publicUrl: urlData.publicUrl };
        }
        catch (error) {
            console.error('Error in uploadCutlistPdf:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Update the cutlist PDF URL for a quote
     * @param quoteNumber The quote number to update
     * @param pdfUrl The new cutlist PDF URL
     * @returns Promise with updated quote data
     */
    async updateCutlistPdfUrl(quoteNumber, pdfUrl) {
        try {
            const { data, error } = await supabase
                .from('quotes')
                .update({ cutlist_pdf_url: pdfUrl, updated_at: new Date().toISOString() })
                .eq('quote_number', quoteNumber)
                .select()
                .single();
            if (error) {
                console.error(`Error updating cutlist PDF URL for quote ${quoteNumber}:`, error);
                return { success: false, error: error.message };
            }
            return { success: true, data };
        }
        catch (error) {
            console.error(`Error in updateCutlistPdfUrl for ${quoteNumber}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Fetch invoice by quote identifier - searches by filename-based quote lookup first
     * @param quoteIdentifier The quote identifier to search for
     * @returns Promise with invoice data
     */
    async fetchInvoiceByQuoteId(quoteIdentifier) {
        try {
            console.log(`🔍 Looking up invoice with identifier: ${quoteIdentifier}`);
            // First, get the quote using filename-based lookup
            const quoteResult = await this.fetchQuoteByNumber(quoteIdentifier);
            if (!quoteResult.success || !quoteResult.data) {
                console.log(`❌ Could not find quote for identifier: ${quoteIdentifier}`);
                return { success: false, error: 'Quote not found' };
            }
            const quote = quoteResult.data;
            console.log(`✅ Found quote: ID ${quote.id}, filename: "${quote.filename}"`);
            // Try 1: Search invoices by quote_number (most common case)
            let { data, error } = await supabase
                .from('invoices')
                .select('*')
                .eq('quote_number', quoteIdentifier)
                .order('created_at', { ascending: false })
                .limit(1);
            // Try 2: Search by quote_id if no match by quote_number
            if (!data || data.length === 0) {
                console.log(`🔍 No invoice found with quote_number, trying by quote_id: ${quote.id}`);
                ({ data, error } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('quote_id', quote.id)
                    .order('created_at', { ascending: false })
                    .limit(1));
            }
            // Try 3: Search by filename (in case invoice stores filename)
            if (!data || data.length === 0) {
                console.log(`🔍 No invoice found with quote_id, trying by filename: ${quote.filename}`);
                ({ data, error } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('quote_number', quote.filename)
                    .order('created_at', { ascending: false })
                    .limit(1));
            }
            if (error) {
                console.error(`❌ Error fetching invoice with identifier ${quoteIdentifier}:`, error);
                return { success: false, error: error.message };
            }
            if (!data || data.length === 0) {
                console.log(`❌ No invoice found for identifier: ${quoteIdentifier}`);
                return { success: false, error: 'Invoice not found' };
            }
            console.log(`✅ Found invoice: ${data[0].invoice_number} for quote identifier: ${quoteIdentifier}`);
            return { success: true, data: data[0] };
        }
        catch (error) {
            console.error(`❌ Error in fetchInvoiceByQuoteId for ${quoteIdentifier}:`, error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Update invoice payment details
     * @param invoiceNumber The invoice number to update
     * @param paymentDetails Payment details to update
     * @returns Promise with update result
     */
    async updateInvoicePaymentDetails(invoiceNumber, paymentDetails) {
        try {
            // First check if the invoice exists and get its current structure
            const { data: existingInvoice, error: fetchError } = await supabase
                .from('invoices')
                .select('*')
                .eq('invoice_number', invoiceNumber)
                .single();
            if (fetchError) {
                console.error(`Error fetching invoice for payment update ${invoiceNumber}:`, fetchError);
                return { success: false, error: fetchError.message };
            }
            if (!existingInvoice) {
                console.error(`Invoice not found for payment update: ${invoiceNumber}`);
                return { success: false, error: 'Invoice not found' };
            }
            // Build update object with only fields that exist in the database schema
            const updateData = {};
            // Add payment fields that exist in the invoices table schema
            if (paymentDetails.method) {
                updateData.payment_method = paymentDetails.method;
            }
            if (paymentDetails.reference) {
                updateData.payment_reference = paymentDetails.reference;
            }
            if (paymentDetails.date) {
                updateData.payment_date = paymentDetails.date;
            }
            // Note: payment_id and amount_paid fields don't exist in the schema
            console.log(`💳 Attempting to update invoice ${invoiceNumber} with payment data:`, updateData);
            // Try to update with available fields
            const { data, error } = await supabase
                .from('invoices')
                .update(updateData)
                .eq('invoice_number', invoiceNumber)
                .select()
                .single();
            if (error) {
                console.error('Error updating invoice payment details:', error);
                // Don't fail completely if payment details can't be updated - the payment was still successful
                console.warn(`⚠️ Payment details update failed for ${invoiceNumber}, but payment was processed successfully`);
                return { success: true, data: existingInvoice, warning: 'Payment details update failed but payment processed' };
            }
            console.log(`✅ Invoice payment details updated successfully for ${invoiceNumber}`);
            return { success: true, data };
        }
        catch (error) {
            console.error('Error in updateInvoicePaymentDetails:', error);
            // Don't fail completely - payment was still successful
            return { success: true, warning: 'Payment details update failed but payment processed', error: error.message };
        }
    }
};
exports.default = SupabaseService;
