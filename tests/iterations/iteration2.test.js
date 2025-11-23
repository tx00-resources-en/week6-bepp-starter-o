const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app-test');
const Tour = require('../../models/tourModel');
const User = require('../../models/userModel');
const jwt = require('jsonwebtoken');

describe("Given two users exist in the system", () => {
  let token, userId, otherToken, otherUserId;

  beforeAll(async () => {
    // Connect to test database before running any tests
    await mongoose.connect("mongodb://localhost:27017/test-db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await User.deleteMany({});
    await Tour.deleteMany({});

    // Create first user via signup to properly hash password and include all required fields
    let res = await supertest(app)
      .post('/api/users/signup')
      .send({
        name: 'Test User',
        email: 'testuser@example.com',
        password: 'R3g5T7#gh',
        phone_number: '1234567890',
        gender: 'Male',
        date_of_birth: '1990-01-01',
        membership_status: 'Active'
      });
    userId = jwt.decode(res.body.token)._id;
    token = res.body.token;

    // Create second user via signup
    res = await supertest(app)
      .post('/api/users/signup')
      .send({
        name: 'Other User',
        email: 'other@example.com',
        password: 'OtherPass123!',
        phone_number: '9876543210',
        gender: 'Female',
        date_of_birth: '1992-05-15',
        membership_status: 'Active'
      });
    otherUserId = jwt.decode(res.body.token)._id;
    otherToken = res.body.token;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Tour.deleteMany({});
    // Properly close the DB connection
    await mongoose.disconnect();
  });

  describe("Given the Tour model schema", () => {
    it("should define a user_id field referencing User", () => {
      const userField = Tour.schema.obj.user_id;
      expect(userField).toBeDefined();
      expect(userField.ref).toBe('User');
      expect(userField.required).toBe(true);
    });
  });

  describe("Given no authentication token is provided", () => {
    it("should reject GET /api/tours with 401", async () => {
      const res = await supertest(app).get('/api/tours');
      expect(res.status).toBeGreaterThanOrEqual(401);
    });

    it("should reject POST /api/tours with 401", async () => {
      const res = await supertest(app)
        .post('/api/tours')
        .send({ name: 'Test', info: 'Test', image: 'test.jpg', price: '100' });
      expect(res.status).toBeGreaterThanOrEqual(401);
    });

    it("should reject GET /api/tours/:id with 401", async () => {
      const res = await supertest(app).get('/api/tours/507f1f77bcf86cd799439011');
      expect(res.status).toBeGreaterThanOrEqual(401);
    });

    it("should reject PUT /api/tours/:id with 401", async () => {
      const res = await supertest(app)
        .put('/api/tours/507f1f77bcf86cd799439011')
        .send({ name: 'Updated' });
      expect(res.status).toBeGreaterThanOrEqual(401);
    });

    it("should reject DELETE /api/tours/:id with 401", async () => {
      const res = await supertest(app).delete('/api/tours/507f1f77bcf86cd799439011');
      expect(res.status).toBeGreaterThanOrEqual(401);
    });
  });

  describe("Given an authenticated user creates a tour", () => {
    it("should attach their user_id to the new tour", async () => {
      const res = await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Tour', info: 'Test Info', image: 'test.jpg', price: '100' });

      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(userId.toString());
      expect(res.body.name).toBe('Test Tour');
    });
  });

  describe("Given there are initially some tours saved", () => {
    beforeAll(async () => {
      await Tour.deleteMany({});
      await Tour.create({ name: 'User 1 Tour 1', info: 'Tour by user 1', image: 'tour1.jpg', price: '100', user_id: userId });
      await Tour.create({ name: 'User 1 Tour 2', info: 'Another tour by user 1', image: 'tour2.jpg', price: '150', user_id: userId });
      await Tour.create({ name: 'User 2 Tour 1', info: 'Tour by user 2', image: 'tour3.jpg', price: '200', user_id: otherUserId });
    });

    it("should return only the authenticated user's tours when GET /api/tours is called", async () => {
      const res = await supertest(app).get('/api/tours').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.every(tour => tour.user_id === userId.toString())).toBe(true);
    });

    it("should return only the other user's tours when they call GET /api/tours", async () => {
      const res = await supertest(app).get('/api/tours').set('Authorization', `Bearer ${otherToken}`);
      expect(res.status).toBe(200);
      expect(res.body[0].user_id).toBe(otherUserId.toString());
    });

    it("should allow a user to GET their own tour by ID", async () => {
      const userTour = await Tour.findOne({ user_id: userId });
      const res = await supertest(app).get(`/api/tours/${userTour._id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body._id).toBe(userTour._id.toString());
    });

    it("should return 404 when a user tries to GET another user's tour by ID", async () => {
      const otherTour = await Tour.findOne({ user_id: otherUserId });
      const res = await supertest(app).get(`/api/tours/${otherTour._id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("Given a user wants to update tours", () => {
    it("should allow them to update their own tour", async () => {
      const userTour = await Tour.findOne({ user_id: userId });
      const res = await supertest(app)
        .put(`/api/tours/${userTour._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Tour Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Tour Name');
    });

    it("should return 404 when they try to update another user's tour", async () => {
      const otherTour = await Tour.findOne({ user_id: otherUserId });
      const res = await supertest(app)
        .put(`/api/tours/${otherTour._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(404);
    });
  });

  describe("Given a user wants to delete tours", () => {
    beforeAll(async () => {
      await Tour.create({ name: 'Tour to Delete', info: 'Will be deleted', image: 'delete.jpg', price: '50', user_id: userId });
    });

    it("should allow them to delete their own tour", async () => {
      const userTour = await Tour.findOne({ name: 'Tour to Delete' });
      const res = await supertest(app).delete(`/api/tours/${userTour._id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
      const deletedTour = await Tour.findById(userTour._id);
      expect(deletedTour).toBeNull();
    });

    it("should return 404 when they try to delete another user's tour", async () => {
      const otherTour = await Tour.findOne({ user_id: otherUserId });
      const res = await supertest(app).delete(`/api/tours/${otherTour._id}`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
      const stillExists = await Tour.findById(otherTour._id);
      expect(stillExists).not.toBeNull();
    });
  });
});
