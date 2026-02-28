// src/models/Transaction.js
module.exports = (sequelize, DataTypes) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    walletId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM(
        'deposit',
        'withdrawal',
        'match_entry',
        'match_winning',
        'match_refund',
        'tournament_entry',
        'tournament_winning',
        'fee_deduction',
        'referral_bonus'
      ),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    fee: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    netAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled', 'refunded'),
      defaultValue: 'pending'
    },
    reference: {
      type: DataTypes.STRING,
      unique: true
    },
    paymentMethod: {
      type: DataTypes.ENUM('mpesa', 'paypal', 'wallet'),
      allowNull: false
    },
    paymentDetails: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    balanceBefore: {
      type: DataTypes.DECIMAL(15, 2)
    },
    balanceAfter: {
      type: DataTypes.DECIMAL(15, 2)
    },
    description: {
      type: DataTypes.STRING
    }
  }, {
    timestamps: true
  });

  return Transaction;
};