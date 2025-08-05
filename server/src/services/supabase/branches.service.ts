import { supabase } from './config';

/**
 * Get branch by trading_as value from branches table
 */
export async function getBranchByTradingAs(tradingAs: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('*')
      .eq('trading_as', tradingAs)
      .single();
    
    if (error) {
      console.error('Error fetching branch by trading_as:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in getBranchByTradingAs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get banking details by fx_branch (match to trading_as of selected branch)
 */
export async function getBankingDetailsByBranch(fxBranch: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('branch_details')
      .select('*')
      .eq('fx_branch', fxBranch)
      .single();
    
    if (error) {
      console.error('Error fetching banking details by branch:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error('Error in getBankingDetailsByBranch:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get branch email from branch_details table
 */
export async function getBranchEmailByQuote(quoteId: string): Promise<string | null> {
  try {
    // First get the quote to find the branch
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select('branch_name')
      .eq('quote_number', quoteId)
      .single();
    
    if (quoteError || !quoteData?.branch_name) {
      console.error('Error fetching quote for branch email:', quoteError);
      return null;
    }
    
    // Then get the branch email
    const { data: branchData, error: branchError } = await supabase
      .from('branch_details')
      .select('email')
      .eq('fx_branch', quoteData.branch_name)
      .single();
    
    if (branchError || !branchData) {
      console.error('Error fetching branch email:', branchError);
      return null;
    }
    
    return branchData.email;
  } catch (error) {
    console.error('Error in getBranchEmailByQuote:', error);
    return null;
  }
}

/**
 * Get the best email address for a quote (priority: branch email, then customer email)
 */
export async function getBestEmailForQuote(quoteId: string): Promise<string | null> {
  try {
    // Try branch email first
    const branchEmail = await getBranchEmailByQuote(quoteId);
    if (branchEmail) {
      return branchEmail;
    }
    
    // Fallback to customer email
    const { data, error } = await supabase
      .from('quotes')
      .select('customer_email')
      .eq('quote_number', quoteId)
      .single();
    
    if (error || !data) {
      console.error('Error fetching customer email:', error);
      return null;
    }
    
    return data.customer_email;
  } catch (error) {
    console.error('Error in getBestEmailForQuote:', error);
    return null;
  }
}
