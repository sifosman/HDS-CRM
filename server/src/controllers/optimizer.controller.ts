import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {
  prepareOptimizationData,
  optimizeCuttingLayout,
  generatePdf,
  generateQuotePdf,
  generateIQExport,
  importFromIQ
} from '../services/optimizer.service';
import SupabaseService from '../services/supabase.service';

// Optimize cutting layout
export const optimizeCutting = async (req: Request, res: Response) => {
  try {
    const { pieces, unit, width, layout } = req.body;

    // Validate input
    if (!pieces || !Array.isArray(pieces) || pieces.length === 0) {
      return res.status(400).json({ message: 'Invalid pieces data' });
    }

    // Check if there are both stock pieces and cut pieces
    const hasStockPieces = pieces.some(piece => piece.kind === 1);
    const hasCutPieces = pieces.some(piece => piece.kind === 0);

    if (!hasStockPieces || !hasCutPieces) {
      return res.status(400).json({
        message: 'You need at least one stock piece and one cut piece'
      });
    }

    // Prepare data for optimization
    const { stockPieces, cutPieces } = prepareOptimizationData(pieces, unit || 0);

    // Run optimization
    const solution = optimizeCuttingLayout(stockPieces, cutPieces, width || 3, layout || 0);

    // Generate PDF
    const pdfId = generatePdf(solution, unit || 0, width || 3, layout || 0);

    // Generate IQ export data
    const iqData = generateIQExport(solution, unit || 0, width || 3, layout || 0);

    // Return result
    res.status(200).json({
      message: 'Optimization completed successfully',
      pdfId,
      solution,
      iqData
    });
  } catch (error) {
    console.error('Optimization error:', error);
    res.status(500).json({ message: 'Error during optimization', error });
  }
};

// Download PDF result
export const downloadPdf = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const pdfPath = path.join(__dirname, '../../pdfs', `solution_${id}.pdf`);

    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ message: 'PDF not found' });
    }

    // Send file
    res.download(pdfPath);
  } catch (error) {
    console.error('PDF download error:', error);
    res.status(500).json({ message: 'Error downloading PDF', error });
  }
};

// Export IQ data for a specific optimization
export const exportIQData = async (req: Request, res: Response) => {
  try {
    const { solution, unit, width, layout } = req.body;

    // Validate input
    if (!solution || !solution.stockPieces) {
      return res.status(400).json({ message: 'Invalid solution data' });
    }

    // Generate IQ export data
    const iqData = generateIQExport(solution, unit || 0, width || 3, layout || 0);

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=iq_export.json');

    // Send data
    res.status(200).json(iqData);
  } catch (error) {
    console.error('IQ export error:', error);
    res.status(500).json({ message: 'Error exporting IQ data', error });
  }
};

// Import data from IQ software
export const importIQData = async (req: Request, res: Response) => {
  try {
    const iqData = req.body;

    // Validate input
    if (!iqData) {
      return res.status(400).json({ message: 'Missing IQ data' });
    }

    // Process IQ data
    const { pieces, unit, width, layout } = importFromIQ(iqData);

    // Check if there are both stock pieces and cut pieces
    const hasStockPieces = pieces.some(piece => piece.kind === 1);
    const hasCutPieces = pieces.some(piece => piece.kind === 0);

    if (!hasStockPieces || !hasCutPieces) {
      return res.status(400).json({
        message: 'The imported data must contain at least one stock piece and one cut piece'
      });
    }

    // Prepare data for optimization
    const { stockPieces, cutPieces } = prepareOptimizationData(pieces, unit);

    // Run optimization
    const solution = optimizeCuttingLayout(stockPieces, cutPieces, width, layout);

    // Generate PDF
    const pdfId = generatePdf(solution, unit, width, layout);

    // Generate IQ export data for confirmation
    const exportData = generateIQExport(solution, unit, width, layout);

    // Return result
    res.status(200).json({
      message: 'IQ data imported and processed successfully',
      pdfId,
      solution,
      iqData: exportData,
      importedPieces: pieces
    });
  } catch (error) {
    console.error('IQ import error:', error);
    res.status(500).json({
      message: 'Error importing IQ data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Generate a complete quote with optimization, pricing, and PDF
export const generateQuote = async (req: Request, res: Response) => {
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
    let edgingCostTotal = 0;
    let totalBoardsUsed = 0; // Track total boards used for cutting fee
    
    for (const section of sections) {
      const { material, cutPieces } = section;
      
      if (!material || !cutPieces || !Array.isArray(cutPieces) || cutPieces.length === 0) {
        continue; // Skip invalid sections
      }
      
      // 1. Get product pricing by description from Supabase
      console.log(`Getting pricing for material: ${material}`);
      
      // 1. Look up pricing for this material from Supabase
      const pricingResult = await SupabaseService.getProductPricingByDescription(material, true);
      
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
      const sizeParts = cleanSizes.split('x').map((part: string) => parseInt(part.trim(), 10));
      
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
      let width = sizeParts[1];  // Using exact value as-is
      
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
        width: width,   // Using the adjusted width
        amount: 100,    // Set quantity to 100 as requested
        kind: 1,        // Stock piece
        pattern: 0      // No pattern
      };
      
      console.log(`Creating stock piece with dimensions: ${length}x${width}mm (quantity: 100)`);
      
      // 5. Prepare all pieces for optimization
      const allPieces = [
        stockPiece,
        ...cutPieces.map(piece => ({
          ...piece,
          kind: 0 // Cut piece
        }))
      ];
      
      // 6. Prepare data for optimization (convert to mm internally)
      const unit = 0; // mm
      console.log('Preparing optimization data with allPieces:', JSON.stringify(allPieces));
      const { stockPieces, cutPieces: optimizerCutPieces } = prepareOptimizationData(allPieces, unit);
      console.log('Prepared optimization data:', { 
        stockPieces: JSON.stringify(stockPieces),
        cutPieces: JSON.stringify(optimizerCutPieces)
      });
      
      // 7. Run optimization
      const cutWidth = 3; // 3mm saw blade width
      const layout = 0; // Guillotine layout
      console.log('Running optimization with:', {
        stockPiecesCount: stockPieces.length,
        cutPiecesCount: optimizerCutPieces.length,
        cutWidth,
        layout
      });
      const solution = optimizeCuttingLayout(stockPieces, optimizerCutPieces, cutWidth, layout);
      console.log('Optimization result:', {
        solutionStockPiecesCount: solution.stockPieces?.length || 0,
        solutionStockPieces: JSON.stringify(solution.stockPieces)
      });
      
      // 8. Calculate boards needed and wastage statistics
      const boardsNeeded = solution.stockPieces.length;
      totalBoardsUsed += boardsNeeded; // Add to total boards for cutting fee
      
      // Calculate total board area and used area to determine wastage
      const boardArea = length * width * boardsNeeded;
      let usedArea = 0;
      
      // Calculate the total area of all cut pieces
      for (const piece of cutPieces) {
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
      console.log(`Cut pieces count: ${cutPieces.length}`);
      
      for (const piece of cutPieces) {
        // Check each edge (L1, L2, W1, W2) and calculate edging needed
        let pieceEdging = 0;
        let edgingSides: string[] = [];
        
        console.log(`\nPiece: ${piece.name || 'Unnamed'} (${piece.length}x${piece.width}mm, qty: ${piece.amount || 1})`);
        console.log(`Edging data received: ${JSON.stringify(piece.edging)}`);
        
        // Parse the edging field if it exists
        // edging can be a string like "L1,W2" or a number (0 or 1)
        const edging = piece.edging;
        
        console.log(`Piece: ${piece.length}x${piece.width}mm, quantity: ${piece.amount || 1}, edging: ${JSON.stringify(edging)}`);
        
        if (edging) {
          if (typeof edging === 'string') {
<<<<<<< HEAD
            const sides = edging.split(',').map(s => s.trim()).filter(s => s);
            console.log(`  Edging sides: ${sides.join(', ')}`);
            
            // Calculate edging length for each specified side
            for (const side of sides) {
              if (side === 'L1' || side === 'L2') {
                pieceEdging += Number(piece.length) || 0;
                edgingSides.push(side);
                console.log(`    ${side}: +${piece.length}mm`);
              } else if (side === 'W1' || side === 'W2') {
                pieceEdging += Number(piece.width) || 0;
                edgingSides.push(side);
                console.log(`    ${side}: +${piece.width}mm`);
=======
            const sides = edging.split(',').filter(s => s.trim()); // Filter empty strings
            console.log(`Parsed edging sides: [${sides.join(', ')}]`);
            
            // Calculate edging length for each specified side
            for (const side of sides) {
              const trimmedSide = side.trim();
              if (trimmedSide === 'L1' || trimmedSide === 'L2') {
                pieceEdging += piece.length;
                edgingSides.push(trimmedSide);
                console.log(`  ${trimmedSide}: +${piece.length}mm (length side)`);
              } else if (trimmedSide === 'W1' || trimmedSide === 'W2') {
                pieceEdging += piece.width;
                edgingSides.push(trimmedSide);
                console.log(`  ${trimmedSide}: +${piece.width}mm (width side)`);
>>>>>>> c8a3b0bf58b2cf1231a6cae946e1915428955cf6
              }
            }
          } else if (edging === 1 || edging === true) {
            // If edging is just set to 1 or true, assume all 4 sides
            pieceEdging = 2 * (Number(piece.length) || 0) + 2 * (Number(piece.width) || 0);
            edgingSides = ['L1', 'L2', 'W1', 'W2'];
<<<<<<< HEAD
            console.log(`  All sides: 2×${piece.length} + 2×${piece.width} = ${pieceEdging}mm`);
=======
            console.log(`  All sides: ${pieceEdging}mm (2x${piece.length} + 2x${piece.width})`);
>>>>>>> c8a3b0bf58b2cf1231a6cae946e1915428955cf6
          }
        } else {
          console.log(`  No edging required`);
        }
        
        // Multiply by quantity
<<<<<<< HEAD
        const pieceEdgingBeforeQty = pieceEdging;
        pieceEdging *= (piece.amount || 1);
        console.log(`  Before quantity: ${pieceEdgingBeforeQty}mm, after quantity (×${piece.amount || 1}): ${pieceEdging}mm`);
        
        totalEdging += pieceEdging;
        console.log(`  Running total edging: ${totalEdging}mm`);
=======
        const beforeQuantity = pieceEdging;
        pieceEdging *= (piece.amount || 1);
        console.log(`  Before quantity: ${beforeQuantity}mm, After quantity (x${piece.amount || 1}): ${pieceEdging}mm`);
        
        totalEdging += pieceEdging;
        console.log(`  Running total: ${totalEdging}mm`);
>>>>>>> c8a3b0bf58b2cf1231a6cae946e1915428955cf6
        
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
      
<<<<<<< HEAD
      console.log(`\n=== EDGING COST CALCULATION ===`);
      console.log(`Total edging required: ${totalEdging}mm`);
      console.log(`Converting to meters: ${totalEdging}mm ÷ 1000 = ${totalEdging / 1000}m`);
=======
      console.log(`\n=== FINAL EDGING TOTALS for ${material} ===`);
      console.log(`Total edging length: ${totalEdging}mm`);
      console.log(`Total edging cost: R${((totalEdging / 1000) * 14).toFixed(2)}`);
      console.log(`=== END EDGING DEBUG ===\n`);
      
      console.log(`Edging calculation: Total edging required: ${totalEdging}mm`);
>>>>>>> c8a3b0bf58b2cf1231a6cae946e1915428955cf6
      
      // Calculate edging cost (R14 per metre)
      const edgingCost = (totalEdging / 1000) * 14;
      console.log(`Edging cost: ${totalEdging / 1000}m × R14/m = R${edgingCost.toFixed(2)}`);
      
      // Add to total edging length accumulator
      totalEdgingLength += totalEdging;
      console.log(`Total edging length across all sections: ${totalEdgingLength}mm`);
      
      // Add edging cost to grand total
      const grandTotalBefore = grandTotal;
      grandTotal += edgingCost;
      edgingCostTotal += edgingCost;
      console.log(`Grand total before edging: R${grandTotalBefore.toFixed(2)}, after adding R${edgingCost.toFixed(2)}: R${grandTotal.toFixed(2)}`);
      console.log(`Total edging cost across all sections: R${edgingCostTotal.toFixed(2)}`);
      console.log(`=== END EDGING CALCULATION ===\n`);
      
      // 10. Format sizes for display (use adjusted dimensions)
      const boardSize = `${length}×${width}${sizeParts[2] ? '×'+sizeParts[2] : ''}`;
      
      // 11. Add to processed sections with wastage and edging info
      const processedSection = {
        material,
        boardSize,
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
          cost: edgingCost
        }
      };
      
      processedSections.push(processedSection);
      
      // 12. Add section details for PDF with enhanced information
      pdfSections.push({
        ...processedSection,
        cutPieces: cutPieces.map(p => ({ 
          length: p.length, 
          width: p.width, 
          quantity: p.amount || 1,
          edging: p.edging || null
        }))
      });
    }
    
    // Generate a unique quote ID
    const now = new Date();
    const quoteId = `Q-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
    
    // Calculate cutting fee (same as in PDF quote - R70 per board)
    const cuttingFeePerBoard = 70; // R70 per board
    const totalCuttingFee = parseFloat((totalBoardsUsed * cuttingFeePerBoard).toFixed(2));
    
    // Add cutting fee to grand total
    grandTotal += totalCuttingFee;
    
    // Debug log to confirm totals before PDF generation
    console.log('Quote summary for PDF:', { grandTotal, totalCuttingFee, totalBoardsUsed, processedSections });
    // 8. Generate PDF quotation (now returns buffer instead of file path)
    // Fetch banking details for the selected branch (match trading_as to fx_branch)
    let bankingDetails = null;
    if (branchData && branchData.trading_as) {
      const bankingRes = await SupabaseService.getBankingDetailsByBranch(branchData.trading_as);
      if (bankingRes.success) {
        bankingDetails = bankingRes.data;
      } else {
        console.warn(`No banking details found for branch ${branchData.trading_as}:`, bankingRes.error);
      }
    }
    const pdfResult = await generateQuotePdf({
      quoteId: quoteId,
      customerName,
      projectName,
      date: new Date().toLocaleDateString(),
      sections: pdfSections,
      grandTotal,
      branchData: branchData || null,
      bankingDetails: bankingDetails,
      edgingLength: totalEdgingLength, // Total in mm
      edgingCost: edgingCostTotal // Total cost
    });

    // 9. Upload PDF to Supabase "hdsquotes" bucket and get public URL
    console.log(`Uploading quote PDF to Supabase storage (quoteId: ${quoteId})...`);
    
    // Create filename for storage
    const pdfFilename = `quote_${quoteId}_${Date.now()}.pdf`;
    
    // Upload the PDF buffer to the Supabase "hdsquotes" bucket
    const uploadResult = await SupabaseService.uploadQuotePdf(
      pdfResult.buffer, 
      pdfFilename
    );
    
    if (!uploadResult.success) {
      console.error('Error uploading PDF to Supabase:', uploadResult.error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload quote PDF to storage',
        error: uploadResult.error
      });
    }
    
    // Get the public URL from the upload result
    const pdfUrl = uploadResult.publicUrl;
    
    // Keep this as a fallback in case Supabase upload fails
    // (Not needed now, but commented out for potential debugging/rollback)
    // const pdfBase64 = pdfResult.buffer.toString('base64');
    // const dataUrl = `data:application/pdf;base64,${pdfBase64}`;
    
    console.log(`PDF successfully uploaded to Supabase with URL: ${pdfUrl}`);
    
    // Save quote in database with the PDF URL
    try {
      console.log('Saving quote data to Supabase database...');
      const quoteData = {
        quote_id: quoteId,  // Match the field name used in the createQuote method
        customer_name: customerName,
        project_name: projectName,
        phone_number: phoneNumber || null,
        total_amount: grandTotal,
        pdf_url: pdfUrl,
        branch_data: branchData || null,
        created_at: new Date().toISOString(),
        status: 'pending',
        sections: JSON.stringify(processedSections) // Store sections as JSON string
      };
      
      const saveResult = await SupabaseService.createQuote(quoteData);
      
      if (!saveResult.success) {
        console.warn('Failed to save quote to database:', saveResult.error);
        // Continue anyway as we still have the PDF URL and can return it to the client
      } else {
        console.log('Quote saved to database successfully');
      }
    } catch (dbError) {
      console.error('Error saving quote to database:', dbError);
      // Continue anyway as we still have the PDF URL and can return it to the client
    }
    
    // Send WhatsApp message if phone number provided
    if (phoneNumber) {
      // TODO: Send WhatsApp message with quote details and PDF link
      console.log(`Would send WhatsApp to ${phoneNumber} with quote ${quoteId}`);
    }
    
    // Return the processed data
    res.status(200).json({
      success: true,
      message: 'Quote generated successfully',
      data: {
        quoteId,
        sections: processedSections,
        grandTotal,
        pdfUrl
      }
    });
  } catch (error) {
    console.error('Quote generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating quote',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

// Upload PDF and get a shareable URL
export const uploadPdf = async (req: Request, res: Response) => {
  try {
    const { quoteId, pdfDataUrl } = req.body;

    if (!quoteId || !pdfDataUrl) {
      return res.status(400).json({
        success: false,
        message: 'Quote ID and PDF data URL are required'
      });
    }

    // Check if it's a valid PDF data URL
    if (!pdfDataUrl.startsWith('data:application/pdf')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PDF data URL format'
      });
    }

    // Extract base64 data
    const base64Data = pdfDataUrl.split(',')[1];
    if (!base64Data) {
      return res.status(400).json({
        success: false,
        message: 'Invalid PDF data URL'
      });
    }

    // Create a unique filename
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const filename = `quote_${quoteId}_${timestamp}_${randomString}.pdf`;
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Write the PDF file
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    // Generate a URL for the uploaded file
    const host = req.get('host');
    const protocol = req.protocol;
    const pdfUrl = `${protocol}://${host}/uploads/${filename}`;

    // Update the quote record with the new PDF URL if needed
    try {
      await SupabaseService.updateQuotePdfUrl(quoteId, pdfUrl);
    } catch (updateError) {
      console.error('Failed to update quote record with PDF URL:', updateError);
      // Continue anyway as we still have the URL
    }

    return res.status(200).json({
      success: true,
      message: 'PDF uploaded successfully',
      pdfUrl,
      quoteId
    });

  } catch (error: any) {
    console.error('Error uploading PDF:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload PDF',
      error: error?.message || 'Unknown error'
    });
  }
};

// Send quote to WhatsApp (legacy - now handled in the frontend)
export const sendQuoteToWhatsApp = async (req: Request, res: Response) => {
  try {
    const { quoteId, phoneNumber, customerName, message } = req.body;

    if (!quoteId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Quote ID and phone number are required'
      });
    }

    // Fetch quote data based on quoteId
    const quoteData = await SupabaseService.fetchQuoteById(quoteId);
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

  } catch (error: any) {
    console.error('Error sending quote to WhatsApp:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send quote to WhatsApp',
      error: error?.message || 'Unknown error'
    });
  }
};
