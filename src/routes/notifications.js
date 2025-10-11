const express = require('express');
const auth = require('../middleware/auth');
const { Notification } = require('../Models');

const router = express.Router();

// List my notifications (latest first)
router.get('/', auth, async (req, res) => {
  try {
    const list = await Notification.findAll({
      where: { recipient_id: req.user.employee_id },
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark as read
router.patch('/:id/read', auth, async (req, res) => {
  try {
    const n = await Notification.findByPk(req.params.id);
    if (!n || n.recipient_id !== req.user.employee_id) return res.status(404).json({ error: 'not found' });
    n.read = true;
    await n.save();
    res.json(n);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
