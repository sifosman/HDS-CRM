// After installing @types/node, remove this declaration and use proper Buffer type

interface CutPiece {
  width: number;
  length: number;
  externalId: string | number;
  x?: number;
  y?: number;
}

interface StockPiece {
  width: number;
  length: number;
  cutPieces: CutPiece[];
}

interface Solution {
  stockPieces: StockPiece[];
}

// Import uuid and pdfkit dynamically to handle missing type declarations
// Note: These require statements work in Node.js environment
const { v4: uuidv4 } = eval('require')('uuid');
const PDFDocument = eval('require')('pdfkit');

// Buffer type - will be properly typed after installing @types/node
// For now, we'll keep this as a placeholder
type BufferType = any;

// Helper function to convert units (copied from optimizer.service)
const convertUnit = (value: number, fromUnit: number, toUnit: number): number => {
  // Convert from source unit to mm first
  let valueInMm = value;
  if (fromUnit === 1) { // inches to mm
    valueInMm = value * 25.4;
  } else if (fromUnit === 2) { // feet to mm
    valueInMm = value * 304.8;
  }
  
  // Convert from mm to target unit
  if (toUnit === 0) { // mm
    return valueInMm;
  } else if (toUnit === 1) { // inches
    return valueInMm / 25.4;
  } else if (toUnit === 2) { // feet
    return valueInMm / 304.8;
  }
  
  return valueInMm;
};

/**
 * Generate PDF with optimization solution and upload to Supabase storage
 * @param solution The optimization solution
 * @param unit Unit of measurement (0 = mm, 1 = inches, 2 = feet)
 * @param cutWidth Saw blade thickness
 * @param layout Layout algorithm type
 * @returns Promise with the public URL and ID of the uploaded PDF
 */
export const generateAndUploadOptimizationPdf = async (
  solution: Solution,
  unit: number,
  cutWidth: number = 3,
  layout: number = 0
): Promise<{ success: boolean; publicUrl?: string; pdfId?: string; error?: string }> => {
  try {
    // Generate PDF buffer using existing generatePdfWithBuffer function
    const pdfResult = await generatePdfWithBuffer(solution, unit, cutWidth, layout);
    
    // Create filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `optimization_${pdfResult.id}_${timestamp}.pdf`;
    
    // Import Supabase service dynamically to avoid circular dependencies
    const SupabaseService = (await import('./supabase.service')).default;
    
    // Upload to Supabase cutlists bucket
    const uploadResult = await SupabaseService.uploadCutlistPdf(pdfResult.buffer, fileName);
    
    if (uploadResult.success && uploadResult.publicUrl) {
      return {
        success: true,
        publicUrl: uploadResult.publicUrl,
        pdfId: pdfResult.id
      };
    } else {
      return {
        success: false,
        error: uploadResult.error || 'Failed to upload PDF to storage'
      };
    }
  } catch (error: any) {
    console.error('Error generating and uploading optimization PDF:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
};

/**
 * Generate PDF with optimization solution and return buffer for cloud storage
 * @param solution The optimization solution
 * @param unit Unit of measurement (0 = mm, 1 = inches, 2 = feet)
 * @param cutWidth Saw blade thickness
 * @param layout Layout algorithm type
 * @returns Promise with the buffer and ID of the generated PDF
 */
export const generatePdfWithBuffer = async (
  solution: Solution,
  unit: number,
  cutWidth: number = 3,
  layout: number = 0
): Promise<{ buffer: any, id: string }> => {
  const pdfId = uuidv4();
  
  // Create PDF document
  const doc = new PDFDocument({ size: 'A4' });
  
  // Collect PDF data in memory buffers instead of writing to disk
  const buffers: BufferType[] = [];
  doc.on('data', buffers.push.bind(buffers));
  
  // Add title with a colored header box
  doc.rect(50, 50, doc.page.width - 100, 60)
     .fillAndStroke('#003366', '#000000');

  doc.fontSize(24)
     .fillColor('#FFFFFF')
     .text('HDS Group Cutlist', 50, 65, { align: 'center', width: doc.page.width - 100 });

  doc.fontSize(16)
     .fillColor('#FFFFFF')
     .text('2D CUTTING OPTIMIZER', 50, 95, { align: 'center', width: doc.page.width - 100 });

  // Add date and time
  const now = new Date();
  const dateString = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  doc.fontSize(10)
     .fillColor('#000000')
     .text(`Generated: ${dateString} ${timeString}`, 50, 120, { align: 'right', width: doc.page.width - 100 });

  doc.moveDown(3);

  // Add detailed summary information
  const totalStockPieces = solution.stockPieces.length;
  const totalCutPieces = solution.stockPieces.reduce((sum, sp) => sum + sp.cutPieces.length, 0);

  // Calculate total area and waste
  let totalStockArea = 0;
  let totalCutArea = 0;

  solution.stockPieces.forEach(stockPiece => {
    const stockArea = stockPiece.width * stockPiece.length;
    totalStockArea += stockArea;

    stockPiece.cutPieces.forEach((cutPiece: CutPiece) => {
      totalCutArea += cutPiece.width * cutPiece.length;
    });
  });

  const wasteArea = totalStockArea - totalCutArea;
  const wastePercentage = ((wasteArea / totalStockArea) * 100).toFixed(2);

  // Create a detailed summary table
  doc.fontSize(14).text('Optimization Summary', { underline: true });
  doc.moveDown(0.5);

  // Summary information
  doc.fontSize(12).fillColor('#000000');
  doc.text(`Stock Pieces Used: ${totalStockPieces}`);
  doc.text(`Cut Pieces Placed: ${totalCutPieces}`);
  
  const unitLabel = unit === 0 ? 'mm²' : unit === 1 ? 'in²' : 'ft²';
  const totalStockAreaConverted = convertUnit(totalStockArea, 0, unit).toFixed(2);
  const totalCutAreaConverted = convertUnit(totalCutArea, 0, unit).toFixed(2);
  const wasteAreaConverted = convertUnit(wasteArea, 0, unit).toFixed(2);
  
  doc.text(`Total Stock Area: ${totalStockAreaConverted} ${unitLabel}`);
  doc.text(`Total Cut Area: ${totalCutAreaConverted} ${unitLabel}`);
  doc.text(`Waste Area: ${wasteAreaConverted} ${unitLabel} (${wastePercentage}%)`);
  
  doc.moveDown(2);

  // Draw each stock piece and its cut pieces (simplified version for buffer generation)
  solution.stockPieces.forEach((stockPiece, index) => {
    // Add page for each stock piece except the first one
    if (index > 0) {
      doc.addPage();
    }

    // Stock piece title
    doc.fontSize(16).fillColor('#003366');
    doc.text(`Case ${index + 1} - Stock Piece`, { underline: true });
    doc.moveDown(0.5);

    // Stock piece details
    const unitLabelSingle = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';
    const stockWidth = convertUnit(stockPiece.width, 0, unit).toFixed(1);
    const stockLength = convertUnit(stockPiece.length, 0, unit).toFixed(1);
    const stockArea = (parseFloat(stockWidth) * parseFloat(stockLength)).toFixed(2);

    doc.fontSize(12).fillColor('#000000');
    doc.text(`Dimensions: ${stockWidth} × ${stockLength} ${unitLabelSingle}`);
    doc.text(`Area: ${stockArea} ${unitLabel}`);
    doc.moveDown(1);

    // Cut pieces table
    doc.fontSize(14).fillColor('#003366');
    doc.text('Cut Pieces:', { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(10).fillColor('#000000');
    stockPiece.cutPieces.forEach((cutPiece: CutPiece) => {
      const cutWidth = convertUnit(cutPiece.width, 0, unit).toFixed(1);
      const cutLength = convertUnit(cutPiece.length, 0, unit).toFixed(1);
      doc.text(`${cutPiece.externalId}: ${cutWidth} × ${cutLength} ${unitLabelSingle}`);
    });

    doc.moveDown(2);
  });
  
  // Finalize PDF
  doc.end();
  
  // Return promise with buffer and ID
  return new Promise<{ buffer: BufferType, id: string }>((resolve) => {
    doc.on('end', () => {
      // After installing @types/node, replace this with: const pdfBuffer = Buffer.concat(buffers);
      const bufferConcat = eval('require')('buffer').Buffer.concat;
      const pdfBuffer = bufferConcat(buffers);
      resolve({
        buffer: pdfBuffer,
        id: pdfId
      });
    });
  });
};
