import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { n8nController } from './controllers/n8n.controller';
import { webhookDirectController } from './controllers/webhook-direct.controller';

// Import routes
import optimizerRoutes from './routes/optimizer.routes';
import projectRoutes from './routes/project.routes';
import botsailorRoutes from './routes/botsailor.routes';
import iqretailRoutes from './routes/iqretail.routes';
import ocrRoutes from './routes/ocr.routes';
import cutlistRoutes from './routes/cutlist.routes';
import n8nRoutes from './routes/n8n.routes';
import webhookDirectRoutes from './routes/webhook-direct.routes';
import debugRoutes from './routes/debug.routes';
import supabaseRoutes from './routes/supabase.routes';
import { diagnosticRoutes } from './routes/diagnostic.routes';
import payfastRoutes from './routes/payfast.routes';
import invoiceRoutes from './routes/invoice.routes';
import invoicePdfRoutes from './routes/invoice-pdf.routes';
import emailTestRoutes from './routes/email-test.routes';
import emailTestHardcodedRoutes from './routes/email-test-hardcoded.routes';
import testEmailRoutes from './routes/test-email.routes';
import testRoutes from './routes/test.routes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the public directory
app.use(express.static('public'));

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/freecut';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/optimizer', optimizerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/botsailor', botsailorRoutes);
app.use('/api/iqretail', iqretailRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/cutlist', cutlistRoutes);
app.use('/api/n8n', n8nRoutes);
app.use('/api/webhook-direct', webhookDirectRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/supabase', supabaseRoutes);
app.use('/api/diagnostic', diagnosticRoutes);
app.use('/api/payfast', payfastRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/invoice-pdf', invoicePdfRoutes);
app.use('/api/email', emailTestRoutes);
app.use('/api/email-hardcoded', emailTestHardcodedRoutes);
app.use('/api/test-email', testEmailRoutes);
app.use('/api/test', testRoutes);

// Direct test endpoint for n8n integration
app.get('/api/direct-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Direct API test endpoint is working!',
    timestamp: new Date().toISOString()
  });
});

// Direct POST endpoint for n8n data - use our webhook direct controller
app.post('/api/direct-n8n', async (req, res) => {
  try {
    // Use our specialized webhook direct controller
    await webhookDirectController.processN8n(req, res);
  } catch (error) {
    console.error('Error in direct-n8n endpoint:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error processing n8n data',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to HDS Group Cutlist API',
    version: '1.3.0',
    endpoints: [
      '/api/optimizer',
      '/api/projects',
      '/api/botsailor',
      '/api/ocr',
      '/api/cutlist',
      '/api/n8n/process',
      '/api/direct-test',
      '/api/direct-n8n',
      '/api/payfast',
      '/api/invoice-pdf/generate/:quoteNumber',
      '/api/invoice-pdf/:invoiceNumber',
      '/api/invoice-pdf/regenerate/:invoiceNumber'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
