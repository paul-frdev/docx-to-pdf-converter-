import request from 'supertest';
import app from '../../src/app';

describe('Smoke Test - Express App Initialization', () => {
  it('should successfully run health check route to verify imports and configurations', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'OK');
  });
});
