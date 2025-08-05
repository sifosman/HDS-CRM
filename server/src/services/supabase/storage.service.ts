import { supabase } from './config';

/**
 * Upload a PDF buffer to the Supabase hdsquotes bucket
 * @param fileBuffer The PDF file buffer
 * @param fileName The name for the uploaded file
 * @returns Promise with the public URL or an error
 */
export async function uploadQuotePdf(fileBuffer: Buffer, fileName: string): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('hdsquotes')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('Error uploading quote PDF:', error);
      return { success: false, error: error.message };
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('hdsquotes')
      .getPublicUrl(fileName);

    return { 
      success: true, 
      publicUrl: publicUrlData.publicUrl 
    };
  } catch (error: any) {
    console.error('Error in uploadQuotePdf:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upload invoice PDF to Supabase storage
 * @param fileBuffer The PDF file buffer
 * @param fileName The name for the uploaded file
 * @returns Promise with the public URL or an error
 */
export async function uploadInvoicePdf(fileBuffer: Buffer, fileName: string): Promise<{ success: boolean; error?: string; publicUrl?: string }> {
  try {
    const { data, error } = await supabase.storage
      .from('invoices')
      .upload(fileName, fileBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('Error uploading invoice PDF:', error);
      return { success: false, error: error.message };
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from('invoices')
      .getPublicUrl(fileName);

    return { 
      success: true, 
      publicUrl: publicUrlData.publicUrl 
    };
  } catch (error: any) {
    console.error('Error in uploadInvoicePdf:', error);
    return { success: false, error: error.message };
  }
}
