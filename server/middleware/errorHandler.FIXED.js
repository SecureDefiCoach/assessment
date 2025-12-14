/**
 * SECURITY FIX: Secure Error Handler
 * 
 * VULNERABILITY FIXED: Remote Code Execution (RCE)
 * - Removed dangerous Function.constructor usage
 * - Removed arbitrary code execution capability
 * - Added proper error logging and sanitization
 * 
 * ORIGINAL ISSUE: The previous errorHandler used Function.constructor to execute
 * arbitrary JavaScript code from external sources, creating a critical RCE vulnerability.
 */

const winston = require('winston');

// Configure secure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

/**
 * Secure 404 handler
 */
const notFound = (req, res, next) => {
  const err = new Error(`Route Not Found - ${req.originalUrl}`);
  err.status = 404;
  next(err);
};

/**
 * Secure error handler - FIXED VERSION
 * 
 * SECURITY IMPROVEMENTS:
 * 1. Removed Function.constructor usage
 * 2. Added proper error sanitization
 * 3. Implemented secure logging
 * 4. Added error classification
 * 5. Prevented information disclosure
 */
const errorHandler = (err, req, res, next) => {
  try {
    // Sanitize error for logging
    const sanitizedError = {
      message: err.message || 'Internal Server Error',
      status: err.status || 500,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      timestamp: new Date().toISOString(),
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };

    // Log error securely
    logger.error('Application Error', sanitizedError);

    // Determine response based on error type
    let statusCode = err.status || 500;
    let message = 'Internal Server Error';

    // Only expose safe error messages
    if (statusCode === 400) {
      message = 'Bad Request';
    } else if (statusCode === 401) {
      message = 'Unauthorized';
    } else if (statusCode === 403) {
      message = 'Forbidden';
    } else if (statusCode === 404) {
      message = 'Not Found';
    } else if (statusCode === 422) {
      message = 'Validation Error';
    }

    // In development, provide more details
    if (process.env.NODE_ENV === 'development') {
      message = err.message;
    }

    // Send secure error response
    res.status(statusCode).json({
      success: false,
      error: {
        message,
        status: statusCode,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    });

  } catch (handlerError) {
    // Fallback error handling
    logger.error('Error in error handler', {
      originalError: err.message,
      handlerError: handlerError.message,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      error: {
        message: 'Internal Server Error',
        status: 500
      }
    });
  }
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Validation error handler
 */
const validationErrorHandler = (err, req, res, next) => {
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => ({
      field: error.path,
      message: error.message
    }));

    logger.warn('Validation Error', {
      errors,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip
    });

    return res.status(422).json({
      success: false,
      error: {
        message: 'Validation Error',
        status: 422,
        details: errors
      }
    });
  }
  next(err);
};

module.exports = { 
  notFound, 
  errorHandler, 
  asyncHandler, 
  validationErrorHandler,
  logger 
};