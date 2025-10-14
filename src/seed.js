require('dotenv').config();
const bcrypt = require('bcrypt');
// Fix path to Models (capital M)
const {
  sequelize,
  Department,
  Category,
  Employee,
  // Buy/Sell
  Product,
  ProductImage,
  ProductInterest,
  ProductFlag,
  ProductComment,
  Notification,
  // Vehicle Rental
  Vehicle,
  RentalLog,
  // IT Assets
  Asset,
  Assignment,
  // Audits
  AuditItAdmin,
  AuditAdmin,
} = require('./Models');

async function seed() {
  let t;
  try {
    await sequelize.authenticate();
    await sequelize.sync();

    t = await sequelize.transaction();

    console.log('[seed] Seeding Departments...');
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
    for (const d of depts) {
      await Department.findOrCreate({ where: { dept_id: d.dept_id }, defaults: d, transaction: t });
    }

    console.log('[seed] Seeding Categories...');
    const cats = [
      { category_id: 'CLEAN', category_name: 'Cleaning' },
      { category_id: 'AC', category_name: 'AC' },
      { category_id: 'PLUMB', category_name: 'Plumbing' },
      { category_id: 'ELEC', category_name: 'Electrical' },
      { category_id: 'FURN', category_name: 'Furniture' },
      { category_id: 'PANTRY', category_name: 'Pantry' },
      { category_id: 'PARKING', category_name: 'Parking' },
    ];
    for (const c of cats) {
      await Category.findOrCreate({ where: { category_id: c.category_id }, defaults: c, transaction: t });
    }

    // Admin (env-driven)
    console.log('[seed] Seeding Default Admin...');
    const adminDefaults = {
      id: process.env.ADMIN_ID || 'E-ADMIN',
      name: process.env.ADMIN_NAME || 'Admin User',
      phone: process.env.ADMIN_PHONE || '9999999999',
      email: process.env.ADMIN_EMAIL || 'admin@company.local',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: process.env.ADMIN_ROLE || 'admin', // must be one of: employee, admin, staff, it_admin
      departmentId: process.env.ADMIN_DEPARTMENT_ID || 'ENE-HR',
    };

    // Ensure admin department exists even if not in default list
    await Department.findOrCreate({
      where: { dept_id: adminDefaults.departmentId },
      defaults: { dept_id: adminDefaults.departmentId, dept_name: adminDefaults.departmentId },
      transaction: t,
    });

    const [admin, created] = await Employee.findOrCreate({
      where: { email: adminDefaults.email },
      defaults: {
        employee_id: adminDefaults.id,
        name: adminDefaults.name,
        phone_no: adminDefaults.phone,
        email: adminDefaults.email,
        password: await bcrypt.hash(adminDefaults.password, 10),
        role: adminDefaults.role,
        department_id: adminDefaults.departmentId,
      },
      transaction: t,
    });

    if (created) {
      console.log(`[seed] Admin created: ${adminDefaults.email}`);
    } else {
      console.log(`[seed] Admin already exists: ${adminDefaults.email}`);
    }

    // Create a default staff user (for buy/sell & rentals)
    console.log('[seed] Ensuring default Staff user...');
    const staffDefaults = {
      id: process.env.STAFF1_ID || 'E-STAFF1',
      name: process.env.STAFF1_NAME || 'Staff One',
      phone: process.env.STAFF1_PHONE || '8888888888',
      email: process.env.STAFF1_EMAIL || 'staff1@company.local',
      password: process.env.STAFF1_PASSWORD || 'staff123',
      role: 'staff',
      departmentId: process.env.STAFF1_DEPARTMENT_ID || 'ENE-HK',
    };
    await Department.findOrCreate({
      where: { dept_id: staffDefaults.departmentId },
      defaults: { dept_id: staffDefaults.departmentId, dept_name: staffDefaults.departmentId },
      transaction: t,
    });
    const [staff, staffCreated] = await Employee.findOrCreate({
      where: { email: staffDefaults.email },
      defaults: {
        employee_id: staffDefaults.id,
        name: staffDefaults.name,
        phone_no: staffDefaults.phone,
        email: staffDefaults.email,
        password: await bcrypt.hash(staffDefaults.password, 10),
        role: staffDefaults.role,
        department_id: staffDefaults.departmentId,
      },
      transaction: t,
    });
    if (staffCreated) console.log(`[seed] Staff created: ${staffDefaults.email}`);

    // =========================
    // Buy/Sell Seed
    // =========================
    console.log('[seed] Seeding Buy/Sell...');
    const sellerId = admin.get('employee_id');
    const buyerId = staff.get('employee_id');

    const [product, productCreated] = await Product.findOrCreate({
      where: { name: 'Office Chair', seller_id: sellerId },
      defaults: {
        seller_id: sellerId,
        name: 'Office Chair',
        description: 'Comfortable mesh office chair with adjustable height.',
        price: 3500.00,
        status: 'active',
      },
      transaction: t,
    });
    if (productCreated) console.log('[seed] Product created: Office Chair');

    await ProductImage.findOrCreate({
      where: { product_id: product.id, url: 'https://example.com/images/chair-1.jpg' },
      defaults: { product_id: product.id, url: 'https://example.com/images/chair-1.jpg', order_index: 0 },
      transaction: t,
    });

    await ProductInterest.findOrCreate({
      where: { product_id: product.id, buyer_id: buyerId },
      defaults: { product_id: product.id, buyer_id: buyerId },
      transaction: t,
    });

    await ProductComment.findOrCreate({
      where: { product_id: product.id, commenter_id: buyerId, text: 'Is this still available?' },
      defaults: { product_id: product.id, commenter_id: buyerId, text: 'Is this still available?' },
      transaction: t,
    });

    await ProductFlag.findOrCreate({
      where: { product_id: product.id, reporter_id: buyerId, reason: 'Test flag: inappropriate content' },
      defaults: { product_id: product.id, reporter_id: buyerId, reason: 'Test flag: inappropriate content', status: 'open' },
      transaction: t,
    });

    await Notification.findOrCreate({
      where: { recipient_id: sellerId, type: 'info', message: 'Welcome to Buy/Sell!' },
      defaults: { recipient_id: sellerId, type: 'info', message: 'Welcome to Buy/Sell!', meta: { seeded: true } },
      transaction: t,
    });

    // Vehicle Rental: skip seeding vehicles/logs; admin will create vehicles manually

    // =========================
    // IT Assets Seed
    // =========================
    console.log('[seed] Seeding IT Assets...');
    const assetUUID = '00000000-0000-0000-0000-000000000001';
    const [asset] = await Asset.findOrCreate({
      where: { assetId: 'ASSET-001' },
      defaults: {
        id: assetUUID,
        assetId: 'ASSET-001',
        serialNumber: 'SN-001',
        assetType: 'laptop',
        brand: 'Dell',
        model: 'Latitude 7420',
        cpu: 'Intel i7',
        ram: '16GB',
        storage: '512GB SSD',
        os: 'Windows 11 Pro',
        status: 'active',
        location: 'HQ-IT-Store',
      },
      transaction: t,
    });

    await Assignment.findOrCreate({
      where: { assetId: asset.id, employeeId: buyerId, status: 'active' },
      defaults: {
        id: '00000000-0000-0000-0000-000000000101',
        assetId: asset.id,
        employeeId: buyerId,
        assignedBy: sellerId,
        status: 'active',
        notes: 'Seed assignment',
      },
      transaction: t,
    });

    // =========================
    // Audits Seed
    // =========================
    console.log('[seed] Seeding Audits...');
    await AuditAdmin.findOrCreate({
      where: { userId: sellerId, action: 'SEED_CREATE', entityType: 'Product', entityId: String(product.id) },
      defaults: { userId: sellerId, action: 'SEED_CREATE', entityType: 'Product', entityId: String(product.id), metadata: { seeded: true } },
      transaction: t,
    });
    await AuditItAdmin.findOrCreate({
      where: { userId: sellerId, action: 'SEED_ASSIGN', entityType: 'Asset', entityId: asset.assetId },
      defaults: { userId: sellerId, action: 'SEED_ASSIGN', entityType: 'Asset', entityId: asset.assetId, metadata: { seeded: true } },
      transaction: t,
    });

    await t.commit();

    console.log('Seed done');
    process.exit(0);
  } catch (err) {
    console.error('[seed] Error:', err);
    if (t) {
      try { await t.rollback(); } catch (_) {}
    }
    process.exit(1);
  }
}

seed();