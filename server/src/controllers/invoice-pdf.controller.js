import SupabaseService from '../services/supabase.service.js';

/**
 * Controller for handling invoice PDF generation endpoints
 */
class InvoicePdfController {
  /**
   * Generate invoice PDF after payment success
   */
  async generateInvoicePdf(req, res) {
    try {
      const { quoteNumber } = req.params;
      
      if (!quoteNumber) {
        return res.status(400).json({ 
          success: false, 
          error: 'Quote number is required' 
        });
      }

      // Create invoice with PDF generation
      const result = await SupabaseService.createInvoiceWithPdf(quoteNumber, {
        method: 'PayFast',
        reference: `PAYFAST-${Date.now()}`,
        date: new Date().toISOString()
      });

      if (result.success) {
        return res.json({
          success: true,
          message: 'Invoice PDF generated successfully',
          invoiceNumber: result.data.invoiceNumber,
          pdfUrl: result.data.pdfUrl
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get invoice details including PDF URL
   */
  async getInvoiceDetails(req, res) {
    try {
      const { invoiceNumber } = req.params;
      
      if (!invoiceNumber) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invoice number is required' 
        });
      }

      const { data, error } = await SupabaseService.supabase
        .from('invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();

      if (error) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      return res.json({
        success: true,
        data: {
          invoiceNumber: data.invoice_number,
          quoteNumber: data.quote_number,
          customerName: data.customer_name,
          total: data.total,
          pdfUrl: data.pdf_url,
          createdAt: data.created_at,
          status: data.status
        }
      });
    } catch (error) {
      console.error('Error fetching invoice details:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Regenerate invoice PDF (useful if original failed or needs update)
   */
  async regenerateInvoicePdf(req, res) {
    try {
      const { invoiceNumber } = req.params;
      
      if (!invoiceNumber) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invoice number is required' 
        });
      }

      // Get invoice details first
      const { data: invoice, error: invoiceError } = await SupabaseService.supabase
        .from('invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();

      if (invoiceError || !invoice) {
        return res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
      }

      // Get quote number from invoice
      const { data: quote, error: quoteError } = await SupabaseService.supabase
        .from('quotes')
        .select('quote_number')
        .eq('id', invoice.quote_id)
        .single();

      if (quoteError || !quote) {
        return res.status(404).json({
          success: false,
          error: 'Quote not found'
        });
      }

      // Regenerate PDF
      const result = await SupabaseService.generateAndUploadInvoicePdf(
        quote.quote_number,
        invoiceNumber
      );

      if (result.success) {
        return res.json({
          success: true,
          message: 'Invoice PDF regenerated successfully',
          pdfUrl: result.publicUrl
        });
      } else {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error regenerating invoice PDF:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

export default new InvoicePdfController();
