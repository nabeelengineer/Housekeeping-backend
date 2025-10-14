'use strict';

/**
 * Baseline schema migration for Housekeeping app.
 * Idempotent: checks table existence before creating.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const ensureTable = async (name, definition, indexes = []) => {
      let exists = false;
      try { await queryInterface.describeTable(name); exists = true; } catch (_) { exists = false; }
      if (!exists) { await queryInterface.createTable(name, definition); }
      // Apply named indexes safely
      const existing = await queryInterface.showIndex(name).catch(() => []);
      const names = new Set((existing || []).map(i => i.name).filter(Boolean));
      for (const idx of indexes) {
        const idxName = idx.name;
        if (!idxName || names.has(idxName)) continue;
        await queryInterface.addIndex(name, idx.fields, { ...idx, fields: undefined });
      }
    };

    // departments
    await ensureTable('departments', {
      dept_id: { type: Sequelize.STRING, allowNull: false, primaryKey: true },
      dept_name: { type: Sequelize.STRING, allowNull: false },
    });

    // employees
    await ensureTable('employees', {
      employee_id: { type: Sequelize.STRING, allowNull: false, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      phone_no: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.ENUM('employee','admin','staff','it_admin'), allowNull: false, defaultValue: 'employee' },
      department_id: { type: Sequelize.STRING, allowNull: false },
      manager_id: { type: Sequelize.STRING, allowNull: true },
      otp_code: { type: Sequelize.STRING, allowNull: true },
      otp_expires_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    }, [
      { name: 'ux_employees_email', fields: ['email'], unique: true },
      { name: 'ux_employees_phone', fields: ['phone_no'], unique: true },
      { name: 'ix_employees_dept', fields: ['department_id'] },
      { name: 'ix_employees_role', fields: ['role'] },
    ]);

    // categories
    await ensureTable('categories', {
      category_id: { type: Sequelize.STRING, allowNull: false, primaryKey: true },
      category_name: { type: Sequelize.STRING, allowNull: false, unique: true },
    }, [ { name: 'ux_categories_name', fields: ['category_name'], unique: true } ]);

    // requests
    await ensureTable('requests', {
      request_id: { type: Sequelize.STRING, allowNull: false, primaryKey: true },
      employee_id: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.ENUM('complaint','requirement'), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      floor: { type: Sequelize.STRING, allowNull: true },
      unit: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.ENUM('pending','in_progress','resolved','closed'), allowNull: false, defaultValue: 'pending' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: true },
      closed_date: { type: Sequelize.DATE, allowNull: true },
      priority: { type: Sequelize.ENUM('low','medium','high'), allowNull: false, defaultValue: 'low' },
      assigned_to: { type: Sequelize.STRING, allowNull: true },
    }, [
      { name: 'ix_requests_employee', fields: ['employee_id'] },
      { name: 'ix_requests_status', fields: ['status'] },
      { name: 'ix_requests_priority', fields: ['priority'] },
      { name: 'ix_requests_created_at', fields: ['created_at'] },
    ]);

    // request_categories
    await ensureTable('request_categories', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      category_id: { type: Sequelize.STRING, allowNull: false },
      request_id: { type: Sequelize.STRING, allowNull: false },
    }, [ { name: 'ix_req_cat_cat', fields: ['category_id'] }, { name: 'ix_req_cat_req', fields: ['request_id'] } ]);

    // request_departments
    await ensureTable('request_departments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      request_id: { type: Sequelize.STRING, allowNull: false },
      dept_id: { type: Sequelize.STRING, allowNull: false },
    }, [ { name: 'ix_req_dept_req', fields: ['request_id'] }, { name: 'ix_req_dept_dept', fields: ['dept_id'] } ]);

    // vehicles
    await ensureTable('vehicles', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: true },
      type: { type: Sequelize.ENUM('car','scooter','bike'), allowNull: false },
      wheelers: { type: Sequelize.ENUM('2','4'), allowNull: true },
      plate: { type: Sequelize.STRING, allowNull: false, unique: true },
      image_url: { type: Sequelize.STRING, allowNull: true },
      chassis_no: { type: Sequelize.STRING, allowNull: true },
      insurance_image_url: { type: Sequelize.STRING, allowNull: true },
      insurance_valid_from: { type: Sequelize.DATEONLY, allowNull: true },
      insurance_valid_to: { type: Sequelize.DATEONLY, allowNull: true },
      rc_image_url: { type: Sequelize.STRING, allowNull: true },
      rc_valid_from: { type: Sequelize.DATEONLY, allowNull: true },
      rc_valid_to: { type: Sequelize.DATEONLY, allowNull: true },
      pollution_image_url: { type: Sequelize.STRING, allowNull: true },
      pollution_valid_from: { type: Sequelize.DATEONLY, allowNull: true },
      pollution_valid_to: { type: Sequelize.DATEONLY, allowNull: true },
      paper_image_url: { type: Sequelize.STRING, allowNull: true },
      status: { type: Sequelize.ENUM('available','rented','maintenance'), allowNull: false, defaultValue: 'available' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: true },
    }, [
      { name: 'ux_vehicles_plate', fields: ['plate'], unique: true },
      { name: 'ix_vehicles_status', fields: ['status'] },
      { name: 'ix_vehicles_type', fields: ['type'] },
    ]);

    // rental_logs
    await ensureTable('rental_logs', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      vehicle_id: { type: Sequelize.INTEGER, allowNull: false },
      renter_id: { type: Sequelize.STRING, allowNull: false },
      rented_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      returned_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
    }, [
      { name: 'ix_rental_logs_vehicle', fields: ['vehicle_id'] },
      { name: 'ix_rental_logs_renter', fields: ['renter_id'] },
      { name: 'ix_rental_logs_rented_at', fields: ['rented_at'] },
    ]);

    // rental_odometer_reads
    await ensureTable('rental_odometer_reads', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      rental_id: { type: Sequelize.INTEGER, allowNull: false, unique: true },
      vehicle_id: { type: Sequelize.INTEGER, allowNull: false },
      start_km: { type: Sequelize.DECIMAL(10,2), allowNull: false },
      start_image_url: { type: Sequelize.STRING, allowNull: true },
      start_captured_at: { type: Sequelize.DATE, allowNull: false },
      start_captured_by: { type: Sequelize.STRING, allowNull: false },
      end_km: { type: Sequelize.DECIMAL(10,2), allowNull: true },
      end_image_url: { type: Sequelize.STRING, allowNull: true },
      end_captured_at: { type: Sequelize.DATE, allowNull: true },
      end_captured_by: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: true },
    }, [
      { name: 'ix_ror_vehicle', fields: ['vehicle_id'] },
      { name: 'ix_ror_start_captured_at', fields: ['start_captured_at'] },
      { name: 'ix_ror_end_captured_at', fields: ['end_captured_at'] },
    ]);

    // notifications
    await ensureTable('notifications', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      recipient_id: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      message: { type: Sequelize.STRING(500), allowNull: false },
      meta: { type: Sequelize.JSON, allowNull: true },
      read: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    }, [
      { name: 'ix_notifications_recipient', fields: ['recipient_id'] },
      { name: 'ix_notifications_read', fields: ['read'] },
      { name: 'ix_notifications_type', fields: ['type'] },
    ]);

    // products
    await ensureTable('products', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      seller_id: { type: Sequelize.STRING, allowNull: false },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      price: { type: Sequelize.DECIMAL(10,2), allowNull: true },
      status: { type: Sequelize.ENUM('active','sold','removed'), allowNull: false, defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: true },
    }, [
      { name: 'ix_products_seller', fields: ['seller_id'] },
      { name: 'ix_products_status', fields: ['status'] },
      { name: 'ix_products_created_at', fields: ['created_at'] },
    ]);

    // product_images
    await ensureTable('product_images', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      product_id: { type: Sequelize.INTEGER, allowNull: false },
      url: { type: Sequelize.STRING, allowNull: false },
      order_index: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    }, [
      { name: 'ix_prod_images_product', fields: ['product_id'] },
      { name: 'ix_prod_images_order', fields: ['order_index'] },
    ]);

    // product_comments
    await ensureTable('product_comments', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      product_id: { type: Sequelize.INTEGER, allowNull: false },
      commenter_id: { type: Sequelize.STRING, allowNull: false },
      text: { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    }, [
      { name: 'ix_prod_comments_product', fields: ['product_id'] },
      { name: 'ix_prod_comments_commenter', fields: ['commenter_id'] },
    ]);

    // product_flags
    await ensureTable('product_flags', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      product_id: { type: Sequelize.INTEGER, allowNull: false },
      reporter_id: { type: Sequelize.STRING, allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.ENUM('open','received','kept','removed'), allowNull: false, defaultValue: 'open' },
      admin_notes: { type: Sequelize.TEXT, allowNull: true },
      resolved_by: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      resolved_at: { type: Sequelize.DATE, allowNull: true },
    }, [
      { name: 'ix_prod_flags_product', fields: ['product_id'] },
      { name: 'ix_prod_flags_reporter', fields: ['reporter_id'] },
      { name: 'ix_prod_flags_status', fields: ['status'] },
    ]);

    // product_interests
    await ensureTable('product_interests', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      product_id: { type: Sequelize.INTEGER, allowNull: false },
      buyer_id: { type: Sequelize.STRING, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    }, [ { name: 'ux_prod_interest_unique', fields: ['product_id','buyer_id'], unique: true } ]);

    // assets
    await ensureTable('assets', {
      id: { type: Sequelize.CHAR(36), allowNull: false, primaryKey: true },
      assetId: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      serialNumber: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      assetType: { type: Sequelize.ENUM('laptop','mouse','keyboard','stand','other'), allowNull: false, defaultValue: 'laptop' },
      typeDetail: { type: Sequelize.STRING(64), allowNull: true },
      brand: { type: Sequelize.STRING(64), allowNull: true },
      model: { type: Sequelize.STRING(128), allowNull: true },
      cpu: { type: Sequelize.STRING(128), allowNull: true },
      ram: { type: Sequelize.STRING(64), allowNull: true },
      storage: { type: Sequelize.STRING(128), allowNull: true },
      os: { type: Sequelize.STRING(128), allowNull: true },
      gpu: { type: Sequelize.STRING(128), allowNull: true },
      purchaseDate: { type: Sequelize.DATEONLY, allowNull: true },
      warrantyExpiry: { type: Sequelize.DATEONLY, allowNull: true },
      location: { type: Sequelize.STRING(128), allowNull: true },
      status: { type: Sequelize.ENUM('active','assigned','repair','retired'), allowNull: false, defaultValue: 'active' },
      createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.fn('NOW') },
    }, [
      { name: 'ix_assets_type', fields: ['assetType'] },
      { name: 'ix_assets_status', fields: ['status'] },
      { name: 'ux_assets_assetId', fields: ['assetId'], unique: true },
      { name: 'ux_assets_serialNumber', fields: ['serialNumber'], unique: true },
    ]);

    // assignments
    await ensureTable('assignments', {
      id: { type: Sequelize.CHAR(36), allowNull: false, primaryKey: true },
      assetId: { type: Sequelize.CHAR(36), allowNull: false },
      employeeId: { type: Sequelize.STRING(64), allowNull: false },
      assignedAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.fn('NOW') },
      assignedBy: { type: Sequelize.STRING(64), allowNull: false },
      returnedAt: { type: Sequelize.DATE(3), allowNull: true },
      returnedBy: { type: Sequelize.STRING(64), allowNull: true },
      status: { type: Sequelize.ENUM('active','returned','retired'), allowNull: false, defaultValue: 'active' },
      notes: { type: Sequelize.TEXT, allowNull: true },
      conditionOnAssign: { type: Sequelize.STRING(255), allowNull: true },
      conditionOnReturn: { type: Sequelize.STRING(255), allowNull: true },
      retired: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      retireReason: { type: Sequelize.STRING(255), allowNull: true },
      retiredBy: { type: Sequelize.STRING(64), allowNull: true },
      createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.fn('NOW') },
      active_only: { type: Sequelize.CHAR(36), allowNull: true }, // generated column may not be portable; create nullable
    }, [
      { name: 'ix_assign_asset_status', fields: ['assetId','status'] },
      { name: 'ix_assign_employee_status', fields: ['employeeId','status'] },
      { name: 'ix_assign_assignedAt', fields: ['assignedAt'] },
      { name: 'ix_assign_returnedAt', fields: ['returnedAt'] },
      { name: 'ux_assign_one_active', fields: ['active_only'], unique: true },
    ]);

    // audit_admin
    await ensureTable('audit_admin', {
      id: { type: Sequelize.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.STRING(64), allowNull: false },
      action: { type: Sequelize.STRING(64), allowNull: false },
      entityType: { type: Sequelize.STRING(32), allowNull: false },
      entityId: { type: Sequelize.STRING(64), allowNull: false },
      metadata: { type: Sequelize.JSON, allowNull: true },
      createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.fn('NOW') },
    }, [
      { name: 'ix_audit_admin_user', fields: ['userId'] },
      { name: 'ix_audit_admin_action', fields: ['action'] },
      { name: 'ix_audit_admin_createdAt', fields: ['createdAt'] },
    ]);

    // audit_it_admin
    await ensureTable('audit_it_admin', {
      id: { type: Sequelize.BIGINT, allowNull: false, primaryKey: true, autoIncrement: true },
      userId: { type: Sequelize.STRING(64), allowNull: false },
      action: { type: Sequelize.STRING(64), allowNull: false },
      entityType: { type: Sequelize.STRING(32), allowNull: false },
      entityId: { type: Sequelize.STRING(64), allowNull: false },
      metadata: { type: Sequelize.JSON, allowNull: true },
      createdAt: { type: Sequelize.DATE(3), allowNull: false, defaultValue: Sequelize.fn('NOW') },
    }, [
      { name: 'ix_audit_it_user', fields: ['userId'] },
      { name: 'ix_audit_it_action', fields: ['action'] },
      { name: 'ix_audit_it_createdAt', fields: ['createdAt'] },
    ]);
  },

  async down(queryInterface) {
    // Drop in reverse dependency order; ignore errors if not present
    const drop = async (name) => { try { await queryInterface.dropTable(name); } catch (_) {} };
    await drop('audit_it_admin');
    await drop('audit_admin');
    await drop('assignments');
    await drop('assets');
    await drop('product_interests');
    await drop('product_flags');
    await drop('product_comments');
    await drop('product_images');
    await drop('products');
    await drop('notifications');
    await drop('rental_odometer_reads');
    await drop('rental_logs');
    await drop('vehicles');
    await drop('request_departments');
    await drop('request_categories');
    await drop('requests');
    await drop('categories');
    await drop('employees');
    await drop('departments');
  }
};
