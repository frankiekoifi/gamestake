// src/services/MatchService.js
const { Match, User, Dispute, sequelize } = require('../models');
const WalletService = require('./WalletService');
const NotificationService = require('./NotificationService');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class MatchService {
  /**
   * Create a new challenge
   */
  async createChallenge(creatorId, { game, wagerAmount, rules = {} }) {
    return await sequelize.transaction(async (transaction) => {
      // Check wallet balance
      const wallet = await WalletService.getWallet(creatorId);
      if (wallet.balance < wagerAmount) {
        throw new Error('Insufficient balance');
      }

      // Create match
      const match = await Match.create({
        creatorId,
        game,
        wagerAmount,
        rules,
        status: 'pending',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      }, { transaction });

      // Lock creator's funds
      await WalletService.lockMatchFunds(creatorId, match.id, wagerAmount);

      return match;
    });
  }

  /**
   * Accept a challenge
   */
  async acceptChallenge(matchId, opponentId) {
    return await sequelize.transaction(async (transaction) => {
      const match = await Match.findOne({
        where: { id: matchId, status: 'pending' },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!match) {
        throw new Error('Match not available');
      }

      // Check opponent's balance
      const opponentWallet = await WalletService.getWallet(opponentId);
      if (opponentWallet.balance < match.wagerAmount) {
        throw new Error('Insufficient balance');
      }

      // Update match
      match.opponentId = opponentId;
      match.status = 'accepted';
      await match.save({ transaction });

      // Lock opponent's funds
      await WalletService.lockMatchFunds(opponentId, match.id, match.wagerAmount);

      // Notify creator
      await NotificationService.sendNotification(match.creatorId, {
        type: 'match_accepted',
        title: 'Challenge Accepted!',
        body: `Your challenge has been accepted by User ${opponentId}`,
        data: { matchId: match.id }
      });

      return match;
    });
  }

  /**
   * Submit match proof
   */
  async submitProof(matchId, userId, proofUrl) {
    const match = await Match.findByPk(matchId);
    
    if (match.status !== 'accepted' && match.status !== 'in_progress') {
      throw new Error('Match not in progress');
    }

    if (match.creatorId !== userId && match.opponentId !== userId) {
      throw new Error('Not authorized');
    }

    match.proofSubmittedBy = userId;
    match.proofUrl = proofUrl;
    match.status = 'completed';
    match.completedAt = new Date();
    
    // Set confirmation timeout (24 hours)
    match.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await match.save();

    // Notify opponent to confirm
    const opponentId = userId === match.creatorId ? match.opponentId : match.creatorId;
    await NotificationService.sendNotification(opponentId, {
      type: 'proof_submitted',
      title: 'Proof Submitted',
      body: 'Your opponent has submitted match proof. Please confirm or dispute.',
      data: { matchId: match.id }
    });

    return match;
  }

  /**
   * Confirm match result
   */
  async confirmResult(matchId, userId) {
    return await sequelize.transaction(async (transaction) => {
      const match = await Match.findOne({
        where: { id: matchId, status: 'completed' },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!match) {
        throw new Error('Match not found or not completed');
      }

      // Set winner (submitter wins by default on confirmation)
      match.winnerId = match.proofSubmittedBy;
      match.resultConfirmedBy = userId;
      match.status = 'completed';
      match.completedAt = new Date();
      await match.save({ transaction });

      // Process payout
      const platformFee = match.wagerAmount * (process.env.PLATFORM_FEE_PERCENTAGE / 100);
      const winnerAmount = match.wagerAmount * 2 - platformFee;

      // Release loser's funds and transfer to winner
      await WalletService.releaseLockedFunds(
        match.winnerId === match.creatorId ? match.opponentId : match.creatorId,
        match.id,
        match.wagerAmount
      );

      await WalletService.processWinnings(
        match.winnerId,
        match.id,
        winnerAmount,
        platformFee
      );

      // Update user stats
      await User.increment('totalWins', { where: { id: match.winnerId }, transaction });
      await User.increment('totalLosses', { 
        where: { id: match.winnerId === match.creatorId ? match.opponentId : match.creatorId },
        transaction 
      });

      return match;
    });
  }

  /**
   * Create dispute
   */
  async createDispute(matchId, userId, reason, evidence = []) {
    return await sequelize.transaction(async (transaction) => {
      const match = await Match.findByPk(matchId, { transaction, lock: true });
      
      if (!match) {
        throw new Error('Match not found');
      }

      if (match.status !== 'completed') {
        throw new Error('Cannot dispute match that is not completed');
      }

      match.status = 'disputed';
      await match.save({ transaction });

      const dispute = await Dispute.create({
        matchId,
        raisedBy: userId,
        reason,
        evidence,
        status: 'pending'
      }, { transaction });

      // Notify admins
      await NotificationService.notifyAdmins({
        type: 'new_dispute',
        title: 'New Dispute',
        body: `Dispute #${dispute.id} created for match #${matchId}`,
        data: { disputeId: dispute.id, matchId }
      });

      return dispute;
    });
  }

  /**
   * Auto-resolve expired matches
   */
  async autoResolveMatches() {
    const expiredMatches = await Match.findAll({
      where: {
        status: 'completed',
        expiresAt: { [Op.lt]: new Date() },
        winnerId: null
      }
    });

    for (const match of expiredMatches) {
      // Auto-confirm in favor of proof submitter
      match.winnerId = match.proofSubmittedBy;
      match.resultConfirmedBy = 'system';
      await match.save();

      // Process payout
      await this.processMatchPayout(match);
      
      logger.info(`Auto-resolved match ${match.id}`);
    }
  }
}

module.exports = new MatchService();