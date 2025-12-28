/**
 * End-to-End Test Suite for User Management
 * Tests the complete flow from user creation to profile management
 */

const request = require('supertest');
const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8002';
const FRONTEND_URL = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

// Test utilities
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test data
const testUser = {
  email: 'test.user@example.com',
  password: 'TestPass123!',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890',
  employee_code: 'TEST001',
  role_name: 'company_admin',
  department: 'IT',
  designation: 'Software Engineer'
};

const testBranch = {
  name: 'Test Branch',
  code: 'TEST-001',
  address: '123 Test Street',
  city: 'Test City',
  state: 'Test State',
  country: 'India',
  postal_code: '123456',
  phone: '+1234567890',
  email: 'test@test.com'
};

let authToken = null;
let createdUserId = null;
let createdRoleId = null;
let createdBranchId = null;

describe('User Management E2E Tests', () => {
  beforeAll(async () => {
    console.log('\n🚀 Starting User Management E2E Tests');
    console.log(`API URL: ${BASE_URL}`);
    console.log(`Frontend URL: ${FRONTEND_URL}`);

    // Wait for services to be ready
    await delay(2000);
  });

  describe('Role Management', () => {
    test('should list default roles', async () => {
      const response = await request(BASE_URL)
        .get('/roles')
        .expect(200)
        .expect('Content-Type', /json/);

      const roles = response.body;
      expect(Array.isArray(roles)).toBe(true);
      expect(roles.length).toBeGreaterThan(0);

      // Check for required roles
      const roleNames = roles.map(r => r.role_name);
      expect(roleNames).toContain('company_admin');
      expect(roleNames).toContain('finance_manager');
      expect(roleNames).toContain('branch_manager');
      expect(roleNames).toContain('logistics_manager');
      expect(roleNames).toContain('driver');

      console.log('✅ Found', roles.length, 'default roles');
    });

    test('should create a custom role', async () => {
      const roleData = {
        name: 'test_role',
        display_name: 'Test Role',
        description: 'A test role for E2E testing',
        permissions: ['users:read', 'users:write'],
        is_active: true
      };

      const response = await request(BASE_URL)
        .post('/roles')
        .send(roleData)
        .expect(201)
        .expect('Content-Type', /json/);

      createdRoleId = response.body.id;
      expect(response.body.name).toBe(roleData.name);
      expect(response.body.display_name).toBe(roleData.display_name);

      console.log('✅ Created custom role:', response.body.display_name);
    });
  });

  describe('Branch Management', () => {
    test('should create a test branch', async () => {
      const response = await request(BASE_URL)
        .post('/branches')
        .send(testBranch)
        .expect(201)
        .expect('Content-Type', /json/);

      createdBranchId = response.body.id;
      expect(response.body.name).toBe(testBranch.name);
      expect(response.body.code).toBe(testBranch.code);

      console.log('✅ Created test branch:', response.body.name);
    });
  });

  describe('User Management', () => {
    test('should create a new user', async () => {
      const userData = {
        user_id: `user_${Date.now()}`,
        employee_code: testUser.employee_code,
        role_id: createdRoleId,
        branch_id: createdBranchId,
        first_name: testUser.first_name,
        last_name: testUser.last_name,
        phone: testUser.phone,
        email: testUser.email,
        department: testUser.department,
        designation: testUser.designation,
        is_active: true
      };

      const response = await request(BASE_URL)
        .post('/users')
        .send(userData)
        .expect(201)
        .expect('Content-Type', /json/);

      createdUserId = response.body.id;
      expect(response.body.email).toBe(testUser.email);
      expect(response.body.first_name).toBe(testUser.first_name);
      expect(response.body.employee_code).toBe(testUser.employee_code);

      console.log('✅ Created user:', `${testUser.first_name} ${testUser.last_name}`);
    });

    test('should list users', async () => {
      const response = await request(BASE_URL)
        .get('/users')
        .expect(200)
        .expect('Content-Type', /json/);

      const users = response.body.data;
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);

      const createdUser = users.find(u => u.id === createdUserId);
      expect(createdUser).toBeDefined();

      console.log('✅ Listed', users.length, 'users');
    });

    test('should filter users by role', async () => {
      const response = await request(BASE_URL)
        .get(`/users?role_id=${createdRoleId}`)
        .expect(200)
        .expect('Content-Type', /json/);

      const users = response.body.data;
      const filteredUsers = users.filter(u => u.role_id === createdRoleId);

      expect(filteredUsers.length).toBe(1);
      expect(filteredUsers[0].id).toBe(createdUserId);

      console.log('✅ Role filtering works - found 1 user');
    });

    test('should update user status', async () => {
      const response = await request(BASE_URL)
        .post(`/users/${createdUserId}/deactivate`)
        .expect(200);

      expect(response.body.is_active).toBe(false);

      console.log('✅ User deactivated successfully');
    });

    test('should reactivate user', async () => {
      const response = await request(BASE_URL)
        .post(`/users/${createdUserId}/activate`)
        .expect(200);

      expect(response.body.is_active).toBe(true);

      console.log('✅ User reactivated successfully');
    });
  });

  describe('Profile Management', () => {
    test('should get user profile completion', async () => {
      const response = await request(BASE_URL)
        .get(`/profiles/${createdUserId}/completion`)
        .expect(200)
        .expect('Content-Type', /json/);

      const completion = response.body;
      expect(completion).toHaveProperty('percentage');
      expect(completion).toHaveProperty('missing_sections');

      console.log('✅ Profile completion:', `${completion.percentage}% complete`);
    });

    test('should create driver profile', async () => {
      // First, update user to be a driver
      const driverRoleResponse = await request(BASE_URL)
        .get('/roles')
        .expect(200);

      const driverRole = driverRoleResponse.body.find(r => r.role_name === 'driver');
      expect(driverRole).toBeDefined();

      await request(BASE_URL)
        .put(`/users/${createdUserId}`)
        .send({ role_id: driverRole.id });

      // Now create driver profile
      const driverProfileData = {
        license_number: 'DL123456789',
        license_type: 'heavy_motor',
        issue_date: '2020-01-01',
        expiry_date: '2025-12-31',
        issuing_authority: 'RTO Maharashtra',
        experience_years: 5
      };

      const response = await request(BASE_URL)
        .post('/profiles/drivers')
        .send({
          employee_id: createdUserId,
          ...driverProfileData
        })
        .expect(201)
        .expect('Content-Type', /json/);

      expect(response.body.license_number).toBe(driverProfileData.license_number);

      console.log('✅ Created driver profile');
    });
  });

  describe('Document Management', () => {
    test('should list user documents', async () => {
      const response = await request(BASE_URL)
        .get(`/profiles/${createdUserId}/documents`)
        .expect(200)
        .expect('Content-Type', /json/);

      const documents = response.body.data || [];
      expect(Array.isArray(documents)).toBe(true);

      console.log('✅ Listed', documents.length, 'documents');
    });

    test('should upload a document', async () => {
      // Create a test file
      const testFilePath = path.join(__dirname, 'test-document.pdf');
      require('fs').writeFileSync(testFilePath, 'Test document content');

      const formData = {
        document_type: 'passport',
        document_name: 'Test Passport',
        file: require('fs').createReadStream(testFilePath)
      };

      try {
        const response = await request(BASE_URL)
          .post(`/profiles/${createdUserId}/documents`)
          .attach('file', testFilePath)
          .field('document_type', formData.document_type)
          .field('document_name', formData.document_name)
          .expect(200)
          .expect('Content-Type', /json/);

        console.log('✅ Document uploaded successfully');
      } finally {
        // Clean up test file
        require('fs').unlinkSync(testFilePath);
      }
    });
  });

  describe('Search and Export', () => {
    test('should search users', async () => {
      const searchData = {
        search: 'John',
        limit: 10
      };

      const response = await request(BASE_URL)
        .post('/users/search')
        .send(searchData)
        .expect(200)
        .expect('Content-Type', /json/);

      const results = response.body.data || [];
      expect(Array.isArray(results)).toBe(true);

      const searchResults = results.filter(u =>
        u.first_name.toLowerCase().includes('john') ||
        u.last_name.toLowerCase().includes('john')
      );

      console.log('✅ Search found', searchResults.length, 'results');
    });

    test('should export users', async () => {
      const exportData = {
        format: 'csv',
        filters: {
          role_id: createdRoleId,
          is_active: true
        }
      };

      const response = await request(BASE_URL)
        .post('/users/export')
        .send(exportData)
        .expect(200)
        .expect('Content-Type', 'text/csv');

      expect(response.headers['content-type']).toMatch(/text\/csv/);

      console.log('✅ Export successful');
    });
  });

  describe('Edge Cases', () => {
    test('should handle duplicate email validation', async () => {
      const duplicateUser = {
        ...testUser,
        email: testUser.email, // Same email
        employee_code: 'TEST002'
      };

      const response = await request(BASE_URL)
        .post('/users')
        .send(duplicateUser)
        .expect(400);

      expect(response.body.detail).toContain('already exists');

      console.log('✅ Duplicate email validation works');
    });

    test('should handle invalid role ID', async () => {
      const invalidRoleUser = {
        ...testUser,
        role_id: 'invalid-role-id',
        employee_code: 'TEST003'
      };

      const response = await request(BASE_URL)
        .post('/users')
        .send(invalidRoleUser)
        .expect(400);

      expect(response.body.detail).toContain('not found');

      console.log('✅ Invalid role validation works');
    });

    test('should handle invalid branch ID', async () => {
      const invalidBranchUser = {
        ...testUser,
        role_id: createdRoleId,
        branch_id: 'invalid-branch-id',
        employee_code: 'TEST004'
      };

      const response = await request(BASE_URL)
        .post('/users')
        .send(invalidBranchUser)
        .expect(400);

      expect(response.body.detail).toContain('not found');

      console.log('✅ Invalid branch validation works');
    });
  });

  afterAll(async () => {
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');

    try {
      // Delete test user
      if (createdUserId) {
        await request(BASE_URL).delete(`/users/${createdUserId}`);
        console.log('✅ Deleted test user');
      }

      // Delete test role
      if (createdRoleId) {
        await request(BASE_URL).delete(`/roles/${createdRoleId}`);
        console.log('✅ Deleted test role');
      }

      // Delete test branch
      if (createdBranchId) {
        await request(BASE_URL).delete(`/branches/${createdBranchId}`);
        console.log('✅ Deleted test branch');
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }

    console.log('\n✅ All E2E tests completed!');
  });
});