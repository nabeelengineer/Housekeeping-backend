require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { sequelize } = require('./Models');
const { Sequelize } = require('sequelize');
const baseMigration = require('./migrations/20251013_000_base_schema');
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
// Security middleware
app.use(helmet());
app.use(helmet.hsts({
  maxAge: 31536000, // 1 year
  includeSubDomains: true,
  preload: true
}));
app.use(helmet.referrerPolicy({ policy: 'same-origin' }));

// Request logging
app.use(morgan('combined'));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for development
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Simple CORS configuration for development
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed list or is a localhost URL
    const allowedOrigins = [
      'http://3.91.212.140',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000'
    ];
    
    // Add any additional origins from environment variable
    const envOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
    const allAllowedOrigins = [...new Set([...allowedOrigins, ...envOrigins])];
    
    if (allAllowedOrigins.includes(origin) || 
        allAllowedOrigins.some(allowed => origin.startsWith(allowed))) {
      return callback(null, true);
    }
    
    // For development, you might want to allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parsing with increased limit for file uploads
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static('uploads', {
  maxAge: '1y',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.set('Content-Disposition', 'inline');
    }
  }
}));

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    database: 'unknown',
    status: 'ok'
  };

  try {
    // Check database connection
    await sequelize.authenticate();
    healthcheck.database = 'connected';
    res.json(healthcheck);
  } catch (err) {
    healthcheck.database = 'disconnected';
    healthcheck.error = err.message;
    res.status(503).json(healthcheck);
  }
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested resource was not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ 
      error: 'Invalid Token',
      message: 'The provided token is invalid'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ 
      error: 'Token Expired',
      message: 'Your session has expired. Please log in again.'
    });
  }

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Validation failed',
      details: err.errors ? err.errors.map(e => ({
        field: e.path,
        message: e.message
      })) : [err.message]
    });
  }

  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Not allowed by CORS policy'
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Database and server initialization
(async () => {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Sync all models
    await sequelize.sync({ alter: false });
    console.log('Database synced');

    // Start server
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      switch (error.code) {
        case 'EACCES':
          console.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`Port ${PORT} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Consider restarting the process or logging to an external service
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      // Consider restarting the process or logging to an external service
      process.exit(1);
    });

    // Handle SIGTERM for graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received. Shutting down gracefully');
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
})();


(async () => {
  try {
    await sequelize.authenticate();
    console.log('DB connected');
    // Ensure base schema exists using idempotent migration
    try {
      await baseMigration.up(sequelize.getQueryInterface(), Sequelize);
      console.log('Base schema ensured via migration');
    } catch (schemaErr) {
      console.warn('Base schema migration failed or skipped:', schemaErr?.message || schemaErr);
      // Attempt orphaned table repair then retry once
      try {
        const tables = [
          'request_departments', 'request_categories', 'rental_odometer_reads', 'rental_logs',
          'product_interests', 'product_flags', 'product_comments', 'product_images', 'products',
          'notifications', 'assignments', 'assets', 'vehicles', 'requests', 'categories', 'employees', 'departments',
          'audit_it_admin', 'audit_admin'
        ];
        for (const t of tables) {
          await sequelize.query(`DROP TABLE IF EXISTS \`${t}\``);
        }
        await baseMigration.up(sequelize.getQueryInterface(), Sequelize);
        console.log('Base schema repaired and ensured via migration');
      } catch (repairErr) {
        console.warn('Repair attempt failed:', repairErr?.message || repairErr);
      }
    }
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
    // Prefer migrations. Optionally allow sync in dev when USE_SYNC=true
    if (String(process.env.USE_SYNC).toLowerCase() === 'true') {
      await sequelize.sync();
      console.log('Models synced via sync()');
    } else {
      console.log('Skipping sequelize.sync(); using migrations');
    }
    // Safe migrations for vehicles: add new document fields and wheelers enum if missing
    try {
      const [vehTbl] = await sequelize.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'vehicles'");
      if (vehTbl && vehTbl.length > 0) {
        // Add name column
        const [nameCol] = await sequelize.query("SHOW COLUMNS FROM `vehicles` LIKE 'name'");
        if (!nameCol || nameCol.length === 0) {
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `name` VARCHAR(255) NULL AFTER `id`");
          console.log("Added vehicles.name column");
        }
        // Ensure type enum is correct (car,scooter,bike)
        try {
          const [typeCol] = await sequelize.query("SHOW COLUMNS FROM `vehicles` LIKE 'type'");
          const typeStr = String(typeCol?.[0]?.Type || '');
          if (typeStr && (!typeStr.includes("'scooter'") || !typeStr.includes("'car'") || !typeStr.includes("'bike'"))) {
            await sequelize.query("ALTER TABLE `vehicles` MODIFY COLUMN `type` ENUM('car','scooter','bike') NOT NULL");
            console.log("Normalized vehicles.type enum to ('car','scooter','bike')");
          }
        } catch (e) {
          console.warn('Vehicles.type enum migration skipped or failed:', e?.message || e);
        }
        // Add wheelers enum column
        const [wheelersCol] = await sequelize.query("SHOW COLUMNS FROM `vehicles` LIKE 'wheelers'");
        if (!wheelersCol || wheelersCol.length === 0) {
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `wheelers` ENUM('2','4') NULL AFTER `type`");
          console.log("Added vehicles.wheelers column");
        }
        // Add chassis_no
        const [chassisCol] = await sequelize.query("SHOW COLUMNS FROM `vehicles` LIKE 'chassis_no'");
        if (!chassisCol || chassisCol.length === 0) {
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `chassis_no` VARCHAR(255) NULL AFTER `image_url`");
          console.log("Added vehicles.chassis_no column");
        }
        // Insurance fields
        const [insImgCol] = await sequelize.query("SHOW COLUMNS FROM `vehicles` LIKE 'insurance_image_url'");
        if (!insImgCol || insImgCol.length === 0) {
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `insurance_image_url` VARCHAR(512) NULL AFTER `chassis_no`");
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `insurance_valid_from` DATE NULL AFTER `insurance_image_url`");
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `insurance_valid_to` DATE NULL AFTER `insurance_valid_from`");
          console.log("Added vehicles.insurance_* columns");
        }
        // RC fields
        const [rcImgCol] = await sequelize.query("SHOW COLUMNS FROM `vehicles` LIKE 'rc_image_url'");
        if (!rcImgCol || rcImgCol.length === 0) {
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `rc_image_url` VARCHAR(512) NULL AFTER `insurance_valid_to`");
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `rc_valid_from` DATE NULL AFTER `rc_image_url`");
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `rc_valid_to` DATE NULL AFTER `rc_valid_from`");
          console.log("Added vehicles.rc_* columns");
        }
        // Pollution fields
        const [polImgCol] = await sequelize.query("SHOW COLUMNS FROM `vehicles` LIKE 'pollution_image_url'");
        if (!polImgCol || polImgCol.length === 0) {
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `pollution_image_url` VARCHAR(512) NULL AFTER `rc_valid_to`");
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `pollution_valid_from` DATE NULL AFTER `pollution_image_url`");
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `pollution_valid_to` DATE NULL AFTER `pollution_valid_from`");
          console.log("Added vehicles.pollution_* columns");
        }
        // Paper image
        const [paperImgCol] = await sequelize.query("SHOW COLUMNS FROM `vehicles` LIKE 'paper_image_url'");
        if (!paperImgCol || paperImgCol.length === 0) {
          await sequelize.query("ALTER TABLE `vehicles` ADD COLUMN `paper_image_url` VARCHAR(512) NULL AFTER `pollution_valid_to`");
          console.log("Added vehicles.paper_image_url column");
        }
      }
    } catch (vehMigErr) {
      console.warn('Vehicles table migration skipped or failed:', vehMigErr?.message || vehMigErr);
    }
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
    // Removed vehicle default seeding; vehicles will be created manually by admin

    // =========================
    // Vehicle document expiry notifications
    // =========================
    async function checkVehicleDocumentsAndNotify() {
      try {
        const { Vehicle, Notification, Employee } = sequelize.models;
        if (!Vehicle || !Notification || !Employee) return;
        const admins = await Employee.findAll({ where: { role: 'admin' }, attributes: ['employee_id', 'name'] });
        if (!admins || admins.length === 0) return;

        const vehicles = await Vehicle.findAll();
        const today = new Date();
        const thresholds = [15, 10, 5, 2, 1];
        const docs = [
          { key: 'insurance', toField: 'insurance_valid_to' },
          { key: 'rc', toField: 'rc_valid_to' },
          { key: 'pollution', toField: 'pollution_valid_to' },
        ];

        for (const v of vehicles) {
          for (const d of docs) {
            const to = v.get(d.toField);
            if (!to) continue;
            const expiry = new Date(to);
            // Strip time for day-level compare
            const msPerDay = 24 * 60 * 60 * 1000;
            const diffDays = Math.ceil((expiry.setHours(0, 0, 0, 0) - new Date(today.setHours(0, 0, 0, 0))) / msPerDay);

            const notifyAdmins = async (label, options = { dedupe: true }) => {
              const message = `Vehicle ${v.plate} ${d.key.toUpperCase()} ${label}`;
              for (const a of admins) {
                if (options.dedupe) {
                  const existing = await Notification.findOne({ where: { recipient_id: a.employee_id, type: 'vehicle_doc_reminder', message } });
                  if (existing) continue;
                }
                await Notification.create({
                  recipient_id: a.employee_id,
                  type: 'vehicle_doc_reminder',
                  message,
                  meta: { vehicle_id: v.id, plate: v.plate, doc: d.key, valid_to: v.get(d.toField) },
                  created_at: new Date(),
                });
              }
            };

            if (diffDays < 0) {
              // expired: send daily until updated (include date so message differs daily)
              const todayStr = new Date().toISOString().slice(0, 10);
              await notifyAdmins(`document EXPIRED on ${todayStr}`, { dedupe: false });
            } else if (thresholds.includes(diffDays)) {
              // pre-expiry reminders should be sent once per threshold, so dedupe
              await notifyAdmins(`expires in ${diffDays} day(s)`, { dedupe: true });
            }
          }
        }
      } catch (e) {
        console.warn('Vehicle expiry check failed:', e?.message || e);
      }
    }

    // Run once on startup and then daily
    await checkVehicleDocumentsAndNotify();
    setInterval(checkVehicleDocumentsAndNotify, 24 * 60 * 60 * 1000);

    app.listen(PORT, '0.0.0.0', () => console.log(`Server running on ${PORT}`));
  } catch (err) {
    console.error('Failed to start', err);
  }
})();