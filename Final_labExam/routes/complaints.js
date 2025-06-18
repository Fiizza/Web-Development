const express = require('express');
const router = express.Router();
const Complaint = require('../models/complaint');
const { requireAuth, requireAdmin } = require('../middleware/auth');


router.get('/contact', requireAuth, (req, res) => {
  res.render('contact', { title: 'Contact / Complaint' });
});

// Submit complaint
router.post('/contact', requireAuth, async (req, res) => {
  const { orderId, message } = req.body;
  if (!orderId || !message) {
    return res.status(400).send('Order ID and message are required');
  }

  await Complaint.create({
    userId: req.session.user._id || req.session.user.id,
    orderId,
    message
  });

  res.redirect('/my-complaints');
});

router.get('/my-complaints', requireAuth, async (req, res) => {
  const complaints = await Complaint.find({ userId: req.session.user._id || req.session.user.id }).sort({ createdAt: -1 });
  res.render('user-complaints', { title: 'My Complaints', complaints });
});

router.get('/admin/complaints', requireAuth, requireAdmin, async (req, res) => {
  const complaints = await Complaint.find().populate('userId', 'name email').sort({ createdAt: -1 });
  res.render('admin-complaints', { title: 'All Complaints', complaints });
});


module.exports = router;
