const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app-test');
const Tour = require('../../models/tourModel');
const User = require('../../models/userModel');
const jwt = require('jsonwebtoken');

describe('Given the application has full authentication and user expansion', () => {
  let token, userId, otherToken, otherUserId;

  beforeAll(async () => {
    // Connect to test database before running any tests
    await mongoose.connect("mongodb://localhost:27017/test-db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    await User.deleteMany({});
    await Tour.deleteMany({});

    // Create first user via signup with all required fields
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
        password: 'R3g5T7#gh',
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

  describe('Tour CRUD operations with user isolation', () => {
    it('should allow authenticated users to create tours', async () => {
      const res = await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Mountain Adventure',
          info: 'Explore beautiful mountains',
          image: 'mountain.jpg',
          price: '150'
        });

      expect(res.status).toBe(201);
      expect(res.body.user_id).toBe(userId.toString());
    });

    it('should allow users to retrieve only their own tours', async () => {
      // Create tours for both users
      await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'User 1 Tour',
          info: 'Tour 1',
          image: 'tour1.jpg',
          price: '100'
        });

      await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'User 2 Tour',
          info: 'Tour 2',
          image: 'tour2.jpg',
          price: '200'
        });

      // User 1 should only see their own tour
      const res = await supertest(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.every(tour => tour.user_id === userId.toString())).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should prevent users from accessing tours of other users', async () => {
      const res = await supertest(app)
        .get('/api/tours')
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(200);
      expect(res.body.every(tour => tour.user_id === otherUserId.toString())).toBe(true);
    });

    it('should allow users to update only their own tours', async () => {
      // Create a tour
      const createRes = await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Original Name',
          info: 'Original Info',
          image: 'original.jpg',
          price: '100'
        });

      const tourId = createRes.body._id;

      // Update the tour
      const updateRes = await supertest(app)
        .put(`/api/tours/${tourId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Updated Name',
          price: '150'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Updated Name');
    });

    it('should prevent users from updating tours of other users', async () => {
      // Create a tour by user 1
      const createRes = await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Protected Tour',
          info: 'This tour is protected',
          image: 'protected.jpg',
          price: '100'
        });

      const tourId = createRes.body._id;

      // Try to update with user 2's token
      const updateRes = await supertest(app)
        .put(`/api/tours/${tourId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({
          name: 'Hacked Name'
        });

      expect(updateRes.status).toBeGreaterThanOrEqual(400);
    });

    it('should allow users to delete only their own tours', async () => {
      // Create a tour
      const createRes = await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Deletable Tour',
          info: 'This tour can be deleted',
          image: 'deletable.jpg',
          price: '100'
        });

      const tourId = createRes.body._id;

      // Delete the tour
      const deleteRes = await supertest(app)
        .delete(`/api/tours/${tourId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(204);

      // Verify it's deleted
      const getRes = await supertest(app)
        .get(`/api/tours/${tourId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('User authentication and validation', () => {
    it('should reject signup with weak password', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Weak Password User',
          email: 'weak@example.com',
          password: 'weak', // Too weak
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: '1990-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject signup with invalid email format', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Invalid Email User',
          email: 'not-an-email', // Invalid email format
          password: 'R3g5T7#gh',
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: '1990-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should accept signup with strong password and valid email', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Strong Password User',
          email: 'strongpass@example.com',
          password: 'R3g5T7#gh', // Strong password
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: '1990-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
    });

    it('should reject signup with passwords that lack uppercase letters', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'No Uppercase User',
          email: 'nouppercase@example.com',
          password: 'r3g5t7#gh', // lowercase only
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: '1990-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject signup with passwords that lack numbers', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'No Numbers User',
          email: 'nonumbers@example.com',
          password: 'RgTgh#Abc', // no numbers
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: '1990-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject signup with passwords that lack special characters', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'No Special User',
          email: 'nospecial@example.com',
          password: 'R3g5t7Abc', // no special characters
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: '1990-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should allow login with valid credentials', async () => {
      const res = await supertest(app)
        .post('/api/users/login')
        .send({
          email: 'testuser@example.com',
          password: 'R3g5T7#gh'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('testuser@example.com');
    });

    it('should reject login with wrong password', async () => {
      const res = await supertest(app)
        .post('/api/users/login')
        .send({
          email: 'testuser@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('User profile endpoint', () => {
    it('should return authenticated user profile via /me endpoint', async () => {
      const res = await supertest(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(userId.toString());
    });

    it('should reject /me request without authentication', async () => {
      const res = await supertest(app)
        .get('/api/users/me');

      expect(res.status).toBe(401);
    });

    it('should reject /me request with invalid token', async () => {
      const res = await supertest(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer invalid.token.here`);

      expect(res.status).toBe(401);
    });
  });

  describe('Integration: Full user and tour workflow', () => {
    it('should complete a full workflow: signup, create tour, retrieve tour, update tour, delete tour', async () => {
      // Step 1: Signup
      const signupRes = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Workflow User',
          email: 'workflow@example.com',
          password: 'R3g5T7#gh',
          phone_number: '5555555555',
          gender: 'Other',
          date_of_birth: '1995-03-10',
          membership_status: 'Active'
        });

      expect(signupRes.status).toBe(201);
      const workflowToken = signupRes.body.token;

      // Step 2: Create a tour
      const createRes = await supertest(app)
        .post('/api/tours')
        .set('Authorization', `Bearer ${workflowToken}`)
        .send({
          name: 'Workflow Tour',
          info: 'Complete workflow tour',
          image: 'workflow.jpg',
          price: '250'
        });

      expect(createRes.status).toBe(201);
      const tourId = createRes.body._id;

      // Step 3: Retrieve the tour
      const getRes = await supertest(app)
        .get(`/api/tours/${tourId}`)
        .set('Authorization', `Bearer ${workflowToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Workflow Tour');

      // Step 4: Update the tour
      const updateRes = await supertest(app)
        .put(`/api/tours/${tourId}`)
        .set('Authorization', `Bearer ${workflowToken}`)
        .send({
          name: 'Updated Workflow Tour',
          price: '300'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Updated Workflow Tour');

      // Step 5: Delete the tour
      const deleteRes = await supertest(app)
        .delete(`/api/tours/${tourId}`)
        .set('Authorization', `Bearer ${workflowToken}`);

      expect(deleteRes.status).toBe(204);
    });
  });
});
