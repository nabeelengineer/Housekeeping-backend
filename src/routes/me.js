const express = require('express');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { Assignment, Asset } = require('../Models');

const router = express.Router();

// Employee: view own assets (current and history)
router.get('/assets', auth, requireRole('employee', 'it_admin', 'admin'), async (req, res) => {
  try {
    const employeeId = req.user.employee_id;
    const rows = await Assignment.findAll({
      where: { employeeId },
      include: [{ model: Asset, as: 'asset' }],
      order: [['assignedAt', 'DESC']],
    });
    res.json({ data: rows });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
