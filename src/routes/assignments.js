const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { sequelize, Asset, Assignment, Employee, AuditItAdmin } = require('../Models');
const { Op } = require('sequelize');

const router = express.Router();

// Assign asset
router.post('/', auth, requireRole('it_admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { assetId, employeeId, notes, conditionOnAssign, assignedAt } = req.body;
    const asset = await Asset.findByPk(assetId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!asset) throw new Error('Asset not found');
    if (asset.status !== 'active') throw new Error('Asset not in active state');

    const existing = await Assignment.findOne({ where: { assetId, status: 'active' }, transaction: t, lock: t.LOCK.UPDATE });
    if (existing) throw new Error('Asset already assigned');

    const id = uuidv4();
    const rec = await Assignment.create({
      id,
      assetId,
      employeeId,
      assignedBy: req.user.employee_id,
      assignedAt: assignedAt ? new Date(assignedAt) : undefined,
      notes,
      conditionOnAssign,
      status: 'active',
    }, { transaction: t });


    // Update asset status to 'assigned'
    await asset.update({ status: 'assigned' }, { transaction: t });

    // Lookup helpers for richer log metadata
    const emp = await Employee.findByPk(employeeId, { transaction: t });
    // Log the assignment in audit
    await AuditItAdmin.create({
      userId: req.user.employee_id,
      action: 'ASSIGN_ASSET',
      entityType: 'assignment',
      entityId: rec.id,
      metadata: {
        assetId: rec.assetId,
        assetCode: asset.assetId,
        employeeId: rec.employeeId,
        employeeName: emp?.name,
        assignedBy: rec.assignedBy,
        notes: rec.notes,
        assignedAt: rec.assignedAt,
      }
    }, { transaction: t });

    await t.commit();
    res.status(201).json(rec);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ message: err.message });
  }
});

// Edit details of a returned assignment (notes, conditionOnReturn, retired toggle)
router.patch('/:id', auth, requireRole('it_admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { notes, conditionOnReturn, retired, retireReason, status } = req.body;
    const rec = await Assignment.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!rec) throw new Error('Assignment not found');
    if (!(rec.status === 'returned' || rec.status === 'retired')) throw new Error('Only returned/retired assignments can be edited');

    const before = rec.get({ plain: true });
    const payload = { notes, conditionOnReturn };
    // Handle retired toggle
    if (typeof retired === 'boolean') {
      payload.retired = retired;
      payload.status = retired ? 'retired' : (status === 'returned' ? 'returned' : 'returned');
      payload.retireReason = retired ? (retireReason ?? rec.retireReason) : null;
      payload.retiredBy = retired ? req.user.employee_id : null;
      // Ensure returnedAt exists
      if (!rec.returnedAt) payload.returnedAt = new Date();
    }
    await rec.update(payload, { transaction: t });

    // Update underlying asset based on retired state
    const asset = await Asset.findByPk(rec.assetId, { transaction: t, lock: t.LOCK.UPDATE });
    if (asset) {
      if (rec.retired) {
        await asset.update({ status: 'retired' }, { transaction: t });
      } else if (asset.status === 'retired') {
        // If un-retired, make it active
        await asset.update({ status: 'active' }, { transaction: t });
      }
    }

    await AuditItAdmin.create({
      userId: req.user.employee_id,
      action: 'UPDATE_RETURN_DETAILS',
      entityType: 'assignment',
      entityId: rec.id,
      metadata: {
        changes: {
          notes: { from: before.notes, to: rec.notes },
          conditionOnReturn: { from: before.conditionOnReturn, to: rec.conditionOnReturn },
          ...(typeof retired === 'boolean' && { retired: { from: before.retired, to: rec.retired } }),
          ...(typeof retired === 'boolean' && { status: { from: before.status, to: rec.status } }),
          ...(typeof retired === 'boolean' && { retireReason: { from: before.retireReason, to: rec.retireReason } }),
        },
      },
    }, { transaction: t });

    await t.commit();
    res.json(rec);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ message: err.message });
  }
});

// Return asset (with optional retire)
router.post('/:id/return', auth, requireRole('it_admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { notes, conditionOnReturn, returnedAt, retired, retireReason } = req.body;
    const rec = await Assignment.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!rec) throw new Error('Assignment not found');
    if (rec.status !== 'active') throw new Error('Asset not currently assigned');

    const oldStatus = rec.status;
    const retiring = !!retired;
    await rec.update({
      status: retiring ? 'retired' : 'returned',
      returnedAt: returnedAt ? new Date(returnedAt) : new Date(),
      returnedBy: req.user.employee_id,
      conditionOnReturn,
      notes: notes || rec.notes,
      retired: retiring,
      retireReason: retiring ? (retireReason || null) : null,
      retiredBy: retiring ? req.user.employee_id : null,
    }, { transaction: t });

    // Set asset back to 'active'
    const asset = await Asset.findByPk(rec.assetId, { transaction: t, lock: t.LOCK.UPDATE });
    const emp = await Employee.findByPk(rec.employeeId, { transaction: t });
    if (asset) {
      if (retiring) {
        await asset.update({ status: 'retired' }, { transaction: t });
      } else if (asset.status !== 'retired') {
        await asset.update({ status: 'active' }, { transaction: t });
      }
    }

    // Log the return in audit
    await AuditItAdmin.create({
      userId: req.user.employee_id,
      action: 'RETURN_ASSET',
      entityType: 'assignment',
      entityId: rec.id,
      metadata: {
        assetId: rec.assetId,
        assetCode: asset?.assetId,
        employeeId: rec.employeeId,
        employeeName: emp?.name,
        returnedBy: req.user.employee_id,
        oldStatus,
        newStatus: retiring ? 'retired' : 'returned',
        conditionOnReturn,
        notes: notes || rec.notes,
        returnedAt: rec.returnedAt,
        ...(retiring && { retired: true, retireReason, retiredBy: req.user.employee_id }),
      }
    }, { transaction: t });

    await t.commit();
    res.json(rec);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ message: err.message });
  }
});

// List assignments
router.get('/', auth, requireRole('it_admin', 'admin'), async (req, res) => {
  try {
    const { employeeId, employeeName, assetId, serialNumber, model, assetType, brand, status, retired, from, to, assignmentId, assignedDate, returnedDate, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (assignmentId) where.id = assignmentId;
    if (employeeId) where.employeeId = employeeId;
    if (assetId) where.assetId = assetId;
    if (status) {
      const s = String(status).toLowerCase();
      if (s.includes(',')) {
        const list = s.split(',').map((v) => v.trim()).filter(Boolean);
        where.status = { [Op.in]: list };
      } else if (s === 'history') {
        where.status = { [Op.in]: ['returned', 'retired'] };
      } else {
        where.status = s;
      }
    }
    if (typeof retired !== 'undefined') {
      const val = String(retired).toLowerCase();
      if (val === 'true') {
        // consider legacy rows where only status was set to 'retired'
        where[Op.or] = [
          { retired: true },
          { status: 'retired' },
        ];
      } else if (val === 'false') {
        where.retired = false;
      }
    }
    if (from || to) {
      where.assignedAt = {};
      if (from) where.assignedAt[Op.gte] = new Date(from);
      if (to) where.assignedAt[Op.lte] = new Date(to);
    }
    // Date-only filters (whole day)
    if (assignedDate) {
      const start = new Date(`${assignedDate}T00:00:00.000Z`);
      const end = new Date(`${assignedDate}T23:59:59.999Z`);
      where.assignedAt = { [Op.gte]: start, [Op.lte]: end };
    }
    if (returnedDate) {
      const start = new Date(`${returnedDate}T00:00:00.000Z`);
      const end = new Date(`${returnedDate}T23:59:59.999Z`);
      where.returnedAt = { [Op.gte]: start, [Op.lte]: end };
    }

    // Join-like filters via subqueries
    if (serialNumber || model || assetType || brand) {
      const assetWhere = {};
      if (serialNumber) assetWhere.serialNumber = { [Op.like]: `%${serialNumber}%` };
      if (model) assetWhere.model = { [Op.like]: `%${model}%` };
      if (assetType) assetWhere.assetType = assetType;
      if (brand) assetWhere.brand = { [Op.like]: `%${brand}%` };
      const assets = await Asset.findAll({ where: assetWhere, attributes: ['id'] });
      where.assetId = where.assetId || { [Op.in]: assets.map(a => a.id) };
    }

    if (employeeName) {
      const emps = await Employee.findAll({ where: { name: { [Op.like]: `%${employeeName}%` } }, attributes: ['employee_id'] });
      where.employeeId = where.employeeId || { [Op.in]: emps.map(e => e.employee_id) };
    }

    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;
    const { rows, count } = await Assignment.findAndCountAll({
      where,
      limit,
      offset,
      distinct: true,
      order: [['assignedAt', 'DESC']],
      include: [
        { model: Asset, as: 'asset', attributes: ['id', 'assetId', 'serialNumber', 'assetType', 'brand', 'model'] },
        { model: Employee, as: 'employee', attributes: ['employee_id', 'name'] },
      ],
    });
    res.json({ data: rows, page: Number(page), pageSize: limit, total: count });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Admin: list IT audit logs (assign/return/updates)
router.get('/admin/logs', auth, requireRole('admin', 'it_admin'), async (req, res) => {
  try {
    const { action, userId, entityType, from, to, q, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (entityType) where.entityType = entityType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    if (q) {
      where[Op.or] = [
        { action: { [Op.like]: `%${q}%` } },
        { entityId: { [Op.like]: `%${q}%` } },
      ];
    }

    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;
    const { rows, count } = await AuditItAdmin.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
    // Enrich logs where metadata may be incomplete or stored as string
    const enriched = [];
    for (const r of rows) {
      const plain = r.get({ plain: true });
      let meta = plain.metadata;
      if (typeof meta === 'string') {
        try { meta = JSON.parse(meta); } catch { meta = {}; }
      }
      meta = meta || {};
      if ((plain.action === 'ASSIGN_ASSET' || plain.action === 'RETURN_ASSET') && (!meta.employeeId || !meta.employeeName || !(meta.assignedAt || meta.returnedAt) || !meta.assetCode)) {
        const a = await Assignment.findByPk(plain.entityId, {
          include: [
            { model: Asset, as: 'asset', attributes: ['assetId'] },
            { model: Employee, as: 'employee', attributes: ['employee_id', 'name'] },
          ]
        });
        if (a) {
          meta.employeeId = meta.employeeId || a.employee?.employee_id || a.employeeId;
          meta.employeeName = meta.employeeName || a.employee?.name;
          if (plain.action === 'ASSIGN_ASSET') {
            meta.assignedAt = meta.assignedAt || a.assignedAt;
          }
          if (plain.action === 'RETURN_ASSET') {
            meta.returnedAt = meta.returnedAt || a.returnedAt;
          }
          meta.assetCode = meta.assetCode || a.asset?.assetId;
        }
      }
      if (plain.action === 'CREATE_ASSET' && !meta.assetType) {
        const asset = await Asset.findByPk(plain.entityId);
        if (asset) {
          meta.assetType = asset.assetType;
          meta.brand = meta.brand || asset.brand;
          meta.model = meta.model || asset.model;
          meta.status = meta.status || asset.status;
          meta.assetId = meta.assetId || asset.assetId;
        }
      }
      enriched.push({ ...plain, metadata: meta });
    }
    res.json({ data: enriched, page: Number(page), pageSize: limit, total: count });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
