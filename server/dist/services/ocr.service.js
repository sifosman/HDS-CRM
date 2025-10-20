"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveImageFile = exports.convertOCRToCutlistData = exports.processImageWithOCR = void 0;
const vision_1 = require("@google-cloud/vision");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Initialize the Google Cloud Vision client
// This can use either GOOGLE_CREDENTIALS environment variable with JSON content
// or GOOGLE_APPLICATION_CREDENTIALS environment variable with file path
let visionClient;
try {
    // First, try to use GOOGLE_CREDENTIALS (JSON string in environment variable)
    // This is primarily for Vercel and other serverless environments
    if (process.env.GOOGLE_CREDENTIALS) {
        console.log('Using Google Cloud credentials from GOOGLE_CREDENTIALS environment variable');
        const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        visionClient = new vision_1.ImageAnnotatorClient({ credentials });
    }
    // Otherwise, fall back to GOOGLE_APPLICATION_CREDENTIALS file path
    else {
        const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';
        if (credentialsPath && fs_1.default.existsSync(path_1.default.resolve(credentialsPath))) {
            console.log(`Using Google Cloud credentials from file: ${credentialsPath}`);
            visionClient = new vision_1.ImageAnnotatorClient();
        }
        else {
            console.warn(`Google Cloud credentials not found in environment or at file path: ${credentialsPath}`);
            console.warn('OCR functionality will be limited to mock responses');
            // Create a mock client for development/testing
            visionClient = {
                textDetection: () => __awaiter(void 0, void 0, void 0, function* () {
                    return [
                        {
                            textAnnotations: [
                                {
                                    description: 'Mock OCR Text\n800 x 600 2pcs\n400 x 300 4pcs\n2440 x 1220 1pc',
                                    boundingPoly: { vertices: [] }
                                }
                            ]
                        }
                    ];
                })
            };
        }
    }
}
catch (error) {
    console.error('Error initializing Google Cloud Vision client:', error);
    // Create a mock client as fallback
    visionClient = {
        textDetection: () => __awaiter(void 0, void 0, void 0, function* () {
            return [
                {
                    textAnnotations: [
                        {
                            description: 'Mock OCR Text\n800 x 600 2pcs\n400 x 300 4pcs\n2440 x 1220 1pc',
                            boundingPoly: { vertices: [] }
                        }
                    ]
                }
            ];
        })
    };
}
/**
 * Process an image with Google Cloud Vision OCR
 * @param imagePath Path to the image file
 * @returns Extracted text and structured data
 */
const processImageWithOCR = (imagePath) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        // Read the image file
        const imageFile = fs_1.default.readFileSync(imagePath);
        // Perform OCR on the image
        const [result] = yield visionClient.textDetection(imageFile);
        const detections = result.textAnnotations || [];
        // Extract the full text and individual text blocks
        const rawText = ((_a = detections[0]) === null || _a === void 0 ? void 0 : _a.description) || '';
        const textBlocks = [];
        // Process each text annotation (skip the first one which is the full text)
        for (let i = 1; i < detections.length; i++) {
            const detection = detections[i];
            if (detection.description && ((_b = detection.boundingPoly) === null || _b === void 0 ? void 0 : _b.vertices)) {
                textBlocks.push({
                    text: detection.description,
                    confidence: detection.confidence || 0,
                    boundingBox: {
                        vertices: detection.boundingPoly.vertices.map(vertex => ({
                            x: vertex.x || 0,
                            y: vertex.y || 0
                        }))
                    }
                });
            }
        }
        // Extract dimensions from the text
        const { dimensions, unit } = extractDimensionsFromText(rawText);
        return {
            rawText,
            textBlocks,
            dimensions,
            unit
        };
    }
    catch (error) {
        console.error('Error processing image with OCR:', error);
        throw error;
    }
});
exports.processImageWithOCR = processImageWithOCR;
/**
 * Extract dimensions from OCR text
 * @param text The OCR extracted text
 * @returns Extracted dimensions and unit
 */
const extractDimensionsFromText = (text) => {
    // Initialize result
    const dimensions = [];
    let unit = 'mm'; // Default unit
    // Determine the unit of measurement
    if (text.toLowerCase().includes('inch') || text.includes('"')) {
        unit = 'in';
    }
    else if (text.toLowerCase().includes('feet') || text.toLowerCase().includes('foot') || text.includes("'")) {
        unit = 'ft';
    }
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    // Regular expressions for matching dimensions
    const dimensionRegex = /(\d+(?:\.\d+)?)\s*[x×X]\s*(\d+(?:\.\d+)?)/;
    const quantityRegex = /(\d+)\s*(?:pcs|pieces|pc|piece|qty|quantity)/i;
    // Process each line
    for (const line of lines) {
        // Skip header lines or empty lines
        if (line.toLowerCase().includes('cutting list') ||
            line.toLowerCase().includes('header') ||
            line.trim() === '') {
            continue;
        }
        // Try to extract dimensions
        const dimensionMatch = line.match(dimensionRegex);
        if (dimensionMatch) {
            const width = parseFloat(dimensionMatch[1]);
            const length = parseFloat(dimensionMatch[2]);
            // Try to extract quantity
            let quantity = 1;
            const quantityMatch = line.match(quantityRegex);
            if (quantityMatch) {
                quantity = parseInt(quantityMatch[1]);
            }
            // Extract any description (text before or after the dimensions)
            let description = line
                .replace(dimensionRegex, '')
                .replace(quantityRegex, '')
                .trim();
            // Add the dimension to the result
            dimensions.push({
                width,
                length,
                quantity,
                description: description || undefined
            });
        }
    }
    return { dimensions, unit };
};
/**
 * Convert OCR results to cutting list data format
 * @param ocrResults The OCR processing results
 * @returns Formatted cutting list data
 */
const convertOCRToCutlistData = (ocrResults) => {
    // Initialize result structure
    const result = {
        stockPieces: [],
        cutPieces: [],
        materials: [
            {
                id: 'default',
                name: 'Default Material',
                type: 'board',
                thickness: 18
            }
        ],
        unit: ocrResults.unit
    };
    // Process dimensions
    for (const dimension of ocrResults.dimensions) {
        // Determine if it's a stock piece or cut piece
        // Typically, larger dimensions are stock pieces
        if (dimension.width > 1000 || dimension.length > 1000) {
            result.stockPieces.push({
                id: `sp-${result.stockPieces.length + 1}`,
                width: dimension.width,
                length: dimension.length,
                quantity: dimension.quantity,
                material: 'default'
            });
        }
        else {
            result.cutPieces.push({
                id: `cp-${result.cutPieces.length + 1}`,
                width: dimension.width,
                length: dimension.length,
                quantity: dimension.quantity,
                name: dimension.description || `Part ${result.cutPieces.length + 1}`
            });
        }
    }
    // If no stock pieces were found but cut pieces were, add a default stock piece
    if (result.stockPieces.length === 0 && result.cutPieces.length > 0) {
        result.stockPieces.push({
            id: 'sp-default',
            width: 2440,
            length: 1220,
            quantity: 1,
            material: 'default'
        });
    }
    return result;
};
exports.convertOCRToCutlistData = convertOCRToCutlistData;
/**
 * Save an image file to disk
 * @param imageBuffer The image buffer
 * @param fileExtension The file extension
 * @returns The path to the saved image
 */
const saveImageFile = (imageBuffer, fileExtension) => {
    // Create a unique filename
    const filename = `cutlist-${(0, uuid_1.v4)()}${fileExtension}`;
    // Define the upload directory
    const uploadDir = path_1.default.join(__dirname, '../../uploads');
    // Ensure the directory exists
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    // Define the file path
    const filePath = path_1.default.join(uploadDir, filename);
    // Write the file
    fs_1.default.writeFileSync(filePath, imageBuffer);
    return filePath;
};
exports.saveImageFile = saveImageFile;
