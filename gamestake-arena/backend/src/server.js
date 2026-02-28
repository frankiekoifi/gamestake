// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const socketIo = require('socket.io');
const { sequelize } = require('./models');
const logger = require('./utils/logger');
const cron = require('node-cron');
const MatchService = require('./services/MatchService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const walletRoutes = require('./routes/wallet');
const matchRoutes = require('./routes/match');
const tournamentRoutes = require('./routes/tournament');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date() });
});

// WebSocket for real-time updates
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  // Verify JWT
  next();
}).on('connection', (socket) => {
  logger.info('New WebSocket connection');
  
  socket.on('join-match', (matchId) => {
    socket.join(`match:${matchId}`);
  });

  socket.on('leave-match', (matchId) => {
    socket.leave(`match:${matchId}`);
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

// Make io available to routes
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Scheduled jobs
cron.schedule('*/5 * * * *', async () => {
  logger.info('Running auto-resolve matches job');
  await MatchService.autoResolveMatches();
});

// Database connection and server start
const PORT = process.env.PORT || 5000;

sequelize.authenticate()
  .then(() => {
    logger.info('Database connected');
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    logger.error('Unable to connect to database:', err);
  });

module.exports = { app, server, io };