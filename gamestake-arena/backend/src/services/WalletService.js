// src/services/WalletService.js
const { Wallet, Transaction, sequelize } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class WalletService {
  /**
   * Atomic wallet transaction with concurrency control
   */
  async atomicTransaction(userId, type, amount, options = {}) {
    const {
      paymentMethod = 'wallet',
      metadata = {},
      description = '',
      fee = 0
    } = options;

    const netAmount = amount - fee;

    return await sequelize.transaction(async (transaction) => {
      // Lock the wallet row for update
      const wallet = await Wallet.findOne({
        where: { userId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Validate sufficient balance for debits
      if (amount < 0 && wallet.balance + wallet.pendingBalance < Math.abs(amount)) {
        throw new Error('Insufficient balance');
      }

      const balanceBefore = wallet.balance;
      let balanceAfter = wallet.balance;

      // Update wallet based on transaction type
      switch (type) {
        case 'deposit':
          balanceAfter = Number(wallet.balance) + Number(amount);
          break;
        case 'withdrawal':
          if (wallet.balance < Math.abs(amount)) {
            throw new Error('Insufficient available balance');
          }
          balanceAfter = Number(wallet.balance) - Number(amount);
          break;
        case 'match_entry':
          wallet.lockedBalance = Number(wallet.lockedBalance) + Number(Math.abs(amount));
          break;
        case 'match_winning':
          balanceAfter = Number(wallet.balance) + Number(amount);
          break;
        case 'match_refund':
          wallet.lockedBalance = Number(wallet.lockedBalance) - Number(Math.abs(amount));
          balanceAfter = Number(wallet.balance) + Number(amount);
          break;
      }

      // Update wallet
      wallet.balance = balanceAfter;
      wallet.version += 1;
      await wallet.save({ transaction });

      // Create transaction record
      const transactionRecord = await Transaction.create({
        id: uuidv4(),
        userId,
        walletId: wallet.id,
        type,
        amount,
        fee,
        netAmount,
        status: 'completed',
        reference: options.reference || `txn_${Date.now()}_${userId}`,
        paymentMethod,
        balanceBefore,
        balanceAfter,
        description,
        metadata,
        paymentDetails: options.paymentDetails || {}
      }, { transaction });

      return { wallet, transaction: transactionRecord };
    });
  }

  /**
   * Lock funds for match participation
   */
  async lockMatchFunds(userId, matchId, amount) {
    return await this.atomicTransaction(
      userId,
      'match_entry',
      -amount,
      {
        description: `Locked funds for match #${matchId}`,
        metadata: { matchId }
      }
    );
  }

  /**
   * Release locked funds (match completed/cancelled)
   */
  async releaseLockedFunds(userId, matchId, amount) {
    return await sequelize.transaction(async (transaction) => {
      const wallet = await Wallet.findOne({
        where: { userId },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      wallet.lockedBalance = Number(wallet.lockedBalance) - Number(amount);
      await wallet.save({ transaction });

      return wallet;
    });
  }

  /**
   * Process match winnings
   */
  async processWinnings(userId, matchId, amount, fee) {
    const netAmount = amount - fee;
    
    return await this.atomicTransaction(
      userId,
      'match_winning',
      netAmount,
      {
        fee,
        description: `Winnings from match #${matchId}`,
        metadata: { matchId }
      }
    );
  }
}

module.exports = new WalletService();