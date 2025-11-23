"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendQuoteToWhatsApp = exports.generateQuote = exports.importIQData = exports.exportIQData = exports.downloadPdf = exports.optimizeCutting = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const optimizer_service_1 = require("../services/optimizer.service");
const supabase_service_1 = __importDefault(require("../services/supabase.service"));
const email_service_1 = __importDefault(require("../services/email.service"));
// Optimize cutting layout
const optimizeCutting = async (req, res) => {
    try {
        const { pieces, unit, width, layout } = req.body;
        // Validate inputs
        if (!pieces || !Array.isArray(pieces) || pieces.length === 0) {
            return res.status(400).json({ message: 'Invalid pieces data' });
        }
        // Check if there are both stock pieces and cut piecess
        const hasStockPieces = pieces.some(piece => piece.kind === 1);
        const hasCutPieces = pieces.some(piece => piece.kind === 0);
        if (!hasStockPieces || !hasCutPieces) {
            return res.status(400).json({
                message: 'You need at least one stock piece and one cut piece'
            });
        }
        // Prepare data for optimization
        const { stockPieces, cutPieces } = (0, optimizer_service_1.prepareOptimizationData)(pieces, unit || 0);
        // Run optimization
        const solution = (0, optimizer_service_1.optimizeCuttingLayout)(stockPieces, cutPieces, width || 3, layout || 0);
        // Generate PDF and upload to Supabase
        const pdfResult = await (0, optimizer_service_1.generateAndUploadOptimizationPdf)(solution, unit || 0, width || 3, layout || 0);
        if (!pdfResult.success) {
            return res.status(500).json({
                message: 'Error generating PDF',
                error: pdfResult.error
            });
        }
        // Generate IQ export data
        const iqData = (0, optimizer_service_1.generateIQExport)(solution, unit || 0, width || 3, layout || 0);
        // Return result
        res.status(200).json({
            message: 'Optimization completed successfully',
            pdfId: pdfResult.pdfId,
            pdfUrl: pdfResult.publicUrl,
            solution,
            iqData
        });
    }
    catch (error) {
        console.error('Optimization error:', error);
        res.status(500).json({ message: 'Error during optimization', error });
    }
};
exports.optimizeCutting = optimizeCutting;
// Download PDF result
const downloadPdf = async (req, res) => {
    try {
        const { id } = req.params;
        const pdfPath = path_1.default.join(__dirname, '../../pdfs', `solution_${id}.pdf`);
        // Check if file exists
        if (!fs_1.default.existsSync(pdfPath)) {
            return res.status(404).json({ message: 'PDF not found' });
        }
        // Send file
        res.download(pdfPath);
    }
    catch (error) {
        console.error('PDF download error:', error);
        res.status(500).json({ message: 'Error downloading PDF', error });
    }
};
exports.downloadPdf = downloadPdf;
// Export IQ data for a specific optimization
const exportIQData = async (req, res) => {
    try {
        const { solution, unit, width, layout } = req.body;
        // Validate input
        if (!solution || !solution.stockPieces) {
            return res.status(400).json({ message: 'Invalid solution data' });
        }
        // Generate IQ export data
        const iqData = (0, optimizer_service_1.generateIQExport)(solution, unit || 0, width || 3, layout || 0);
        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=iq_export.json');
        // Send data
        res.status(200).json(iqData);
    }
    catch (error) {
        console.error('IQ export error:', error);
        res.status(500).json({ message: 'Error exporting IQ data', error });
    }
};
exports.exportIQData = exportIQData;
// Import data from IQ software
const importIQData = async (req, res) => {
    try {
        const iqData = req.body;
        // Validate input
        if (!iqData) {
            return res.status(400).json({ message: 'Missing IQ data' });
        }
        // Process IQ data
        const { pieces, unit, width, layout } = (0, optimizer_service_1.importFromIQ)(iqData);
        // Check if there are both stock pieces and cut pieces
        const hasStockPieces = pieces.some(piece => piece.kind === 1);
        const hasCutPieces = pieces.some(piece => piece.kind === 0);
        if (!hasStockPieces || !hasCutPieces) {
            return res.status(400).json({
                message: 'The imported data must contain at least one stock piece and one cut piece'
            });
        }
        // Prepare data for optimization
        const { stockPieces, cutPieces } = (0, optimizer_service_1.prepareOptimizationData)(pieces, unit);
        // Run optimization
        const solution = (0, optimizer_service_1.optimizeCuttingLayout)(stockPieces, cutPieces, width, layout);
        // Generate PDF and upload to Supabase
        const pdfResult = await (0, optimizer_service_1.generateAndUploadOptimizationPdf)(solution, unit, width, layout);
        if (!pdfResult.success) {
            return res.status(500).json({
                message: 'Error generating PDF',
                error: pdfResult.error
            });
        }
        // Generate IQ export data for confirmation
        const exportData = (0, optimizer_service_1.generateIQExport)(solution, unit, width, layout);
        // Return result
        res.status(200).json({
            message: 'IQ data imported and processed successfully',
            pdfId: pdfResult.pdfId,
            pdfUrl: pdfResult.publicUrl,
            solution,
            iqData: exportData,
            importedPieces: pieces
        });
    }
    catch (error) {
        console.error('IQ import error:', error);
        res.status(500).json({
            message: 'Error importing IQ data',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};
exports.importIQData = importIQData;
// Generate a complete quote with optimization, pricing, and PDF
const generateQuote = async (req, res) => {
    var _a, _b, _c, _d, _e;
    try {
        const { sections, customerName, projectName, phoneNumber, branchData } = req.body;
        // Validate input
        if (!sections || !Array.isArray(sections) || sections.length === 0) {
            return res.status(400).json({ message: 'Invalid sections data' });
        }
        if (!customerName) {
            return res.status(400).json({ message: 'Customer name is required' });
        }
        // Process each material section
        const processedSections = [];
        const pdfSections = [];
        let grandTotal = 0;
        let totalEdgingLength = 0;
        let invoiceNumber = null;
        let quotePdfUrl = '';
        let invoicePdfUrl = '';
        let cutlistPdfUrl = '';
        let edgingCostTotal = 0;
        let totalBoardsUsed = 0; // Track total boards used for cutting fee
        // Generate a unique quote ID with branch name BEFORE processing sections
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const randomNum = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        // Include branch name in quote ID if available
        let quoteId;
        if (branchData && branchData.trading_as) {
            // Create branch abbreviation from trading_as (more descriptive)
            let branchAbbr = '';
            const words = branchData.trading_as.split(' ').filter((word) => word.length > 0);
            if (words.length === 1) {
                // Single word: take first 8 characters
                branchAbbr = words[0].substring(0, 8).toUpperCase();
            }
            else if (words.length === 2) {
                // Two words: take first 4 chars of each
                branchAbbr = words[0].substring(0, 4).toUpperCase() + words[1].substring(0, 4).toUpperCase();
            }
            else {
                // Multiple words: take first 3 chars of first 3 words
                branchAbbr = words.slice(0, 3)
                    .map((word) => word.substring(0, 3).toUpperCase())
                    .join('');
            }
            // Ensure max length of 10 characters for readability
            branchAbbr = branchAbbr.substring(0, 10);
            quoteId = `Q-${dateStr}-${randomNum}-${branchAbbr}`;
            console.log(`Generated quote ID with branch: ${quoteId} (Branch: ${branchData.trading_as})`);
        }
        else {
            quoteId = `Q-${dateStr}-${randomNum}`;
            console.log(`Generated quote ID without branch: ${quoteId}`);
        }
        // Generate a unique cutlist ID for this quote based on the quote ID
        const dynamicCutlistId = `cutlist-${quoteId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        console.log('Generated cutlist ID:', dynamicCutlistId);
        for (const section of sections) {
            const { material, cutPieces } = section;
            if (!material || !cutPieces || !Array.isArray(cutPieces) || cutPieces.length === 0) {
                continue; // Skip invalid sections
            }
            // Filter out separator pieces from calculations
            const validCutPieces = cutPieces.filter((piece) => !piece.separator);
            if (validCutPieces.length === 0) {
                console.log(`Skipping section ${material} - no valid cut pieces after filtering separators`);
                continue; // Skip sections with only separator pieces
            }
            // 1. Get product pricing by description from Supabase
            console.log(`Getting pricing for material: ${material}`);
            // 1. Look up pricing for this material from Supabase
            const pricingResult = await supabase_service_1.default.getProductPricingByDescription(material, true);
            if (!pricingResult.success) {
                console.error(`No pricing found for ${material}`);
                // Instead of skipping, add error information to the response
                return res.status(400).json({
                    success: false,
                    message: `Material pricing not found: ${material}`,
                    error: `We couldn't find pricing information for "${material}" in our database. Please select a different material.`
                });
            }
            // 2. Extract price and dimensions from the pricing data
            // Add null check to avoid TypeScript errors
            if (!pricingResult.data) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid pricing data returned for ${material}`,
                    error: `The pricing data for "${material}" is invalid. Please contact support.`
                });
            }
            const { price, sizes } = pricingResult.data; // 'price' may come as string; cast to number
            const priceNum = typeof price === 'number' ? price : Number(price);
            if (isNaN(priceNum)) {
                console.error(`Price for ${material} is not a valid number: ${price}`);
                return res.status(400).json({
                    success: false,
                    message: `Invalid price value for ${material}`,
                    error: `The price value for "${material}" is not a valid number (received: ${price}). Please correct the data in the price list.`
                });
            }
            if (!price || !sizes) {
                console.error(`Missing price or dimensions for ${material}`);
                return res.status(400).json({
                    success: false,
                    message: `Missing pricing or dimension data for ${material}`,
                    error: `The material "${material}" is missing price or dimension information in our database. Please contact support.`
                });
            }
            // 3. Parse dimensions string (e.g., "2750x1830x18" -> length x width)
            // Remove 'mm' suffix if present
            const cleanSizes = sizes.replace(/mm$/i, '');
            // Split by 'x' and parse as integers
            const sizeParts = cleanSizes.split('x').map((part) => parseInt(part.trim(), 10));
            if (sizeParts.length < 2 || isNaN(sizeParts[0]) || isNaN(sizeParts[1])) {
                console.error(`Invalid dimensions format for ${material}: ${sizes}`);
                return res.status(400).json({
                    success: false,
                    message: `Invalid dimensions format for ${material}`,
                    error: `The dimensions data "${sizes}" for "${material}" is in an invalid format. Please contact support.`
                });
            }
            // Use the exact values from the dimensions column without conversion
            let length = sizeParts[0]; // Using exact value as-is
            let width = sizeParts[1]; // Using exact value as-is
            console.log(`Using exact dimensions from product data: ${length}x${width} (no conversion applied)`);
            // Sanity check - if dimensions are unrealistically small, use standard values
            if (length < 10 || width < 10) {
                console.warn(`Even after conversion, dimensions still appear too small (${length}x${width}mm), using standard dimensions`);
                length = 2440; // Standard board length in mm
                width = 1220; // Standard board width in mm
                console.log(`Using standard board dimensions: ${length}x${width}mm`);
            }
            // 4. Create stock piece with adjusted dimensions
            const stockPiece = {
                length: length, // Using the adjusted length
                width: width, // Using the adjusted width
                amount: 100, // Set quantity to 100 as requested
                kind: 1, // Stock piece
                pattern: 0 // No pattern
            };
            console.log(`Creating stock piece with dimensions: ${length}x${width}mm (quantity: 100)`);
            // 5. Prepare all pieces for optimization
            const allPieces = [
                stockPiece,
                ...validCutPieces.map(piece => (Object.assign(Object.assign({}, piece), { kind: 0 // Cut piece
                 })))
            ];
            // 6. Prepare data for optimization (convert to mm internally)
            const unit = 0; // mm
            console.log('Preparing optimization data with allPieces:', JSON.stringify(allPieces));
            const { stockPieces, cutPieces: optimizerCutPieces } = (0, optimizer_service_1.prepareOptimizationData)(allPieces, unit);
            console.log('Prepared optimization data:', {
                stockPieces: JSON.stringify(stockPieces),
                cutPieces: JSON.stringify(optimizerCutPieces)
            });
            // Enforce selective rotation: only allow rotation for specific materials (case-insensitive exact match)
            try {
                // Allowed materials for rotation - exact user-provided list (lowercased)
                const allowedMaterials = [
                    // ACRYLIC / ACRYLIC-UV
                    'acrylic black matt 9x4x17',
                    'acrylic white matt 9x4x17',
                    'acrylic/uv - assorted clearance gloss 8x4x17mm',
                    // MEL CHIP
                    'mel chip black peen 9x6x16 df pg',
                    'mel chip black txt 9x6x16 df',
                    'mel chip caligra text 9x6x16 df',
                    'mel chip charcoal grey txt 9x6x16 df',
                    'mel chip charcoal grey txt 9x6x16 df b-grd',
                    'mel chip cream txt 9x6x16df best buy',
                    'mel chip dessert sky txt 9x6x16 df',
                    'mel chip dunblane grey peen 9x6x16df pg',
                    'mel chip folkstone grey peen 9x6x16mm pg',
                    'mel chip iceberg white peen 9x6x16 df pg',
                    'mel chip kalapana peen 9x6x16 df pg',
                    'mel chip kara blue peen 9x6x16 df pg',
                    'mel chip metallic cappuccino txt 9x6x16 df',
                    'mel chip moonstone grey txt 9x6x16 df',
                    'mel chip moonstone txt 9x6x16 df grey b-grade',
                    'mel chip olivia text 9x6x16 df',
                    'mel chip pearl grey text 9x6x16 df',
                    'mel chip premium white txt 9x6x16 df',
                    'mel chip storm grey peen 9x6x16 df pg',
                    'mel chip value white 9x6x16 df',
                    // MEL MDF
                    'mel mdf platinum white 9x6x16 df',
                    'mel mdf platinum white 9x6x3 sf 202',
                    // PLAIN CHIP
                    'plain chip 2750x1830x16mm "best buy"',
                    'plain chip 2750x1830x16mm fx',
                    // UV
                    'uv - black 9x6x17',
                    'uv - black 9x6x17 cutting grd',
                    'uv - black 9x6x17 pg',
                    'uv - caligra 9x6x17mm',
                    'uv - cappucinno 9x6x17 pg'
                ];
                const materialKey = String(material || '').toLowerCase().trim();
                const allowRotationForMaterial = allowedMaterials.includes(materialKey);
                optimizerCutPieces.forEach((cp) => {
                    // Keep legacy rule (no pattern) and further restrict by material
                    cp.canRotate = Boolean(cp.canRotate && allowRotationForMaterial);
                });
                console.log(`Rotation policy for material "${material}" => ${allowRotationForMaterial ? 'ALLOW' : 'BLOCK'}`);
            }
            catch (e) {
                console.warn('Selective rotation enforcement failed; using legacy behavior', e);
            }
            // 7. Run optimization
            const cutWidth = 3; // 3mm saw blade width
            const layout = 0; // Guillotine layout
            console.log('Running optimization with:', {
                stockPiecesCount: stockPieces.length,
                cutPiecesCount: optimizerCutPieces.length,
                cutWidth,
                layout
            });
            const solution = (0, optimizer_service_1.optimizeCuttingLayout)(stockPieces, optimizerCutPieces, cutWidth, layout);
            console.log('Optimization result:', {
                solutionStockPiecesCount: ((_a = solution.stockPieces) === null || _a === void 0 ? void 0 : _a.length) || 0,
                solutionStockPieces: JSON.stringify(solution.stockPieces)
            });
            // Generate and upload cutlist PDF to cutlists bucket
            try {
                console.log('Generating cutlist PDF');
                const cutlistPdfResult = await (0, optimizer_service_1.generateAndUploadOptimizationPdf)(solution, unit, cutWidth, layout, dynamicCutlistId);
                if (cutlistPdfResult.success && cutlistPdfResult.publicUrl) {
                    console.log('Cutlist PDF generated and uploaded successfully:', cutlistPdfResult.publicUrl);
                    cutlistPdfUrl = cutlistPdfResult.publicUrl;
                }
                else {
                    console.error('Failed to generate or upload cutlist PDF:', cutlistPdfResult.error);
                }
            }
            catch (pdfError) {
                console.error('Error generating cutlist PDF:', pdfError);
            }
            // 8. Calculate boards needed and wastage statistics
            const boardsNeeded = solution.stockPieces.length;
            totalBoardsUsed += boardsNeeded; // Add to total boards for cutting fee
            const boardArea = length * width * boardsNeeded;
            let usedArea = 0;
            // Calculate the total area of all cut pieces
            for (const piece of validCutPieces) {
                usedArea += piece.length * piece.width * (piece.amount || 1);
            }
            // Calculate wastage - the area of the boards that wasn't used
            // If usedArea > boardArea, we're efficiently using multiple boards
            // and the wastage is the unused portion of the last board
            const wasteArea = boardArea - usedArea > 0 ? boardArea - usedArea : (boardArea - (usedArea % boardArea));
            // Calculate efficiency percentage (used area / total area)
            const efficiencyPercentage = boardArea > 0 ? Math.min(100, Math.round((usedArea / boardArea) * 100)) : 0;
            // Calculate wastage percentage (waste area / total area)
            const wastePercentage = boardArea > 0 ? Math.max(0, Math.round((wasteArea / boardArea) * 100)) : 0;
            console.log(`Board calculation: ${boardsNeeded} boards of size ${length}x${width}mm`);
            console.log(`Area calculation: Board area ${boardArea}mm², used area ${usedArea}mm²`);
            console.log(`Efficiency: ${efficiencyPercentage}%, waste ${wastePercentage}%`);
            // 9. Calculate total price for this section and edging requirements
            const sectionTotal = boardsNeeded * priceNum;
            grandTotal += sectionTotal;
            // Calculate edging requirements
            let totalEdging = 0;
            const edgingBreakdown = [];
            console.log(`\n=== EDGING CALCULATION DEBUG for ${material} ===`);
            console.log(`Cut pieces count: ${validCutPieces.length}`);
            for (const piece of validCutPieces) {
                // Check each edge (L1, L2, W1, W2) and calculate edging needed
                let pieceEdging = 0;
                let edgingSides = [];
                console.log(`\nPiece: ${piece.name || 'Unnamed'} (${piece.length}x${piece.width}mm, qty: ${piece.amount || 1})`);
                console.log(`Edging data received: ${JSON.stringify(piece.edging)}`);
                // Parse the edging field if it exists
                // edging can be a string like "L1,W2" or a number (0 or 1)
                const edging = piece.edging;
                console.log(`Piece: ${piece.length}x${piece.width}mm, quantity: ${piece.amount || 1}, edging: ${JSON.stringify(edging)}`);
                if (edging) {
                    if (typeof edging === 'string') {
                        // Handle special case: "1" means all 4 sides
                        if (edging.trim() === '1') {
                            pieceEdging = 2 * (Number(piece.length) || 0) + 2 * (Number(piece.width) || 0);
                            edgingSides = ['L1', 'L2', 'W1', 'W2'];
                            console.log(`  All sides (from "1"): ${pieceEdging}mm (2x${piece.length} + 2x${piece.width})`);
                        }
                        else {
                            // Parse comma-separated sides like "L1,W2"
                            const sides = edging.split(',').filter(s => s.trim()); // Filter empty strings
                            console.log(`Parsed edging sides: [${sides.join(', ')}]`);
                            // Calculate edging length for each specified side
                            for (const side of sides) {
                                const trimmedSide = side.trim();
                                if (trimmedSide === 'L1' || trimmedSide === 'L2') {
                                    const lengthValue = Number(piece.length) || 0;
                                    pieceEdging += lengthValue;
                                    edgingSides.push(trimmedSide);
                                    console.log(`  ${trimmedSide}: +${lengthValue}mm (length side)`);
                                }
                                else if (trimmedSide === 'W1' || trimmedSide === 'W2') {
                                    const widthValue = Number(piece.width) || 0;
                                    pieceEdging += widthValue;
                                    edgingSides.push(trimmedSide);
                                    console.log(`  ${trimmedSide}: +${widthValue}mm (width side)`);
                                }
                            }
                        }
                    }
                    else if (edging === 1 || edging === true) {
                        // If edging is just set to 1 or true, assume all 4 sides
                        pieceEdging = 2 * (Number(piece.length) || 0) + 2 * (Number(piece.width) || 0);
                        edgingSides = ['L1', 'L2', 'W1', 'W2'];
                        console.log(`  All sides: ${pieceEdging}mm (2x${piece.length} + 2x${piece.width})`);
                    }
                    else {
                        console.log(`  No edging required`);
                    }
                }
                // Multiply by quantity
                const beforeQuantity = pieceEdging;
                pieceEdging *= (piece.amount || 1);
                console.log(`  Before quantity: ${beforeQuantity}mm, After quantity (x${piece.amount || 1}): ${pieceEdging}mm`);
                totalEdging += pieceEdging;
                console.log(`  Running total: ${totalEdging}mm`);
                // Add to edging breakdown if edging is required
                if (pieceEdging > 0) {
                    edgingBreakdown.push({
                        length: piece.length,
                        width: piece.width,
                        quantity: piece.amount || 1,
                        edges: edgingSides,
                        edgingLength: pieceEdging
                    });
                }
            }
            console.log(`\n=== FINAL EDGING TOTALS for ${material} ===`);
            console.log(`Total edging length: ${totalEdging}mm`);
            console.log(`Total edging cost: R${((totalEdging / 1000) * 14).toFixed(2)}`);
            console.log(`=== END EDGING DEBUG ===\n`);
            // 11. Add to processed sections with wastage and edging info
            const processedSection = {
                material,
                boardSize: `${length}x${width}`,
                boardsNeeded,
                pricePerBoard: priceNum,
                sectionTotal,
                wastage: {
                    boardArea,
                    usedArea,
                    wasteArea,
                    wastePercentage,
                    efficiencyPercentage
                },
                edging: {
                    length: totalEdging,
                    totalEdging: totalEdging, // Add this for PDF compatibility
                    cost: parseFloat(((totalEdging / 1000) * 14).toFixed(2)) // Store as number, not string
                }
            };
            processedSections.push(processedSection);
            pdfSections.push(Object.assign(Object.assign({}, processedSection), { cutPieces: validCutPieces.map((p) => ({
                    length: p.length,
                    width: p.width,
                    quantity: p.amount || 1,
                    edging: p.edging || null
                })) }));
        }
        // Quote ID already generated earlier in the function
        // Calculate cutting fee (same as in PDF quote - R70 per board)
        const cuttingFeePerBoard = 70; // R70 per board
        const totalCuttingFee = parseFloat((totalBoardsUsed * cuttingFeePerBoard).toFixed(2));
        // Get banking details based on branch trading_as (fx_branch)
        let bankingDetails = null;
        if (branchData && branchData.trading_as) {
            console.log(`Fetching banking details for branch: ${branchData.trading_as}`);
            const bankingResult = await supabase_service_1.default.getBankingDetailsByBranch(branchData.trading_as);
            if (bankingResult.success && bankingResult.data) {
                console.log('Banking details found:', bankingResult.data.bank);
                bankingDetails = bankingResult.data;
            }
            else {
                console.warn(`Banking details not found for branch: ${branchData.trading_as}`);
                console.warn('Error or message:', bankingResult.error || 'No data returned');
            }
        }
        else {
            console.warn('Cannot fetch banking details: No branch data or trading_as field provided');
        }
        // Generate PDF with all required data
        const quoteData = {
            quoteId, // Include the quote ID for reference
            customerName,
            projectName,
            date: now.toISOString(),
            sections: pdfSections,
            grandTotal,
            totalCuttingFee,
            phoneNumber,
            branchData,
            bankingDetails // Add the matched banking details
        };
        console.log(`Generating PDF quote with ID: ${quoteId}`);
        if (bankingDetails) {
            console.log(`Using banking details for: ${bankingDetails.bank}, Account: ${bankingDetails.account_holder}`);
        }
        else {
            console.log('No banking details found, using fallback information');
        }
        const pdfResult = await (0, optimizer_service_1.generateQuotePdf)(quoteData);
        const pdfId = pdfResult.id;
        // Upload PDF to storage and get URL
        // Note: uploadQuotePdf takes fileBuffer first, then fileName
        const uploadResult = await supabase_service_1.default.uploadQuotePdf(pdfResult.buffer, pdfId);
        quotePdfUrl = uploadResult.publicUrl || ''; // Store quote PDF URL separately
        // dynamicCutlistId already generated earlier in the function
        // Create cutlist record in database before creating quote to satisfy foreign key constraint
        try {
            console.log('Creating cutlist record with ID:', dynamicCutlistId);
            // Prepare cutlist data
            const cutlistData = {
                id: dynamicCutlistId,
                customer_name: customerName,
                project_name: projectName,
                cut_pieces: JSON.stringify(processedSections.map(section => ({
                    material: section.material,
                    pieces: section.pieces,
                    optimization: section.optimization
                }))),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            // Create cutlist record
            const cutlistResult = await supabase_service_1.default.saveCutlist(cutlistData);
            if (!cutlistResult.success) {
                console.error('Failed to create cutlist record:', cutlistResult.error);
                // Continue with quote creation but log the error
            }
            else {
                console.log('Cutlist record created successfully:', cutlistResult.data);
            }
        }
        catch (cutlistError) {
            console.error('Error creating cutlist record:', cutlistError);
            // Continue with quote creation - the cutlist might already exist
        }
        // Save quote to database with all required fields for PayFast integration
        let quoteSaveData;
        try {
            quoteSaveData = {
                filename: pdfId, // Use the PDF ID as the filename
                cutlistId: dynamicCutlistId, // Use the generated cutlist ID
                quoteNumber: quoteId, // Store the generated quote ID
                customerName: customerName,
                customerPhone: phoneNumber,
                customerEmail: req.body.customerEmail || req.body.email || '',
                projectName: projectName,
                quoteData: {
                    // Save the processed sections with all edging and cutting data for invoice generation
                    sections: processedSections || [],
                    items: (pdfSections && Array.isArray(pdfSections)) ? pdfSections.map(section => ({
                        description: `${section.material || 'Material'} - ${(section.pieces && section.pieces.length) || 0} pieces`,
                        quantity: (section.pieces && Array.isArray(section.pieces))
                            ? section.pieces.reduce((sum, piece) => sum + (piece.quantity || 1), 0)
                            : 1,
                        unitPrice: (section.totalCost || 0) / Math.max(1, (section.pieces && Array.isArray(section.pieces))
                            ? section.pieces.reduce((sum, piece) => sum + (piece.quantity || 1), 0)
                            : 1),
                        total: section.totalCost || 0
                    })) : [{
                            description: 'Quote Items',
                            quantity: 1,
                            unitPrice: grandTotal,
                            total: grandTotal
                        }],
                    totals: {
                        subtotal: grandTotal,
                        tax: grandTotal * 0.15, // 15% VAT
                        finalTotal: grandTotal * 1.15
                    },
                    // Include explicit branch info for downstream consumers (invoice/email)
                    branchData: branchData || null
                },
                subtotal: grandTotal,
                tax: grandTotal * 0.15,
                total: grandTotal * 1.15,
                status: 'pending',
                cutlistUrl: quotePdfUrl,
                branchData: branchData,
                cutlistPdfUrl: cutlistPdfUrl
            };
        }
        catch (dataError) {
            console.error('Error creating quote save data:', dataError);
            // Fallback to minimal quote data
            quoteSaveData = {
                filename: pdfId,
                cutlistId: dynamicCutlistId, // Use the generated cutlist ID
                quoteNumber: quoteId,
                customerName: customerName || 'Unknown Customer',
                projectName: projectName || 'Unknown Project',
                quoteData: {
                    // Save the processed sections with all edging and cutting data for invoice generation
                    sections: processedSections || [],
                    items: [{
                            description: 'Quote Items',
                            quantity: 1,
                            unitPrice: grandTotal,
                            total: grandTotal
                        }],
                    totals: {
                        subtotal: grandTotal,
                        tax: grandTotal * 0.15,
                        finalTotal: grandTotal * 1.15
                    },
                    // Include explicit branch info if available even in fallback
                    branchData: branchData || null
                },
                subtotal: grandTotal,
                tax: grandTotal * 0.15,
                total: grandTotal * 1.15,
                status: 'pending',
                cutlistPdfUrl: cutlistPdfUrl
            };
        }
        console.log('Saving quote with data:', {
            quoteNumber: quoteSaveData.quoteNumber,
            customerName: quoteSaveData.customerName,
            total: quoteSaveData.total,
            hasCutlistId: !!quoteSaveData.cutlistId,
            hasQuoteData: !!quoteSaveData.quoteData,
            itemsCount: ((_c = (_b = quoteSaveData.quoteData) === null || _b === void 0 ? void 0 : _b.items) === null || _c === void 0 ? void 0 : _c.length) || 0
        });
        const quoteResult = await supabase_service_1.default.createQuote(quoteSaveData);
        if (!quoteResult.success) {
            console.error('Failed to save quote to database:', quoteResult.error);
        }
        else {
            console.log('Quote saved to database successfully with ID:', (_d = quoteResult.data) === null || _d === void 0 ? void 0 : _d.id);
            // Create invoice and generate PDF at quote creation time
            try {
                console.log('🚀 Creating invoice at quote creation time for:', quoteId);
                // Create invoice with pending status (since payment hasn't been made yet)
                const invoiceResult = await supabase_service_1.default.createInvoice(quoteId, {
                    method: 'Pending Payment',
                    reference: `QUOTE-${quoteId}`,
                    date: new Date().toISOString(),
                    amount: grandTotal * 1.15, // Include 15% VAT to match quote total
                    payment_id: `PENDING-${Date.now()}`
                });
                if (invoiceResult.success && ((_e = invoiceResult.data) === null || _e === void 0 ? void 0 : _e.invoiceNumber)) {
                    invoiceNumber = invoiceResult.data.invoiceNumber;
                    // Generate and upload invoice PDF immediately
                    if (invoiceNumber) {
                        const pdfResult = await supabase_service_1.default.generateAndUploadInvoicePdf(quoteId, invoiceNumber);
                        if (pdfResult.success) {
                            invoicePdfUrl = pdfResult.publicUrl || '';
                            console.log('✅ Invoice PDF generated and uploaded:', invoicePdfUrl);
                        }
                        else {
                            console.error('❌ Failed to generate invoice PDF:', pdfResult.error);
                        }
                    }
                }
                else {
                    console.error('❌ Failed to create invoice:', invoiceResult.error);
                }
            }
            catch (invoiceError) {
                console.error('❌ Error creating invoice at quote creation:', invoiceError);
                // Continue without invoice if creation fails - quote is still valid
            }
            // Send notification email to branch with attached cutlist PDF
            try {
                let branchEmail = null;
                if (branchData && branchData.email_address) {
                    branchEmail = branchData.email_address;
                }
                else if (branchData && branchData.trading_as) {
                    const branchRes = await supabase_service_1.default.getBranchByTradingAs(branchData.trading_as);
                    if (branchRes.success && branchRes.data && branchRes.data.email_address) {
                        branchEmail = branchRes.data.email_address;
                    }
                }
                const fallbackEmail = process.env.DEFAULT_NOTIFICATION_EMAIL || '';
                const recipient = branchEmail || fallbackEmail;
                if (!recipient) {
                    console.warn('No branch or fallback email configured; skipping quote-created email');
                }
                else if (!cutlistPdfUrl) {
                    console.warn('No cutlistPdfUrl available; skipping quote-created email');
                }
                else {
                    const emailService = new email_service_1.default();
                    await emailService.sendQuoteCreatedEmail({
                        branchEmail: recipient,
                        quoteNumber: quoteId,
                        customerName,
                        customerPhone: phoneNumber,
                        projectName,
                        cutlistPdfUrl,
                        quotePdfUrl,
                    });
                }
            }
            catch (emailError) {
                console.error('Error sending quote-created email:', emailError);
            }
        }
        // Send notification email to branch with attached cutlist PDF (best-effort)
        try {
            let branchEmail = null;
            if (branchData && branchData.email_address) {
                branchEmail = branchData.email_address;
            }
            else if (branchData && branchData.trading_as) {
                const branchRes = await supabase_service_1.default.getBranchByTradingAs(branchData.trading_as);
                if (branchRes.success && branchRes.data && branchRes.data.email_address) {
                    branchEmail = branchRes.data.email_address;
                }
            }
            const fallbackEmail = process.env.DEFAULT_NOTIFICATION_EMAIL || '';
            const recipient = branchEmail || fallbackEmail;
            if (!recipient) {
                console.warn('No branch or fallback email configured; skipping quote-created email');
            }
            else if (!cutlistPdfUrl) {
                console.warn('No cutlistPdfUrl available; skipping quote-created email');
            }
            else {
                const emailService = new email_service_1.default();
                await emailService.sendQuoteCreatedEmail({
                    branchEmail: recipient,
                    quoteNumber: quoteId,
                    customerName,
                    customerPhone: phoneNumber,
                    projectName,
                    cutlistPdfUrl,
                    quotePdfUrl,
                });
            }
        }
        catch (emailError) {
            console.error('Error sending quote-created email:', emailError);
        }
        // Return the processed data without returning the response object
        res.status(200).json({
            success: true,
            message: 'Quote generated successfully',
            data: {
                quoteId,
                invoiceNumber,
                sections: processedSections,
                grandTotal,
                quotePdfUrl,
                invoicePdfUrl
            }
        });
    }
    catch (error) {
        console.error('Quote generation error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating quote',
            error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'
        });
    }
};
exports.generateQuote = generateQuote;
// Send quote to WhatsApp (legacy - now handled in the frontend)
const sendQuoteToWhatsApp = async (req, res) => {
    try {
        const { quoteId, phoneNumber, customerName, message } = req.body;
        if (!quoteId || !phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Quote ID and phone number are required'
            });
        }
        // Fetch quote data based on quoteId
        const quoteData = await supabase_service_1.default.fetchQuoteById(quoteId);
        if (!quoteData) {
            return res.status(404).json({
                success: false,
                message: 'Quote not found'
            });
        }
        // Prepare WhatsApp message
        const recipient = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        const customerInfo = customerName ? ` for ${customerName}` : '';
        const whatsappMessage = message || `Quote ${quoteId}${customerInfo} is ready. View your quote: ${quoteData.pdfUrl}`;
        // Send message using WhatsApp API (example - you'll need to replace with actual API)
        // This is a placeholder for the actual WhatsApp Business API integration
        console.log(`Sending WhatsApp message to ${recipient}: ${whatsappMessage}`);
        // In a real implementation, you would make an API call to WhatsApp Business API
        // For now, we'll just simulate a successful response
        return res.status(200).json({
            success: true,
            message: 'Quote sent to WhatsApp',
            recipient,
            whatsappMessage
        });
    }
    catch (error) {
        console.error('Error sending quote to WhatsApp:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send quote to WhatsApp',
            error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'
        });
    }
};
exports.sendQuoteToWhatsApp = sendQuoteToWhatsApp;
