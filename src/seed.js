require('dotenv').config();
const bcrypt = require('bcrypt');
// Fix path to Models (capital M)
const { sequelize, Department, Category, Employee } = require('./Models');

async function seed() {
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    const depts = [
      { dept_id: 'ENE-HK', dept_name: 'Housekeeping' },
      { dept_id: 'ENE-MAINT', dept_name: 'Maintenance' },
      { dept_id: 'ENE-CAN', dept_name: 'Canteen' },
      { dept_id: 'ENE-SEC', dept_name: 'Security' },
      { dept_id: 'ENE-IT', dept_name: 'IT' },
      { dept_id: 'ENE-HR', dept_name: 'HR' },
      { dept_id: 'ENE-SALES', dept_name: 'Sales/Tender' },
      { dept_id: 'ENE-OPS', dept_name: 'Operations' },
      { dept_id: 'ENE-ACC', dept_name: 'Accounts' },
      { dept_id: 'ENE-RND', dept_name: 'R&D' },
      { dept_id: 'ENE-CAL', dept_name: 'Calibration' },
      { dept_id: 'ENE-PROD', dept_name: 'Production' },
      { dept_id: 'ENE-AQMS', dept_name: 'AQMS' },
      { dept_id: 'ENE-CEMS', dept_name: 'CEMS' },
      { dept_id: 'ENE-WATER', dept_name: 'Water Analyzer' },
      { dept_id: 'ENE-PIZO', dept_name: 'Pizometer' },
      { dept_id: 'ENE-STORE', dept_name: 'Store' },
      { dept_id: 'ENE-PACK', dept_name: 'Packaging' },
      { dept_id: 'ENE-MCOMM', dept_name: 'Marketing Communication' },
    ];
    for (const d of depts) await Department.findOrCreate({ where: { dept_id: d.dept_id }, defaults: d });

    const cats = [
      { category_id: 'CLEAN', category_name: 'Cleaning' },
      { category_id: 'AC', category_name: 'AC' },
      { category_id: 'PLUMB', category_name: 'Plumbing' },
      { category_id: 'ELEC', category_name: 'Electrical' },
      { category_id: 'FURN', category_name: 'Furniture' },
      { category_id: 'PANTRY', category_name: 'Pantry' },
      { category_id: 'PARKING', category_name: 'Parking' },
    ];
    for (const c of cats) await Category.findOrCreate({ where: { category_id: c.category_id }, defaults: c });

    // Admin
    const adminEmail = 'admin@company.local';
    const [admin, created] = await Employee.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        employee_id: 'E-ADMIN',
        name: 'Admin User',
        phone_no: '9999999999',
        email: adminEmail,
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
        department_id: 'ENE-HR'
      }
    });

    console.log('Seed done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();