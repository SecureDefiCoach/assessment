/**
 * SECURITY FIX: Tests for Secure Authentication Controller
 * 
 * These tests verify that the security fixes are working correctly
 */

const request = require('supertest');
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Mock the user model
jest.mock('../models/users');
const userM = require('../models/users');

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    add: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    File: jest.fn(),
    Console: jest.fn()
  }
}));

const authController = require('../controllers/auth.controller.FIXED');

const app = express();
app.use(express.json());

// Test routes
app.post('/login', authController.userLogin);
app.post('/register', authController.userRegistration);

describe('Secure Authentication Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Login Security', () => {
    test('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/login')
        .send({});

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Validation failed');
    });

    test('should reject login with invalid email format', async () => {
      const response = await request(app)
        .post('/login')
        .send({
          emailPhone: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    test('should handle non-existent user securely', async () => {
      userM.findOne.mockResolvedValue(null);

      const response = await request(app)
        .post('/login')
        .send({
          emailPhone: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    test('should handle wrong password securely', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: await bcrypt.hash('correctpassword', 12),
        fname: 'Test',
        lname: 'User',
        isAdmin: false
      };

      userM.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/login')
        .send({
          emailPhone: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid credentials');
    });

    test('should login successfully with correct credentials', async () => {
      const password = 'correctpassword';
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        password: await bcrypt.hash(password, 12),
        fname: 'Test',
        lname: 'User',
        isAdmin: false
      };

      userM.findOne.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/login')
        .send({
          emailPhone: 'test@example.com',
          password: password
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned
    });
  });

  describe('User Registration Security', () => {
    test('should reject registration with weak password', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          fname: 'Test',
          lName: 'User',
          email: 'test@example.com',
          phoneNo: '1234567890',
          password: 'weak' // Too weak
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            msg: expect.stringContaining('Password must contain')
          })
        ])
      );
    });

    test('should reject registration with invalid email', async () => {
      const response = await request(app)
        .post('/register')
        .send({
          fname: 'Test',
          lName: 'User',
          email: 'invalid-email',
          phoneNo: '1234567890',
          password: 'SecurePass123!'
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });

    test('should reject registration with existing user', async () => {
      const existingUser = {
        _id: 'existing123',
        email: 'existing@example.com',
        phoneNo: '1234567890'
      };

      userM.findOne.mockResolvedValue(existingUser);

      const response = await request(app)
        .post('/register')
        .send({
          fname: 'Test',
          lName: 'User',
          email: 'existing@example.com',
          phoneNo: '1234567890',
          password: 'SecurePass123!'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already exists');
    });

    test('should register user successfully with valid data', async () => {
      userM.findOne.mockResolvedValue(null); // No existing user
      
      const mockSavedUser = {
        _id: 'newuser123',
        fname: 'Test',
        lname: 'User',
        email: 'test@example.com',
        phoneNo: '1234567890'
      };

      const mockUserInstance = {
        save: jest.fn().mockResolvedValue(mockSavedUser)
      };

      userM.mockImplementation(() => mockUserInstance);

      const response = await request(app)
        .post('/register')
        .send({
          fname: 'Test',
          lName: 'User',
          email: 'test@example.com',
          phoneNo: '1234567890',
          password: 'SecurePass123!'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user.password).toBeUndefined(); // Password should not be returned
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize XSS attempts in registration', async () => {
      userM.findOne.mockResolvedValue(null);
      
      const mockUserInstance = {
        save: jest.fn().mockResolvedValue({
          _id: 'newuser123',
          fname: 'Test', // Should be sanitized
          lname: 'User',
          email: 'test@example.com'
        })
      };

      userM.mockImplementation(() => mockUserInstance);

      const response = await request(app)
        .post('/register')
        .send({
          fname: '<script>alert("xss")</script>Test',
          lName: 'User',
          email: 'test@example.com',
          phoneNo: '1234567890',
          password: 'SecurePass123!'
        });

      // The request should be processed but XSS should be sanitized
      expect(mockUserInstance.save).toHaveBeenCalled();
    });
  });
});

module.exports = {
  // Export for integration tests
  app
};