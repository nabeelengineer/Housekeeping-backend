const express = require('express');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { sequelize, Asset, Assignment, Employee, AuditItAdmin } = require('../Models');

const router = express.Router();

// Create asset
router.post('/', auth, requireRole('it_admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const data = req.body;
    const id = uuidv4();
    const asset = await Asset.create({ id, ...data }, { transaction: t });
    
    // Log the creation in audit
    await AuditItAdmin.create({
      userId: req.user.employee_id,
      action: 'CREATE_ASSET',
      entityType: 'asset',
      entityId: asset.id,
      metadata: {
        assetId: asset.assetId,
        serialNumber: asset.serialNumber,
        assetType: asset.assetType,
        status: asset.status,
        ...(asset.model && { model: asset.model }),
        ...(asset.brand && { brand: asset.brand })
      }
    }, { transaction: t });
    
    await t.commit();
    res.status(201).json(asset);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ message: err.message });
  }
});

// List assets with filters
router.get('/', auth, requireRole('it_admin', 'admin'), async (req, res) => {
  try {
    const { q, assetType, status, location, page = 1, pageSize = 20 } = req.query;
    const where = {};
    if (assetType) where.assetType = assetType;
    if (status) where.status = status;
    if (location) where.location = location;
    if (q) {
      where[require('sequelize').Op.or] = [
        { assetId: { [require('sequelize').Op.like]: `%${q}%` } },
        { serialNumber: { [require('sequelize').Op.like]: `%${q}%` } },
        { model: { [require('sequelize').Op.like]: `%${q}%` } },
        { brand: { [require('sequelize').Op.like]: `%${q}%` } },
      ];
    }
    const limit = Number(pageSize);
    const offset = (Number(page) - 1) * limit;
    const { rows, count } = await Asset.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });
    res.json({ data: rows, page: Number(page), pageSize: limit, total: count });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get asset details + current assignment
router.get('/:id', auth, requireRole('it_admin', 'admin'), async (req, res) => {
  try {
    const asset = await Asset.findByPk(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Not found' });
    const current = await Assignment.findOne({ where: { assetId: asset.id, status: 'active' } });
    res.json({ asset, currentAssignment: current });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update asset
router.patch('/:id', auth, requireRole('it_admin'), async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const asset = await Asset.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!asset) {
      await t.rollback();
      return res.status(404).json({ message: 'Asset not found' });
    }
    
    const oldValues = { ...asset.get({ plain: true }) };
    await asset.update(req.body, { transaction: t });
    
    // Determine changed fields
    const changes = {};
    Object.keys(req.body).forEach(key => {
      if (oldValues[key] !== asset[key]) {
        changes[key] = { from: oldValues[key], to: asset[key] };
      }
    });
    
    // Only log if there were actual changes
    if (Object.keys(changes).length > 0) {
      await AuditItAdmin.create({
        userId: req.user.employee_id,
        action: 'UPDATE_ASSET',
        entityType: 'asset',
        entityId: asset.id,
        metadata: {
          assetId: asset.assetId,
          changes,
          updatedBy: req.user.employee_id
        }
      }, { transaction: t });
    }
    
    await t.commit();
    res.json(asset);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ message: err.message });
  }
});

// Admin: assets summary counts
router.get('/admin/summary', auth, requireRole('admin'), async (req, res) => {
  try {
    const total = await Asset.count();
    const active = await Asset.count({ where: { status: 'active' } });
    const assigned = await Asset.count({ where: { status: 'assigned' } });
    const retired = await Asset.count({ where: { status: 'retired' } });
    res.json({ total, active, assigned, retired, in_use: assigned, available: active });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
