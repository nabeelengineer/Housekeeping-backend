require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { sequelize } = require('./Models');
const authRoutes = require('./routes/auth');
const deptRoutes = require('./routes/department');
const catRoutes = require('./routes/categories');
const empRoutes = require('./routes/employees');
const reqRoutes = require('./routes/request');
const marketRoutes = require('./routes/market');
const vehicleRoutes = require('./routes/vehicles');
const notificationRoutes = require('./routes/notifications');
const assetsRoutes = require('./routes/assets');
const assignmentsRoutes = require('./routes/assignments');
const meRoutes = require('./routes/me');

const app = express();
const PORT = process.env.PORT || 4000;
app.use(bodyParser.json());
app.use(cors({ origin: 'http://localhost:5173' }));
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/departments', deptRoutes);
app.use('/api/categories', catRoutes);
app.use('/api/employees', empRoutes);
app.use('/api/requests', reqRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/assignments', assignmentsRoutes);
app.use('/api/me', meRoutes);


(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    // Safe migration: extend employees.role enum with 'it_admin' if not present
    try {
      const [rows] = await sequelize.query("SHOW COLUMNS FROM `employees` LIKE 'role'");
      if (rows && rows[0] && !String(rows[0].Type).includes('it_admin')) {
        await sequelize.query("ALTER TABLE employees MODIFY COLUMN role ENUM('employee','admin','staff','it_admin') NOT NULL DEFAULT 'employee'");
        console.log("Extended employees.role enum with 'it_admin'");
      }
    } catch (roleErr) {
      console.warn('Role enum migration skipped or failed:', roleErr?.message || roleErr);
    }
    // Safe, one-off migration: add 'price' column to products if missing
    try {
      const [cols] = await sequelize.query("SHOW COLUMNS FROM `products` LIKE 'price'");
      if (!cols || cols.length === 0) {
        await sequelize.query('ALTER TABLE `products` ADD COLUMN `price` DECIMAL(10,2) NULL AFTER `description`');
        console.log("Added 'price' column to products");
      }
    } catch (mErr) {
      console.warn('Price column check/add failed or not applicable:', mErr?.message || mErr);
    }
    // Safe migration: add 'floor' and 'unit' to requests if missing
    try {
      const [floorCol] = await sequelize.query("SHOW COLUMNS FROM `requests` LIKE 'floor'");
      if (!floorCol || floorCol.length === 0) {
        await sequelize.query("ALTER TABLE `requests` ADD COLUMN `floor` VARCHAR(50) NULL AFTER `description`");
        console.log("Added 'floor' column to requests");
      }
      const [unitCol] = await sequelize.query("SHOW COLUMNS FROM `requests` LIKE 'unit'");
      if (!unitCol || unitCol.length === 0) {
        await sequelize.query("ALTER TABLE `requests` ADD COLUMN `unit` VARCHAR(50) NULL AFTER `floor`");
        console.log("Added 'unit' column to requests");
      }
    } catch (reqMigErr) {
      console.warn('Request columns migration skipped or failed:', reqMigErr?.message || reqMigErr);
    }
    // Use plain sync to create new tables without altering existing ones to avoid excessive index churn
    await sequelize.sync();
    console.log('Models synced');
    // Safe migration: ensure assets.status enum includes 'assigned' and add typeDetail column if missing
    try {
      const [assetsTbl] = await sequelize.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assets'");
      if (assetsTbl && assetsTbl.length > 0) {
        // Extend status enum
        const [statusCol] = await sequelize.query("SHOW COLUMNS FROM `assets` LIKE 'status'");
        const typeStr = String(statusCol?.[0]?.Type || '');
        if (typeStr && !typeStr.includes("'assigned'")) {
          await sequelize.query("ALTER TABLE `assets` MODIFY COLUMN `status` ENUM('active','assigned','repair','retired') NOT NULL DEFAULT 'active'");
          console.log("Extended assets.status enum with 'assigned'");
        }
        // Add typeDetail column if missing
        const [typeDetailCol] = await sequelize.query("SHOW COLUMNS FROM `assets` LIKE 'typeDetail'");
        if (!typeDetailCol || typeDetailCol.length === 0) {
          await sequelize.query("ALTER TABLE `assets` ADD COLUMN `typeDetail` VARCHAR(64) NULL AFTER `assetType`");
          console.log("Added assets.typeDetail column");
        }
        // Ensure unique index on assetId
        const [idxRows] = await sequelize.query("SHOW INDEX FROM `assets` WHERE Key_name = 'ux_assets_assetId'");
        if (!idxRows || idxRows.length === 0) {
          await sequelize.query("CREATE UNIQUE INDEX `ux_assets_assetId` ON `assets` (`assetId`)");
          console.log('Created unique index ux_assets_assetId');
        }
      }
    } catch (assetMigErr) {
      console.warn('Assets table migration skipped or failed:', assetMigErr?.message || assetMigErr);
    }
    // Safe migration: ensure assignments has retired fields and status enum includes 'retired'
    try {
      const [assTbl] = await sequelize.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments'");
      if (assTbl && assTbl.length > 0) {
        // Extend status enum with 'retired'
        try {
          const [statusCol] = await sequelize.query("SHOW COLUMNS FROM `assignments` LIKE 'status'");
          const typeStr = String(statusCol?.[0]?.Type || '');
          if (typeStr && !typeStr.includes("'retired'")) {
            await sequelize.query("ALTER TABLE `assignments` MODIFY COLUMN `status` ENUM('active','returned','retired') NOT NULL DEFAULT 'active'");
            console.log("Extended assignments.status enum with 'retired'");
          }
        } catch (e) {
          console.warn('Assignments.status enum migration skipped or failed:', e?.message || e);
        }
        // Add retired boolean
        const [retiredCol] = await sequelize.query("SHOW COLUMNS FROM `assignments` LIKE 'retired'");
        if (!retiredCol || retiredCol.length === 0) {
          await sequelize.query("ALTER TABLE `assignments` ADD COLUMN `retired` TINYINT(1) NOT NULL DEFAULT 0 AFTER `conditionOnReturn`");
          console.log("Added assignments.retired column");
        }
        // Add retireReason
        const [retireReasonCol] = await sequelize.query("SHOW COLUMNS FROM `assignments` LIKE 'retireReason'");
        if (!retireReasonCol || retireReasonCol.length === 0) {
          await sequelize.query("ALTER TABLE `assignments` ADD COLUMN `retireReason` VARCHAR(255) NULL AFTER `retired`");
          console.log("Added assignments.retireReason column");
        }
        // Add retiredBy
        const [retiredByCol] = await sequelize.query("SHOW COLUMNS FROM `assignments` LIKE 'retiredBy'");
        if (!retiredByCol || retiredByCol.length === 0) {
          await sequelize.query("ALTER TABLE `assignments` ADD COLUMN `retiredBy` VARCHAR(64) NULL AFTER `retireReason`");
          console.log("Added assignments.retiredBy column");
        }
      }
    } catch (assignMigErr) {
      console.warn('Assignments table migration skipped or failed:', assignMigErr?.message || assignMigErr);
    }
    // Add generated column + unique index for one-active-assignment rule, after table exists
    try {
      const [tbl] = await sequelize.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'assignments'");
      if (tbl && tbl.length > 0) {
        const [col] = await sequelize.query("SHOW COLUMNS FROM `assignments` LIKE 'active_only'");
        if (!col || col.length === 0) {
          await sequelize.query("ALTER TABLE `assignments` ADD COLUMN `active_only` CHAR(36) GENERATED ALWAYS AS (CASE WHEN status='active' THEN assetId ELSE NULL END) STORED");
          await sequelize.query("CREATE UNIQUE INDEX `ux_assign_one_active` ON `assignments` (`active_only`)");
          console.log('Added generated column and unique index for assignments.active_only');
        }
      }
    } catch (genErr) {
      console.warn('Generated column/index migration skipped or failed:', genErr?.message || genErr);
    }
    // Seed default vehicles if table is empty
    try {
      const Vehicle = sequelize.models.Vehicle;
      if (Vehicle) {
        const count = await Vehicle.count();
        if (count === 0) {
          await Vehicle.bulkCreate([
            { type: 'bike', plate: 'BK-001', status: 'available', created_at: new Date() },
            { type: 'scooty', plate: 'SC-001', status: 'available', created_at: new Date() },
            { type: 'car', plate: 'CR-001', status: 'available', created_at: new Date() },
          ]);
          console.log('Seeded default vehicles');
        }
      }
    } catch (seedErr) {
      console.warn('Vehicle seed skipped:', seedErr?.message || seedErr);
    }
    app.listen(PORT, () => console.log(`Server running on ${PORT}`));
  } catch (err) {
    console.error('Failed to start', err);
  }
})();