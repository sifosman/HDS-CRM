import { supabase } from './config';

/**
 * Save cutlist data to the cutlists table
 */
export async function saveCutlist(cutlistData: any): Promise<any> {
  try {
    // Map the cutlist data to match the Supabase table schema
    const cutlistRecord = {
      id: cutlistData.id || undefined,
      customer_name: cutlistData.customerName || cutlistData.customer_name || null,
      project_name: cutlistData.projectName || cutlistData.project_name || null,
      phone_number: cutlistData.phoneNumber || cutlistData.phone_number || null,
      unit: cutlistData.unit || 'mm',
      ocr_text: cutlistData.ocrText || cutlistData.ocr_text || null,
      cut_pieces: cutlistData.cutPieces || cutlistData.cut_pieces || cutlistData.pieces || [],
      stock_pieces: cutlistData.stockPieces || cutlistData.stock_pieces || [],
      materials: cutlistData.materials || [],
      is_confirmed: cutlistData.isConfirmed || cutlistData.is_confirmed || false,
      created_at: cutlistData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('cutlists')
      .insert([cutlistRecord])
      .select()
      .single();
    
    if (error) {
      console.error('Error saving cutlist:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in saveCutlist:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get cutlist data by ID from the cutlists table
 */
export async function getCutlistById(cutlistId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('cutlists')
      .select('*')
      .eq('id', cutlistId)
      .single();
    
    if (error) {
      console.error('Error fetching cutlist by ID:', error);
      return { success: false, error: error.message };
    }
    
    if (!data) {
      return { success: false, error: 'Cutlist not found' };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in getCutlistById:', error);
    return { success: false, error: error.message };
  }
}
