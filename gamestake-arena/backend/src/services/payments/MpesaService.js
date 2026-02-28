// src/services/payments/MpesaService.js
const axios = require('axios');
const crypto = require('crypto');
const logger = require('../../utils/logger');

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortCode = process.env.MPESA_SHORTCODE;
    this.callbackUrl = process.env.MPESA_CALLBACK_URL;
    this.baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
  }

  /**
   * Generate OAuth token
   */
  async generateToken() {
    const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
    
    try {
      const response = await axios.get(
        `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            Authorization: `Basic ${auth}`
          }
        }
      );
      
      return response.data.access_token;
    } catch (error) {
      logger.error('M-Pesa token generation failed:', error);
      throw new Error('Failed to generate M-Pesa token');
    }
  }

  /**
   * Initiate STK Push
   */
  async stkPush(phoneNumber, amount, accountReference, transactionDesc) {
    const token = await this.generateToken();
    const timestamp = this.getTimestamp();
    const password = this.generatePassword(timestamp);

    try {
      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber,
          PartyB: this.shortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: this.callbackUrl,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      return {
        success: true,
        merchantRequestId: response.data.MerchantRequestID,
        checkoutRequestId: response.data.CheckoutRequestID,
        responseCode: response.data.ResponseCode,
        responseDescription: response.data.ResponseDescription
      };
    } catch (error) {
      logger.error('M-Pesa STK push failed:', error);
      throw new Error('STK push initiation failed');
    }
  }

  /**
   * Handle payment callback
   */
  async handleCallback(callbackData) {
    try {
      const { Body } = callbackData;
      
      if (Body.stkCallback.ResultCode === 0) {
        // Payment successful
        const metadata = Body.stkCallback.CallbackMetadata;
        
        const amount = metadata.Item.find(item => item.Name === 'Amount').Value;
        const mpesaReceipt = metadata.Item.find(item => item.Name === 'MpesaReceiptNumber').Value;
        const phoneNumber = metadata.Item.find(item => item.Name === 'PhoneNumber').Value;

        return {
          success: true,
          amount,
          receiptNumber: mpesaReceipt,
          phoneNumber,
          checkoutRequestId: Body.stkCallback.CheckoutRequestID
        };
      } else {
        // Payment failed
        return {
          success: false,
          resultCode: Body.stkCallback.ResultCode,
          resultDesc: Body.stkCallback.ResultDesc
        };
      }
    } catch (error) {
      logger.error('M-Pesa callback processing failed:', error);
      throw error;
    }
  }

  /**
   * Generate password for STK push
   */
  generatePassword(timestamp) {
    const str = this.shortCode + this.passkey + timestamp;
    return Buffer.from(str).toString('base64');
  }

  /**
   * Get current timestamp in required format
   */
  getTimestamp() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}${month}${day}${hour}${minute}${second}`;
  }
}

module.exports = new MpesaService();