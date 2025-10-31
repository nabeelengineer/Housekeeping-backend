const express = require('express');
const router = express.Router();
const { Department, Employee } = require('../Models');
const auth = require('../middleware/auth');

// Public: list departments (no auth) so signup can load options
router.get('/', async (req, res) => {
  const list = await Department.findAll();
  res.json(list);
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Only Admin' });
  }
  const { dept_id, dept_name } = req.body;
  const d = await Department.create({ dept_id, dept_name });
  res.status(201).json(d);
});

// Update department name
router.patch('/:dept_id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only Admin' });
    }
    const { dept_id } = req.params;
    const { dept_name } = req.body;
    if (!dept_name) return res.status(400).json({ error: 'dept_name is required' });
    const dept = await Department.findByPk(dept_id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    dept.dept_name = dept_name;
    await dept.save();
    res.json(dept);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete department (block if employees exist)
router.delete('/:dept_id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only Admin' });
    }
    const { dept_id } = req.params;
    const dept = await Department.findByPk(dept_id);
    if (!dept) return res.status(404).json({ error: 'Department not found' });
    const count = await Employee.count({ where: { department_id: dept_id } });
    if (count > 0) {
      return res.status(400).json({ error: 'Cannot delete department with assigned employees' });
    }
    await dept.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;