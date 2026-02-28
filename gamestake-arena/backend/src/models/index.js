// src/models/index.js
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'postgres',
  logging: false,
  pool: {
    max: 20,
    min: 5,
    acquire: 60000,
    idle: 10000
  }
});

// Initialize models
const User = require('./User')(sequelize);
const Wallet = require('./Wallet')(sequelize);
const Transaction = require('./Transaction')(sequelize);
const Match = require('./Match')(sequelize);
const Tournament = require('./Tournament')(sequelize);
const TournamentParticipant = require('./TournamentParticipant')(sequelize);
const Dispute = require('./Dispute')(sequelize);
const Message = require('./Message')(sequelize);
const PlatformEarnings = require('./PlatformEarnings')(sequelize);
const Verification = require('./Verification')(sequelize);
const Friend = require('./Friend')(sequelize);
const Notification = require('./Notification')(sequelize);

// Associations
User.hasOne(Wallet);
Wallet.belongsTo(User);

User.hasMany(Transaction);
Transaction.belongsTo(User);

User.hasMany(Match, { as: 'CreatedMatches', foreignKey: 'creatorId' });
User.hasMany(Match, { as: 'OpponentMatches', foreignKey: 'opponentId' });
Match.belongsTo(User, { as: 'Creator', foreignKey: 'creatorId' });
Match.belongsTo(User, { as: 'Opponent', foreignKey: 'opponentId' });

Match.hasMany(Dispute);
Dispute.belongsTo(Match);

User.hasMany(Tournament, { as: 'CreatedTournaments', foreignKey: 'creatorId' });
Tournament.belongsTo(User, { as: 'Creator', foreignKey: 'creatorId' });

Tournament.belongsToMany(User, { through: TournamentParticipant, foreignKey: 'tournamentId' });
User.belongsToMany(Tournament, { through: TournamentParticipant, foreignKey: 'userId' });

User.hasMany(Message, { as: 'SentMessages', foreignKey: 'senderId' });
User.hasMany(Message, { as: 'ReceivedMessages', foreignKey: 'receiverId' });

User.belongsToMany(User, { through: Friend, as: 'Friends', foreignKey: 'userId', otherKey: 'friendId' });

module.exports = {
  sequelize,
  User,
  Wallet,
  Transaction,
  Match,
  Tournament,
  TournamentParticipant,
  Dispute,
  Message,
  PlatformEarnings,
  Verification,
  Friend,
  Notification
};