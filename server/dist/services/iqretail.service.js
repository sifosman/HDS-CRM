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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IQRetailService = void 0;
const axios_1 = __importDefault(require("axios"));
const https = __importStar(require("https"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
/**
 * IQ Retail API Service
 *
 * This service handles all interactions with the IQ Retail API, including:
 * - Authentication
 * - Product/Stock lookup
 * - Pricing information retrieval
 * - Quote generation
 * - Invoice creation
 * - Order status updates
 */
class IQRetailService {
    constructor() {
        // Read configuration from environment variables
        this.baseUrl = process.env.IQRETAIL_API_URL || 'https://qa1.iqsoftware.co.za:8090/IQRetailRestAPI/v1';
        this.username = process.env.IQRETAIL_USERNAME || '';
        this.password = process.env.IQRETAIL_PASSWORD || '';
        this.companyNumber = process.env.IQRETAIL_COMPANY_NUMBER || '001';
        this.terminalNumber = process.env.IQRETAIL_TERMINAL_NUMBER || '1';
        // Initialize axios client with SSL/TLS configuration
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            httpsAgent: new https.Agent({
                rejectUnauthorized: process.env.NODE_ENV === 'production' // Only verify SSL in production
            }),
            timeout: 10000, // 10 seconds timeout
            headers: {
                'Content-Type': 'application/xml',
                'Accept': 'application/xml'
            }
        });
    }
    /**
     * Generate standard XML request header with authentication info
     */
    generateRequestHeader() {
        return `<?xml version="1.0" encoding="Windows-1252"?>
    <IQ_API>
      <IQ_Company_Number>${this.companyNumber}</IQ_Company_Number>
      <IQ_Terminal_Number>${this.terminalNumber}</IQ_Terminal_Number>
      <IQ_User_Number>${this.username}</IQ_User_Number>
      <IQ_User_Password>${this.password}</IQ_User_Password>
      <IQ_Partner_Passphrase></IQ_Partner_Passphrase>`;
    }
    /**
     * Generate XML closing tags
     */
    generateRequestFooter() {
        return `</IQ_API>`;
    }
    /**
     * Check connection to IQ Retail API
     * @returns Promise resolving to boolean indicating if connection is successful
     */
    async checkConnection() {
        try {
            // Simple request to check if API is accessible
            const xml = `${this.generateRequestHeader()}${this.generateRequestFooter()}`;
            const response = await this.client.post('/IQ_API_Test_Int', xml);
            return response.status === 200;
        }
        catch (error) {
            console.error('IQ Retail API connection error:', error);
            return false;
        }
    }
    /**
     * Look up stock/product information by code
     * @param stockCode Product/stock code to look up
     * @returns Promise resolving to product information
     */
    async getStockAttributes(stockCode) {
        try {
            const xml = `${this.generateRequestHeader()}
      <IQ_API_Request_Stock_Attributes>
        <Stock_Code>${stockCode}</Stock_Code>
      </IQ_API_Request_Stock_Attributes>
      ${this.generateRequestFooter()}`;
            const response = await this.client.post('/Stock_Attributes', xml);
            // Parse response XML and return as JSON
            // In a real implementation, you would use an XML parser here
            return this.parseResponse(response);
        }
        catch (error) {
            console.error('Error fetching stock attributes:', error);
            throw new Error('Failed to fetch stock information from IQ Retail');
        }
    }
    /**
     * Get pricing for a specific product
     * @param stockCode Product/stock code
     * @returns Promise resolving to product pricing information
     */
    async getStockPricing(stockCode) {
        try {
            const xml = `${this.generateRequestHeader()}
      <IQ_API_Request_Stock_ActiveSellingPrice>
        <Stock_Code>${stockCode}</Stock_Code>
      </IQ_API_Request_Stock_ActiveSellingPrice>
      ${this.generateRequestFooter()}`;
            const response = await this.client.post('/Stock_ActiveSellingPrice', xml);
            return this.parseResponse(response);
        }
        catch (error) {
            console.error('Error fetching stock pricing:', error);
            throw new Error('Failed to fetch product pricing from IQ Retail');
        }
    }
    /**
     * Get contract pricing for a specific product
     * @param stockCode Product/stock code
     * @param accountCode Optional account code for specific pricing
     * @returns Promise resolving to product contract pricing information
     */
    async getContractPricing(stockCode, accountCode) {
        try {
            let accountXml = '';
            if (accountCode) {
                accountXml = `<Account_Code>${accountCode}</Account_Code>`;
            }
            const xml = `${this.generateRequestHeader()}
      <IQ_API_Request_Stock_ContractPricing>
        <Stock_Code>${stockCode}</Stock_Code>
        ${accountXml}
      </IQ_API_Request_Stock_ContractPricing>
      ${this.generateRequestFooter()}`;
            const response = await this.client.post('/Stock_ContractPricing', xml);
            return this.parseResponse(response);
        }
        catch (error) {
            console.error('Error fetching contract pricing:', error);
            throw new Error('Failed to fetch contract pricing from IQ Retail');
        }
    }
    /**
     * Create a quote in IQ Retail
     * @param quoteData Quote data including product info and customer details
     * @returns Promise resolving to created quote information
     */
    async createQuote(quoteData) {
        try {
            // Build XML for quote creation based on provided data
            const xml = this.buildQuoteXml(quoteData);
            const response = await this.client.post('/Document_Quote', xml);
            return this.parseResponse(response);
        }
        catch (error) {
            console.error('Error creating quote:', error);
            throw new Error('Failed to create quote in IQ Retail');
        }
    }
    /**
     * Create a sales order from quote data
     * @param orderData Sales order data (converted from quote)
     * @returns Promise resolving to created sales order information
     */
    async createSalesOrder(orderData) {
        try {
            const xml = this.buildSalesOrderXml(orderData);
            const response = await this.client.post('/Document_Sales_Order', xml);
            return this.parseResponse(response);
        }
        catch (error) {
            console.error('Error creating sales order:', error);
            throw new Error('Failed to create sales order in IQ Retail');
        }
    }
    /**
     * Generate an invoice from a sales order
     * @param invoiceData Invoice data including order reference
     * @returns Promise resolving to created invoice information
     */
    async createInvoice(invoiceData) {
        try {
            const xml = this.buildInvoiceXml(invoiceData);
            const response = await this.client.post('/Document_Invoice', xml);
            return this.parseResponse(response);
        }
        catch (error) {
            console.error('Error creating invoice:', error);
            throw new Error('Failed to create invoice in IQ Retail');
        }
    }
    /**
     * Parse XML response to JSON (simplified implementation)
     * In a real-world scenario, you would use a proper XML parser
     */
    parseResponse(response) {
        // This is a simplified implementation
        // In a real app, use an XML parser library like xml2js
        const result = {
            success: response.status === 200,
            data: response.data
            // In a real implementation, this would parse the XML to a proper JSON structure
        };
        return result;
    }
    /**
     * Build XML for quote creation
     * @param quoteData Quote data
     * @returns XML string for quote submission
     */
    buildQuoteXml(quoteData) {
        // Extract required fields from quoteData
        const { customerName = '', customerAddress = '', customerTelephone = '', customerEmail = '', items = [], discountPercentage = 0, discountAmount = 0, total = 0 } = quoteData;
        // Build items XML
        let itemsXml = '';
        items.forEach((item) => {
            itemsXml += `
        <Line_Item>
          <Stock_Code>${item.stockCode}</Stock_Code>
          <Description>${item.description}</Description>
          <Quantity>${item.quantity}</Quantity>
          <Price_Exclusive>${item.priceExclusive}</Price_Exclusive>
          <Line_Total>${item.lineTotal}</Line_Total>
        </Line_Item>`;
        });
        return `${this.generateRequestHeader()}
    <IQ_API_Request_Document_Quote>
      <IQ_Result_Data>
        <Company_Name>${customerName}</Company_Name>
        <Company_Address1>${customerAddress}</Company_Address1>
        <Company_Telephone1>${customerTelephone}</Company_Telephone1>
        <Company_Email>${customerEmail}</Company_Email>
        <Discount_Percentage>${discountPercentage}</Discount_Percentage>
        <Discount_Amount>${discountAmount}</Discount_Amount>
        <Document_Total>${total}</Document_Total>
        <Line_Items>${itemsXml}</Line_Items>
      </IQ_Result_Data>
    </IQ_API_Request_Document_Quote>
    ${this.generateRequestFooter()}`;
    }
    /**
     * Build XML for sales order creation
     * @param orderData Sales order data
     * @returns XML string for sales order submission
     */
    buildSalesOrderXml(orderData) {
        // Similar structure to quote XML but with sales order specific fields
        // Implementation would be similar to buildQuoteXml
        return `${this.generateRequestHeader()}
    <IQ_API_Submit_Document_Sales_Order>
      <!-- Sales order specific fields would go here -->
    </IQ_API_Submit_Document_Sales_Order>
    ${this.generateRequestFooter()}`;
    }
    /**
     * Build XML for invoice creation
     * @param invoiceData Invoice data
     * @returns XML string for invoice submission
     */
    buildInvoiceXml(invoiceData) {
        // Similar structure to sales order XML but with invoice specific fields
        // Implementation would be similar to buildQuoteXml
        return `${this.generateRequestHeader()}
    <IQ_API_Submit_Document_Invoice>
      <!-- Invoice specific fields would go here -->
    </IQ_API_Submit_Document_Invoice>
    ${this.generateRequestFooter()}`;
    }
}
exports.IQRetailService = IQRetailService;
exports.default = new IQRetailService();
