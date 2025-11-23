const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app-test');
const User = require('../../models/userModel');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

describe("Given a user exists and a JWT token is issued", () => {
  let token, userId;

  beforeAll(async () => {
    // Connect to the test database before running any tests
    await mongoose.connect("mongodb://localhost:27017/test-db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await User.deleteMany({});
    
    // Create user via signup endpoint to properly hash password and include all required fields
    const res = await supertest(app)
      .post('/api/users/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'R3g5T7#gh',
        phone_number: '1234567890',
        gender: 'Male',
        date_of_birth: '1990-01-01',
        membership_status: 'Active'
      });
    userId = jwt.decode(res.body.token)._id;
    token = res.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({});
    // Properly close the DB connection
    await mongoose.disconnect();
  });

  describe("Given the requireAuth middleware is in place", () => {
    it("should accept requests when a valid Bearer token is provided", async () => {
      const res = await supertest(app).get('/api/tours').set('Authorization', `Bearer ${token}`);
      expect(res.status).not.toBe(401);
    });

    it("should reject requests with 401 when no Authorization header is provided", async () => {
      const res = await supertest(app).get('/api/tours');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authorization token required');
    });

    it("should accept requests when the token is provided after any prefix", async () => {
      const res = await supertest(app).get('/api/tours').set('Authorization', `Token ${token}`);
      expect(res.status).not.toBe(401);
    });

    it("should reject requests with 401 when the token is invalid or expired", async () => {
      const invalidToken = jwt.sign({ _id: userId }, 'wrong-secret', { expiresIn: '1d' });
      const res = await supertest(app).get('/api/tours').set('Authorization', `Bearer ${invalidToken}`);
      expect(res.status).toBe(401);
    });

    it("should reject requests with 401 when the token is malformed", async () => {
      const res = await supertest(app).get('/api/tours').set('Authorization', `Bearer invalid.token.here`);
      expect(res.status).toBe(401);
    });
  });

  describe("Given a JWT token is created", () => {
    it("should decode to reveal the user ID", () => {
      const decoded = jwt.verify(token, process.env.SECRET);
      expect(decoded._id).toBe(userId.toString());
    });

    it("should include _id in the payload", () => {
      const decoded = jwt.verify(token, process.env.SECRET);
      expect(decoded).toHaveProperty('_id');
    });

    it("should include an expiration time in the payload", () => {
      const decoded = jwt.verify(token, process.env.SECRET);
      expect(decoded).toHaveProperty('exp');
      expect(typeof decoded.exp).toBe('number');
    });
  });

  describe("Given a request passes authentication", () => {
    it("should attach req.user._id to the request", async () => {
      const res = await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Auth Test Tour', info: 'Testing req.user attachment', image: 'test.jpg', price: '100' });

      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(userId.toString());
    });

    it("should make authenticated requests accessible to route handlers via req.user", async () => {
      const res = await supertest(app).get('/api/tours').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("Given the authentication flow is executed", () => {
    it("should fetch the user by ID from the database and attach it to req.user", async () => {
      const res = await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Flow Test Tour', info: 'Testing the full flow', image: 'test.jpg', price: '100' });

      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(userId.toString());
    });

    it("should enforce requireAuth middleware on protected routes", async () => {
      const unauthedRes = await supertest(app).get('/api/tours');
      expect(unauthedRes.status).toBe(401);

      const authedRes = await supertest(app).get('/api/tours').set('Authorization', `Bearer ${token}`);
      expect(authedRes.status).toBe(200);
    });
  });

  describe("Given the requireAuth middleware file exists", () => {
    it("should contain jwt.verify and req.user references", () => {
      const requireAuthPath = path.resolve(__dirname, '../../middleware/requireAuth.js');
      expect(fs.existsSync(requireAuthPath)).toBe(true);
      const content = fs.readFileSync(requireAuthPath, 'utf8');
      expect(content).toContain('jwt.verify');
      expect(content).toContain('req.user');
    });

    it("should contain console.log statements for debugging", () => {
      const requireAuthPath = path.resolve(__dirname, '../../middleware/requireAuth.js');
      const content = fs.readFileSync(requireAuthPath, 'utf8');
      expect(content).toMatch(/console\.log/);
    });

    it("should split the Authorization header correctly to extract the token", () => {
      const requireAuthPath = path.resolve(__dirname, '../../middleware/requireAuth.js');
      const content = fs.readFileSync(requireAuthPath, 'utf8');
      expect(content).toContain('split(" ")[1]');
    });
  });
});
