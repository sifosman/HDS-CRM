import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export interface PaymentConfirmationData {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  quoteNumber: string;
  amount: number;
  quotePdfUrl?: string;
  invoicePdfUrl?: string;
  cutlistPdfUrl?: string;
  optimizationDetails: {
    totalBoards?: number;
    totalLength?: number;
    wastage?: number;
    cutlistUrl?: string;
  };
}

export class EmailService {
  private transporter;
  private config: EmailConfig;

  constructor(config?: EmailConfig) {
    this.config = config || {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      fromEmail: process.env.FROM_EMAIL || '',
      fromName: process.env.FROM_NAME || 'HDS Group'
    };

    // Default fromEmail to SMTP user if not explicitly provided
    if (!this.config.fromEmail && this.config.user) {
      this.config.fromEmail = this.config.user;
    }

    // Log effective email config (excluding password) for diagnostics
    console.log('[EmailService] SMTP config:', {
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      user: this.config.user ? '(set)' : '(empty)',
      fromEmail: this.config.fromEmail,
      fromName: this.config.fromName
    });

    // Use stricter defaults: port 465 => secure TLS; port 587 => STARTTLS
    const useSecure = this.config.secure || this.config.port === 465;
    const isServerless = !!(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL);
    const requireTls = process.env.SMTP_REQUIRE_TLS ? process.env.SMTP_REQUIRE_TLS === 'true' : !useSecure;
    const enablePool = process.env.SMTP_POOL === 'true' && !isServerless;

    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: useSecure,
      auth: {
        user: this.config.user,
        pass: this.config.pass
      },
      // Connection pool can improve reliability with some SMTP servers
      pool: enablePool,
      maxConnections: 2,
      maxMessages: 50,
      // Optional verbose debugging
      logger: process.env.SMTP_DEBUG === 'true',
      debug: process.env.SMTP_DEBUG === 'true',
      // Enforce STARTTLS when not on implicit TLS
      requireTLS: requireTls,
      // Allow disabling STARTTLS negotiation entirely if provider expects plain 587
      ignoreTLS: process.env.SMTP_IGNORE_TLS === 'true',
      // Helpful timeouts to avoid hanging sockets
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 30000,
      // Some hosted SMTPs present non-standard cert chains
      tls: {
        // Keep strict by default; if you face cert issues, set SMTP_TLS_INSECURE=true
        rejectUnauthorized: process.env.SMTP_TLS_INSECURE === 'true' ? false : true
      }
    } as any);
  }

  async sendPaymentConfirmationEmail(data: PaymentConfirmationData): Promise<void> {
    try {
      // Verify connection before sending to catch networking/cert issues early
      try {
        await this.transporter.verify();
        console.log('[EmailService] SMTP verify succeeded');
      } catch (verr) {
        console.warn('[EmailService] SMTP verify failed, attempting to send anyway:', verr);
      }
      const mailOptions: any = {
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: data.customerEmail,
        subject: `New Order - Payment Confirmed for Quote ${data.quoteNumber}`,
        html: this.generatePaymentConfirmationTemplate(data)
      };

      // Note: Using download links instead of attachments for better reliability
      // PDF files will be linked in the email template for branch staff to download

      // Retry transient errors once
      const isTransient = (err: any) => {
        const msg = (err && (err.code || err.message || '')) + '';
        return /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EPIPE|Unexpected socket close/i.test(msg);
      };
      let attempt = 0;
      const maxAttempts = 2;
      while (true) {
        try {
          attempt++;
          const result = await this.transporter.sendMail(mailOptions);
          console.log('Payment confirmation email sent:', result.messageId);
          console.log('Email includes download links for PDFs');
          break;
        } catch (sendErr) {
          console.warn(`[EmailService] send attempt ${attempt} failed:`, sendErr);
          if (attempt >= maxAttempts || !isTransient(sendErr)) {
            throw sendErr;
          }
          // backoff
          await new Promise(res => setTimeout(res, 1500));
        }
      }
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      throw error;
    }
  }

  private generatePaymentConfirmationTemplate(data: PaymentConfirmationData): string {
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
          ${optimization.cutlistUrl ? `<p><strong>Quote Link:</strong> <a href="${optimization.cutlistUrl}" style="color: #007bff;">View Online</a></p>` : ''}
        </div>

        <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #155724;">📎 Download Documents</h3>
          <p style="color: #155724; margin-bottom: 10px;">Click the links below to download the required documents:</p>
          <div style="margin: 15px 0;">
            ${data.quotePdfUrl ? `
              <div style="margin: 10px 0;">
                <a href="${data.quotePdfUrl}" style="display: inline-block; background: #fd7e14; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                  📝 Download Quote PDF
                </a>
              </div>
            ` : ''}
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
            ${!data.quotePdfUrl && !data.invoicePdfUrl && !data.cutlistPdfUrl ? '<p style="color: #856404;">Documents will be available shortly.</p>' : ''}
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

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service connection verified');
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

export default EmailService;
