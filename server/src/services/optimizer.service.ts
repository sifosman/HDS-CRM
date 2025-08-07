import { IPiece } from '../models/project.model';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { Buffer } from 'buffer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Interfaces for the optimizer
interface StockPiece {
  width: number;
  length: number;
  quantity: number;
  patternDirection: number;
}

interface CutPiece {
  width: number;
  length: number;
  quantity: number;
  patternDirection: number;
  externalId: number;
  canRotate: boolean;
}

interface PlacedPiece {
  x: number;
  y: number;
  width: number;
  length: number;
  externalId: number | string;
  canRotate?: boolean;
}

interface Solution {
  stockPieces: Array<{
    width: number;
    length: number;
    cutPieces: PlacedPiece[];
  }>;
}

// Convert units
const convertUnit = (value: number, fromUnit: number, toUnit: number): number => {
  // Units: 0 = mm, 1 = inch, 2 = foot
  const mmToInch = 0.0393701;
  const mmToFoot = 0.00328084;
  const inchToMm = 25.4;
  const inchToFoot = 0.0833333;
  const footToMm = 304.8;
  const footToInch = 12;

  if (fromUnit === toUnit) return value;

  if (fromUnit === 0) { // from mm
    if (toUnit === 1) return value * mmToInch;
    if (toUnit === 2) return value * mmToFoot;
  } else if (fromUnit === 1) { // from inch
    if (toUnit === 0) return value * inchToMm;
    if (toUnit === 2) return value * inchToFoot;
  } else if (fromUnit === 2) { // from foot
    if (toUnit === 0) return value * footToMm;
    if (toUnit === 1) return value * footToInch;
  }

  return value;
};

// Prepare data for optimization
export const prepareOptimizationData = (pieces: IPiece[], unit: number): { stockPieces: StockPiece[], cutPieces: CutPiece[] } => {
  const stockPieces: StockPiece[] = [];
  const cutPieces: CutPiece[] = [];
  let seq = 0;

  pieces.forEach(piece => {
    // Convert to mm for internal calculations
    const width = Math.round(convertUnit(piece.width, unit, 0));
    const length = Math.round(convertUnit(piece.length, unit, 0));
    const patternDirection = piece.pattern;

    if (piece.kind === 1) { // Stock piece
      for (let i = 0; i < piece.amount; i++) {
        stockPieces.push({
          width,
          length,
          quantity: 1,
          patternDirection
        });
      }
    } else { // Cut piece
      for (let i = 0; i < piece.amount; i++) {
        seq++;
        cutPieces.push({
          width,
          length,
          quantity: 1,
          patternDirection,
          externalId: seq,
          canRotate: patternDirection === 0 // Can only rotate if no pattern
        });
      }
    }
  });

  return { stockPieces, cutPieces };
};

// Improved optimization function with better bin packing algorithm
export const optimizeCuttingLayout = (stockPieces: StockPiece[], cutPieces: CutPiece[], cutWidth: number, layout: number): Solution => {
  const solution: Solution = {
    stockPieces: []
  };

  // Sort cut pieces by area (largest first) for better packing
  const sortedCutPieces = [...cutPieces].sort((a, b) => {
    const areaA = a.width * a.length;
    const areaB = b.width * b.length;
    return areaB - areaA; // Descending order (largest first)
  });

  // Process each stock piece
  for (let stockPieceIndex = 0; stockPieceIndex < stockPieces.length; stockPieceIndex++) {
    const stockPiece = stockPieces[stockPieceIndex];

    // Skip if no more cut pieces to place
    if (sortedCutPieces.length === 0) break;

    const solutionStockPiece = {
      width: stockPiece.width,
      length: stockPiece.length,
      cutPieces: [] as PlacedPiece[]
    };

    // For guillotine layout, we'll use a simple shelf algorithm
    // For nested layout, we'll use a more complex bin packing approach
    if (layout === 0) { // Guillotine layout
      // Initialize free rectangles with the whole stock piece
      const freeRects = [{ x: 0, y: 0, width: stockPiece.width, height: stockPiece.length }];

      // Try to place each cut piece
      let i = 0;
      while (i < sortedCutPieces.length) {
        const cutPiece = sortedCutPieces[i];
        let placed = false;

        // Try to place in each free rectangle
        for (let j = 0; j < freeRects.length; j++) {
          const rect = freeRects[j];

          // Check if piece fits in this rectangle (considering cut width)
          const fitsWidth = cutPiece.width <= rect.width;
          const fitsHeight = cutPiece.length <= rect.height;

          // Try rotated if allowed and it fits better
          const canRotate = cutPiece.canRotate && cutPiece.patternDirection === 0;
          const fitsWidthRotated = canRotate && cutPiece.length <= rect.width;
          const fitsHeightRotated = canRotate && cutPiece.width <= rect.height;

          let useRotated = false;

          if (fitsWidth && fitsHeight) {
            // Check if rotation would be more efficient
            if (canRotate && fitsWidthRotated && fitsHeightRotated) {
              const normalWaste = (rect.width - cutPiece.width) * (rect.height - cutPiece.length);
              const rotatedWaste = (rect.width - cutPiece.length) * (rect.height - cutPiece.width);
              useRotated = rotatedWaste < normalWaste;
            }

            // Place the piece
            const placedPiece: PlacedPiece = {
              x: rect.x,
              y: rect.y,
              width: useRotated ? cutPiece.length : cutPiece.width,
              length: useRotated ? cutPiece.width : cutPiece.length,
              externalId: cutPiece.externalId
            };

            solutionStockPiece.cutPieces.push(placedPiece);

            // Split the free rectangle into two new free rectangles
            // Remove the current free rectangle
            freeRects.splice(j, 1);

            // Add new free rectangles (considering cut width)
            const usedWidth = placedPiece.width + cutWidth;
            const usedHeight = placedPiece.length + cutWidth;

            // Right rectangle
            if (rect.width - usedWidth > 0) {
              freeRects.push({
                x: rect.x + usedWidth,
                y: rect.y,
                width: rect.width - usedWidth,
                height: rect.height
              });
            }

            // Bottom rectangle
            if (rect.height - usedHeight > 0) {
              freeRects.push({
                x: rect.x,
                y: rect.y + usedHeight,
                width: usedWidth,
                height: rect.height - usedHeight
              });
            }

            // Remove the placed piece from the list
            sortedCutPieces.splice(i, 1);
            placed = true;
            break;
          }
        }

        // If the piece couldn't be placed, move to the next one
        if (!placed) {
          i++;
        }
      }
    } else { // Nested layout - more complex bin packing
      // Initialize a grid for the stock piece
      const gridSize = Math.min(cutWidth, 10); // Use cut width as grid size, but not smaller than 10
      const gridWidth = Math.ceil(stockPiece.width / gridSize);
      const gridHeight = Math.ceil(stockPiece.length / gridSize);
      const grid = Array(gridHeight).fill(0).map(() => Array(gridWidth).fill(false));

      // Try to place each cut piece
      let i = 0;
      while (i < sortedCutPieces.length) {
        const cutPiece = sortedCutPieces[i];
        let placed = false;

        // Calculate piece dimensions in grid units
        const pieceWidth = Math.ceil(cutPiece.width / gridSize);
        const pieceHeight = Math.ceil(cutPiece.length / gridSize);
        const cutWidthGrid = Math.ceil(cutWidth / gridSize);

        // Try all possible positions
        for (let y = 0; y <= gridHeight - pieceHeight; y++) {
          for (let x = 0; x <= gridWidth - pieceWidth; x++) {
            // Check if this position is free
            let canPlace = true;
            for (let py = 0; py < pieceHeight; py++) {
              for (let px = 0; px < pieceWidth; px++) {
                if (grid[y + py][x + px]) {
                  canPlace = false;
                  break;
                }
              }
              if (!canPlace) break;
            }

            // Also check if there's enough space for the cut width
            if (canPlace) {
              // Check right edge
              if (x + pieceWidth < gridWidth) {
                for (let py = 0; py < pieceHeight; py++) {
                  for (let c = 0; c < cutWidthGrid; c++) {
                    if (x + pieceWidth + c < gridWidth && grid[y + py][x + pieceWidth + c]) {
                      canPlace = false;
                      break;
                    }
                  }
                  if (!canPlace) break;
                }
              }

              // Check bottom edge
              if (canPlace && y + pieceHeight < gridHeight) {
                for (let px = 0; px < pieceWidth; px++) {
                  for (let c = 0; c < cutWidthGrid; c++) {
                    if (y + pieceHeight + c < gridHeight && grid[y + pieceHeight + c][x + px]) {
                      canPlace = false;
                      break;
                    }
                  }
                  if (!canPlace) break;
                }
              }
            }

            if (canPlace) {
              // Mark the grid as used
              for (let py = 0; py < pieceHeight; py++) {
                for (let px = 0; px < pieceWidth; px++) {
                  grid[y + py][x + px] = true;
                }
              }

              // Mark cut width areas as used
              if (x + pieceWidth < gridWidth) {
                for (let py = 0; py < pieceHeight; py++) {
                  for (let c = 0; c < cutWidthGrid; c++) {
                    if (x + pieceWidth + c < gridWidth) {
                      grid[y + py][x + pieceWidth + c] = true;
                    }
                  }
                }
              }

              if (y + pieceHeight < gridHeight) {
                for (let px = 0; px < pieceWidth; px++) {
                  for (let c = 0; c < cutWidthGrid; c++) {
                    if (y + pieceHeight + c < gridHeight) {
                      grid[y + pieceHeight + c][x + px] = true;
                    }
                  }
                }
              }

              // Add the placed piece
              solutionStockPiece.cutPieces.push({
                x: x * gridSize,
                y: y * gridSize,
                width: cutPiece.width,
                length: cutPiece.length,
                externalId: cutPiece.externalId
              });

              // Remove the placed piece from the list
              sortedCutPieces.splice(i, 1);
              placed = true;
              break;
            }
          }
          if (placed) break;
        }

        // If the piece couldn't be placed, move to the next one
        if (!placed) {
          i++;
        }
      }
    }

    // Only add stock pieces that have cut pieces placed on them
    if (solutionStockPiece.cutPieces.length > 0) {
      solution.stockPieces.push(solutionStockPiece);
    }
  }

  return solution;
};

// Generate PDF with the solution
export const generatePdf = (solution: Solution, unit: number, cutWidth: number = 3, layout: number = 0): string => {
  const pdfId = uuidv4();
  const pdfPath = path.join(__dirname, '../../pdfs', `solution_${pdfId}.pdf`);

  // Ensure directory exists
  const dir = path.dirname(pdfPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Create PDF document
  const doc = new PDFDocument({ size: 'A4' });
  const stream = fs.createWriteStream(pdfPath);
  doc.pipe(stream);

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

  // Calculate basic solution properties
  
  // Calculate total edging required in mm
  let totalEdging = 0;
  solution.stockPieces.forEach((sp: any) => {
    sp.cutPieces.forEach((cp: any) => {
      // Count edges that need edging (L1, L2, W1, W2)
      const edgingNeeded = [
        cp.edgeL1 ? cp.length : 0,
        cp.edgeL2 ? cp.length : 0,
        cp.edgeW1 ? cp.width : 0,
        cp.edgeW2 ? cp.width : 0
      ].reduce((sum: number, val: number) => sum + val, 0);
      
      totalEdging += edgingNeeded;
    });
  });
  
  // Convert edging to meters and calculate cost
  const EDGING_PRICE_PER_METER = 14; // R14 per meter
  const totalEdgingMeters = totalEdging / 1000;
  const edgingCost = totalEdgingMeters * EDGING_PRICE_PER_METER;

  // Calculate total area and waste
  let totalStockArea = 0;
  let totalCutArea = 0;

  solution.stockPieces.forEach(stockPiece => {
    const stockArea = stockPiece.width * stockPiece.length;
    totalStockArea += stockArea;

    stockPiece.cutPieces.forEach(cutPiece => {
      totalCutArea += cutPiece.width * cutPiece.length;
    });
  });

  const wasteArea = totalStockArea - totalCutArea;
  const wastePercentage = ((wasteArea / totalStockArea) * 100).toFixed(2);

  // Create a detailed summary table
  doc.fontSize(14).text(`Optimization Summary`, { underline: true });
  doc.moveDown(0.5);

  // Draw summary table
  const summaryStartX = 50;
  const summaryStartY = doc.y;
  const summaryColWidths = [200, 100, 150];
  const summaryRowHeight = 25;

  // Draw table headers
  doc.rect(summaryStartX, summaryStartY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .fillAndStroke('#e0e0e0', '#000000');

  doc.fontSize(10).fillColor('#000000');
  doc.text('Parameter', summaryStartX + 5, summaryStartY + 8, { width: summaryColWidths[0] });
  doc.text('Value', summaryStartX + summaryColWidths[0] + 5, summaryStartY + 8, { width: summaryColWidths[1] });
  doc.text('Details', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, summaryStartY + 8, { width: summaryColWidths[2] });

  // Draw rows
  let currentSummaryY = summaryStartY + summaryRowHeight;

  // Row 1: Stock Pieces
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Stock Pieces Used', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalStockPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total sheets/panels`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 2: Cut Pieces
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Cut Pieces Placed', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalCutPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total parts cut`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 3: Total Stock Area
  const unitLabel = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';
  const totalStockAreaConverted = convertUnit(totalStockArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Total Stock Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalStockAreaConverted} ${unitLabel}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total material area`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 4: Total Cut Area
  const totalCutAreaConverted = convertUnit(totalCutArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Total Cut Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalCutAreaConverted} ${unitLabel}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total used material`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 5: Waste Area
  const wasteAreaConverted = convertUnit(wasteArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .fillAndStroke('#fff0f0', '#000000');
  doc.text('Waste Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${wasteAreaConverted} ${unitLabel}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`${wastePercentage}% of total material`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 6: Edging Cost
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Edging Cost', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`R ${edgingCost.toFixed(2)}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Total edging cost`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 7: Layout Type
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Layout Type', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${layout === 0 ? 'Guillotine' : 'Nested'}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Cutting algorithm used`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 8: Cut Width
  const cutWidthConverted = convertUnit(cutWidth, 0, unit).toFixed(2);
  const unitLabelSingle = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Cut Width', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${cutWidthConverted} ${unitLabelSingle}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(`Saw blade thickness`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });

  doc.moveDown(3);

  // Draw layout diagrams
  
  // Calculate positions for stock piece layouts
  const stockTitleX = 50;
  const stockTitleY = currentSummaryY + 50; // Position below the summary
  const stockTitleWidth = 500;
  
  // Draw each stock piece layout
  solution.stockPieces.forEach((stockPiece, index) => {
    const stockTitleHeight = 30;

    doc.rect(stockTitleX, stockTitleY, stockTitleWidth, stockTitleHeight)
       .fillAndStroke('#003366', '#000000');

    doc.fontSize(14)
       .fillColor('#FFFFFF')
       .text(`CASE ${index + 1}`, stockTitleX, stockTitleY + 8,
             { align: 'center', width: stockTitleWidth });

    // Add stock piece details in a table format
    const stockDetailsStartX = 50;
    const stockDetailsStartY = stockTitleY + stockTitleHeight + 10;
    const stockDetailsColWidths = [100, 100, 100, 100];
    const stockDetailsRowHeight = 25;

    // Draw header
    doc.rect(stockDetailsStartX, stockDetailsStartY,
             stockDetailsColWidths.reduce((a, b) => a + b, 0),
             stockDetailsRowHeight)
       .fillAndStroke('#e0e0e0', '#000000');

    doc.fontSize(10).fillColor('#000000');
    doc.text('Resource', stockDetailsStartX + 5, stockDetailsStartY + 8,
             { width: stockDetailsColWidths[0] });
    doc.text('Width', stockDetailsStartX + stockDetailsColWidths[0] + 5,
             stockDetailsStartY + 8, { width: stockDetailsColWidths[1] });
    doc.text('Length', stockDetailsStartX + stockDetailsColWidths[0] +
             stockDetailsColWidths[1] + 5, stockDetailsStartY + 8,
             { width: stockDetailsColWidths[2] });
    doc.text('Area', stockDetailsStartX + stockDetailsColWidths[0] +
             stockDetailsColWidths[1] + stockDetailsColWidths[2] + 5,
             stockDetailsStartY + 8, { width: stockDetailsColWidths[3] });

    // Draw data row
    const stockDetailsDataY = stockDetailsStartY + stockDetailsRowHeight;
    doc.rect(stockDetailsStartX, stockDetailsDataY,
             stockDetailsColWidths.reduce((a, b) => a + b, 0),
             stockDetailsRowHeight)
       .stroke();

    const stockWidth = convertUnit(stockPiece.width, 0, unit).toFixed(1);
    const stockLength = convertUnit(stockPiece.length, 0, unit).toFixed(1);
    const stockAreaFormatted = (parseFloat(stockWidth) * parseFloat(stockLength)).toFixed(2);

    doc.text(`Case ${index + 1}`, stockDetailsStartX + 5, stockDetailsDataY + 8,
             { width: stockDetailsColWidths[0] });
    doc.text(`${stockWidth} ${unitLabel}`, stockDetailsStartX + stockDetailsColWidths[0] + 5,
             stockDetailsDataY + 8, { width: stockDetailsColWidths[1] });
    doc.text(`${stockLength} ${unitLabel}`, stockDetailsStartX + stockDetailsColWidths[0] +
             stockDetailsColWidths[1] + 5, stockDetailsDataY + 8,
             { width: stockDetailsColWidths[2] });
    doc.text(`${stockAreaFormatted} ${unitLabel}`, stockDetailsStartX + stockDetailsColWidths[0] +
             stockDetailsColWidths[1] + stockDetailsColWidths[2] + 5,
             stockDetailsDataY + 8, { width: stockDetailsColWidths[3] });

    doc.moveDown(3);

    // Calculate scale to fit on page
    const pageWidth = 500;
    const pageHeight = 700;
    const scale = Math.min(
      pageWidth / stockPiece.width,
      pageHeight / stockPiece.length
    ) * 0.8;

    // Draw stock piece
    const startX = 50;
    const startY = 120;

    // Draw stock piece outline
    doc.rect(
      startX,
      startY,
      stockPiece.width * scale,
      stockPiece.length * scale
    ).stroke('#000000');

    // Draw cut pieces
    stockPiece.cutPieces.forEach((cutPiece, pieceIndex) => {
      // Generate a color for this piece (pastel colors for better visibility)
      const colors = [
        '#FFD6D6', // light pink
        '#D6FFDB', // light green
        '#D6F0FF', // light blue
        '#FFF7D6', // light yellow
        '#EBD6FF', // light purple
        '#FFE4D6', // light orange
        '#D6FFFF'  // light cyan
      ];
      const fillColor = colors[pieceIndex % colors.length];

      // Draw cut piece
      doc.rect(
        startX + cutPiece.x * scale,
        startY + cutPiece.y * scale,
        cutPiece.width * scale,
        cutPiece.length * scale
      ).fillAndStroke(fillColor, '#000000');

      // Add ID label in the center
      const labelX = startX + cutPiece.x * scale + (cutPiece.width * scale / 2);
      const labelY = startY + cutPiece.y * scale + (cutPiece.length * scale / 2);

      // Draw the ID in the center with larger font
      doc.fontSize(14)
         .fillColor('#000000')
         .text(
           `${cutPiece.externalId}`,
           labelX - 10,
           labelY - 10,
           { width: 20, align: 'center' }
         );

      // Draw width dimension on top
      const widthLabel = convertUnit(cutPiece.width, 0, unit).toFixed(0);
      doc.fontSize(8)
         .fillColor('#000000')
         .text(
           widthLabel,
           startX + cutPiece.x * scale + (cutPiece.width * scale / 2) - 10,
           startY + cutPiece.y * scale - 12,
           { width: 20, align: 'center' }
         );

      // Draw length dimension on the left side
      const lengthLabel = convertUnit(cutPiece.length, 0, unit).toFixed(0);
      doc.fontSize(8)
         .fillColor('#000000')
         .text(
           lengthLabel,
           startX + cutPiece.x * scale - 20,
           startY + cutPiece.y * scale + (cutPiece.length * scale / 2) - 5,
           { width: 20, align: 'center' }
         );

      // Draw dimension lines
      // Top width line
      doc.moveTo(startX + cutPiece.x * scale, startY + cutPiece.y * scale - 5)
         .lineTo(startX + cutPiece.x * scale + cutPiece.width * scale, startY + cutPiece.y * scale - 5)
         .stroke('#000000');

      // Left length line
      doc.moveTo(startX + cutPiece.x * scale - 5, startY + cutPiece.y * scale)
         .lineTo(startX + cutPiece.x * scale - 5, startY + cutPiece.y * scale + cutPiece.length * scale)
         .stroke('#000000');

      // Draw small ticks at the ends of dimension lines
      // Top width ticks
      doc.moveTo(startX + cutPiece.x * scale, startY + cutPiece.y * scale - 3)
         .lineTo(startX + cutPiece.x * scale, startY + cutPiece.y * scale - 7)
         .stroke('#000000');
      doc.moveTo(startX + cutPiece.x * scale + cutPiece.width * scale, startY + cutPiece.y * scale - 3)
         .lineTo(startX + cutPiece.x * scale + cutPiece.width * scale, startY + cutPiece.y * scale - 7)
         .stroke('#000000');

      // Left length ticks
      doc.moveTo(startX + cutPiece.x * scale - 3, startY + cutPiece.y * scale)
         .lineTo(startX + cutPiece.x * scale - 7, startY + cutPiece.y * scale)
         .stroke('#000000');
      doc.moveTo(startX + cutPiece.x * scale - 3, startY + cutPiece.y * scale + cutPiece.length * scale)
         .lineTo(startX + cutPiece.x * scale - 7, startY + cutPiece.y * scale + cutPiece.length * scale)
         .stroke('#000000');
    });

    // Add cut pieces table with colored header
    doc.moveDown(2);

    // Create a colored header for the cut pieces table
    const cutPiecesTitleX = 50;
    const cutPiecesTitleY = doc.y;
    const cutPiecesTitleWidth = doc.page.width - 100;
    const cutPiecesTitleHeight = 30;

    doc.rect(cutPiecesTitleX, cutPiecesTitleY, cutPiecesTitleWidth, cutPiecesTitleHeight)
       .fillAndStroke('#003366', '#000000');

    doc.fontSize(14)
       .fillColor('#FFFFFF')
       .text('CUTTED PARTS', cutPiecesTitleX, cutPiecesTitleY + 8,
             { align: 'center', width: cutPiecesTitleWidth });

    doc.moveDown(2);

    const tableTop = doc.y;
    const colWidths = [80, 80, 80, 60, 80, 80];
    const rowHeight = 25;

    // Draw table header
    doc.rect(startX, tableTop, colWidths.reduce((a, b) => a + b, 0), rowHeight)
       .fillAndStroke('#4682B4', '#000000'); // Steel blue header

    doc.fontSize(10).fillColor('#FFFFFF');
    doc.text('Part Name', startX + 5, tableTop + 8, { width: colWidths[0] });
    doc.text('X', startX + colWidths[0] + 5, tableTop + 8, { width: colWidths[1], align: 'center' });
    doc.text('Y', startX + colWidths[0] + colWidths[1] + 5, tableTop + 8, { width: colWidths[2], align: 'center' });
    doc.text('Count', startX + colWidths[0] + colWidths[1] + colWidths[2] + 5, tableTop + 8, { width: colWidths[3], align: 'center' });
    doc.text('Width', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, tableTop + 8, { width: colWidths[4], align: 'center' });
    doc.text('Length', startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, tableTop + 8, { width: colWidths[5], align: 'center' });

    // Group cut pieces by dimensions to count similar pieces
    const groupedPieces = new Map();

    stockPiece.cutPieces.forEach(cutPiece => {
      const key = `${cutPiece.width}-${cutPiece.length}`;
      if (!groupedPieces.has(key)) {
        groupedPieces.set(key, {
          width: cutPiece.width,
          length: cutPiece.length,
          count: 1,
          pieces: [cutPiece]
        });
      } else {
        const group = groupedPieces.get(key);
        group.count++;
        group.pieces.push(cutPiece);
      }
    });

    // Draw cut pieces in the table
    let currentY = tableTop + rowHeight;
    let partIndex = 0;

    Array.from(groupedPieces.values()).forEach((group, idx) => {
      partIndex++;
      const partName = String.fromCharCode(65 + (idx % 26)); // A, B, C, ...

      // Get the first piece in the group for position reference
      const firstPiece = group.pieces[0];

      // Unit is handled in the width/length conversion
      const width = convertUnit(group.width, 0, unit).toFixed(1);
      const length = convertUnit(group.length, 0, unit).toFixed(1);
      const x = convertUnit(firstPiece.x, 0, unit).toFixed(1);
      const y = convertUnit(firstPiece.y, 0, unit).toFixed(1);

      // Alternate row background for better readability
      if (idx % 2 === 1) {
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
           .fillAndStroke('#F0F8FF', '#000000'); // Light blue background
      } else {
        doc.rect(startX, currentY, colWidths.reduce((a, b) => a + b, 0), rowHeight)
           .fillAndStroke('#FFFFFF', '#000000'); // White background
      }

      doc.fillColor('#000000');
      doc.text(partName, startX + 5, currentY + 8, { width: colWidths[0] });
      doc.text(x, startX + colWidths[0] + 5, currentY + 8, { width: colWidths[1], align: 'center' });
      doc.text(y, startX + colWidths[0] + colWidths[1] + 5, currentY + 8, { width: colWidths[2], align: 'center' });
      doc.text(group.count.toString(), startX + colWidths[0] + colWidths[1] + colWidths[2] + 5, currentY + 8, { width: colWidths[3], align: 'center' });
      doc.text(width, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 5, currentY + 8, { width: colWidths[4], align: 'center' });
      doc.text(length, startX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + 5, currentY + 8, { width: colWidths[5], align: 'center' });

      currentY += rowHeight;

      // Update the externalId of each piece in the group to use the part name
      group.pieces.forEach((piece: PlacedPiece) => {
        piece.externalId = partName;
      });
    });

    // Draw table border
    doc.rect(startX, tableTop, colWidths.reduce((a, b) => a + b, 0), currentY - tableTop)
       .stroke('#000000');

    // Add additional information table with colored header
    doc.moveDown(2);

    // Create a colored header for the info table
    const infoTitleX = 50;
    const infoTitleY = doc.y;
    const infoTitleWidth = doc.page.width - 100;
    const infoTitleHeight = 30;

    doc.rect(infoTitleX, infoTitleY, infoTitleWidth, infoTitleHeight)
       .fillAndStroke('#003366', '#000000');

    doc.fontSize(14)
       .fillColor('#FFFFFF')
       .text('CUTTING PARAMETERS', infoTitleX, infoTitleY + 8,
             { align: 'center', width: infoTitleWidth });

    doc.moveDown(2);

    const infoTableTop = doc.y;
    const infoColWidths = [150, 150];

    // Draw info table header
    doc.rect(startX, infoTableTop, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#4682B4', '#000000');

    doc.fontSize(10).fillColor('#FFFFFF');
    doc.text('Parameter', startX + 5, infoTableTop + 8, { width: infoColWidths[0] });
    doc.text('Value', startX + infoColWidths[0] + 5, infoTableTop + 8, { width: infoColWidths[1] });

    let infoCurrentY = infoTableTop + rowHeight;

    // Row 1: Guillotine Cutting
    doc.rect(startX, infoCurrentY, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#F0F8FF', '#000000'); // Light blue background
    doc.fillColor('#000000');
    doc.text('Guillotine Cutting', startX + 5, infoCurrentY + 8, { width: infoColWidths[0] });
    doc.text(layout === 0 ? 'Yes' : 'No', startX + infoColWidths[0] + 5, infoCurrentY + 8, { width: infoColWidths[1] });
    infoCurrentY += rowHeight;

    // Row 2: Rotating
    doc.rect(startX, infoCurrentY, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#FFFFFF', '#000000'); // White background
    doc.text('Rotating', startX + 5, infoCurrentY + 8, { width: infoColWidths[0] });
    // Check if any pieces have canRotate=true
    const canRotate = stockPiece.cutPieces.some(p => p.canRotate);
    doc.text(canRotate ? 'Yes' : 'No', startX + infoColWidths[0] + 5, infoCurrentY + 8, { width: infoColWidths[1] });
    infoCurrentY += rowHeight;

    // Row 3: Waste
    const stockAreaValue = stockPiece.width * stockPiece.length;
    let usedAreaValue = 0;
    stockPiece.cutPieces.forEach(p => {
      usedAreaValue += p.width * p.length;
    });
    const wasteAreaValue = stockAreaValue - usedAreaValue;
    const wastePercentage = ((wasteAreaValue / stockAreaValue) * 100).toFixed(2);

    doc.rect(startX, infoCurrentY, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#FFECEC', '#000000'); // Light red background for waste
    doc.text('Waste', startX + 5, infoCurrentY + 8, { width: infoColWidths[0] });
    doc.text(`${convertUnit(wasteAreaValue, 0, unit).toFixed(2)} ${unitLabel} (${wastePercentage}%)`,
             startX + infoColWidths[0] + 5, infoCurrentY + 8, { width: infoColWidths[1] });

    // Row 4: Edging Cost
    doc.rect(startX, infoCurrentY + rowHeight, infoColWidths[0] + infoColWidths[1], rowHeight)
       .fillAndStroke('#F0F8FF', '#000000'); // Light blue background
    doc.fillColor('#000000');
    doc.text('Edging Cost', startX + 5, (infoCurrentY + rowHeight) + 8, { width: infoColWidths[0] });
    doc.text(`R ${edgingCost.toFixed(2)}`, startX + infoColWidths[0] + 5, (infoCurrentY + rowHeight) + 8, { width: infoColWidths[1] });
  });

  // Add a simple footer to the last page
  doc.fontSize(8).fillColor('#666666');
  doc.text(
    `HDS Group Cutlist - Generated on ${dateString}`,
    50,
    doc.page.height - 50,
    { align: 'center', width: doc.page.width - 100 }
  );

  // Finalize PDF
  doc.end();

  return pdfId;
};

// Generate a PDF invoice from quote data
export const generateInvoicePdf = (quoteData: any, branchData?: any): Promise<{ buffer: any, id: string }> => {
  return new Promise((resolve, reject) => {
    try {
      console.log('Generating invoice PDF for quote:', quoteData.quote_number || quoteData.id);
      
      // Extract data from quote with better fallback handling
      const quoteId = quoteData.quote_number || quoteData.id || `INV-${Date.now()}`;
      const customerName = quoteData.customer_name || quoteData.customerName || 'Customer';
      const projectName = quoteData.project_name || quoteData.projectName || 'Project';
      const quoteDate = quoteData.created_at ? new Date(quoteData.created_at).toLocaleDateString() : new Date().toLocaleDateString();
      const invoiceDate = new Date().toLocaleDateString();
      const invoiceNumber = `INV-${quoteId}-${Date.now()}`;
      
      // Parse quote data with better structure handling
      let parsedQuoteData;
      try {
        parsedQuoteData = typeof quoteData.quote_data === 'string' 
          ? JSON.parse(quoteData.quote_data) 
          : quoteData.quote_data || quoteData;
      } catch (e) {
        console.warn('Could not parse quote_data, using fallback');
        parsedQuoteData = { items: [], totals: { finalTotal: 0 } };
      }
      
      // Extract sections data (same as quote PDF)
      const sections = parsedQuoteData.sections || [];
      
      // Calculate totals using the same logic as quote PDF
      const EDGING_PRICE_PER_METER = 14; // R14 per meter
      let totalEdgingMeters = 0;
      
      console.log('💰 Extracting amounts from quote data...');
      
      let boardTotal = 0;
      let totalEdgingCost = 0;
      let totalCuttingFee = 0;
      let finalTotal = 0;
      
      // Parse quote data to get the actual totals
      try {
        const parsedQuoteData = JSON.parse(quoteData.quote_data || '{}');
        console.log('📊 Parsed quote data keys:', Object.keys(parsedQuoteData));
        
        if (parsedQuoteData.totals) {
          // Use the totals from the quote data
          const quoteTotals = parsedQuoteData.totals;
          console.log('💰 Found totals in quote data:', quoteTotals);
          
          // The quote already has calculated totals - use the subtotal as our base
          finalTotal = parseFloat(quoteTotals.subtotal || quoteTotals.finalTotal || 0);
          boardTotal = finalTotal; // For display purposes, treat the subtotal as board total
          
          console.log('✅ Using quote subtotal as base amount:', finalTotal);
        } else if (parsedQuoteData.items && Array.isArray(parsedQuoteData.items)) {
          // Fallback: calculate from items if totals not available
          console.log('📦 Calculating from items...');
          parsedQuoteData.items.forEach((item: any) => {
            if (item.total && !isNaN(item.total)) {
              finalTotal += parseFloat(item.total);
            }
          });
          boardTotal = finalTotal;
          console.log('✅ Calculated total from items:', finalTotal);
        }
        
        // If we still don't have amounts, try to use sections data (fallback)
        if (finalTotal === 0 && sections && sections.length > 0) {
          console.log('⚠️ No amounts in quote data, trying sections fallback...');
          
          // Calculate sectionTotal for each section if not already calculated
          sections.forEach((section: any) => {
            if (!section.sectionTotal && section.pricePerBoard && section.boardsNeeded) {
              section.sectionTotal = parseFloat((section.pricePerBoard * section.boardsNeeded).toFixed(2));
            }
          });
          
          // Calculate initial grand total from board costs
          boardTotal = sections.reduce((sum: number, section: any) => sum + (section.sectionTotal || 0), 0);
          boardTotal = parseFloat(boardTotal.toFixed(2));

          // Calculate edging costs for each section
          sections.forEach((section: any) => {
            if (section.edging && section.edging.totalEdging > 0) {
              // Convert from mm to meters
              const edgingMeters = section.edging.totalEdging / 1000;
              totalEdgingMeters += edgingMeters;
              
              // Use the already calculated cost from the controller if available
              if (section.edging.cost !== undefined) {
                section.edgingCost = parseFloat(section.edging.cost);
                totalEdgingCost += section.edgingCost;
              } else {
                // Fallback calculation if cost not provided
                const edgingCost = (edgingMeters * EDGING_PRICE_PER_METER).toFixed(2);
                section.edgingCost = parseFloat(edgingCost);
                totalEdgingCost += section.edgingCost;
              }
            } else {
              section.edgingCost = 0;
            }
          });
          
          // Round the total edging cost to 2 decimal places
          totalEdgingCost = parseFloat(totalEdgingCost.toFixed(2));
          
          // Calculate cutting fee (R70 per board)
          const cuttingFeePerBoard = 70; // R70 per board
          const totalBoardsUsed = sections.reduce((sum: number, section: any) => sum + (section.boardsNeeded || 0), 0);
          totalCuttingFee = parseFloat((totalBoardsUsed * cuttingFeePerBoard).toFixed(2));
          
          // Calculate final grand total with edging and cutting fee included
          finalTotal = boardTotal + totalEdgingCost + totalCuttingFee;
          
          console.log('✅ Calculated from sections - Board:', boardTotal, 'Edging:', totalEdgingCost, 'Cutting:', totalCuttingFee, 'Total:', finalTotal);
        }
        
      } catch (parseError) {
        console.error('❌ Error parsing quote data for amounts:', parseError);
        // Use fallback amounts if parsing fails
        finalTotal = 0;
        boardTotal = 0;
      }
      
      // Ensure we have some amount to display (never show R0.00 if quote has a total)
      if (finalTotal === 0 && quoteData.total && !isNaN(quoteData.total)) {
        console.log('⚠️ Using quote.total as fallback:', quoteData.total);
        finalTotal = parseFloat(quoteData.total);
        boardTotal = finalTotal;
      }
      
      // Define variables needed for PDF display
      const cuttingFeePerBoard = 70; // R70 per board (for display purposes)
      const totalBoardsUsed = sections.length > 0 
        ? sections.reduce((sum: number, section: any) => sum + (section.boardsNeeded || 0), 0)
        : Math.ceil(finalTotal / 500); // Estimate boards if no sections data
      
      console.log('💰 Final amounts for invoice:');
      console.log('  Board Total:', boardTotal);
      console.log('  Edging Cost:', totalEdgingCost);
      console.log('  Cutting Fee:', totalCuttingFee);
      console.log('  Total Boards Used:', totalBoardsUsed);
      console.log('  Subtotal (before VAT):', finalTotal);
      
      // Create PDF document
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      
      // Setup buffer to store PDF content
      const buffers: any[] = [];
      let pdfBuffer: any = null;
      
      doc.on('data', (chunk: any) => {
        buffers.push(chunk);
      });
      
      doc.on('end', () => {
        pdfBuffer = Buffer.concat(buffers);
        resolve({
          buffer: pdfBuffer,
          id: invoiceNumber
        });
      });
      
      doc.on('error', (error: any) => {
        console.error('PDF generation error:', error);
        reject(error);
      });
      
      // Generate a unique ID for this invoice
      const pdfId = invoiceNumber;
      
      // ===== INVOICE HEADER =====
      doc.fontSize(28).fillColor('#003366').font('Helvetica-Bold');
      doc.text('INVOICE', 50, 50, { align: 'center', width: doc.page.width - 100 });
      
      doc.moveDown(1);
      
      // Company details (left side) - using dynamic branch data
      console.log('🏢 Branch data received in generateInvoicePdf:', JSON.stringify(branchData, null, 2));
      
      const effectiveBranchData = branchData || {
        name: 'HDS Group',
        trading_as: 'HDS Group',
        branch_address: 'Please contact us for address details',
        branch_telephone: '011 123 4567',
        email_address: 'info@hdsgroup.co.za'
      };
      
      console.log('🏢 Effective branch data:', JSON.stringify(effectiveBranchData, null, 2));
      
      doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
      const companyName = effectiveBranchData.trading_as || effectiveBranchData.name || 'HDS Group';
      doc.text(companyName, 50, doc.y);
      console.log('🏢 Company name displayed:', companyName);
      
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      
      // Address - always show something
      const address = effectiveBranchData.branch_address || 'Please contact us for address details';
      doc.text(address, 50, doc.y + 5);
      console.log('🏢 Address displayed:', address);
      
      // Phone - always show something
      const phone = effectiveBranchData.branch_telephone || '011 123 4567';
      doc.text(`Tel: ${phone}`, 50, doc.y + 5);
      console.log('🏢 Phone displayed:', phone);
      
      // Email - always show something
      const email = effectiveBranchData.email_address || 'info@hdsgroup.co.za';
      doc.text(`Email: ${email}`, 50, doc.y + 5);
      console.log('🏢 Email displayed:', email);
      
      // Invoice details (right side)
      const rightColumnX = doc.page.width - 250;
      const topY = 120;
      
      doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
      doc.text('Invoice Details', rightColumnX, topY);
      
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      doc.text('Invoice Number:', rightColumnX, topY + 20);
      doc.text(invoiceNumber, rightColumnX + 80, topY + 20);
      
      doc.text('Invoice Date:', rightColumnX, topY + 35);
      doc.text(invoiceDate, rightColumnX + 80, topY + 35);
      
      doc.text('Quote Number:', rightColumnX, topY + 50);
      doc.text(quoteId, rightColumnX + 80, topY + 50);
      
      doc.text('Quote Date:', rightColumnX, topY + 65);
      doc.text(quoteDate, rightColumnX + 80, topY + 65);
      
      // Customer details
      doc.y = topY + 100;
      doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
      doc.text('Bill To:', 50, doc.y);
      
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      doc.text(customerName, 50, doc.y + 15);
      doc.text(projectName, 50, doc.y + 15);
      
      doc.moveDown(2);
      
      // ===== INVOICE ITEMS TABLE (using same structure as quote PDF) =====
      doc.moveDown(1);
      
      // For each material section (same as quote PDF)
      sections.forEach((section: any, index: number) => {
        const { material, boardSize, boardsNeeded, pricePerBoard, sectionTotal, cutPieces, wastage, edging } = section;
        
        // Check if we need a new page for this section
        if (doc.y > doc.page.height - 200) {
          doc.addPage();
        }
        
        doc.moveDown(0.5);
        
        // Create a compact table for this section's details
        const startY = doc.y;
        const colWidths = [200, 100, 100, 100];
        const rowHeight = 20;
        
        const currentStartY = doc.y;
        
        // Header row
        doc.rect(50, currentStartY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
           .fillAndStroke('#cccccc', '#000000');
        
        doc.fontSize(10).fillColor('#000000');
        doc.text('Description', 55, currentStartY + 8, { width: colWidths[0] - 10 });
        doc.text('Board Size', 55 + colWidths[0], currentStartY + 8, { width: colWidths[1] - 10 });
        doc.text('Quantity', 55 + colWidths[0] + colWidths[1], currentStartY + 8, { width: colWidths[2] - 10 });
        doc.text('Price', 55 + colWidths[0] + colWidths[1] + colWidths[2], currentStartY + 8, { width: colWidths[3] - 10 });
        
        // Data row
        let currentY = currentStartY + rowHeight;
        
        doc.rect(50, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
           .stroke();
        doc.text(material ?? '-', 55, currentY + 8, { width: colWidths[0] - 10 });
        doc.text(boardSize ?? '-', 55 + colWidths[0], currentY + 8, { width: colWidths[1] - 10 });
        
        const boardsNeededDisplay = boardsNeeded !== undefined && boardsNeeded !== null ? boardsNeeded.toString() : '-';
        doc.text(boardsNeededDisplay, 55 + colWidths[0] + colWidths[1], currentY + 8, { width: colWidths[2] - 10 });
        
        const priceDisplay = pricePerBoard !== undefined && pricePerBoard !== null ? `R ${pricePerBoard.toFixed(2)}` : '-';
        doc.text(priceDisplay, 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 8, { width: colWidths[3] - 10 });
        
        currentY += rowHeight;
        
        // Section total
        doc.rect(50, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
           .stroke();
        
        doc.fontSize(10).fillColor('#000000');
        doc.text('Board Total:', 55, currentY + 8, { width: colWidths[0] + colWidths[1] + colWidths[2] - 10 });
        const sectionTotalDisplay = sectionTotal !== undefined && sectionTotal !== null ? `R ${sectionTotal.toFixed(2)}` : '-';
        doc.text(sectionTotalDisplay, 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 8, { width: colWidths[3] - 10 });
        
        currentY += rowHeight;
        
        // Add edging information if available
        if (edging && edging.totalEdging > 0) {
          doc.rect(50, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
             .stroke();
          
          const edgingMeters = (edging.totalEdging / 1000).toFixed(2);
          const edgingCost = section.edgingCost !== undefined 
            ? section.edgingCost.toFixed(2) 
            : (parseFloat(edgingMeters) * EDGING_PRICE_PER_METER).toFixed(2);
          
          doc.fontSize(10).fillColor('#000000');
          doc.text(`Edging (${edgingMeters}m @ R${EDGING_PRICE_PER_METER}/m):`, 55, currentY + 8, { width: colWidths[0] + colWidths[1] + colWidths[2] - 10 });
          doc.text(`R ${edgingCost}`, 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 8, { width: colWidths[3] - 10 });
          
          currentY += rowHeight;
          
          // Combined section total (boards + edging)
          doc.rect(50, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
             .fillAndStroke('#e6e6e6', '#000000');
             
          doc.fontSize(10).fillColor('#000000');
          doc.text('Section Total:', 55, currentY + 8, { width: colWidths[0] + colWidths[1] + colWidths[2] - 10 });
          
          const combinedTotal = (parseFloat(sectionTotal || '0') + parseFloat(edgingCost)).toFixed(2);
          doc.text(`R ${combinedTotal}`, 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 8, { width: colWidths[3] - 10 });
        }
        
        // Minimal spacing between sections
        doc.moveDown(0.5);
      });
      
      // Add invoice summary (same as quote PDF summary)
      doc.moveDown(0.5);
      
      const pageWidth = doc.page.width - 100;
      doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold');
      doc.text('Invoice Summary', 50, doc.y, { align: 'center', width: pageWidth });
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      doc.moveDown(0.3);
      
      // Create a summary table
      const summaryStartY = doc.y;
      const summaryColWidth = (doc.page.width - 100) / 2;
      const summaryRowHeight = 25;
      
      // Table header
      doc.rect(50, summaryStartY, summaryColWidth * 2, summaryRowHeight)
         .fillAndStroke('#cccccc', '#000000');
      
      doc.fontSize(12).fillColor('#000000');
      doc.text('Description', 60, summaryStartY + 8);
      doc.text('Amount', 60 + summaryColWidth, summaryStartY + 8);
      
      let summaryY = summaryStartY + summaryRowHeight;
      
      // Board costs row
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight).stroke();
      doc.text('Total Board Cost', 60, summaryY + 8);
      doc.text(`R ${boardTotal.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
      
      summaryY += summaryRowHeight;
      
      // Edging costs row
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight).stroke();
      doc.text(`Total Edging Cost (${totalEdgingMeters.toFixed(2)}m @ R${EDGING_PRICE_PER_METER}/m)`, 60, summaryY + 8);
      doc.text(`R ${totalEdgingCost.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
      
      summaryY += summaryRowHeight;

      // Cutting fee row
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight)
         .fillAndStroke('#ffffff', '#000000');
      doc.fillColor('#000000');
      doc.text(`Cutting Fee (R${cuttingFeePerBoard} per board × ${totalBoardsUsed} board(s))`, 60, summaryY + 8);
      doc.text(`R ${totalCuttingFee.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);

      summaryY += summaryRowHeight;

      // Subtotal row (before VAT)
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight)
         .fillAndStroke('#f0f0f0', '#000000');
      
      doc.fontSize(11).fillColor('#000000').font('Helvetica-Bold');
      doc.text('SUBTOTAL (Excl. VAT):', 60, summaryY + 8);
      doc.text(`R ${finalTotal.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
      
      summaryY += summaryRowHeight;
      
      // VAT calculation (15.5%)
      const VAT_RATE = 0.155; // 15.5%
      const vatAmount = finalTotal * VAT_RATE;
      
      // VAT row
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight)
         .stroke('#000000');
      
      doc.fontSize(11).fillColor('#000000').font('Helvetica');
      doc.text('VAT (15.5%):', 60, summaryY + 8);
      doc.text(`R ${vatAmount.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
      
      summaryY += summaryRowHeight;
      
      // Total including VAT
      const totalIncludingVAT = finalTotal + vatAmount;
      
      // Grand total row (including VAT)
      doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight)
         .fillAndStroke('#003366', '#000000');
      
      doc.fontSize(14).fillColor('#FFFFFF').font('Helvetica-Bold');
      doc.text('TOTAL (Incl. VAT):', 60, summaryY + 8);
      doc.text(`R ${totalIncludingVAT.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
      doc.font('Helvetica');
      
      // Payment details section removed per user request
      
      // Footer
      doc.fontSize(8).fillColor('#666666');
      doc.text('Thank you for your business!', 50, doc.page.height - 100, { align: 'center', width: doc.page.width - 100 });
      doc.text('This invoice was generated automatically. Please contact us if you have any questions.', 50, doc.page.height - 85, { align: 'center', width: doc.page.width - 100 });
      
      doc.end();
      
    } catch (error: any) {
      console.error('❌ Error in generateInvoicePdf:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      reject(new Error(`PDF generation failed: ${error.message || 'Unknown error'}`));
    }
  });
};
// Generate IQ software compatible export data
export const generateIQExport = (solution: Solution, unit: number, cutWidth: number = 3, layout: number = 0): any => {
  // Create an object structure that matches the IQ software import format
  const iqData: any = {
    version: "1.0",
    title: "HDS Group Cutlist Export",
    date: new Date().toISOString(),
    unit: unit === 0 ? "mm" : unit === 1 ? "in" : "ft",
    layout: layout === 0 ? "guillotine" : "nested",
    cutWidth: convertUnit(cutWidth, 0, unit),
    stockPieces: [],
    metadata: {
      source: "HDS Group Cutlist",
      exportType: "optimization",
      optimizationId: uuidv4(),
      settings: {
        allowRotation: true,
        cutWidth: convertUnit(cutWidth, 0, unit),
        algorithm: layout === 0 ? "guillotine" : "nested"
      }
    },
    summary: {
      totalStockPieces: solution.stockPieces.length,
      totalCutPieces: 0,
      totalStockArea: 0,
      totalCutArea: 0,
      totalWaste: 0,
      wastePercentage: 0
    }
  };

  // Process each stock piece
  solution.stockPieces.forEach((stockPiece, stockIndex) => {
    const stockWidth = convertUnit(stockPiece.width, 0, unit);
    const stockLength = convertUnit(stockPiece.length, 0, unit);
    const stockArea = stockWidth * stockLength;

    // Group cut pieces by dimensions
    const groupedPieces = new Map();

    stockPiece.cutPieces.forEach(cutPiece => {
      const key = `${cutPiece.width}-${cutPiece.length}`;
      if (!groupedPieces.has(key)) {
        groupedPieces.set(key, {
          width: cutPiece.width,
          length: cutPiece.length,
          count: 1,
          pieces: [cutPiece]
        });
      } else {
        const group = groupedPieces.get(key);
        group.count++;
        group.pieces.push(cutPiece);
      }
    });

    // Calculate used area and waste
    let usedArea = 0;
    stockPiece.cutPieces.forEach(p => {
      usedArea += p.width * p.length;
    });

    const wasteArea = stockPiece.width * stockPiece.length - usedArea;
    const wastePercentage = (wasteArea / (stockPiece.width * stockPiece.length)) * 100;

    // Convert grouped pieces to array with part names
    const parts = Array.from(groupedPieces.entries()).map(([_, group], index) => {
      const partName = String.fromCharCode(65 + (index % 26)); // A, B, C, ...
      const firstPiece = group.pieces[0];

      return {
        name: partName,
        width: convertUnit(group.width, 0, unit),
        length: convertUnit(group.length, 0, unit),
        count: group.count,
        x: convertUnit(firstPiece.x, 0, unit),
        y: convertUnit(firstPiece.y, 0, unit)
      };
    });

    // Add stock piece to IQ data
    iqData.stockPieces.push({
      id: `Case${stockIndex + 1}`,
      width: stockWidth,
      length: stockLength,
      area: stockArea,
      usedArea: convertUnit(usedArea, 0, unit),
      waste: convertUnit(wasteArea, 0, unit),
      wastePercentage: wastePercentage.toFixed(2),
      parts: parts
    });

    // Update summary data
    iqData.summary.totalCutPieces += stockPiece.cutPieces.length;
    iqData.summary.totalStockArea += stockArea;
    iqData.summary.totalCutArea += convertUnit(usedArea, 0, unit);
  });

  // Calculate total waste
  iqData.summary.totalWaste = iqData.summary.totalStockArea - iqData.summary.totalCutArea;
  iqData.summary.wastePercentage = ((iqData.summary.totalWaste / iqData.summary.totalStockArea) * 100).toFixed(2);

  return iqData;
};

// Import data from IQ software
export const importFromIQ = (iqData: any): { pieces: IPiece[], unit: number, width: number, layout: number } => {
  if (!iqData || typeof iqData !== 'object') {
    throw new Error('Invalid IQ data format');
  }

  // Determine unit from IQ data
  let unit = 0; // Default to mm
  if (iqData.unit) {
    if (iqData.unit === 'in') unit = 1;
    else if (iqData.unit === 'ft') unit = 2;
  }

  // Determine cut width and layout
  const cutWidth = iqData.cutWidth ? convertUnit(iqData.cutWidth, unit, 0) : 3;
  const layout = iqData.layout === 'nested' ? 1 : 0;

  // Process stock pieces
  const pieces: IPiece[] = [];

  // Add stock pieces
  if (Array.isArray(iqData.stockPieces)) {
    iqData.stockPieces.forEach((stockPiece: any) => {
      if (stockPiece.width && stockPiece.length) {
        pieces.push({
          width: convertUnit(stockPiece.width, unit, 0),
          length: convertUnit(stockPiece.length, unit, 0),
          amount: stockPiece.quantity || 1,
          kind: 1, // Stock piece
          pattern: 0 // No pattern by default
        });
      }
    });
  }

  // Add cut pieces
  if (iqData.parts) {
    iqData.parts.forEach((part: any) => {
      if (part.width && part.length) {
        pieces.push({
          width: convertUnit(part.width, unit, 0),
          length: convertUnit(part.length, unit, 0),
          amount: part.quantity || 1,
          kind: 0, // Cut piece
          pattern: 0 // No pattern by default
        });
      }
    });
  } else if (iqData.stockPieces) {
    // Try to extract parts from stock pieces if they exist
    iqData.stockPieces.forEach((stockPiece: any) => {
      if (Array.isArray(stockPiece.parts)) {
        stockPiece.parts.forEach((part: any) => {
          if (part.width && part.length) {
            pieces.push({
              width: convertUnit(part.width, unit, 0),
              length: convertUnit(part.length, unit, 0),
              amount: part.count || 1,
              kind: 0, // Cut piece
              pattern: 0 // No pattern by default
            });
          }
        });
      }
    });
  }

  return {
    pieces,
    unit,
    width: cutWidth,
    layout
  };
};

// Helper to safely format numbers. Returns '-' if value is null/undefined/NaN
const safeFixed = (value: any, digits = 2): string => {
  const num = Number(value);
  return isFinite(num) ? num.toFixed(digits) : '-';
};

// Generate a PDF for quotations
export const generateQuotePdf = (quoteData: any, isPaid: boolean = false): Promise<{ buffer: any, id: string }> => {
  const {
    quoteId,
    customerName,
    projectName,
    date,
    sections,
    grandTotal,
    branchData,
    bankingDetails,
    edgingLength,
    edgingCost
  } = quoteData;

  // Create PDF document
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  // (Removed branch header from top)
  
  // Generate a unique ID for this PDF
  const pdfId = quoteId || `Q-${Date.now()}`;
  
  // Setup buffer to store PDF content
  const buffers: any[] = [];
  doc.on('data', buffers.push.bind(buffers));
  
  // We'll store the final buffer here
  let pdfBuffer: any = null;
  doc.on('end', () => {
    // Using concatenated array to avoid TypeScript errors
    pdfBuffer = (buffers as any[]).length === 1 ? buffers[0] : buffers;
  });
  
  // Add compact HDS branding header
  const headerColor = isPaid ? '#28a745' : '#003366'; // Green for paid, blue for quote
  doc.rect(50, 50, doc.page.width - 100, 40)
     .fillAndStroke(headerColor, '#000000');
     
  const headerText = isPaid ? 'HDS Group Invoice' : 'HDS Group Quotation';
  doc.fontSize(18)
     .fillColor('#FFFFFF')
     .text(headerText, 50, 62, { align: 'center', width: doc.page.width - 100 });
  
  // Set default text color to solid black for all content
  doc.fillColor('#000000');
  
  // Add quote details in a professional container layout
  const containerY = 105;
  const containerHeight = 60;
  const containerPadding = 15;
  
  // Draw a light gray container background for quote details
  doc.rect(50, containerY, doc.page.width - 100, containerHeight)
     .fillAndStroke('#f8f9fa', '#e9ecef');
  
  // Set text styling for quote details
  doc.fontSize(11).fillColor('#000000');
  
  // Create a structured two-row layout with proper spacing
  const leftColumnX = 50 + containerPadding;
  const rightColumnX = 320;
  const firstRowY = containerY + containerPadding;
  const secondRowY = firstRowY + 20;
  
  // First row: Quote ID and Date
  doc.font('Helvetica-Bold')
     .text('Quote:', leftColumnX, firstRowY)
     .font('Helvetica')
     .text(pdfId, leftColumnX + 40, firstRowY);
  
  doc.font('Helvetica-Bold')
     .text('Date:', rightColumnX, firstRowY)
     .font('Helvetica')
     .text(new Date(date).toLocaleDateString(), rightColumnX + 35, firstRowY);
  
  // Second row: Customer and Project
  doc.font('Helvetica-Bold')
     .text('Customer:', leftColumnX, secondRowY)
     .font('Helvetica')
     .text(customerName || 'N/A', leftColumnX + 60, secondRowY);
  
  doc.font('Helvetica-Bold')
     .text('Project:', rightColumnX, secondRowY)
     .font('Helvetica')
     .text(projectName || 'N/A', rightColumnX + 45, secondRowY);
  
  // Calculate grand total and edging costs first so we can display on first page
  const EDGING_PRICE_PER_METER = 14; // R14 per meter
  let totalEdgingMeters = 0;
  let totalEdgingCost = 0;
  
  // Calculate initial grand total from board costs
  let boardTotal = sections.reduce((sum: number, section: any) => sum + (section.sectionTotal || 0), 0);
  boardTotal = parseFloat(boardTotal.toFixed(2));

  // Calculate edging costs for each section
  sections.forEach((section: any) => {
    if (section.edging && section.edging.totalEdging > 0) {
      // Convert from mm to meters
      const edgingMeters = section.edging.totalEdging / 1000;
      totalEdgingMeters += edgingMeters;
      
      // Use the already calculated cost from the controller if available
      if (section.edging.cost !== undefined) {
        section.edgingCost = parseFloat(section.edging.cost);
        totalEdgingCost += section.edgingCost;
      } else {
        // Fallback calculation if cost not provided
        const edgingCost = (edgingMeters * EDGING_PRICE_PER_METER).toFixed(2);
        section.edgingCost = parseFloat(edgingCost);
        totalEdgingCost += section.edgingCost;
      }
    } else {
      section.edgingCost = 0;
    }
  });
  
  // Round the total edging cost to 2 decimal places
  totalEdgingCost = parseFloat(totalEdgingCost.toFixed(2));
  
  // Calculate cutting fee (R70 per board)
  const cuttingFeePerBoard = 70; // R70 per board
  const totalBoardsUsed = sections.reduce((sum: number, section: any) => sum + (section.boardsNeeded || 0), 0);
  const totalCuttingFee = parseFloat((totalBoardsUsed * cuttingFeePerBoard).toFixed(2));
  
  // Calculate final grand total with edging and cutting fee included
  const finalTotal = boardTotal + totalEdgingCost + totalCuttingFee;
  
  // Set starting position for material sections (account for new header container)
  doc.y = containerY + containerHeight + 20; // Start material sections after header container with spacing
  
  // For each material section
  sections.forEach((section: any, index: number) => {
    const { material, boardSize, boardsNeeded, pricePerBoard, sectionTotal, cutPieces, wastage, edging } = section;
    
    // Check if we need a new page for this section (estimate 150px needed for material section)
    if (doc.y > doc.page.height - 200) {
      doc.addPage();
    }
    
    // Removed material header - start directly with table
    doc.moveDown(0.5);
    
    // Create a compact table for this section's details
    const startY = doc.y;
    const colWidths = [200, 100, 100, 100];
    const rowHeight = 20; // Reduced from 25 to 20 for more compact layout
    
    // Estimate table height more accurately (material info + edging + totals)
    const estimatedRows = 4; // Header + data + board total + section total (edging if present)
    const tableHeight = estimatedRows * rowHeight;
    
    // Check if table will fit on current page, if not start new page
    if (doc.y + tableHeight > doc.page.height - 80) {
      doc.addPage();
      // Removed material header on new page - start directly with table
      doc.moveDown(0.5);
    }
    
    const currentStartY = doc.y;
    
    // Header row
    doc.rect(50, currentStartY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
       .fillAndStroke('#cccccc', '#000000');
    
    doc.fontSize(10).fillColor('#000000');
    doc.text('Description', 55, currentStartY + 8, { width: colWidths[0] - 10 });
    doc.text('Board Size', 55 + colWidths[0], currentStartY + 8, { width: colWidths[1] - 10 });
    doc.text('Quantity', 55 + colWidths[0] + colWidths[1], currentStartY + 8, { width: colWidths[2] - 10 });
    doc.text('Price', 55 + colWidths[0] + colWidths[1] + colWidths[2], currentStartY + 8, { width: colWidths[3] - 10 });
    
    // Data row
    let currentY = currentStartY + rowHeight;
    
    // Safely render values even if some fields are missing in the API payload
    doc.rect(50, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
       .stroke();
    doc.text(material ?? '-', 55, currentY + 8, { width: colWidths[0] - 10 });
    doc.text(boardSize ?? '-', 55 + colWidths[0], currentY + 8, { width: colWidths[1] - 10 });
    
    const boardsNeededDisplay = boardsNeeded !== undefined && boardsNeeded !== null ? boardsNeeded.toString() : '-';
    doc.text(boardsNeededDisplay, 55 + colWidths[0] + colWidths[1], currentY + 8, { width: colWidths[2] - 10 });
    
    const priceDisplay = pricePerBoard !== undefined && pricePerBoard !== null ? `R ${safeFixed(pricePerBoard)}` : '-';
    doc.text(priceDisplay, 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 8, { width: colWidths[3] - 10 });
    
    currentY += rowHeight;
    
    // Section total
    doc.rect(50, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
       .stroke();
    
    doc.fontSize(10).fillColor('#000000');
    doc.text('Board Total:', 55, currentY + 8, { width: colWidths[0] + colWidths[1] + colWidths[2] - 10 });
    const sectionTotalDisplay = sectionTotal !== undefined && sectionTotal !== null ? `R ${safeFixed(sectionTotal)}` : '-';
    doc.text(sectionTotalDisplay, 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 8, { width: colWidths[3] - 10 });
    
    currentY += rowHeight;
    
    // Add edging information in the same section as boards (if available)
    if (edging && edging.totalEdging > 0) {
      // Edging row
      doc.rect(50, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
         .stroke();
      
      const edgingMeters = (edging.totalEdging / 1000).toFixed(2);
      const edgingCost = section.edgingCost !== undefined 
        ? section.edgingCost.toFixed(2) 
        : (parseFloat(edgingMeters) * EDGING_PRICE_PER_METER).toFixed(2);
      
      doc.fontSize(10).fillColor('#000000');
      doc.text(`Edging (${edgingMeters}m @ R${EDGING_PRICE_PER_METER}/m):`, 55, currentY + 8, { width: colWidths[0] + colWidths[1] + colWidths[2] - 10 });
      doc.text(`R ${edgingCost}`, 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 8, { width: colWidths[3] - 10 });
      
      currentY += rowHeight;
      
      // Combined section total (boards + edging)
      doc.rect(50, currentY, colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], rowHeight)
         .fillAndStroke('#e6e6e6', '#000000');
         
      doc.fontSize(10).fillColor('#000000');
      doc.text('Section Total:', 55, currentY + 8, { width: colWidths[0] + colWidths[1] + colWidths[2] - 10 });
      
      const combinedTotal = (parseFloat(sectionTotal || '0') + parseFloat(edgingCost)).toFixed(2);
      doc.text(`R ${combinedTotal}`, 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY + 8, { width: colWidths[3] - 10 });
    }
    
    // Minimal spacing between sections for compact layout
    doc.moveDown(0.5);
  });
  
  // Check if we need a new page for the quote summary
  const summaryHeight = 200; // Estimate height needed for summary
  if (doc.y > doc.page.height - summaryHeight) {
    doc.addPage();
  }
  
  // Add quote summary with minimal spacing
  doc.moveDown(0.5);
  
  // Center the Quote Summary headline properly
  const pageWidth = doc.page.width - 100; // Account for margins
  doc.fontSize(14).fillColor('#000000').font('Helvetica-Bold');
  doc.text('Quote Summary', 50, doc.y, { align: 'center', width: pageWidth });
  doc.font('Helvetica').fontSize(10).fillColor('#333333');
  doc.moveDown(0.3);
  
  // Create a summary table
  const summaryStartY = doc.y;
  const summaryColWidth = (doc.page.width - 100) / 2;
  const summaryRowHeight = 25;
  
  // Table header
  doc.rect(50, summaryStartY, summaryColWidth * 2, summaryRowHeight)
     .fillAndStroke('#cccccc', '#000000');
  
  doc.fontSize(12).fillColor('#000000');
  doc.text('Description', 60, summaryStartY + 8);
  doc.text('Amount', 60 + summaryColWidth, summaryStartY + 8);
  
  let summaryY = summaryStartY + summaryRowHeight;
  
  // Board costs row
  doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight).stroke();
  doc.text('Total Board Cost', 60, summaryY + 8);
  doc.text(`R ${boardTotal.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
  
  summaryY += summaryRowHeight;
  
  // Edging costs row
  doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight).stroke();
  doc.text(`Total Edging Cost (${totalEdgingMeters.toFixed(2)}m @ R${EDGING_PRICE_PER_METER}/m)`, 60, summaryY + 8);
  doc.text(`R ${totalEdgingCost.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
  
  summaryY += summaryRowHeight;

  // Cutting fee row with light green background
  doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight)
     .fillAndStroke('#fffff', '#000000'); // Light green background
  doc.fillColor('#000000');
  doc.text(`Cutting Fee (R${cuttingFeePerBoard} per board  ${totalBoardsUsed} board(s))`, 60, summaryY + 8);
  doc.text(`R ${totalCuttingFee.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);

  summaryY += summaryRowHeight;

  // Grand total row - with only a border and no background
  doc.rect(50, summaryY, summaryColWidth * 2, summaryRowHeight)
     .stroke('#000000'); // Only black border, no background fill
  
  // Make the grand total bold but consistent with other totals
  doc.fontSize(12).fillColor('#000000'); // Bold text but normal size
  doc.text('GRAND TOTAL:', 60, summaryY + 8); // Same positioning as other rows
  doc.text(`R ${finalTotal.toFixed(2)}`, 60 + summaryColWidth, summaryY + 8);
  doc.font('Helvetica'); // Reset font
  
  // Add minimal space after the total summary
  doc.moveDown(1);
  
  // ===== CONTACT & PAYMENT INFORMATION SECTION =====
  // Check if we need to add a page break based on remaining space
  const contactInfoHeight = 250; // Reduced estimate for contact & banking info
  const remainingSpace = doc.page.height - doc.y - 50; // Space left on current page minus footer
  
  // If there's not enough room for contact info, start a new page
  if (remainingSpace < contactInfoHeight) {
    doc.addPage();
  }
  
  // Add section header
  doc.fontSize(12).fillColor('#000000').font('Helvetica-Bold');
  doc.text('Contact & Payment Information', 50, doc.y, { align: 'center', width: doc.page.width - 100 });
  doc.font('Helvetica').fontSize(10);
  doc.moveDown(0.5);
  
  // Use fallback branch data if none is provided
  const quoteBranchData = branchData || {
    name: 'HDS Products',
    trading_as: 'HDS Products',
    address1: 'Please contact us for more information',
    phone: '',
    email: ''
  };
  
  // Create a light box for branch info
  const boxStartY = doc.y;
  doc.rect(50, boxStartY, doc.page.width - 100, 70).fillAndStroke('#f5f5f5', '#003366');
  
  // Draw branch name/title
  doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
  doc.text(quoteBranchData.trading_as || quoteBranchData.name || 'Branch', 60, boxStartY + 10, { width: doc.page.width - 120 });
  
  // Prepare to list branch details
  doc.fontSize(9).fillColor('#333333').font('Helvetica');
  let currentY = boxStartY + 28;

  // List of keys to exclude from rendering (internal IDs, metadata, etc.)
  const excludeKeys = ['id', 'created_at', 'updated_at', 'uuid', 'branch_id', 'branch_number'];
  
  // Define pretty labels for known fields
  const prettyLabels: Record<string, string> = {
    trading_as: 'Trading As',
    name: 'Name',
    address1: 'Address 1',
    address2: 'Address 2',
    city: 'City',
    state: 'State',
    zip: 'ZIP',
    phone: 'Phone',
    email: 'Email',
    website: 'Website',
    vat: 'VAT Number',
    registration: 'Company Registration',
    notes: 'Notes',
    whatsapp: 'WhatsApp',
    // Add more known fields as needed
  };
  
  // Render all key/value pairs except excluded ones and name/trading_as (already shown)
  Object.keys(quoteBranchData).forEach((key) => {
    if (excludeKeys.includes(key) || key === 'trading_as' || key === 'name') return;
    const value = quoteBranchData[key];
    if (!value) return;
    const label = prettyLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    doc.text(`${label}: ${value}`, 60, currentY, { width: doc.page.width - 120 });
    currentY += 12;
  });
  
  // Move down past the branch details box
  doc.y = Math.max(doc.y, boxStartY + 80);
  doc.moveDown(1);

  // Add banking details heading
  doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
  doc.text('Banking Details', 50, doc.y);
  doc.font('Helvetica').fontSize(10).fillColor('#333333');
  doc.moveDown(0.5);
  
  // First collect all banking detail lines
  const bankingLines: string[] = [];
  if (bankingDetails && Object.keys(bankingDetails).length > 0) {
    const excludeKeys = ['id', 'created_at', 'updated_at', 'uuid', 'fx_branch'];
    const prettyLabels: Record<string, string> = {
      account_holder: 'Account Holder',
      bank: 'Bank',
      account_number: 'Account Number',
      branch_code: 'Branch Code',
      account_type: 'Account Type',
      reference: 'Reference',
      swift_code: 'SWIFT Code',
      iban: 'IBAN',
      notes: 'Notes',
      // Add more as needed
    };
    Object.keys(bankingDetails).forEach((key) => {
      if (excludeKeys.includes(key)) return;
      const value = bankingDetails[key];
      if (!value) return;
      const label = prettyLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      bankingLines.push(`${label}: ${value}`);
    });
    
    // Ensure we have at least one line
    if (bankingLines.length === 0) {
      bankingLines.push('Please contact us for payment information.');
    }
  } else {
    // Add fallback banking details
    bankingLines.push('Bank: Standard Bank');
    bankingLines.push('Account Type: Business Account');
    bankingLines.push('Reference: Please use your quote number as reference');
    bankingLines.push('Please contact us for complete banking details.');
  }
  
  // Now render all banking details as a single text block with line breaks
  const bankingText = bankingLines.join('\n');
  doc.text(bankingText, 50, doc.y, { width: doc.page.width - 100 });
  
  // Move down a bit
  doc.moveDown(2);

  // ===== ONLINE PAYMENT SECTION =====
  // Add payment status section
  if (isPaid) {
    // Show PAID status
    doc.fontSize(12).fillColor('#28a745').font('Helvetica-Bold');
    doc.text('Payment Status', 50, doc.y);
    doc.font('Helvetica').fontSize(10).fillColor('#333333');
    doc.moveDown(0.5);

    const paymentBoxHeight = 80;
    
    // Check if we need a new page for the payment section
    if (doc.y + paymentBoxHeight > doc.page.height - 50) {
      doc.addPage();
      doc.fontSize(12).fillColor('#28a745').font('Helvetica-Bold');
      doc.text('Payment Status', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      doc.moveDown(0.5);
    }

    const currentPaymentBoxY = doc.y;
    
    // Draw PAID status box with green styling
    doc.rect(50, currentPaymentBoxY, doc.page.width - 100, paymentBoxHeight)
       .fillAndStroke('#e8f5e8', '#28a745');
    
    // Add inner border for professional look
    doc.rect(55, currentPaymentBoxY + 5, doc.page.width - 110, paymentBoxHeight - 10)
       .stroke('#4caf50');
    
    // PAID status header
    doc.fontSize(18).fillColor('#28a745').font('Helvetica-Bold');
    doc.text(' PAYMENT RECEIVED', 60, currentPaymentBoxY + 18, { 
      width: doc.page.width - 120,
      align: 'center'
    });
    
    doc.fontSize(11).fillColor('#555555').font('Helvetica');
    doc.text(`Payment Date: ${new Date().toLocaleDateString()}`, 60, currentPaymentBoxY + 45, { 
      width: doc.page.width - 120,
      align: 'center'
    });
    
    // Move past the payment box
    doc.y = currentPaymentBoxY + paymentBoxHeight + 15;
  } else {
    // Show payment option for unpaid quotes
    doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
    doc.text('Online Payment Option', 50, doc.y);
    doc.font('Helvetica').fontSize(10).fillColor('#333333');
    doc.moveDown(0.5);

    // Create payment button box - larger and more prominent
    const paymentBoxStartY = doc.y;
    const paymentBoxHeight = 120; // Increased height for better visibility
    
    // Check if we need a new page for the payment section
    if (doc.y + paymentBoxHeight > doc.page.height - 50) {
      doc.addPage();
      doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold');
      doc.text('Online Payment Option', 50, doc.y);
      doc.font('Helvetica').fontSize(10).fillColor('#333333');
      doc.moveDown(0.5);
    }

    const currentPaymentBoxY = doc.y;
    
    // Draw main payment box with professional green styling
    doc.rect(50, currentPaymentBoxY, doc.page.width - 100, paymentBoxHeight)
       .fillAndStroke('#f0f8f0', '#2d7a2d');
    
    // Add inner border for professional look
    doc.rect(55, currentPaymentBoxY + 5, doc.page.width - 110, paymentBoxHeight - 10)
       .stroke('#4a934a');
    
    // Payment box header with professional styling
    doc.fontSize(16).fillColor('#2d7a2d').font('Helvetica-Bold');
  doc.text('SECURE ONLINE PAYMENT', 60, currentPaymentBoxY + 18, { 
    width: doc.page.width - 120,
    align: 'center'
  });
  
  doc.fontSize(10).fillColor('#555555').font('Helvetica');
  doc.text('Pay securely with PayFast. All major payment methods accepted.', 60, currentPaymentBoxY + 42, { 
    width: doc.page.width - 120,
    align: 'center'
  });
  
  // Generate payment URL
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const paymentUrl = `${baseUrl}/api/payfast/pay?quoteId=${pdfId}&amount=${finalTotal.toFixed(2)}&customerName=${encodeURIComponent(customerName || 'Customer')}&projectName=${encodeURIComponent(projectName || 'Project')}`;
  
  // Create a prominent clickable button area
  const buttonY = currentPaymentBoxY + 65;
  const buttonHeight = 35;
  const buttonWidth = 300;
  const buttonX = (doc.page.width - buttonWidth) / 2; // Center the button
  
  // Draw professional green button with gradient effect
  doc.rect(buttonX, buttonY, buttonWidth, buttonHeight)
     .fillAndStroke('#28a745', '#1e7e34');
  
  // Add button highlight for 3D effect
  doc.rect(buttonX + 1, buttonY + 1, buttonWidth - 2, 2)
     .fillAndStroke('#4caf50', '#4caf50');
  
  // Add subtle shadow
  doc.rect(buttonX + 3, buttonY + 3, buttonWidth, buttonHeight)
     .stroke('#d4d4d4');
  
  // Button text - professional and clear
  doc.fontSize(13).fillColor('#ffffff').font('Helvetica-Bold');
  doc.text('PAY NOW SECURELY', buttonX, buttonY + 8, { 
    width: buttonWidth,
    align: 'center',
    link: paymentUrl
  });
  
  // Add amount display on button with currency symbol
  doc.fontSize(14).fillColor('#ffffff').font('Helvetica-Bold');
  doc.text(`R ${finalTotal.toFixed(2)}`, buttonX, buttonY + 22, { 
    width: buttonWidth,
    align: 'center',
    link: paymentUrl
  });
  
  // Add professional instruction text below button
  doc.fontSize(9).fillColor('#666666').font('Helvetica');
  doc.text('Click the button above to proceed to secure payment', 60, currentPaymentBoxY + 110, { 
    width: doc.page.width - 120,
    align: 'center'
  });
  
  // Add security badge text
  doc.fontSize(8).fillColor('#28a745').font('Helvetica-Bold');
  doc.text('256-bit SSL Encryption  PCI DSS Compliant', 60, currentPaymentBoxY + 125, { 
    width: doc.page.width - 120,
    align: 'center'
  });
  
  // Move past the payment box
  doc.y = currentPaymentBoxY + paymentBoxHeight + 15;
  doc.moveDown(1);
  }

  // Add a generic footer to the last page
  // First make sure we're near the bottom of the page
  if (doc.y < doc.page.height - 100) {
    doc.y = doc.page.height - 100;
  }
  
  // Add page numbers to all pages - with enhanced error handling and logging
  try {
    // Log the current state of the document before attempting page numbering
    console.log('Starting page numbering process');
    
    // Capture buffered page range - crucial for debugging
    const range = doc.bufferedPageRange();
    console.log('PDF bufferedPageRange():', JSON.stringify(range));
    
    // Skip page numbering if no pages available or invalid range
    if (!range || typeof range !== 'object' || !range.count || range.count <= 0) {
      console.log('Skipping page numbering: No valid pages available');
    } else {
      const totalPages = range.count;
      const startIdx = range.start || 0;
      
      console.log(`Adding page numbers: ${totalPages} pages, starting at index ${startIdx}`);
      
      // Loop through each page using the actual available range
      for (let i = 0; i < totalPages; i++) {
        try {
          const pageIdx = startIdx + i;
          console.log(`Attempting to switch to page ${pageIdx}`);
          
          // Switch to the page and add numbering
          doc.switchToPage(pageIdx);
          
          // Removed page numbering and disclaimer text per user request
          
          console.log(`Successfully added numbering to page ${pageIdx}`);
        } catch (pageError) {
          console.error(`Error processing page ${startIdx + i}:`, pageError);
          // Continue with next page - don't let one page failure stop the process
        }
      }
      
      // Skip page switching - PDFKit doesn't support switchToPage after content
    }
  } catch (error) {
    // Log the error but allow PDF generation to continue
    console.error('Error during page numbering process:', error);
  }
  
  // Finalize PDF
  doc.end();
  
  // We need to wait for the PDF to be fully generated
  return new Promise<{ buffer: any, id: string }>((resolve) => {
    // Wait for the PDF to be fully generated
    doc.on('end', () => {
      // Return the buffer and ID
      const pdfBuffer = Buffer.concat(buffers);
      resolve({
        buffer: pdfBuffer,
        id: pdfId
      });
    });
  });
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
    const fileName = `solution_${pdfResult.id}.pdf`;
    
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
  const buffers: any[] = [];
  doc.on('data', buffers.push.bind(buffers));
  
  // Ensure we start fresh without any page switching
  doc.font('Helvetica');
  
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
     .text('Generated: ' + new Date().toLocaleDateString(), 50, 120, { align: 'right', width: doc.page.width - 100 });

  doc.moveDown(3);

  // Add detailed summary information
  const totalStockPieces = solution.stockPieces.length;
  const totalCutPieces = solution.stockPieces.reduce((sum, sp) => sum + sp.cutPieces.length, 0);

  // Calculate total edging required in mm
  let totalEdging = 0;
  solution.stockPieces.forEach((sp: any) => {
    sp.cutPieces.forEach((cp: any) => {
      // Count edges that need edging (L1, L2, W1, W2)
      const edgingNeeded = [
        cp.edgeL1 ? cp.length : 0,
        cp.edgeL2 ? cp.length : 0,
        cp.edgeW1 ? cp.width : 0,
        cp.edgeW2 ? cp.width : 0
      ].reduce((sum: number, val: number) => sum + val, 0);
      
      totalEdging += edgingNeeded;
    });
  });
  
  // Convert edging to meters and calculate cost
  const EDGING_PRICE_PER_METER = 14; // R14 per meter
  const totalEdgingMeters = totalEdging / 1000;
  const edgingCost = totalEdgingMeters * EDGING_PRICE_PER_METER;

  // Calculate total area and waste
  let totalStockArea = 0;
  let totalCutArea = 0;

  solution.stockPieces.forEach(stockPiece => {
    const stockArea = stockPiece.width * stockPiece.length;
    totalStockArea += stockArea;

    stockPiece.cutPieces.forEach(cutPiece => {
      totalCutArea += cutPiece.width * cutPiece.length;
    });
  });

  const wasteArea = totalStockArea - totalCutArea;
  const wastePercentage = ((wasteArea / totalStockArea) * 100).toFixed(2);

  // Create a detailed summary table
  doc.fontSize(14).text('Optimization Summary', { underline: true });
  doc.moveDown(0.5);

  // Draw summary table
  const summaryStartX = 50;
  const summaryStartY = doc.y;
  const summaryColWidths = [200, 100, 150];
  const summaryRowHeight = 25;

  // Draw table headers
  doc.rect(summaryStartX, summaryStartY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .fillAndStroke('#e0e0e0', '#000000');

  doc.fontSize(10).fillColor('#000000');
  doc.text('Parameter', summaryStartX + 5, summaryStartY + 8, { width: summaryColWidths[0] });
  doc.text('Value', summaryStartX + summaryColWidths[0] + 5, summaryStartY + 8, { width: summaryColWidths[1] });
  doc.text('Details', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, summaryStartY + 8, { width: summaryColWidths[2] });

  // Draw rows
  let currentSummaryY = summaryStartY + summaryRowHeight;

  // Row 1: Stock Pieces
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Stock Pieces Used', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalStockPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total sheets/panels', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 2: Cut Pieces
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Cut Pieces Placed', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${totalCutPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total parts cut', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 3: Total Stock Area
  const unitLabel = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';
  const totalStockAreaConverted = convertUnit(totalStockArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Total Stock Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(totalStockAreaConverted.toString(), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total material area', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 4: Total Cut Area
  const totalCutAreaConverted = convertUnit(totalCutArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Total Cut Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(totalCutAreaConverted.toString(), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total used material', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 5: Waste Area
  const wasteAreaConverted = convertUnit(wasteArea, 0, unit).toFixed(2);

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .fillAndStroke('#fff0f0', '#000000');
  doc.text('Waste Area', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(wasteAreaConverted.toString(), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text(wastePercentage + '% of total material', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 6: Edging Cost
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Edging Cost', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(`${edgingCost}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Total edging cost', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 7: Layout Type
  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Layout Type', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text((layout === 0 ? 'Guillotine' : 'Nested'), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Cutting algorithm used', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
  currentSummaryY += summaryRowHeight;

  // Row 8: Cut Width
  const cutWidthConverted = convertUnit(cutWidth, 0, unit).toFixed(2);
  const unitLabelSingle = unit === 0 ? 'mm' : unit === 1 ? 'in' : 'ft';

  doc.rect(summaryStartX, currentSummaryY, summaryColWidths[0] + summaryColWidths[1] + summaryColWidths[2], summaryRowHeight)
     .stroke();
  doc.text('Cut Width', summaryStartX + 5, currentSummaryY + 8, { width: summaryColWidths[0] });
  doc.text(cutWidthConverted.toString(), summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
  doc.text('Saw blade thickness', summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });

  doc.moveDown(3);

  // CRITICAL FIX: Disable detailed diagrams completely to prevent excessive pages
  const MAX_DETAILED_PAGES = 0; // Completely disabled - only show summary table
  const stockPiecesToShow = 0; // No detailed diagrams
  
  console.log(`📄 PDF Generation: Limiting to ${stockPiecesToShow} of ${solution.stockPieces.length} detailed diagrams`);
  
  // Add comprehensive summary table for ALL stock pieces first
  doc.addPage(); // Start detailed content on new page to prevent overlap
  
  // Title for complete summary
  doc.rect(50, 50, doc.page.width - 100, 40)
     .fillAndStroke('#003366', '#000000');
  
  doc.fontSize(16)
     .fillColor('#FFFFFF')
     .text('Complete Stock Pieces Summary', 50, 60, { align: 'center', width: doc.page.width - 100 });
  
  doc.moveDown(2);
  
  // Create compact table for ALL stock pieces
  const allStockTableStartX = 50;
  const allStockTableStartY = doc.y;
  const allStockColWidths = [50, 70, 70, 80, 80, 100]; // Case, Width, Length, Area, Cut Pieces, Waste
  const allStockRowHeight = 18;
  
  // Draw table header
  doc.rect(allStockTableStartX, allStockTableStartY, allStockColWidths.reduce((a, b) => a + b, 0), allStockRowHeight)
     .fillAndStroke('#e0e0e0', '#000000');
  
  doc.fontSize(9).fillColor('#000000');
  doc.text('Case', allStockTableStartX + 5, allStockTableStartY + 5, { width: allStockColWidths[0] });
  doc.text('Width', allStockTableStartX + allStockColWidths[0] + 5, allStockTableStartY + 5, { width: allStockColWidths[1] });
  doc.text('Length', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + 5, allStockTableStartY + 5, { width: allStockColWidths[2] });
  doc.text('Area', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + 5, allStockTableStartY + 5, { width: allStockColWidths[3] });
  doc.text('Pieces', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + 5, allStockTableStartY + 5, { width: allStockColWidths[4] });
  doc.text('Waste %', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + allStockColWidths[4] + 5, allStockTableStartY + 5, { width: allStockColWidths[5] });
  
  // Draw data rows for ALL stock pieces (compact format)
  let currentRowY = allStockTableStartY + allStockRowHeight;
  const maxRowsPerPage = 35; // Increased rows per page for compact format
  
  solution.stockPieces.forEach((stockPiece, index) => {
    // Add new page if we exceed the row limit
    if (index > 0 && index % maxRowsPerPage === 0) {
      doc.addPage();
      currentRowY = 80; // Reset Y position for new page
      
      // Redraw header on new page
      doc.rect(allStockTableStartX, currentRowY - allStockRowHeight, allStockColWidths.reduce((a, b) => a + b, 0), allStockRowHeight)
         .fillAndStroke('#e0e0e0', '#000000');
      
      doc.fontSize(9).fillColor('#000000');
      doc.text('Case', allStockTableStartX + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[0] });
      doc.text('Width', allStockTableStartX + allStockColWidths[0] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[1] });
      doc.text('Length', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[2] });
      doc.text('Area', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[3] });
      doc.text('Pieces', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[4] });
      doc.text('Waste %', allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + allStockColWidths[4] + 5, currentRowY - allStockRowHeight + 5, { width: allStockColWidths[5] });
    }
    
    // Calculate values for this stock piece
    const stockWidth = convertUnit(stockPiece.width, 0, unit).toFixed(1);
    const stockLength = convertUnit(stockPiece.length, 0, unit).toFixed(1);
    const stockAreaFormatted = (parseFloat(stockWidth) * parseFloat(stockLength)).toFixed(1);
    
    const stockAreaValue = stockPiece.width * stockPiece.length;
    let usedAreaValue = 0;
    stockPiece.cutPieces.forEach(p => {
      usedAreaValue += p.width * p.length;
    });
    const wasteAreaValue = stockAreaValue - usedAreaValue;
    const wastePercentage = ((wasteAreaValue / stockAreaValue) * 100).toFixed(1);
    
    // Draw row
    doc.rect(allStockTableStartX, currentRowY, allStockColWidths.reduce((a, b) => a + b, 0), allStockRowHeight)
       .stroke();
    
    doc.fontSize(8).fillColor('#000000');
    doc.text(`${index + 1}`, allStockTableStartX + 5, currentRowY + 5, { width: allStockColWidths[0] });
    doc.text(`${stockWidth}`, allStockTableStartX + allStockColWidths[0] + 5, currentRowY + 5, { width: allStockColWidths[1] });
    doc.text(`${stockLength}`, allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + 5, currentRowY + 5, { width: allStockColWidths[2] });
    doc.text(`${stockAreaFormatted}`, allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + 5, currentRowY + 5, { width: allStockColWidths[3] });
    doc.text(`${stockPiece.cutPieces.length}`, allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + 5, currentRowY + 5, { width: allStockColWidths[4] });
    doc.text(`${wastePercentage}%`, allStockTableStartX + allStockColWidths[0] + allStockColWidths[1] + allStockColWidths[2] + allStockColWidths[3] + allStockColWidths[4] + 5, currentRowY + 5, { width: allStockColWidths[5] });
    
    currentRowY += allStockRowHeight;
  });
  
  // Detailed diagrams completely disabled to prevent excessive pages
  // All information is available in the summary table above
  
  console.log(`📄 PDF Generation Complete: Summary table only, no detailed diagrams`);
  
  // All detailed diagram code has been completely removed to prevent excessive page generation
  
  // Summary table is now at the beginning of the PDF - no duplicate needed

  // Add simple footer without page switching to avoid buffer errors
  console.log(`Adding simple footer to current page only.`);
  
  try {
    // Add footer with date and basic page info to current page only
    doc.fontSize(8).fillColor('#666666');
    doc.text(
      `HDS Group Cutlist - Generated on ${new Date().toLocaleDateString()}`,
      50,
      doc.page.height - 50,
      { align: 'center', width: doc.page.width - 100 }
    );
      
    console.log('Footer added successfully to current page');
  } catch (error) {
    console.error('Error adding footer:', error);
    // Continue without footer if there's an error
  }
  
  // Finalize PDF
  doc.end();
  
  // Return promise with buffer and ID
  return new Promise<{ buffer: any, id: string }>((resolve) => {
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve({
        buffer: pdfBuffer,
        id: pdfId
      });
    });
  });
};

