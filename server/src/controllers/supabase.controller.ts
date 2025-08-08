import { Request, Response } from 'express';
import SupabaseService from '../services/supabase.service';
import path from 'path';

/**
 * Controller for handling Supabase database operations
 */
const supabaseController = {
  /**
   * Test connection to Supabase
   */
  async testConnection(req: Request, res: Response) {
    try {
      const connected = await SupabaseService.checkConnection();
      if (connected) {
        return res.status(200).json({ success: true, message: 'Successfully connected to Supabase' });
      } else {
        return res.status(500).json({ success: false, message: 'Failed to connect to Supabase' });
      }
    } catch (error) {
      console.error('Error testing Supabase connection:', error);
      return res.status(500).json({ success: false, message: 'Error connecting to Supabase' });
    }
  },

  /**
   * Get product details from Supabase
   */
  async getProductDetails(req: Request, res: Response) {
    try {
      const { productCode } = req.params;
      
      if (!productCode) {
        return res.status(400).json({ success: false, message: 'Product code is required' });
      }
      
      const result = await SupabaseService.getProductDetails(productCode);
      
      if (!result.success) {
        return res.status(404).json({ success: false, message: result.error || 'Product not found' });
      }
      
      return res.status(200).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error fetching product details:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Get product pricing from Supabase
   */
  async getProductPricing(req: Request, res: Response) {
    try {
      const { productCode } = req.params;
      
      if (!productCode) {
        return res.status(400).json({ success: false, message: 'Product code is required' });
      }
      
      const result = await SupabaseService.getProductPricing(productCode);
      
      if (!result.success) {
        return res.status(404).json({ success: false, message: result.error || 'Product pricing not found' });
      }
      
      return res.status(200).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error fetching product pricing:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Create a quote in Supabase
   */
  async createQuote(req: Request, res: Response) {
    try {
      const quoteData = req.body;
      
      // Validate required fields
      if (!quoteData.customerName || !quoteData.customerTelephone || !quoteData.items || quoteData.items.length === 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: customerName, customerTelephone, items' 
        });
      }
      
      const result = await SupabaseService.createQuote(quoteData);
      
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || 'Failed to create quote' });
      }
      
      return res.status(201).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error creating quote:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Update quote status
   */
  async updateQuoteStatus(req: Request, res: Response) {
    try {
      const { quoteNumber } = req.params;
      const { status } = req.body;
      
      if (!quoteNumber) {
        return res.status(400).json({ success: false, message: 'Quote number is required' });
      }
      
      if (!status || !['sent', 'pending', 'approved', 'rejected'].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid status is required: sent, pending, approved, rejected' 
        });
      }
      
      const result = await SupabaseService.updateQuoteStatus(quoteNumber, status);
      
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || 'Failed to update quote status' });
      }
      
      return res.status(200).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error updating quote status:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Create an invoice from a quote
   */
  async createInvoice(req: Request, res: Response) {
    try {
      const { quoteNumber } = req.params;
      const paymentDetails = req.body;
      
      if (!quoteNumber) {
        return res.status(400).json({ success: false, message: 'Quote number is required' });
      }
      
      const result = await SupabaseService.createInvoice(quoteNumber, paymentDetails);
      
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || 'Failed to create invoice' });
      }
      
      return res.status(201).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(req: Request, res: Response) {
    try {
      const { invoiceNumber } = req.params;
      const { status } = req.body;
      
      if (!invoiceNumber) {
        return res.status(400).json({ success: false, message: 'Invoice number is required' });
      }
      
      if (!status || !['pending', 'paid', 'overdue', 'cancelled'].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Valid status is required: pending, paid, overdue, cancelled' 
        });
      }
      
      const result = await SupabaseService.updateInvoiceStatus(invoiceNumber, status);
      
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || 'Failed to update invoice status' });
      }
      
      return res.status(200).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error updating invoice status:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  
  /**
   * Process payment and create invoice
   */
  async processPayment(req: Request, res: Response) {
    try {
      const { quoteNumber, paymentDetails } = req.body;
      
      if (!quoteNumber) {
        return res.status(400).json({ success: false, message: 'Quote number is required' });
      }
      
      // Create invoice from quote
      const result = await SupabaseService.createInvoice(quoteNumber, paymentDetails || {});
      
      if (!result.success) {
        return res.status(500).json({ success: false, message: result.error || 'Failed to create invoice' });
      }
      
      // Mark invoice as paid if payment was successful
      const invoiceNumber = result.data.invoiceNumber;
      await SupabaseService.updateInvoiceStatus(invoiceNumber, 'paid');
      
      // NEW: Send email notification after successful payment
      try {
        // Import email service and get customer email
        const EmailService = (await import('../services/email.service')).EmailService;
        const emailService = new EmailService();
        
        // Get branch/customer email
        const recipientEmail = await SupabaseService.getBestEmailForQuote(quoteNumber);
        
        if (recipientEmail) {
          // Get quote details for email
          const quoteResult = await SupabaseService.fetchQuoteByNumber(quoteNumber);
          
          if (quoteResult.success && quoteResult.data) {
            const quoteData = quoteResult.data;
            const customerName = quoteData.customer_name || 'Customer';
            const quoteNumberFromData = quoteData.quote_number || quoteNumber;
            const amount = parseFloat(paymentDetails?.amount || '0');
            
            // Generate invoice PDF path
            const invoicePath = path.join(__dirname, '../invoices', `invoice-${quoteNumberFromData}.pdf`);
            
            // Prepare optimization details
            const optimizationDetails = {
              totalBoards: quoteData.total_boards,
              totalLength: quoteData.total_length,
              wastage: quoteData.wastage_percentage,
              cutlistUrl: quoteData.cutlist_url
            };
            
            // Send email notification
            await emailService.sendPaymentConfirmationEmail({
              customerName,
              customerEmail: recipientEmail,
              quoteNumber: quoteNumberFromData,
              amount,
              invoicePdfUrl: invoicePath,
              cutlistPdfUrl: './test-cutlist.pdf',
              optimizationDetails
            });
            
            console.log('Payment confirmation email sent successfully to:', recipientEmail);
          }
        } else {
          console.warn('No email address found for quote:', quoteNumber);
        }
      } catch (emailError) {
        console.error('Error sending payment confirmation email:', emailError);
        // Don't fail the payment processing if email fails
      }
      
      return res.status(200).json({
        success: true,
        message: 'Payment processed and invoice created successfully',
        data: {
          invoiceNumber,
          status: 'paid',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error processing payment:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  
  /**
   * Get material options for cascading dropdowns
   */
  async getMaterialOptions(req: Request, res: Response) {
    try {
      const result = await SupabaseService.getMaterialOptions();
      
      if (!result.success) {
        return res.status(404).json({ success: false, message: result.error || 'Material options not found' });
      }
      
      return res.status(200).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error fetching material options:', error);
      return res.status(500).json({ success: false, message: error.message || 'Server error' });
    }
  },
  
  /**
   * Get all product descriptions
   */
  async getProductDescriptions(req: Request, res: Response) {
    try {
      const result = await SupabaseService.getProductDescriptions();
      
      if (!result.success) {
        return res.status(404).json({ success: false, message: result.error || 'Product descriptions not found' });
      }
      
      return res.status(200).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error fetching product descriptions:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  
  /**
   * Get product pricing by description from Supabase
   */
  async getProductPricingByDescription(req: Request, res: Response) {
    try {
      const { description } = req.query;
      const includeSizes = req.query.includeSizes === 'true';
      
      if (!description) {
        return res.status(400).json({ success: false, message: 'Product description is required' });
      }
      
      const result = await SupabaseService.getProductPricingByDescription(description.toString(), includeSizes);
      
      if (!result.success) {
        return res.status(404).json({ success: false, message: result.error || 'Product pricing not found' });
      }
      
      return res.status(200).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error fetching product pricing by description:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  /**
   * Get branch by trading_as value
   */
  getBranchByTradingAs: async (req: Request, res: Response) => {
    try {
      const { tradingAs } = req.params;
      if (!tradingAs) {
        return res.status(400).json({ success: false, message: 'tradingAs parameter is required' });
      }
      const result = await SupabaseService.getBranchByTradingAs(tradingAs);
      if (!result.success) {
        return res.status(404).json({ success: false, message: result.error || 'Branch not found' });
      }
      return res.status(200).json({ success: true, data: result.data });
    } catch (error: any) {
      console.error('Error fetching branch by trading_as:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
  
  /**
   * Upload a quote PDF to the hdsquotes bucket
   */
  uploadQuotePdf: async (req: Request, res: Response) => {
    try {
      // Check if file exists in the request
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No PDF file provided' });
      }

      const fileBuffer = req.file.buffer;
      const fileName = `quote-${Date.now()}-${req.file.originalname}`;

      // Upload file to Supabase storage
      const result = await SupabaseService.uploadQuotePdf(fileBuffer, fileName);

      if (!result.success) {
        return res.status(500).json({ 
          success: false, 
          message: result.error || 'Failed to upload PDF to storage'
        });
      }

      // If quoteid is provided, update the quote with the pdf url
      if (req.body.quoteId) {
        await SupabaseService.updateQuotePdfUrl(req.body.quoteId, result.publicUrl || '');
      }

      return res.status(200).json({
        success: true,
        message: 'PDF uploaded successfully',
        data: {
          fileName,
          url: result.publicUrl
        }
      });
    } catch (error: any) {
      console.error('Error uploading quote PDF:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

};

export default supabaseController;
