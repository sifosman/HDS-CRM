import { generatePdfWithBuffer } from './optimizer.service';
import SupabaseService from './supabase.service';

/**
 * Generate PDF with optimization solution and upload to Supabase storage
 * @param solution The optimization solution
 * @param unit Unit of measurement (0 = mm, 1 = inches, 2 = feet)
 * @param cutWidth Saw blade thickness
 * @param layout Layout algorithm type
 * @returns Promise with the public URL and ID of the uploaded PDF
 */
export const generateAndUploadOptimizationPdf = async (
  solution: any,
  unit: number,
  cutWidth: number = 3,
  layout: number = 0
): Promise<{ success: boolean; publicUrl?: string; pdfId?: string; error?: string }> => {
  try {
    // Generate PDF buffer using existing generatePdfWithBuffer function
    const pdfResult = await generatePdfWithBuffer(solution, unit, cutWidth, layout);
    
    // Create filename using the PDF ID
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
    return { success: false, error: error.message || 'Unknown error occurred' };
  }
};
