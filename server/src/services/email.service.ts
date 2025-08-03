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
  quoteNumber: string;
  amount: number;
  invoicePath: string;
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

    this.transporter = nodemailer.createTransporter({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.user,
        pass: this.config.pass
      }
    });
  }

  async sendPaymentConfirmationEmail(data: PaymentConfirmationData): Promise<void> {
    try {
      // Verify file exists
      if (!fs.existsSync(data.invoicePath)) {
        throw new Error(`Invoice file not found: ${data.invoicePath}`);
      }

      const mailOptions = {
        from: `"${this.config.fromName}" <${this.config.fromEmail}>`,
        to: data.customerEmail,
        subject: `Payment Confirmed - Invoice ${data.quoteNumber}`,
        html: this.generatePaymentConfirmationTemplate(data),
        attachments: [{
          filename: `invoice-${data.quoteNumber}.pdf`,
          path: data.invoicePath,
          contentType: 'application/pdf'
        }]
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Payment confirmation email sent:', result.messageId);
    } catch (error) {
      console.error('Error sending payment confirmation email:', error);
      throw error;
    }
  }

  private generatePaymentConfirmationTemplate(data: PaymentConfirmationData): string {
    const optimization = data.optimizationDetails;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #28a745; margin: 0;">Payment Confirmed!</h2>
        </div>
        
        <p>Dear ${data.customerName},</p>
        
        <p>Your payment of <strong>R${data.amount.toFixed(2)}</strong> has been successfully processed.</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Payment Details</h3>
          <p><strong>Quote Number:</strong> ${data.quoteNumber}</p>
          <p><strong>Amount Paid:</strong> R${data.amount.toFixed(2)}</p>
        </div>

        <div style="background: #e7f3ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #0c5460;">Board Optimization Summary</h3>
          ${optimization.totalBoards ? `<p><strong>Total Boards:</strong> ${optimization.totalBoards}</p>` : ''}
          ${optimization.totalLength ? `<p><strong>Total Length:</strong> ${optimization.totalLength}mm</p>` : ''}
          ${optimization.wastage ? `<p><strong>Wastage:</strong> ${optimization.wastage}%</p>` : ''}
          ${optimization.cutlistUrl ? `<p><strong>Cutlist Link:</strong> <a href="${optimization.cutlistUrl}" style="color: #007bff;">View Online</a></p>` : ''}
        </div>

        <p>Your detailed invoice is attached to this email.</p>
        
        <div style="border-top: 1px solid #dee2e6; padding-top: 15px; margin-top: 30px; color: #6c757d; font-size: 14px;">
          <p>Thank you for your business!</p>
          <p><strong>HDS Group</strong></p>
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
