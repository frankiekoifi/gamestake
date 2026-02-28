// src/services/TournamentService.js
const { Tournament, TournamentParticipant, User, sequelize } = require('../models');
const WalletService = require('./WalletService');
const NotificationService = require('./NotificationService');

class TournamentService {
  /**
   * Create a tournament
   */
  async createTournament(creatorId, {
    name,
    game,
    entryFee,
    maxParticipants,
    startDate,
    type,
    prizeDistribution = [50, 30, 20] // 1st, 2nd, 3rd
  }) {
    return await sequelize.transaction(async (transaction) => {
      const totalPrizePool = entryFee * maxParticipants;
      const platformFee = totalPrizePool * (process.env.PLATFORM_FEE_PERCENTAGE / 100);
      const prizePool = totalPrizePool - platformFee;

      const tournament = await Tournament.create({
        name,
        game,
        entryFee,
        maxParticipants,
        currentParticipants: 1,
        startDate,
        type,
        prizePool,
        platformFee,
        creatorId,
        status: 'registration',
        prizeDistribution
      }, { transaction });

      // Add creator as first participant
      await TournamentParticipant.create({
        tournamentId: tournament.id,
        userId: creatorId,
        status: 'registered'
      }, { transaction });

      // Lock creator's entry fee
      await WalletService.lockMatchFunds(creatorId, tournament.id, entryFee);

      return tournament;
    });
  }

  /**
   * Join tournament
   */
  async joinTournament(tournamentId, userId) {
    return await sequelize.transaction(async (transaction) => {
      const tournament = await Tournament.findOne({
        where: {
          id: tournamentId,
          status: 'registration'
        },
        lock: transaction.LOCK.UPDATE,
        transaction
      });

      if (!tournament) {
        throw new Error('Tournament not available');
      }

      if (tournament.currentParticipants >= tournament.maxParticipants) {
        throw new Error('Tournament is full');
      }

      // Check and lock entry fee
      await WalletService.lockMatchFunds(userId, tournament.id, tournament.entryFee);

      // Add participant
      await TournamentParticipant.create({
        tournamentId,
        userId,
        status: 'registered'
      }, { transaction });

      tournament.currentParticipants += 1;
      
      if (tournament.currentParticipants === tournament.maxParticipants) {
        tournament.status = 'in_progress';
        tournament.actualStartDate = new Date();
      }
      
      await tournament.save({ transaction });

      return tournament;
    });
  }

  /**
   * Generate tournament bracket (for knockout tournaments)
   */
  async generateBracket(tournamentId) {
    const tournament = await Tournament.findByPk(tournamentId);
    
    if (tournament.type !== 'knockout') {
      throw new Error('Bracket generation only for knockout tournaments');
    }

    const participants = await TournamentParticipant.findAll({
      where: { tournamentId, status: 'registered' }
    });

    // Shuffle participants
    const shuffled = participants.sort(() => 0.5 - Math.random());
    
    // Generate bracket structure
    const bracket = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      bracket.push({
        matchId: null,
        player1: shuffled[i].userId,
        player2: shuffled[i + 1]?.userId,
        winner: null,
        nextMatch: Math.floor(i / 2)
      });
    }

    tournament.bracket = bracket;
    tournament.status = 'in_progress';
    await tournament.save();

    return tournament;
  }

  /**
   * Distribute tournament prizes
   */
  async distributePrizes(tournamentId) {
    return await sequelize.transaction(async (transaction) => {
      const tournament = await Tournament.findByPk(tournamentId, { transaction, lock: true });
      
      if (tournament.status !== 'completed') {
        throw new Error('Tournament not completed');
      }

      const winners = tournament.winners; // Array of userIds in order

      tournament.prizeDistribution.forEach(async (percentage, index) => {
        const prizeAmount = tournament.prizePool * (percentage / 100);
        const winnerId = winners[index];

        if (winnerId) {
          await WalletService.processWinnings(
            winnerId,
            tournament.id,
            prizeAmount,
            0, // Fee already deducted from total prize pool
            'tournament_winning'
          );
        }
      });

      tournament.prizesDistributed = true;
      await tournament.save({ transaction });
    });
  }
}

module.exports = new TournamentService();