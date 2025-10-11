const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Employee } = require('../Models');
const bcrypt = require('bcrypt');

router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Only Admin' });
  }
  const list = await Employee.findAll();
  res.json(list);
});

router.get('/me', auth, async (req, res) => {
  const me = await Employee.findOne({ where: { employee_id: req.user.employee_id } });
  res.json(me);
});

// Admin: create employee
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only Admin' });
    }
    const { employee_id, name, phone_no, email, password, department_id, manager_id = null, role = 'employee' } = req.body;
    if (!employee_id || !name || !phone_no || !email || !password || !department_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existing = await Employee.findOne({ where: { employee_id } });
    if (existing) return res.status(409).json({ error: 'employee_id already exists' });
    const hash = await bcrypt.hash(password, 10);
    const created = await Employee.create({ employee_id, name, phone_no, email, password: hash, department_id, manager_id, role });
    res.status(201).json({ employee_id: created.employee_id, role: created.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: set role (cannot change own role; cannot change role of any admin)
router.patch('/:employee_id/role', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only Admin' });
    }
    const targetId = req.params.employee_id;
    const { role } = req.body;
    if (!role) return res.status(400).json({ error: 'role is required' });
    // Prevent changing your own role
    if (targetId === req.user.employee_id) {
      return res.status(400).json({ error: 'You cannot change your own role' });
    }
    const emp = await Employee.findOne({ where: { employee_id: targetId } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    // Prevent changing role of any admin
    if (emp.role === 'admin') {
      return res.status(400).json({ error: 'Cannot change role of an admin user' });
    }
  emp.role = role;
  await emp.save();
  res.json({ employee_id: emp.employee_id, role: emp.role });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update employee (admin only; not for role)
router.patch('/:employee_id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only Admin' });
    }
    const targetId = req.params.employee_id;
    const { name, phone_no, email, department_id, manager_id } = req.body;
    const emp = await Employee.findOne({ where: { employee_id: targetId } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (typeof name !== 'undefined') emp.name = name;
    if (typeof phone_no !== 'undefined') emp.phone_no = phone_no;
    if (typeof email !== 'undefined') emp.email = email;
    if (typeof department_id !== 'undefined') emp.department_id = department_id;
    if (typeof manager_id !== 'undefined') emp.manager_id = manager_id;
    await emp.save();
    res.json({ employee_id: emp.employee_id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete employee (admin only, cannot delete self or admins)
router.delete('/:employee_id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only Admin' });
    }
    const targetId = req.params.employee_id;
    if (targetId === req.user.employee_id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const emp = await Employee.findOne({ where: { employee_id: targetId } });
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (emp.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete an admin user' });
    }
    await emp.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;