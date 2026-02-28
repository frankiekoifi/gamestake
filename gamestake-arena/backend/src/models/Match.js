// src/models/Match.js
module.exports = (sequelize, DataTypes) => {
  const Match = sequelize.define('Match', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    opponentId: {
      type: DataTypes.UUID
    },
    game: {
      type: DataTypes.STRING,
      allowNull: false
    },
    wagerAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    platformFee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    winnerId: {
      type: DataTypes.UUID
    },
    status: {
      type: DataTypes.ENUM(
        'pending',      // Waiting for opponent
        'accepted',     // Opponent accepted, funds locked
        'in_progress',  // Match being played
        'completed',    // Match completed, winner determined
        'disputed',     // Under dispute
        'cancelled',    // Cancelled, funds released
        'expired'       // Expired due to timeout
      ),
      defaultValue: 'pending'
    },
    rules: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    proofSubmittedBy: {
      type: DataTypes.UUID
    },
    proofUrl: {
      type: DataTypes.STRING
    },
    resultConfirmedBy: {
      type: DataTypes.UUID
    },
    expiresAt: {
      type: DataTypes.DATE
    },
    completedAt: {
      type: DataTypes.DATE
    }
  }, {
    timestamps: true
  });

  return Match;
};