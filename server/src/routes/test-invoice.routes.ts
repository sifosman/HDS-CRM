import express from 'express';
import SupabaseService from '../services/supabase.service';

const router = express.Router();

// Test endpoint to generate and upload invoice PDF
router.post('/test-invoice-pdf', async (req, res) => {
  try {
    const { quoteNumber, invoiceNumber } = req.body;
    
    if (!quoteNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'quoteNumber is required' 
      });
    }
    
    const invoiceNum = invoiceNumber || `TEST-${Date.now()}`;
    
    console.log('Testing invoice PDF generation...');
    console.log('Quote Number:', quoteNumber);
    console.log('Invoice Number:', invoiceNum);
    
    // Generate and upload invoice PDF
    const result = await SupabaseService.generateAndUploadInvoicePdf(quoteNumber, invoiceNum);
    
    if (result.success) {
      console.log('✅ Invoice PDF generated and uploaded successfully!');
      console.log('📄 PDF URL:', result.publicUrl);
      
      res.json({
        success: true,
        message: 'Invoice PDF generated and uploaded successfully',
        pdfUrl: result.publicUrl,
        invoiceNumber: invoiceNum,
        quoteNumber: quoteNumber
      });
    } else {
      console.error('❌ Invoice PDF generation failed:', result.error);
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to generate invoice PDF'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

// Test endpoint to check if invoice exists in bucket
router.get('/test-check-invoice/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    
    console.log('Checking for invoice PDF in bucket:', invoiceNumber);
    
    const result = await SupabaseService.listInvoicePdfs(invoiceNumber);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error: any) {
    console.error('❌ Check invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to download invoice PDF
router.get('/test-download-invoice/:invoiceNumber', async (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    
    console.log('Downloading invoice PDF:', invoiceNumber);
    
    const result = await SupabaseService.downloadInvoicePdf(invoiceNumber);
    
    if (result.success && result.data) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceNumber}.pdf"`);
      res.send(result.data);
    } else {
      res.status(404).json({
        success: false,
        error: result.error || 'Invoice PDF not found'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Download invoice error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to list all invoices
router.get('/test-list-invoices', async (req, res) => {
  try {
    console.log('Listing all invoice PDFs in bucket...');
    
    const { data, error } = await SupabaseService.supabase.storage
      .from('invoices')
      .list('', {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' }
      });
    
    if (error) {
      console.error('❌ Error listing invoices:', error);
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
    
    console.log('📋 Found', data.length, 'invoice PDFs');
    
    res.json({
      success: true,
      count: data.length,
      files: data.map(file => ({
        name: file.name,
        created: file.created_at,
        size: file.metadata?.size || 0,
        url: `${process.env.SUPABASE_URL}/storage/v1/object/public/invoices/${file.name}`
      }))
    });
    
  } catch (error: any) {
    console.error('❌ List invoices error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
