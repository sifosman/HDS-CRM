"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const cutlist_controller_1 = require("../controllers/cutlist.controller");
const ocr_disabled_service_1 = require("../services/ocr-disabled.service");
const cutlist_model_1 = __importDefault(require("../models/cutlist.model"));
const router = express_1.default.Router();
// Configure multer for image uploads
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        }
        else {
            cb(null, false);
        }
    }
});
// Route to view a cutlist by its ID
router.get('/view/:id', cutlist_controller_1.cutlistController.viewCutlistById);
// Route to update a cutlist's data
router.post('/update/:id', cutlist_controller_1.cutlistController.updateCutlistById);
// Route to reprocess an existing cutlist to fix quantities
router.put('/reprocess/:id', cutlist_controller_1.cutlistController.reprocessCutlistById);
// Route to create a cutlist from n8n data
router.post('/n8n-data', cutlist_controller_1.cutlistController.createFromN8nData);
// Route to get cutlist data as JSON
router.get('/data/:id', cutlist_controller_1.cutlistController.getCutlistData);
// API endpoint to get all cutlists
router.get('/', cutlist_controller_1.cutlistController.getAllCutlists);
// Route to handle image upload and processing
router.post('/process', upload.single('image'), (async (req, res) => {
    try {
        // Check if image was uploaded
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image uploaded' });
        }
        // Save the image
        const fileExtension = path_1.default.extname(req.file.originalname) || '.jpg';
        const imagePath = await (0, ocr_disabled_service_1.saveImageFile)(req.file.buffer, fileExtension);
        // Process the image with OCR
        const ocrResults = await (0, ocr_disabled_service_1.processImageWithOCR)(imagePath);
        // Create a new cutlist
        const cutlist = new cutlist_model_1.default({
            rawText: ocrResults.rawText,
            dimensions: ocrResults.dimensions,
            unit: ocrResults.unit,
            customerName: req.body.customerName || 'Customer',
            projectName: req.body.projectName || 'Cutting List Project',
        });
        // Save the cutlist
        await cutlist.save();
        // Return success
        res.json({
            success: true,
            message: 'Image processed successfully',
            cutlistId: cutlist._id
        });
    }
    catch (error) {
        console.error('Error processing image:', error);
        res.status(500).json({ success: false, message: 'Error processing image' });
    }
}));
// Route to process the sample cutlist.jpg
router.get('/process-sample', (async (req, res) => {
    try {
        // Get the path to cutlist.jpg in the project root
        const sampleImagePath = path_1.default.join(process.cwd(), 'cutlist.jpg');
        // Check if the file exists
        if (!fs_1.default.existsSync(sampleImagePath)) {
            return res.status(404).json({ success: false, message: 'Sample cutlist.jpg not found' });
        }
        // Process the image with OCR
        const ocrResults = await (0, ocr_disabled_service_1.processImageWithOCR)(sampleImagePath);
        // Create a new cutlist
        const cutlist = new cutlist_model_1.default({
            rawText: ocrResults.rawText,
            dimensions: ocrResults.dimensions,
            unit: ocrResults.unit,
            customerName: 'Sample Customer',
            projectName: 'Sample Cutting List',
        });
        // Save the cutlist
        await cutlist.save();
        // Redirect to the cutlist view
        res.redirect(`/api/cutlist/view/${cutlist._id}`);
    }
    catch (error) {
        console.error('Error processing sample image:', error);
        res.status(500).json({ success: false, message: 'Error processing sample image' });
    }
}));
// Route to test the cutlist feature
router.get('/test', (req, res) => {
    res.redirect('/cutlist-test.html');
});
exports.default = router;
