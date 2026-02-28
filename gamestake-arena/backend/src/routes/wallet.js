// src/routes/wallet.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { depositLimiter } = require('../middleware/rateLimiter');
const WalletService = require('../services/WalletService');
const MpesaService = require('../services/payments/MpesaService');
const PayPalService = require('../services/payments/PayPalService');
const { Transaction } = require('../models');
const { v4: uuidv4 } = require('uuid');

// Get wallet balance
router.get('/balance', authenticate, async (req, res) => {
  try {
    const wallet = await WalletService.getWallet(req.user.id);
    res.json({
      balance: wallet.balance,
      pendingBalance: wallet.pendingBalance,
      lockedBalance: wallet.lockedBalance
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Deposit via M-Pesa
router.post('/deposit/mpesa', authenticate, depositLimiter, async (req, res) => {
  try {
    const { phoneNumber, amount } = req.body;

    if (amount < 10 || amount > 150000) {
      return res.status(400).json({ error: 'Amount must be between 10 and 150,000 KES' });
    }

    const reference = `DEP_${Date.now()}_${req.user.id}`;
    
    const result = await MpesaService.stkPush(
      phoneNumber,
      amount,
      reference,
      'GameStake Arena Deposit'
    );

    if (result.success) {
      // Create pending transaction
      await Transaction.create({
        userId: req.user.id,
        type: 'deposit',
        amount,
        status: 'pending',
        reference,
        paymentMethod: 'mpesa',
        paymentDetails: {
          phoneNumber,
          merchantRequestId: result.merchantRequestId,
          checkoutRequestId: result.checkoutRequestId
        }
      });

      res.json({
        message: 'STK push sent. Please check your phone.',
        checkoutRequestId: result.checkoutRequestId
      });
    } else {
      res.status(400).json({ error: 'Payment initiation failed' });
    }
  } catch (error) {
    console.error('M-Pesa deposit error:', error);
    res.status(500).json({ error: 'Deposit failed' });
  }
});

// Deposit via PayPal
router.post('/deposit/paypal', authenticate, depositLimiter, async (req, res) => {
  try {
    const { amount, currency = 'USD' } = req.body;

    if (amount < 1 || amount > 10000) {
      return res.status(400).json({ error: 'Amount must be between 1 and 10,000 USD' });
    }

    const reference = `DEP_${Date.now()}_${req.user.id}`;
    
    const result = await PayPalService.createOrder(amount, currency, reference);

    if (result.success) {
      // Create pending transaction
      await Transaction.create({
        userId: req.user.id,
        type: 'deposit',
        amount,
        status: 'pending',
        reference,
        paymentMethod: 'paypal',
        paymentDetails: {
          orderId: result.orderId,
          currency
        }
      });

      res.json({
        orderId: result.orderId,
        approvalUrl: result.links.find(link => link.rel === 'approve').href
      });
    } else {
      res.status(400).json({ error: 'Failed to create PayPal order' });
    }
  } catch (error) {
    console.error('PayPal deposit error:', error);
    res.status(500).json({ error: 'Deposit failed' });
  }
});

// Confirm PayPal payment
router.post('/deposit/paypal/confirm', authenticate, async (req, res) => {
  try {
    const { orderId } = req.body;

    const capture = await PayPalService.captureOrder(orderId);

    if (capture.success) {
      // Find pending transaction
      const transaction = await Transaction.findOne({
        where: {
          'paymentDetails.orderId': orderId,
          status: 'pending'
        }
      });

      if (transaction) {
        // Update wallet
        await WalletService.atomicTransaction(
          req.user.id,
          'deposit',
          capture.amount,
          {
            paymentMethod: 'paypal',
            reference: capture.captureId,
            paymentDetails: capture
          }
        );

        // Update transaction status
        transaction.status = 'completed';
        transaction.paymentDetails = { ...transaction.paymentDetails, capture };
        await transaction.save();

        res.json({ message: 'Deposit successful', amount: capture.amount });
      } else {
        res.status(404).json({ error: 'Transaction not found' });
      }
    } else {
      res.status(400).json({ error: 'Payment capture failed' });
    }
  } catch (error) {
    console.error('PayPal confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

// Withdraw funds
router.post('/withdraw', authenticate, async (req, res) => {
  try {
    const { amount, method, details } = req.body;

    const wallet = await WalletService.getWallet(req.user.id);

    if (wallet.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    if (amount < 50 || amount > 50000) {
      return res.status(400).json({ error: 'Amount must be between 50 and 50,000' });
    }

    const result = await WalletService.atomicTransaction(
      req.user.id,
      'withdrawal',
      -amount,
      {
        paymentMethod: method,
        description: `Withdrawal to ${method}`,
        paymentDetails: details
      }
    );

    res.json({
      message: 'Withdrawal initiated',
      transactionId: result.transaction.id
    });
  } catch (error) {
    console.error('Withdrawal error:', error);
    res.status(500).json({ error: 'Withdrawal failed' });
  }
});

// Get transaction history
router.get('/transactions', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const offset = (page - 1) * limit;

    const where = { userId: req.user.id };
    if (type) where.type = type;
    if (status) where.status = status;

    const transactions = await Transaction.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      transactions: transactions.rows,
      total: transactions.count,
      page: parseInt(page),
      totalPages: Math.ceil(transactions.count / limit)
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// M-Pesa callback webhook
router.post('/webhooks/mpesa', async (req, res) => {
  try {
    const callbackData = req.body;
    const result = await MpesaService.handleCallback(callbackData);

    if (result.success) {
      // Find pending transaction
      const transaction = await Transaction.findOne({
        where: {
          'paymentDetails.checkoutRequestId': result.checkoutRequestId
        }
      });

      if (transaction) {
        // Update wallet
        await WalletService.atomicTransaction(
          transaction.userId,
          'deposit',
          result.amount,
          {
            paymentMethod: 'mpesa',
            reference: result.receiptNumber,
            paymentDetails: result
          }
        );

        // Update transaction status
        transaction.status = 'completed';
        transaction.paymentDetails = { ...transaction.paymentDetails, callback: result };
        await transaction.save();
      }
    }

    // Acknowledge receipt
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('M-Pesa webhook error:', error);
    res.json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
});

// PayPal webhook
router.post('/webhooks/paypal', async (req, res) => {
  try {
    const verified = await PayPalService.verifyWebhookSignature(req.headers, req.body);

    if (verified) {
      const event = req.body;
      
      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const capture = event.resource;
        
        // Find and update transaction
        const transaction = await Transaction.findOne({
          where: {
            'paymentDetails.orderId': capture.supplementary_data.related_ids.order_id
          }
        });

        if (transaction && transaction.status === 'pending') {
          await WalletService.atomicTransaction(
            transaction.userId,
            'deposit',
            capture.amount.value,
            {
              paymentMethod: 'paypal',
              reference: capture.id,
              paymentDetails: capture
            }
          );

          transaction.status = 'completed';
          await transaction.save();
        }
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;