'use strict';

module.exports = {
  async up(queryInterface) {
    const now = new Date();

    // Departments
    await queryInterface.bulkInsert('departments', [
      { dept_id: 'OPS', dept_name: 'Operations' },
      { dept_id: 'IT', dept_name: 'IT' },
      { dept_id: 'HR', dept_name: 'HR' },
    ], { ignoreDuplicates: true });

    // Default Admin Employee (password must be set via app flow; here set to a placeholder hash or plain for dev)
    const admin = [{
      employee_id: 'ADMIN001',
      name: 'Admin User',
      email: 'admin@example.com',
      phone_no: '9999999999',
      password: '$2b$10$replace_with_real_hash',
      role: 'admin',
      department_id: 'IT',
      manager_id: null,
      otp_code: null,
      otp_expires_at: null,
      created_at: now,
    }];
    // Try insert, ignore if exists by unique keys
    try { await queryInterface.bulkInsert('employees', admin, {}); } catch (_) {}

    // Categories
    await queryInterface.bulkInsert('categories', [
      { category_id: 'CLEAN', category_name: 'Cleaning' },
      { category_id: 'MAINT', category_name: 'Maintenance' },
    ], { ignoreDuplicates: true });

    // Vehicles (sample plates must be unique)
    await queryInterface.bulkInsert('vehicles', [
      { name: 'Honda Activa', type: 'scooter', wheelers: '2', plate: 'SC-001', status: 'available', created_at: now },
      { name: 'NEON', type: 'car', wheelers: '4', plate: 'CR-001', status: 'available', created_at: now },
    ], {});
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('vehicles', { plate: ['SC-001', 'CR-001'] }, {});
    await queryInterface.bulkDelete('categories', { category_id: ['CLEAN', 'MAINT'] }, {});
    await queryInterface.bulkDelete('employees', { employee_id: 'ADMIN001' }, {});
    await queryInterface.bulkDelete('departments', { dept_id: ['OPS', 'IT', 'HR'] }, {});
  }
};
