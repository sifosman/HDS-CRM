import { Request, Response } from 'express';
import SupabaseService from '../services/supabase.service';

class InvoicePdfController {
  private supabaseService: any;

  constructor() {
    this.supabaseService = SupabaseService;
  }

  /**
   * Generate invoice PDF after payment success
   */
  async generateInvoicePdf(req: Request, res: Response): Promise<void> {
    try {
      const { quoteNumber } = req.params;
      
      if (!quoteNumber) {
        res.status(400).json({
          success: false,
          error: 'Quote number is required'
        });
        return;
      }

      // Create invoice with PDF generation
      const result = await this.supabaseService.createInvoiceWithPdf(quoteNumber, {
        method: 'PayFast',
        reference: `PAYFAST-${Date.now()}`,
        date: new Date().toISOString()
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Invoice PDF generated successfully',
          invoiceNumber: result.data.invoiceNumber,
          pdfUrl: result.data.pdfUrl
        });
        return;
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }
    } catch (error: any) {
      console.error('Error generating invoice PDF:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
      return;
    }
  }

  /**
   * Get invoice details including PDF URL
   */
  async getInvoiceDetails(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceNumber } = req.params;
      
      if (!invoiceNumber) {
        res.status(400).json({
          success: false,
          error: 'Invoice number is required'
        });
        return;
      }

      const { data, error } = await this.supabaseService.supabase
        .from('invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();

      if (error) {
        res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
        return;
      }

      res.json({
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
      return;
    } catch (error: any) {
      console.error('Error fetching invoice details:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
      return;
    }
  }

  /**
   * Regenerate invoice PDF (useful if original failed or needs update)
   */
  async regenerateInvoicePdf(req: Request, res: Response): Promise<void> {
    try {
      const { invoiceNumber } = req.params;
      
      if (!invoiceNumber) {
        res.status(400).json({
          success: false,
          error: 'Invoice number is required'
        });
        return;
      }

      // Get invoice details first
      const { data: invoice, error: invoiceError } = await this.supabaseService.supabase
        .from('invoices')
        .select('*')
        .eq('invoice_number', invoiceNumber)
        .single();

      if (invoiceError || !invoice) {
        res.status(404).json({
          success: false,
          error: 'Invoice not found'
        });
        return;
      }

      // Get quote number from invoice
      const { data: quote, error: quoteError } = await this.supabaseService.supabase
        .from('quotes')
        .select('quote_number')
        .eq('id', invoice.quote_id)
        .single();

      if (quoteError || !quote) {
        res.status(404).json({
          success: false,
          error: 'Quote not found'
        });
        return;
      }

      // Regenerate PDF
      const result = await this.supabaseService.generateAndUploadInvoicePdf(
        quote.quote_number,
        invoiceNumber
      );

      if (result.success) {
        res.json({
          success: true,
          message: 'Invoice PDF regenerated successfully',
          pdfUrl: result.publicUrl
        });
        return;
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
        return;
      }
    } catch (error: any) {
      console.error('Error regenerating invoice PDF:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
      return;
    }
  }
}

export default new InvoicePdfController();
