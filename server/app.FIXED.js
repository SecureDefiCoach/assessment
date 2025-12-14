/**
 * SECURITY FIX: Secure Express Application
 * 
 * VULNERABILITIES FIXED:
 * 1. Added comprehensive security middleware
 * 2. Implemented proper error handling
 * 3. Added input validation and sanitization
 * 4. Configured secure CORS
 * 5. Added rate limiting
 * 6. Implemented security headers
 * 7. Added request logging
 * 8. Enhanced MongoDB connection security
 * 9. Added graceful shutdown handling
 * 
 * ORIGINAL ISSUES:
 * - No security middleware
 * - Weak CORS configuration
 * - No rate limiting
 * - Missing security headers
 * - No input validation
 * - Poor error handling
 */

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');
const http = require('http');
const compression = require('compression');
require('dotenv').config();

// SECURITY FIX: Import secure middleware
const { 
  securityHeaders, 
  generalLimiter, 
  requestLogger, 
  sanitizeInput, 
  corsOptions 
} = require('./middleware/security');
const { 
  notFound, 
  errorHandler, 
  validationErrorHandler,
  logger 
} = require('./middleware/errorHandler.FIXED');

const app = express();
const server = http.createServer(app);

// SECURITY FIX: Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// SECURITY FIX: Security middleware (must be first)
app.use(securityHeaders);
app.use(generalLimiter);
app.use(compression()); // Compress responses

// SECURITY FIX: Secure CORS configuration
app.use(cors(corsOptions));

// SECURITY FIX: Body parsing with limits
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// SECURITY FIX: Input sanitization
app.use(sanitizeInput);

// SECURITY FIX: Request logging
app.use(requestLogger);

// SECURITY FIX: Morgan logging with custom format
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// SECURITY FIX: Static file serving with security
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: false,
  setHeaders: (res, path) => {
    // Prevent execution of uploaded files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'attachment');
  }
}));

// SECURITY FIX: Secure MongoDB connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost/realestatedb';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferMaxEntries: 0, // Disable mongoose buffering
      bufferCommands: false, // Disable mongoose buffering
    });

    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed', { error: error.message });
    process.exit(1);
  }
};

// Connect to database
connectDB();

// SECURITY FIX: MongoDB connection event handlers
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

// SECURITY FIX: Import secure routes
const users = require('./routes/users');
const auth = require('./routes/auth.FIXED'); // Use fixed auth routes
const common = require('./routes/common');
const property = require('./routes/property');
const email = require('./routes/email');

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes with versioning
app.use('/api/v1/user', users);
app.use('/api/v1/auth', auth);
app.use('/api/v1/common', common);
app.use('/api/v1/property', property);
app.use('/api/v1/email', email);

// SECURITY FIX: Backward compatibility (deprecated)
app.use('/api/user', users);
app.use('/api/auth', auth);
app.use('/api/common', common);
app.use('/api/property', property);
app.use('/api/email', email);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DeFi Property API Server',
    version: '1.0.1',
    documentation: '/api/docs'
  });
});

// SECURITY FIX: API documentation endpoint
app.get('/api/docs', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API Documentation',
    endpoints: {
      auth: {
        'POST /api/v1/auth/user/login': 'User login',
        'POST /api/v1/auth/user/register': 'User registration',
        'GET /api/v1/auth/admin/userList': 'Get user list (admin only)',
        'PUT /api/v1/auth/admin/changePass': 'Change password (admin only)'
      },
      users: {
        'GET /api/v1/user/:userId': 'Get user details'
      },
      properties: {
        'GET /api/v1/property/list': 'Get all properties',
        'GET /api/v1/property/list/:userId': 'Get user properties',
        'POST /api/v1/property/new': 'Create new property',
        'GET /api/v1/property/single/:propertySlug': 'Get single property'
      }
    }
  });
});

// SECURITY FIX: Error handling middleware (must be last)
app.use(validationErrorHandler);
app.use(notFound);
app.use(errorHandler);

// SECURITY FIX: Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// SECURITY FIX: Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { 
    error: err.message, 
    stack: err.stack 
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason,
    promise: promise 
  });
  process.exit(1);
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  });
});

module.exports = app;