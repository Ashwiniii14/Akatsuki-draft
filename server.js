
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  Boolean(process.env.JEST_WORKER_ID);

const initialEnv = process.env.NODE_ENV;
dotenv.config();

if (isTestEnv) {
  process.env.NODE_ENV = initialEnv || 'test';
}

const connectDB = require('./config/db');
const {
  notFound,
  errorHandler,
} = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const adminRoutes = require('./routes/adminRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();

// Core middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
}));

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    project: "Akatsuki's Draft API",
    status: 'online',
    version: '1.0.0',
    documentation: '/api/health',
    endpoints: {
      auth: '/api/auth',
      posts: '/api/posts',
      admin: '/api/admin/posts',
      ai: '/api/ai',
    },
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/admin/posts', adminRoutes);
app.use('/api/ai', aiRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server;

// Start server after connecting to MongoDB
const startServer = async () => {
  try {
    console.log('Initializing database connection...');
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(
        `Akatsuki's Draft server running in ${
          process.env.NODE_ENV || 'development'
        } mode on port ${PORT}`
      );

      console.log(`Base API URL: http://localhost:${PORT}`);
      console.log(`Health Check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error(
      'Server startup aborted: Database connection could not be established.'
    );
    console.error(`Action required: ${error.message}`);

    if (!isTestEnv) {
      process.exit(1);
    }
  }
};

// Start only outside the test environment
if (!isTestEnv) {
  startServer();
}

// Graceful shutdown
let shuttingDown = false;

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('\nShutting down gracefully...');

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      console.log('HTTP server closed.');
    }

    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Shutdown error:', error.message);
    process.exit(1);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
