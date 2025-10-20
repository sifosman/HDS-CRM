"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBranchByTradingAs = getBranchByTradingAs;
exports.getBankingDetailsByBranch = getBankingDetailsByBranch;
exports.getBranchEmailByQuote = getBranchEmailByQuote;
exports.getBestEmailForQuote = getBestEmailForQuote;
const config_1 = require("./config");
/**
 * Get branch by trading_as value from branches table
 */
async function getBranchByTradingAs(tradingAs) {
    try {
        const { data, error } = await config_1.supabase
            .from('branches')
            .select('*')
            .eq('trading_as', tradingAs)
            .single();
        if (error) {
            console.error('Error fetching branch by trading_as:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in getBranchByTradingAs:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Get banking details by fx_branch (match to trading_as of selected branch)
 */
async function getBankingDetailsByBranch(fxBranch) {
    try {
        const { data, error } = await config_1.supabase
            .from('branch_details')
            .select('*')
            .eq('fx_branch', fxBranch)
            .single();
        if (error) {
            console.error('Error fetching banking details by branch:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in getBankingDetailsByBranch:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Get branch email from branch_details table
 */
async function getBranchEmailByQuote(quoteId) {
    try {
        // First get the quote to find the branch
        const { data: quoteData, error: quoteError } = await config_1.supabase
            .from('quotes')
            .select('branch_name')
            .eq('quote_number', quoteId)
            .single();
        if (quoteError || !(quoteData === null || quoteData === void 0 ? void 0 : quoteData.branch_name)) {
            console.error('Error fetching quote for branch email:', quoteError);
            return null;
        }
        // Then get the branch email
        const { data: branchData, error: branchError } = await config_1.supabase
            .from('branch_details')
            .select('email')
            .eq('fx_branch', quoteData.branch_name)
            .single();
        if (branchError || !branchData) {
            console.error('Error fetching branch email:', branchError);
            return null;
        }
        return branchData.email;
    }
    catch (error) {
        console.error('Error in getBranchEmailByQuote:', error);
        return null;
    }
}
/**
 * Get the best email address for a quote (priority: branch email, then customer email)
 */
async function getBestEmailForQuote(quoteId) {
    try {
        // Try branch email first
        const branchEmail = await getBranchEmailByQuote(quoteId);
        if (branchEmail) {
            return branchEmail;
        }
        // Fallback to customer email
        const { data, error } = await config_1.supabase
            .from('quotes')
            .select('customer_email')
            .eq('quote_number', quoteId)
            .single();
        if (error || !data) {
            console.error('Error fetching customer email:', error);
            return null;
        }
        return data.customer_email;
    }
    catch (error) {
        console.error('Error in getBestEmailForQuote:', error);
        return null;
    }
}
