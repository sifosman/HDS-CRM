"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const webhook_direct_controller_1 = require("./controllers/webhook-direct.controller");
// Import routes
const optimizer_routes_1 = __importDefault(require("./routes/optimizer.routes"));
const project_routes_1 = __importDefault(require("./routes/project.routes"));
const botsailor_routes_1 = __importDefault(require("./routes/botsailor.routes"));
const iqretail_routes_1 = __importDefault(require("./routes/iqretail.routes"));
const ocr_routes_1 = __importDefault(require("./routes/ocr.routes"));
const cutlist_routes_1 = __importDefault(require("./routes/cutlist.routes"));
const n8n_routes_1 = __importDefault(require("./routes/n8n.routes"));
const webhook_direct_routes_1 = __importDefault(require("./routes/webhook-direct.routes"));
const debug_routes_1 = __importDefault(require("./routes/debug.routes"));
const supabase_routes_1 = __importDefault(require("./routes/supabase.routes"));
const diagnostic_routes_1 = require("./routes/diagnostic.routes");
const payfast_routes_1 = __importDefault(require("./routes/payfast.routes"));
const invoice_routes_1 = __importDefault(require("./routes/invoice.routes"));
// Load environment variables
dotenv_1.default.config();
// Create Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Serve static files from the public directory
app.use(express_1.default.static('public'));
// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/freecut';
mongoose_1.default.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
// Routes
app.use('/api/optimizer', optimizer_routes_1.default);
app.use('/api/projects', project_routes_1.default);
app.use('/api/botsailor', botsailor_routes_1.default);
app.use('/api/ocr', ocr_routes_1.default);
app.use('/api/cutlist', cutlist_routes_1.default);
app.use('/api/n8n', n8n_routes_1.default);
app.use('/api/webhook', webhook_direct_routes_1.default);
app.use('/api/debug', debug_routes_1.default);
app.use('/api/iqretail', iqretail_routes_1.default);
app.use('/api/supabase', supabase_routes_1.default);
app.use('/api/diagnostic', diagnostic_routes_1.diagnosticRoutes);
app.use('/api/payfast', payfast_routes_1.default);
app.use('/api/invoices', invoice_routes_1.default);
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
        await webhook_direct_controller_1.webhookDirectController.processN8n(req, res);
    }
    catch (error) {
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
            '/api/payfast'
        ]
    });
});
// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
exports.default = app;
