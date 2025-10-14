const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Parser } = require('json2csv');
const auth = require('../middleware/auth');
const sequelize = require('../config/db');
const { Op } = require('sequelize');
const { Vehicle, RentalLog, Employee, RentalOdometerRead } = require('../Models');

const router = express.Router();

// Ensure upload dir exists
const uploadDir = path.join(process.cwd(), 'uploads', 'vehicles');
fs.mkdirSync(uploadDir, { recursive: true });

// Configure multer for vehicle docs
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '');
    cb(null, `${Date.now()}_${base}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowed.includes(file.mimetype)) return cb(new Error('Invalid file type'), false);
  cb(null, true);
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

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

// =========================
// Odometer: Start reading (employee)
// =========================
router.post('/rentals/:rentalId/odometer/start', auth, upload.single('start_meter_image'), async (req, res) => {
  try {
    const rentalId = Number(req.params.rentalId);
    const rental = await RentalLog.findByPk(rentalId);
    if (!rental) return res.status(404).json({ error: 'rental not found' });
    if (String(rental.renter_id) !== String(req.user.employee_id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'not allowed' });
    }
    const exists = await RentalOdometerRead.findOne({ where: { rental_id: rentalId } });
    if (exists) return res.status(409).json({ error: 'odometer already captured' });

    const { start_km } = req.body || {};
    if (start_km == null || isNaN(Number(start_km))) return res.status(400).json({ error: 'start_km required' });
    const img = req.file;
    if (!img) return res.status(400).json({ error: 'start meter image required' });
    const row = await RentalOdometerRead.create({
      rental_id: rentalId,
      vehicle_id: rental.vehicle_id,
      start_km: Number(start_km),
      start_image_url: `/uploads/vehicles/${path.basename(img.path)}`,
      start_captured_at: new Date(),
      start_captured_by: String(req.user.employee_id),
      created_at: new Date(),
      updated_at: new Date(),
    });
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================
// Odometer: End reading (employee)
// =========================
router.patch('/rentals/:rentalId/odometer/end', auth, upload.single('end_meter_image'), async (req, res) => {
  try {
    const rentalId = Number(req.params.rentalId);
    const rental = await RentalLog.findByPk(rentalId);
    if (!rental) return res.status(404).json({ error: 'rental not found' });
    if (String(rental.renter_id) !== String(req.user.employee_id) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'not allowed' });
    }
    const row = await RentalOdometerRead.findOne({ where: { rental_id: rentalId } });
    if (!row) return res.status(404).json({ error: 'start odometer missing' });

    const { end_km } = req.body || {};
    if (end_km == null || isNaN(Number(end_km))) return res.status(400).json({ error: 'end_km required' });
    const img = req.file;
    if (!img) return res.status(400).json({ error: 'end meter image required' });
    if (Number(end_km) < Number(row.start_km)) return res.status(400).json({ error: 'end_km must be >= start_km' });
    row.end_km = Number(end_km);
    row.end_image_url = `/uploads/vehicles/${path.basename(img.path)}`;
    row.end_captured_at = new Date();
    row.end_captured_by = String(req.user.employee_id);
    row.updated_at = new Date();
    await row.save();
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================
// Admin: Monthly distance per vehicle
// =========================
router.get('/admin/monthly-distance', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
  try {
    const month = String(req.query.month || '').trim(); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month format YYYY-MM required' });
    const [year, mm] = month.split('-').map((n) => Number(n));
    const from = new Date(year, mm - 1, 1, 0, 0, 0, 0);
    const to = new Date(year, mm, 1, 0, 0, 0, 0); // exclusive

    const logs = await RentalLog.findAll({
      where: { returned_at: { [Op.gte]: from, [Op.lt]: to } },
      include: [{ model: RentalOdometerRead, as: 'odometer' }],
    });
    const map = new Map();
    for (const l of logs) {
      const o = l.odometer;
      if (!o || o.end_km == null) continue;
      const dist = Number(o.end_km) - Number(o.start_km || 0);
      if (!map.has(l.vehicle_id)) map.set(l.vehicle_id, 0);
      map.set(l.vehicle_id, map.get(l.vehicle_id) + (isNaN(dist) ? 0 : dist));
    }
    const result = Array.from(map.entries()).map(([vehicle_id, distance_km]) => ({ vehicle_id, distance_km }));
    res.json(result);
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

// =========================
// Admin: Create/Update/Delete Vehicles
// =========================

// Create vehicle with document images and validity dates
router.post('/admin/vehicles', auth, upload.fields([
  { name: 'vehicle_image', maxCount: 1 },
  { name: 'insurance_image', maxCount: 1 },
  { name: 'rc_image', maxCount: 1 },
  { name: 'pollution_image', maxCount: 1 },
  { name: 'paper_image', maxCount: 1 },
]), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
    const {
      name,
      type, // car | scooter | bike
      wheelers, // '2' | '4'
      plate,
      chassis_no,
      insurance_valid_from,
      insurance_valid_to,
      rc_valid_from,
      rc_valid_to,
      pollution_valid_from,
      pollution_valid_to,
    } = req.body || {};

    if (!type || !plate) return res.status(400).json({ error: 'type and plate are required' });

    const files = req.files || {};
    const vehicle_image = files['vehicle_image']?.[0];
    const insurance_image = files['insurance_image']?.[0];
    const rc_image = files['rc_image']?.[0];
    const pollution_image = files['pollution_image']?.[0];
    const paper_image = files['paper_image']?.[0];

    const payload = {
      name: name || null,
      type: String(type),
      wheelers: wheelers ? String(wheelers) : null,
      plate: String(plate).trim(),
      image_url: vehicle_image ? `/uploads/vehicles/${path.basename(vehicle_image.path)}` : null,
      chassis_no: chassis_no ? String(chassis_no).trim() : null,
      insurance_image_url: insurance_image ? `/uploads/vehicles/${path.basename(insurance_image.path)}` : null,
      insurance_valid_from: insurance_valid_from || null,
      insurance_valid_to: insurance_valid_to || null,
      rc_image_url: rc_image ? `/uploads/vehicles/${path.basename(rc_image.path)}` : null,
      rc_valid_from: rc_valid_from || null,
      rc_valid_to: rc_valid_to || null,
      pollution_image_url: pollution_image ? `/uploads/vehicles/${path.basename(pollution_image.path)}` : null,
      pollution_valid_from: pollution_valid_from || null,
      pollution_valid_to: pollution_valid_to || null,
      paper_image_url: paper_image ? `/uploads/vehicles/${path.basename(paper_image.path)}` : null,
      status: 'available',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const existing = await Vehicle.findOne({ where: { plate: payload.plate } });
    if (existing) return res.status(409).json({ error: 'vehicle with same plate exists' });

    const v = await Vehicle.create(payload);
    res.status(201).json(v);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update vehicle (replace images/dates/fields)
router.patch('/admin/vehicles/:id', auth, upload.fields([
  { name: 'vehicle_image', maxCount: 1 },
  { name: 'insurance_image', maxCount: 1 },
  { name: 'rc_image', maxCount: 1 },
  { name: 'pollution_image', maxCount: 1 },
  { name: 'paper_image', maxCount: 1 },
]), async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
    const v = await Vehicle.findByPk(req.params.id);
    if (!v) return res.status(404).json({ error: 'not found' });

    const body = req.body || {};
    if (body.name !== undefined) v.name = String(body.name).trim() || null;
    if (body.type !== undefined) v.type = String(body.type);
    if (body.wheelers !== undefined) v.wheelers = String(body.wheelers);
    if (body.plate !== undefined) v.plate = String(body.plate).trim();
    if (body.chassis_no !== undefined) v.chassis_no = String(body.chassis_no).trim() || null;
    if (body.insurance_valid_from !== undefined) v.insurance_valid_from = body.insurance_valid_from || null;
    if (body.insurance_valid_to !== undefined) v.insurance_valid_to = body.insurance_valid_to || null;
    if (body.rc_valid_from !== undefined) v.rc_valid_from = body.rc_valid_from || null;
    if (body.rc_valid_to !== undefined) v.rc_valid_to = body.rc_valid_to || null;
    if (body.pollution_valid_from !== undefined) v.pollution_valid_from = body.pollution_valid_from || null;
    if (body.pollution_valid_to !== undefined) v.pollution_valid_to = body.pollution_valid_to || null;

    const files = req.files || {};
    const vehicle_image = files['vehicle_image']?.[0];
    const insurance_image = files['insurance_image']?.[0];
    const rc_image = files['rc_image']?.[0];
    const pollution_image = files['pollution_image']?.[0];
    const paper_image = files['paper_image']?.[0];
    if (vehicle_image) v.image_url = `/uploads/vehicles/${path.basename(vehicle_image.path)}`;
    if (insurance_image) v.insurance_image_url = `/uploads/vehicles/${path.basename(insurance_image.path)}`;
    if (rc_image) v.rc_image_url = `/uploads/vehicles/${path.basename(rc_image.path)}`;
    if (pollution_image) v.pollution_image_url = `/uploads/vehicles/${path.basename(pollution_image.path)}`;
    if (paper_image) v.paper_image_url = `/uploads/vehicles/${path.basename(paper_image.path)}`;

    v.updated_at = new Date();
    await v.save();
    res.json(v);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete vehicle (reject if currently rented)
router.delete('/admin/vehicles/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
    const v = await Vehicle.findByPk(req.params.id);
    if (!v) return res.status(404).json({ error: 'not found' });
    if (v.status === 'rented') return res.status(400).json({ error: 'cannot delete a rented vehicle' });
    await v.destroy();
    res.json({ success: true });
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

    // Business rule: do not allow return unless end_km + end_image exist
    const odo = await RentalOdometerRead.findOne({ where: { rental_id: log.id }, transaction: t, lock: t.LOCK.UPDATE });
    if (!odo || odo.end_km == null || !odo.end_image_url) {
      throw new Error('Cannot return without end km and end meter image');
    }
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

    // Require end odometer reading before admin closes
    const odo = await RentalOdometerRead.findOne({ where: { rental_id: log.id }, transaction: t, lock: t.LOCK.UPDATE });
    if (!odo || odo.end_km == null || !odo.end_image_url) {
      throw new Error('End odometer reading (km + image) required before closing');
    }

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
        { model: RentalOdometerRead, as: 'odometer' },
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
