"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.checkConnection = checkConnection;
const supabase_js_1 = require("@supabase/supabase-js");
// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
/**
 * Test connection to Supabase
 */
async function checkConnection() {
    try {
        const { data, error } = await exports.supabase.from('products').select('count', { count: 'exact', head: true });
        if (error) {
            console.error('Supabase connection error:', error);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Error checking Supabase connection:', error);
        return false;
    }
}
