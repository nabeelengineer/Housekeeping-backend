const express = require('express');
const { Parser } = require('json2csv');
const auth = require('../middleware/auth');
const sequelize = require('../config/db');
const { Op } = require('sequelize');
const { Vehicle, RentalLog, Employee } = require('../Models');

const router = express.Router();

// Employee: my active rentals with vehicle details
router.get('/my/active', auth, async (req, res) => {
  try {
    const logs = await RentalLog.findAll({
      where: { renter_id: req.user.employee_id, returned_at: { [Op.is]: null } },
      include: [{ model: Vehicle, as: 'vehicle' }],
      order: [['rented_at', 'DESC']],
    });
    res.json(logs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: seed default vehicles (idempotent)
router.post('/admin/seed-defaults', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
  const defaults = [
    { type: 'scooter', plate: 'SC-001' },
    { type: 'scooter', plate: 'SC-002' },
    { type: 'car', plate: 'CR-001' },
    { type: 'bike', plate: 'BK-001' },
    { type: 'bike', plate: 'BK-002' },
    { type: 'bike', plate: 'BK-003' },
  ];
  try {
    const created = [];
    for (const d of defaults) {
      const [v, wasCreated] = await Vehicle.findOrCreate({
        where: { plate: d.plate },
        defaults: { ...d, status: 'available' },
      });
      created.push({ plate: v.plate, created: wasCreated });
    }
    res.json({ ok: true, items: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Employee: list available vehicles only
router.get('/', auth, async (req, res) => {
  try {
    const reqStatus = req.query.status;
    const where = {};
    // If client asks for all, return both available and rented to support UI badges
    if (reqStatus === 'all') {
      where.status = { [Op.in]: ['available', 'rented'] };
    } else {
      // Default behavior remains available only unless a specific status is provided
      const effective = reqStatus || 'available';
      where.status = effective;
    }
    if (req.query.type) where.type = req.query.type;
    const list = await Vehicle.findAll({ where, order: [['type', 'ASC'], ['id', 'ASC']] });
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Employee: rent a vehicle (atomic)
router.post('/:id/rent', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const v = await Vehicle.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!v) throw new Error('Vehicle not found');
    if (v.status !== 'available') throw new Error('Vehicle not available');

    v.status = 'rented';
    v.updated_at = new Date();
    await v.save({ transaction: t });

    const log = await RentalLog.create({
      vehicle_id: v.id,
      renter_id: req.user.employee_id,
      rented_at: new Date(),
    }, { transaction: t });

    await t.commit();
    res.json({ vehicle: v, log });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
});

// Employee: return vehicle they rented (no approval)
router.post('/:id/return', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const v = await Vehicle.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!v) throw new Error('Vehicle not found');

    // Find active log for this user and vehicle
    const log = await RentalLog.findOne({
      where: { vehicle_id: v.id, renter_id: req.user.employee_id, returned_at: { [Op.is]: null } },
      order: [['rented_at', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!log) throw new Error('No active rental for this user');

    log.returned_at = new Date();
    await log.save({ transaction: t });

    v.status = 'available';
    v.updated_at = new Date();
    await v.save({ transaction: t });

    await t.commit();
    res.json({ vehicle: v, log });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
});

// Admin override: force return
router.post('/admin/:id/return', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
  const t = await sequelize.transaction();
  try {
    const v = await Vehicle.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!v) throw new Error('Vehicle not found');

    const log = await RentalLog.findOne({
      where: { vehicle_id: v.id, returned_at: { [Op.is]: null } },
      order: [['rented_at', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!log) throw new Error('No active rental');

    log.returned_at = new Date();
    await log.save({ transaction: t });

    v.status = 'available';
    v.updated_at = new Date();
    await v.save({ transaction: t });

    await t.commit();
    res.json({ vehicle: v, log });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
});

// Admin: logs with filters
router.get('/admin/logs', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
  try {
    const { vehicleId, renterId, from, to, status } = req.query;
    const where = {};
    if (vehicleId) where.vehicle_id = vehicleId;
    if (renterId) where.renter_id = renterId;
    if (from || to) where.rented_at = {};
    if (from) where.rented_at[Op.gte] = new Date(from);
    if (to) where.rented_at[Op.lte] = new Date(to);
    if (status === 'active') where.returned_at = { [Op.is]: null };
    if (status === 'closed') where.returned_at = { [Op.not]: null };

    const logs = await RentalLog.findAll({
      where,
      order: [['rented_at', 'DESC']],
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: Employee, as: 'renter', attributes: ['employee_id', 'name'] },
      ],
    });
    res.json(logs);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: CSV export
router.get('/admin/logs.csv', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
  try {
    const logs = await RentalLog.findAll({
      order: [['rented_at', 'DESC']],
      include: [
        { model: Vehicle, as: 'vehicle' },
        { model: Employee, as: 'renter', attributes: ['employee_id', 'name'] },
      ],
    });
    const data = logs.map(l => ({
      id: l.id,
      vehicle_id: l.vehicle_id,
      vehicle_plate: l.vehicle?.plate,
      vehicle_type: l.vehicle?.type,
      renter_id: l.renter_id,
      renter_name: l.renter?.name,
      rented_at: l.rented_at,
      returned_at: l.returned_at,
    }));
    const parser = new Parser({ fields: ['id','vehicle_id','vehicle_plate','vehicle_type','renter_id','renter_name','rented_at','returned_at'] });
    const csv = parser.parse(data);
    res.header('Content-Type', 'text/csv');
    res.attachment('vehicle_logs.csv');
    res.send(csv);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
