"use strict";
// Patch file for optimizer.service.ts encoding errors
// This file contains fixes for the specific template literal errors
text(`Generated: ${new Date().toLocaleDateString()}`, 50, 120, { align: 'right', width: doc.page.width - 100 });
// Fix for line 2086
// Original: doc.text(${totalStockPieces}, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fixed version:
doc.text(`${totalStockPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fix for line 2094
// Original: doc.text(${totalCutPieces}, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fixed version:
doc.text(`${totalCutPieces}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fix for line 2105
// Original: doc.text(${totalStockAreaConverted} , summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fixed version:
doc.text(`${totalStockAreaConverted}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fix for line 2115
// Original: doc.text(${totalCutAreaConverted} , summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fixed version:
doc.text(`${totalCutAreaConverted}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fix for line 2125-2126
// Original: doc.text(${wasteAreaConverted} , summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Original: doc.text(${wastePercentage}% of total material, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
// Fixed version:
doc.text(`${wasteAreaConverted}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
doc.text(`${wastePercentage}% of total material`, summaryStartX + summaryColWidths[0] + summaryColWidths[1] + 5, currentSummaryY + 8, { width: summaryColWidths[2] });
// Fix for line 2141
// Original: doc.text(${layout === 0 ? 'Guillotine' : 'Nested'}, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fixed version:
doc.text(`${layout === 0 ? 'Guillotine' : 'Nested'}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fix for line 2152
// Original: doc.text(${cutWidthConverted} , summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fixed version:
doc.text(`${cutWidthConverted}`, summaryStartX + summaryColWidths[0] + 5, currentSummaryY + 8, { width: summaryColWidths[1] });
// Fix for line 2166
// Original: doc.text(Case  - Stock Piece, { underline: true });
// Fixed version:
doc.text(`Case - Stock Piece`, { underline: true });
// Fix for line 2175
// Original: doc.text(Dimensions:  �  );
// Fixed version:
doc.text(`Dimensions: ${dimensions}`);
