const express = require('express');
const router = express.Router();
const { Request, RequestDepartment, RequestCategory, Department, Category } = require('../Models');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');
const sequelize = require('../config/db');

// Create request (employee)
router.post('/', auth, async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { type, description, priority='low', department_ids = [], category_ids = [], floor = null, unit = null } = req.body;
    const request_id = 'REQ-' + uuidv4().slice(0,8);
    const r = await Request.create({
      request_id,
      type,
      description,
      priority,
      status: 'pending',
      floor,
      unit,
      employee_id: req.user.employee_id,
      closed_date: null
    }, { transaction: t });

    // link departments (verify exist)
    if (Array.isArray(department_ids) && department_ids.length) {
      for (const dept_id of department_ids) {
        const dept = await Department.findOne({ where: { dept_id } });
        if (dept) await RequestDepartment.create({ request_id, dept_id }, { transaction: t });
      }
    }

    // link categories (verify exist)
    if (Array.isArray(category_ids) && category_ids.length) {
      for (const category_id of category_ids) {
        const cat = await Category.findOne({ where: { category_id } });
        if (cat) await RequestCategory.create({ request_id, category_id }, { transaction: t });
      }
    }

    await t.commit();
    const full = await Request.findOne({ where: { request_id }, include: ['departments','categories','requester','assignedStaff'] });
    res.json(full);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
});

// Get requests with basic filters
router.get('/', auth, async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.employee_id) where.employee_id = req.query.employee_id;

  if (req.user.role === 'staff') where.assigned_to = req.user.employee_id;
  else if (req.user.role === 'employee') where.employee_id = req.user.employee_id;

  const list = await Request.findAll({ where, include: ['departments','categories','requester','assignedStaff'] });
  res.json(list);
});

// Assign request to staff (admin)
router.post('/:id/assign', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'only admin' });
  const { id } = req.params;
  const { staff_id } = req.body;
  const r = await Request.findOne({ where: { request_id: id } });
  if (!r) return res.status(404).json({ message: 'not found' });
  r.assigned_to = staff_id;
  r.status = 'in_progress';
  r.updated_at = new Date();
  await r.save();
  const updated = await Request.findOne({ where: { request_id: id }, include: ['departments','categories','requester','assignedStaff'] });
  res.json(updated);
});

// Update status (admin or assigned staff)
router.post('/:id/status', auth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const r = await Request.findOne({ where: { request_id: id } });
  if (!r) return res.status(404).json({ message: 'not found' });
  if (req.user.role !== 'admin' && req.user.employee_id !== r.assigned_to) return res.status(403).json({ message: 'not allowed' });
  r.status = status;
  r.updated_at = new Date();
  if (status === 'resolved' || status === 'closed') {
    r.closed_date = new Date();
  }
  await r.save();
  res.json(r);
});

// Get single request
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const r = await Request.findOne({ where: { request_id: id }, include: ['departments','categories','requester','assignedStaff'] });
  if (!r) return res.status(404).json({ message: 'not found' });
  if (req.user.role === 'employee' && r.employee_id !== req.user.employee_id) return res.status(403).json({ message: 'not allowed' });
  res.json(r);
});

module.exports = router;