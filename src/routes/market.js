const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { auth } = require('../middleware/auth');
const { Op } = require('sequelize');
const {
  Product,
  ProductImage,
  ProductInterest,
  ProductFlag,
  ProductComment,
  Employee,
  Notification,
} = require('../Models');

const router = express.Router();

// Ensure upload dir exists
const uploadDir = path.join(process.cwd(), 'uploads', 'market');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  console.log('Created market upload directory:', uploadDir);
}

// Update product (seller, admin, or it_admin)
router.patch('/products/:id', auth(['user', 'admin', 'it_admin']), async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (req.user.role !== 'admin' && req.user.role !== 'it_admin' && p.seller_id !== req.user.employee_id) {
      return res.status(403).json({ error: 'not allowed' });
    }
    if (p.status === 'removed') return res.status(400).json({ error: 'cannot edit removed product' });

    const { name, description, price } = req.body || {};
    if (name !== undefined) p.name = String(name).trim();
    if (description !== undefined) p.description = String(description || '').trim() || null;
    if (price !== undefined) {
      const num = String(price).trim();
      p.price = num === '' ? null : Number(num);
    }
    p.updated_at = new Date();
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Sanitize filename and add timestamp to prevent collisions
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, '_');
    cb(null, Date.now() + '_' + sanitizedFilename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG, PNG, and WebP images are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// Create product with 3-5 images
router.post('/products', auth(['user', 'admin', 'it_admin']), upload.array('images', 5), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const files = req.files || [];
    if (files.length < 2) return res.status(400).json({ error: 'At least 2 images are required' });
    if (files.length > 4) return res.status(400).json({ error: 'Maximum 4 images allowed' });

    const p = await Product.create({
      seller_id: req.user.employee_id,
      name,
      description: description || null,
      price: price !== undefined && price !== null && String(price).trim() !== '' ? Number(price) : null,
      status: 'active',
      created_at: new Date(),
    });

    const images = await Promise.all(
      (files || []).map((f, idx) =>
        ProductImage.create({
          product_id: p.id,
          url: `/uploads/market/${path.basename(f.path)}`,
          order_index: idx,
        })
      )
    );

    // Notify other employees about the new listing (exclude seller)
    try {
      const employees = await Employee.findAll({
        attributes: ['employee_id', 'name'],
        where: { employee_id: { [Op.ne]: req.user.employee_id } },
      });
      if (employees?.length) {
        const payload = employees.map((e) => ({
          recipient_id: e.employee_id,
          type: 'product_posted',
          message: `${req.user.employee_id} posted a new product: ${name}`,
          meta: { product_id: p.id, name },
          created_at: new Date(),
        }));
        await Notification.bulkCreate(payload, { ignoreDuplicates: true });
      }
    } catch (nErr) {
      // non-fatal
      console.warn('Notify employees failed:', nErr?.message || nErr);
    }

    const full = await Product.findByPk(p.id, {
      include: [
        { model: ProductImage, as: 'images' },
        { model: Employee, as: 'seller', attributes: ['employee_id', 'name', 'phone_no', 'email'] },
      ],
    });
    res.status(201).json(full);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List products (active by default); optional search/sort
router.get('/products', auth(['user', 'admin', 'it_admin']), async (req, res) => {
  try {
    const {
      search = '',
      sort = 'created_at',
      order = 'desc',
      status,
      sellerId,
    } = req.query;

    const where = {};
    
    // For non-admin users, only show active/sold products
    if (req.user.role !== 'admin' && req.user.role !== 'it_admin') {
      where.status = { [Op.in]: ['active', 'sold'] };
    } else if (status) {
      // For admins and IT-Admins, respect the status filter if provided
      where.status = status;
    }
    
    if (sellerId) where.seller_id = sellerId;
    
    // Enhanced search to include title and description
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const list = await Product.findAll({
      where,
      order: [[sort, order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']],
      include: [
        { 
          model: ProductImage, 
          as: 'images' 
        },
        {
          model: Employee,
          as: 'seller',
          attributes: ['employee_id', 'name', 'email', 'phone_no'],
          required: false
        }
      ],
    });
    
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get single product with seller contact
router.get('/products/:id', auth, async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id, {
      include: [
        { model: ProductImage, as: 'images' },
        { model: Employee, as: 'seller', attributes: ['employee_id', 'name', 'phone_no', 'email'] },
      ],
    });
    if (!p) return res.status(404).json({ error: 'not found' });
    // Allow everyone to view 'active' and 'sold'. Restrict 'removed' to admin or seller
    if (p.status === 'removed' && req.user.role !== 'admin' && p.seller_id !== req.user.employee_id) {
      return res.status(403).json({ error: 'not allowed' });
    }
    res.json(p);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Mark sold (seller or admin)
router.patch('/products/:id/mark-sold', auth, async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (req.user.role !== 'admin' && p.seller_id !== req.user.employee_id) return res.status(403).json({ error: 'not allowed' });
    p.status = 'sold';
    p.updated_at = new Date();
    await p.save();
    res.json(p);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove product (soft-delete)
router.delete('/products/:id', auth, async (req, res) => {
  try {
    const p = await Product.findByPk(req.params.id);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (req.user.role !== 'admin' && p.seller_id !== req.user.employee_id) return res.status(403).json({ error: 'not allowed' });
    p.status = 'removed';
    p.updated_at = new Date();
    await p.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// I'm Interested (no message). One per buyer/product.
router.post('/products/:id/interest', auth, async (req, res) => {
  try {
    const product_id = parseInt(req.params.id, 10);
    const buyer_id = req.user.employee_id;
    const p = await Product.findByPk(product_id);
    if (!p || p.status !== 'active') return res.status(400).json({ error: 'invalid product' });
    const existing = await ProductInterest.findOne({ where: { product_id, buyer_id } });
    if (existing) return res.status(200).json(existing);
    const it = await ProductInterest.create({ product_id, buyer_id, created_at: new Date() });
    // TODO: notify seller in-app
    res.status(201).json(it);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get my interest for a product (buyer)
router.get('/products/:id/interest/my', auth, async (req, res) => {
  try {
    const product_id = parseInt(req.params.id, 10);
    const buyer_id = req.user.employee_id;
    const it = await ProductInterest.findOne({ where: { product_id, buyer_id } });
    res.json(it || null);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Seller: list interested buyers for my product
router.get('/products/:id/interests', auth, async (req, res) => {
  try {
    const product_id = parseInt(req.params.id, 10);
    const p = await Product.findByPk(product_id);
    if (!p) return res.status(404).json({ error: 'not found' });
    if (req.user.role !== 'admin' && p.seller_id !== req.user.employee_id) return res.status(403).json({ error: 'only seller or admin' });
    const list = await ProductInterest.findAll({
      where: { product_id },
      order: [['created_at', 'DESC']],
      include: [{ model: Employee, as: 'buyer', attributes: ['employee_id', 'name', 'phone_no', 'email'] }],
    });
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Comments
router.post('/products/:id/comments', auth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
    const product_id = parseInt(req.params.id, 10);
    const c = await ProductComment.create({ product_id, commenter_id: req.user.employee_id, text: text.trim(), created_at: new Date() });
    res.status(201).json(c);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/products/:id/comments', auth, async (req, res) => {
  try {
    const product_id = parseInt(req.params.id, 10);
    const list = await ProductComment.findAll({ where: { product_id }, order: [['created_at', 'DESC']] });
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Flags
router.post('/products/:id/flags', auth, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ error: 'reason required' });
    const product_id = parseInt(req.params.id, 10);
    const f = await ProductFlag.create({ product_id, reporter_id: req.user.employee_id, reason: reason.trim(), status: 'open', created_at: new Date() });
    // TODO: notify admin in-app
    res.status(201).json(f);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin moderation
router.get('/admin/flags', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;
    const list = await ProductFlag.findAll({ where, order: [['created_at', 'DESC']], include: [{ model: Product, as: 'product' }] });
    res.json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/admin/flags/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'only admin' });
    const flag = await ProductFlag.findByPk(req.params.id);
    if (!flag) return res.status(404).json({ error: 'not found' });
    const { action = 'keep', adminNotes = null } = req.body;
    flag.admin_notes = adminNotes;

    // Transition states by action
    if (action === 'received') {
      flag.status = 'received';
      // notify reporter
      await Notification.create({
        recipient_id: flag.reporter_id,
        type: 'flag_received',
        message: `We have received your report for product #${flag.product_id}.`,
        meta: { product_id: flag.product_id, flag_id: flag.id },
        created_at: new Date(),
      });
    } else if (action === 'keep') {
      flag.status = 'kept';
      await Notification.create({
        recipient_id: flag.reporter_id,
        type: 'flag_kept',
        message: `Your report for product #${flag.product_id} is being processed.`,
        meta: { product_id: flag.product_id, flag_id: flag.id },
        created_at: new Date(),
      });
    } else if (action === 'remove') {
      flag.status = 'removed';
      const p = await Product.findByPk(flag.product_id);
      if (p) {
        p.status = 'removed';
        p.updated_at = new Date();
        await p.save();
      }
      await Notification.create({
        recipient_id: flag.reporter_id,
        type: 'flag_removed',
        message: `The product #${flag.product_id} you reported has been removed.`,
        meta: { product_id: flag.product_id, flag_id: flag.id },
        created_at: new Date(),
      });
    } else {
      return res.status(400).json({ error: 'invalid action' });
    }

    flag.resolved_by = req.user.employee_id;
    flag.resolved_at = new Date();
    await flag.save();
    res.json(flag);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
