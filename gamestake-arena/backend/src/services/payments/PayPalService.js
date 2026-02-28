// src/services/payments/PayPalService.js
const paypal = require('@paypal/checkout-server-sdk');
const logger = require('../../utils/logger');

class PayPalService {
  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.environment = process.env.PAYPAL_MODE === 'live'
      ? new paypal.core.LiveEnvironment(this.clientId, this.clientSecret)
      : new paypal.core.SandboxEnvironment(this.clientId, this.clientSecret);
    this.client = new paypal.core.PayPalHttpClient(this.environment);
  }

  /**
   * Create a PayPal order
   */
  async createOrder(amount, currency = 'USD', reference) {
    const request = new paypal.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: currency,
          value: amount.toString()
        },
        reference_id: reference
      }]
    });

    try {
      const response = await this.client.execute(request);
      return {
        success: true,
        orderId: response.result.id,
        status: response.result.status,
        links: response.result.links
      };
    } catch (error) {
      logger.error('PayPal order creation failed:', error);
      throw new Error('Failed to create PayPal order');
    }
  }

  /**
   * Capture a PayPal order
   */
  async captureOrder(orderId) {
    const request = new paypal.orders.OrdersCaptureRequest(orderId);
    request.requestBody({});

    try {
      const response = await this.client.execute(request);
      
      if (response.result.status === 'COMPLETED') {
        const capture = response.result.purchase_units[0].payments.captures[0];
        
        return {
          success: true,
          captureId: capture.id,
          amount: capture.amount.value,
          currency: capture.amount.currency_code,
          status: capture.status
        };
      }
      
      return {
        success: false,
        status: response.result.status
      };
    } catch (error) {
      logger.error('PayPal order capture failed:', error);
      throw new Error('Failed to capture PayPal order');
    }
  }

  /**
   * Process refund
   */
  async refundPayment(captureId, amount = null) {
    const request = new paypal.payments.CapturesRefundRequest(captureId);
    
    if (amount) {
      request.requestBody({
        amount: {
          value: amount.toString(),
          currency_code: 'USD'
        }
      });
    } else {
      request.requestBody({});
    }

    try {
      const response = await this.client.execute(request);
      
      return {
        success: true,
        refundId: response.result.id,
        amount: response.result.amount.value,
        status: response.result.status
      };
    } catch (error) {
      logger.error('PayPal refund failed:', error);
      throw new Error('Failed to process refund');
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(headers, body) {
    const request = new paypal.notifications.webhooks.VerifyWebhookSignature();
    request.requestBody({
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: process.env.PAYPAL_WEBHOOK_ID,
      webhook_event: body
    });

    try {
      const response = await this.client.execute(request);
      return response.result.verification_status === 'SUCCESS';
    } catch (error) {
      logger.error('PayPal webhook verification failed:', error);
      return false;
    }
  }
}

module.exports = new PayPalService();