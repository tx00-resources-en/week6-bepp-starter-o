const fs = require('fs');
const path = require('path');
const supertest = require('supertest');
const app = require('../app-test'); // Adjust path if needed

describe('Setup', () => {
  
  describe('Given the project repository', () => {
    describe('When checking for environment configuration', () => {
      it('Then a .env.example file should exist containing PORT, MONGO_URI, and SECRET', () => {
        const envExamplePath = path.resolve(__dirname, '../../.env.example');
        expect(fs.existsSync(envExamplePath)).toBe(true);
        const envContent = fs.readFileSync(envExamplePath, 'utf8');
        expect(envContent).toMatch(/PORT=/);
        expect(envContent).toMatch(/MONGO_URI=/);
        expect(envContent).toMatch(/SECRET/);
      });
    });
  });

  describe('Given the project dependencies', () => {
    describe('When npm install has been run', () => {
      it('Then node_modules should contain express', () => {
        const nodeModulesPath = path.resolve(__dirname, '../../node_modules');
        expect(fs.existsSync(nodeModulesPath)).toBe(true);
        const expressPath = path.resolve(nodeModulesPath, 'express');
        expect(fs.existsSync(expressPath)).toBe(true);
      });
    });
  });

  describe('Given the application server', () => {
    describe('When sending a GET request to "/"', () => {
      it('Then the response should be 200 and contain "API Running!"', async () => {
        const request = supertest(app);
        const res = await request.get('/');
        expect(res.status).toBe(200);
        expect(res.text).toMatch(/API Running!/);
      });
    });
  });

});
