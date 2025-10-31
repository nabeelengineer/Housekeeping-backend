const express = require('express');
const auth = require('../middleware/auth');
const { Notification, Employee } = require('../Models');

const router = express.Router();

// List my notifications (latest first)
router.get('/', auth, async (req, res) => {
  try {
    const list = await Notification.findAll({
      where: { recipient_id: req.user.employee_id },
      include: [
        {
          model: Employee,
          as: 'sender',
          attributes: ['name', 'employee_id'],
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 100,
    });
    
    // Format the response to include sender name
    const formattedList = list.map(notification => {
      const plainNotification = notification.get({ plain: true });
      // If notification has meta data, try to get the employee name from there
      if (plainNotification.meta && plainNotification.meta.seller_id) {
        return {
          ...plainNotification,
          sender_name: plainNotification.sender ? plainNotification.sender.name : 'System',
        };
      }
      return plainNotification;
    });
    
    res.json(formattedList);
  } catch (err) {
    console.error('Error fetching notifications:', err);
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
