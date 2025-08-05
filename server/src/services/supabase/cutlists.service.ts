import { supabase } from './config';

/**
 * Save cutlist data to the cutlists table
 */
export async function saveCutlist(cutlistData: any): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('cutlists')
      .insert([{
        id: cutlistData.id,
        filename: cutlistData.filename,
        pieces: cutlistData.pieces,
        total_pieces: cutlistData.total_pieces,
        materials_used: cutlistData.materials_used,
        created_at: cutlistData.created_at || new Date().toISOString(),
        status: cutlistData.status || 'pending'
      }])
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
