"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
class EmailService {
    constructor(config) {
        this.config = config || {
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587'),
            secure: process.env.SMTP_SECURE === 'true',
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
            fromEmail: process.env.FROM_EMAIL || '',
            fromName: process.env.FROM_NAME || 'HDS Group'
        };
        this.transporter = nodemailer_1.default.createTransport({
            host: this.config.host,
            port: this.config.port,
            secure: this.config.secure,
            auth: {
                user: this.config.user,
                pass: this.config.pass
            }
        });
    }
    async sendPaymentConfirmationEmail(data) {
        try {
            const mailOptions = {
                from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
                to: data.customerEmail,
                subject: `New Order - Payment Confirmed for Quote ${data.quoteNumber}`,
                html: this.generatePaymentConfirmationTemplate(data)
            };
            // Note: Using download links instead of attachments for better reliability
            // PDF files will be linked in the email template for branch staff to download
            const result = await this.transporter.sendMail(mailOptions);
            console.log('Payment confirmation email sent:', result.messageId);
            console.log('Email includes download links for PDFs');
        }
        catch (error) {
            console.error('Error sending payment confirmation email:', error);
            throw error;
        }
    }
    generatePaymentConfirmationTemplate(data) {
        const optimization = data.optimizationDetails;
        return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #28a745; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="margin: 0;">🎉 New Order Received!</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Payment has been confirmed</p>
        </div>
        
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #856404;">⚠️ ACTION REQUIRED</h3>
          <p style="margin-bottom: 0; color: #856404;">A customer has paid for their quote. Please process this order and contact the customer to arrange production/delivery.</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Customer Information</h3>
          <p><strong>Name:</strong> ${data.customerName}</p>
          ${data.customerPhone ? `<p><strong>Contact Number:</strong> ${data.customerPhone}</p>` : ''}
          <p><strong>Email:</strong> ${data.customerEmail}</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Details</h3>
          <p><strong>Quote Number:</strong> ${data.quoteNumber}</p>
          <p><strong>Amount Paid:</strong> R${data.amount.toFixed(2)}</p>
          <p><strong>Payment Status:</strong> <span style="color: #28a745; font-weight: bold;">CONFIRMED</span></p>
        </div>

        <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0c5460;">Accepted Quotation</h3>
          ${optimization.totalBoards ? `<p><strong>Total Boards:</strong> ${optimization.totalBoards}</p>` : ''}
          ${optimization.totalLength ? `<p><strong>Total Length:</strong> ${optimization.totalLength}mm</p>` : ''}
          ${optimization.wastage ? `<p><strong>Wastage:</strong> ${optimization.wastage}%</p>` : ''}
          ${optimization.cutlistUrl ? `<p><strong>Cutlist Link:</strong> <a href="${optimization.cutlistUrl}" style="color: #007bff;">View Online</a></p>` : ''}
        </div>

        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #155724;">📎 Download Documents</h3>
          <p style="color: #155724; margin-bottom: 10px;">Click the links below to download the required documents:</p>
          <div style="margin: 15px 0;">
            ${data.invoicePdfUrl ? `
              <div style="margin: 10px 0;">
                <a href="${data.invoicePdfUrl}" style="display: inline-block; background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  📄 Download Invoice PDF
                </a>
              </div>
            ` : ''}
            ${data.cutlistPdfUrl ? `
              <div style="margin: 10px 0;">
                <a href="${data.cutlistPdfUrl}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  📋 Download Cutlist PDF
                </a>
              </div>
            ` : ''}
            ${!data.invoicePdfUrl && !data.cutlistPdfUrl ? '<p style="color: #856404;">Documents will be available shortly.</p>' : ''}
          </div>
        </div>
        
        <div style="border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 30px; color: #6c757d; font-size: 14px;">
          <p><strong>Next Steps:</strong></p>
          <ol style="margin: 10px 0;">
            <li>Review the attached cutlist and invoice</li>
            <li>Contact the customer to confirm order details</li>
            <li>Schedule production and delivery</li>
            <li>Update the customer on progress</li>
          </ol>
          <p><strong>HDS Group - Order Management System</strong></p>
        </div>
      </div>
    `;
    }
    async testConnection() {
        try {
            await this.transporter.verify();
            console.log('Email service connection verified');
            return true;
        }
        catch (error) {
            console.error('Email service connection failed:', error);
            return false;
        }
    }
}
exports.EmailService = EmailService;
exports.default = EmailService;
