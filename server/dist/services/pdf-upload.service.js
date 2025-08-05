"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAndUploadOptimizationPdf = void 0;
const optimizer_service_1 = require("./optimizer.service");
/**
 * Generate PDF with optimization solution and upload to Supabase storage
 * @param solution The optimization solution
 * @param unit Unit of measurement (0 = mm, 1 = inches, 2 = feet)
 * @param cutWidth Saw blade thickness
 * @param layout Layout algorithm type
 * @returns Promise with the public URL and ID of the uploaded PDF
 */
const generateAndUploadOptimizationPdf = async (solution, unit, cutWidth = 3, layout = 0) => {
    try {
        // Generate PDF buffer using existing generatePdfWithBuffer function
        const pdfResult = await (0, optimizer_service_1.generatePdfWithBuffer)(solution, unit, cutWidth, layout);
        // Create filename using the PDF ID
        const fileName = `solution_${pdfResult.id}.pdf`;
        // Import Supabase service dynamically to avoid circular dependencies
        const SupabaseService = (await Promise.resolve().then(() => __importStar(require('./supabase.service')))).default;
        // Upload to Supabase cutlists bucket
        const uploadResult = await SupabaseService.uploadCutlistPdf(pdfResult.buffer, fileName);
        if (uploadResult.success && uploadResult.publicUrl) {
            return {
                success: true,
                publicUrl: uploadResult.publicUrl,
                pdfId: pdfResult.id
            };
        }
        else {
            return {
                success: false,
                error: uploadResult.error || 'Failed to upload PDF to storage'
            };
        }
    }
    catch (error) {
        console.error('Error generating and uploading optimization PDF:', error);
        return { success: false, error: error.message || 'Unknown error occurred' };
    }
};
exports.generateAndUploadOptimizationPdf = generateAndUploadOptimizationPdf;
