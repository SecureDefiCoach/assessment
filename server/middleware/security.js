/**
 * Security Middleware
 * 
 * SECURITY IMPROVEMENTS:
 * 1. JWT Authentication middleware
 * 2. Security headers
 * 3. Input sanitization
 * 4. Rate limiting
 * 5. CORS configuration
 * 6. Request logging
 */

const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const { logger } = require('./errorHandler.FIXED');

const secretKey = process.env.JWT_SECRET || 'your-super-secure-secret-key-change-this';

/**
 * JWT Authentication Middleware
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    logger.warn('Missing authentication token', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    return res.status(401).json({
      success: false,
      error: {
        message: 'Access token required',
        status: 401
      }
    });
  }

  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      logger.warn('Invalid authentication token', {
        error: err.message,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
      });
      return res.status(403).json({
        success: false,
        error: {
          message: 'Invalid or expired token',
          status: 403
        }
      });
    }

    req.user = decoded.user;
    next();
  });
};

/**
 * Admin Authorization Middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    logger.warn('Unauthorized admin access attempt', {
      userId: req.user?._id,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });
    return res.status(403).json({
      success: false,
      error: {
        message: 'Admin access required',
        status: 403
      }
    });
  }
  next();
};

/**
 * General Rate Limiting
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      status: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Strict Rate Limiting for sensitive endpoints
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests to sensitive endpoint, please try again later',
      status: 429
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Security Headers Configuration
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Request Logging Middleware
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info('Incoming request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id
  });

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userId: req.user?._id
    });
  });

  next();
};

/**
 * Input Sanitization Middleware
 */
const sanitizeInput = [
  mongoSanitize(), // Prevent NoSQL injection
  xss(), // Prevent XSS attacks
  hpp() // Prevent HTTP Parameter Pollution
];

/**
 * CORS Configuration
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://your-production-domain.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin, ip: req?.ip });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

/**
 * File Upload Security
 */
const fileUploadSecurity = {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow only specific file types
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      logger.warn('Blocked file upload', {
        filename: file.originalname,
        mimetype: file.mimetype,
        ip: req.ip,
        userId: req.user?._id
      });
      cb(new Error('File type not allowed'), false);
    }
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  generalLimiter,
  strictLimiter,
  securityHeaders,
  requestLogger,
  sanitizeInput,
  corsOptions,
  fileUploadSecurity
};