"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductDetails = getProductDetails;
exports.getProductPricing = getProductPricing;
exports.getProductPricingByDescription = getProductPricingByDescription;
exports.getMaterialOptions = getMaterialOptions;
exports.getProductDescriptions = getProductDescriptions;
const config_1 = require("./config");
/**
 * Get product details by product code
 */
async function getProductDetails(productCode) {
    try {
        const { data, error } = await config_1.supabase
            .from('products')
            .select('*')
            .eq('product_code', productCode)
            .single();
        if (error) {
            console.error(`Error fetching product details for ${productCode}:`, error);
            return { success: false, error: error.message };
        }
        if (!data) {
            return { success: false, error: 'Product not found' };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error(`Error in getProductDetails for ${productCode}:`, error);
        return { success: false, error: error.message };
    }
}
/**
 * Get product pricing by product code (legacy method)
 */
async function getProductPricing(productCode) {
    try {
        const { data, error } = await config_1.supabase
            .from('products')
            .select('price, unit')
            .eq('product_code', productCode)
            .single();
        if (error) {
            console.error(`Error fetching product pricing for ${productCode}:`, error);
            return { success: false, error: error.message };
        }
        if (!data) {
            return { success: false, error: 'Product pricing not found' };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error(`Error in getProductPricing for ${productCode}:`, error);
        return { success: false, error: error.message };
    }
}
/**
 * Get product pricing by description from hds_prices table
 */
async function getProductPricingByDescription(description, includeSizes = false) {
    try {
        // Clean and normalize the description for better matching
        const cleanDescription = description.trim().toLowerCase();
        // First try exact match (case insensitive)
        let { data, error } = await config_1.supabase
            .from('hds_prices')
            .select('description, price, sizes, unit')
            .ilike('description', cleanDescription)
            .single();
        if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
            console.error(`Error fetching product pricing for "${description}":`, error);
            return { success: false, error: error.message };
        }
        // If no exact match, try partial matching
        if (!data) {
            const { data: partialData, error: partialError } = await config_1.supabase
                .from('hds_prices')
                .select('description, price, sizes, unit')
                .ilike('description', `%${cleanDescription}%`)
                .limit(1)
                .single();
            if (partialError && partialError.code !== 'PGRST116') {
                console.error(`Error in partial matching for "${description}":`, partialError);
                return { success: false, error: partialError.message };
            }
            data = partialData;
        }
        if (!data) {
            return { success: false, error: 'Product pricing not found' };
        }
        const result = {
            description: data.description,
            price: data.price,
            sizes: includeSizes ? data.sizes : null,
            unit: data.unit
        };
        return { success: true, data: result };
    }
    catch (error) {
        console.error(`Error in getProductPricingByDescription for "${description}":`, error);
        return { success: false, error: error.message };
    }
}
/**
 * Fetch material options for cascading dropdowns from the hds_prices table
 */
async function getMaterialOptions() {
    try {
        const { data, error } = await config_1.supabase
            .from('hds_prices')
            .select('description')
            .order('description');
        if (error) {
            console.error('Error fetching material options:', error);
            return { success: false, error: error.message };
        }
        return { success: true, data };
    }
    catch (error) {
        console.error('Error in getMaterialOptions:', error);
        return { success: false, error: error.message };
    }
}
/**
 * Get all product descriptions
 */
async function getProductDescriptions() {
    try {
        const { data, error } = await config_1.supabase
            .from('hds_prices')
            .select('description')
            .order('description');
        if (error) {
            console.error('Error fetching product descriptions:', error);
            return { success: false, error: error.message };
        }
        // Extract just the description strings
        const descriptions = (data === null || data === void 0 ? void 0 : data.map(item => item.description)) || [];
        return { success: true, data: descriptions };
    }
    catch (error) {
        console.error('Error in getProductDescriptions:', error);
        return { success: false, error: error.message };
    }
}
