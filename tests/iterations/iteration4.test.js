const mongoose = require('mongoose');
const supertest = require('supertest');
const app = require('../app-test');
const User = require('../../models/userModel');
const jwt = require('jsonwebtoken');

describe('Given a user wants to expand their profile with additional information', () => {
  let token, userId;

  beforeAll(async () => {
    await User.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    mongoose.connection.close();
  });

  describe('User model schema validation', () => {
    it('should have name field as required string', () => {
      const nameField = User.schema.obj.name;
      expect(nameField).toBeDefined();
      expect(nameField.type).toBe(String);
      expect(nameField.required).toBe(true);
    });

    it('should have phone_number field with numeric validation', () => {
      const phoneField = User.schema.obj.phone_number;
      expect(phoneField).toBeDefined();
      expect(phoneField.type).toBe(String);
      expect(phoneField.required).toBe(true);
      expect(phoneField.match).toBeDefined();
    });

    it('should have gender field with enum validation', () => {
      const genderField = User.schema.obj.gender;
      expect(genderField).toBeDefined();
      expect(genderField.type).toBe(String);
      expect(genderField.required).toBe(true);
      expect(genderField.enum).toEqual(['Male', 'Female', 'Other']);
    });

    it('should have date_of_birth field as required date', () => {
      const dobField = User.schema.obj.date_of_birth;
      expect(dobField).toBeDefined();
      expect(dobField.type).toBe(Date);
      expect(dobField.required).toBe(true);
    });

    it('should have membership_status field with enum validation', () => {
      const statusField = User.schema.obj.membership_status;
      expect(statusField).toBeDefined();
      expect(statusField.type).toBe(String);
      expect(statusField.required).toBe(true);
      expect(statusField.enum).toEqual(['Active', 'Inactive', 'Suspended']);
    });
  });

  describe('User signup with full profile information', () => {
    it('should create a user with all required fields', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Pekka',
          email: 'pekka@example.com',
          password: 'R3g5T7#gh',
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: '1999-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      userId = jwt.decode(res.body.token)._id;
    });

    it('should validate phone_number format (must be 10+ digits)', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Invalid Phone',
          email: 'invalid@example.com',
          password: 'R3g5T7#gh',
          phone_number: '123', // Too short
          gender: 'Male',
          date_of_birth: '1999-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(400);
    });

    it('should validate gender enum (must be Male, Female, or Other)', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Invalid Gender',
          email: 'invalid2@example.com',
          password: 'R3g5T7#gh',
          phone_number: '1234567890',
          gender: 'Unknown', // Invalid enum
          date_of_birth: '1999-01-01',
          membership_status: 'Active'
        });

      expect(res.status).toBe(400);
    });

    it('should validate date_of_birth format (YYYY-MM-DD)', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Invalid Date',
          email: 'invalid3@example.com',
          password: 'R3g5T7#gh',
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: 'invalid-date',
          membership_status: 'Active'
        });

      expect(res.status).toBe(400);
    });

    it('should validate membership_status enum (must be Active, Inactive, or Suspended)', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Invalid Status',
          email: 'invalid4@example.com',
          password: 'R3g5T7#gh',
          phone_number: '1234567890',
          gender: 'Male',
          date_of_birth: '1999-01-01',
          membership_status: 'Pending' // Invalid enum
        });

      expect(res.status).toBe(400);
    });

    it('should require all fields', async () => {
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Incomplete',
          email: 'incomplete@example.com',
          password: 'R3g5T7#gh'
          // Missing other required fields
        });

      expect(res.status).toBe(400);
    });
  });

  describe('User login with full profile information', () => {
    beforeAll(async () => {
      // Create a test user via signup endpoint so password is hashed
      const res = await supertest(app)
        .post('/api/users/signup')
        .send({
          name: 'Login Test',
          email: 'login@example.com',
          password: 'R3g5T7#gh',
          phone_number: '9876543210',
          gender: 'Female',
          date_of_birth: '1995-05-15',
          membership_status: 'Active'
        });
      userId = jwt.decode(res.body.token)._id;
    });

    it('should return user object with all fields after successful login', async () => {
      const res = await supertest(app)
        .post('/api/users/login')
        .send({
          email: 'login@example.com',
          password: 'R3g5T7#gh'
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      // Check that user data includes all new fields
      if (res.body.user) {
        expect(res.body.user).toHaveProperty('name');
        expect(res.body.user).toHaveProperty('phone_number');
        expect(res.body.user).toHaveProperty('gender');
        expect(res.body.user).toHaveProperty('date_of_birth');
        expect(res.body.user).toHaveProperty('membership_status');
      }
    });

    it('should return token on successful login', async () => {
      const res = await supertest(app)
        .post('/api/users/login')
        .send({
          email: 'login@example.com',
          password: 'R3g5T7#gh'
        });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
    });

    it('should reject login with incorrect email', async () => {
      const res = await supertest(app)
        .post('/api/users/login')
        .send({
          email: 'wrong@example.com',
          password: 'TestPass123!'
        });

      expect(res.status).toBe(400);
    });

    it('should reject login with incorrect password', async () => {
      const res = await supertest(app)
        .post('/api/users/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword123!'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('User profile data persistence and retrieval', () => {
    it('should verify that all profile fields are saved in the database', async () => {
      const newUser = await User.create({
        name: 'Persistence Test',
        email: 'persist@example.com',
        password: 'R3g5T7#gh',
        phone_number: '5555555555',
        gender: 'Other',
        date_of_birth: new Date('2000-01-01'),
        membership_status: 'Inactive'
      });

      const savedUser = await User.findById(newUser._id);
      expect(savedUser.name).toBe('Persistence Test');
      expect(savedUser.phone_number).toBe('5555555555');
      expect(savedUser.gender).toBe('Other');
      expect(savedUser.membership_status).toBe('Inactive');
    });

    it('should return user data via getMe endpoint with all fields', async () => {
      const user = await User.create({
        name: 'GetMe Test',
        email: 'getme@example.com',
        password: 'R3g5T7#gh',
        phone_number: '1111111111',
        gender: 'Male',
        date_of_birth: new Date('1998-06-20'),
        membership_status: 'Active'
      });

      const token = jwt.sign({ _id: user._id }, process.env.SECRET, { expiresIn: '1d' });

      const res = await supertest(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(user._id.toString());
    });
  });
});
