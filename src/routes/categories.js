const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Category, RequestCategory } = require('../Models');

router.get('/', auth, async (req, res) => {
  const list = await Category.findAll();
  res.json(list);
});

router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Only Admin' });
  }
  const { category_id, category_name } = req.body;
  const c = await Category.create({ category_id, category_name });
  res.status(201).json(c);
});

// Update category name
router.patch('/:category_id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only Admin' });
    }
    const { category_id } = req.params;
    const { category_name } = req.body;
    if (!category_name) return res.status(400).json({ error: 'category_name is required' });
    const cat = await Category.findByPk(category_id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    cat.category_name = category_name;
    await cat.save();
    res.json(cat);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete category (block if linked to any requests)
router.delete('/:category_id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Only Admin' });
    }
    const { category_id } = req.params;
    const cat = await Category.findByPk(category_id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    const links = await RequestCategory.count({ where: { category_id } });
    if (links > 0) {
      return res.status(400).json({ error: 'Cannot delete category linked to requests' });
    }
    await cat.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;