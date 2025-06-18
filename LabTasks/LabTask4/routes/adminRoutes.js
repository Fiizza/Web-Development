const express = require('express');
const router = express.Router();
const path = require('path');

// ====================== MIDDLEWARE ======================
const requireAdmin = (req, res, next) => {
    if (req.session && req.session.adminLoggedIn) {
        return next();
    }
    return res.redirect('/admin/login');
};

const checkAdminRole = (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    if (req.session && req.session.adminLoggedIn) {
        return next();
    }
    return res.status(403).json({ error: 'Admin privileges required' });
};

// ====================== LOGIN PAGE GET ======================

router.post('/login', (req, res) => {
    const { email, password } = req.body;
    const ADMIN_EMAIL = 'admin@asos.com';
    const ADMIN_PASSWORD = 'admin123';

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        req.session.adminLoggedIn = true;
        return res.json({ success: true, redirect: '/admin' });
    } else {
        return res.status(400).json({ error: 'Invalid admin credentials' });
    }
});


// ====================== LOGOUT ======================
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

// ====================== MAIN ADMIN PANEL ======================
router.get('/', requireAdmin, (req, res) => {
    try {
        res.sendFile(path.join(__dirname, '../views/admin/admin-panel.html'));
    } catch (error) {
        console.error('Admin panel error:', error);
        res.status(500).send('Admin panel error');
    }
});

// ====================== API ROUTES ======================

// Dashboard Stats
router.get('/api/stats', requireAdmin, (req, res) => {
    try {
        res.json({
            totalProducts: 15,
            totalUsers: 156,
            totalOrders: 42,
            totalRevenue: 12450
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Products
router.get('/api/products', requireAdmin, (req, res) => {
    const products = [
        { id: 1, name: "Cotton T-Shirt", price: 29.99, category: "Clothing", stock: 150, description: "Comfortable cotton t-shirt" },
        { id: 2, name: "Denim Jeans", price: 79.99, category: "Clothing", stock: 85, description: "Premium jeans" },
        { id: 3, name: "Running Sneakers", price: 129.99, category: "Shoes", stock: 42, description: "Sport shoes" }
    ];
    res.json(products);
});

router.post('/api/products', requireAdmin, (req, res) => {
    const { name, price, category, stock, description } = req.body;
    if (!name || !price || !category || !stock) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const newProduct = {
        id: Date.now(),
        name,
        price: parseFloat(price),
        category,
        stock: parseInt(stock),
        description: description || ''
    };

    res.json({ success: true, message: 'Product created', product: newProduct });
});

router.put('/api/products/:id', requireAdmin, (req, res) => {
    const productId = req.params.id;
    const updateData = req.body;
    res.json({ success: true, message: 'Product updated', productId });
});

router.delete('/api/products/:id', requireAdmin, (req, res) => {
    const productId = req.params.id;
    res.json({ success: true, message: 'Product deleted' });
});

// Users
router.get('/api/users', requireAdmin, (req, res) => {
    const users = [
        { id: 1, name: "John Doe", email: "john@example.com", role: "Customer", status: "Active" },
        { id: 2, name: "Jane Smith", email: "jane@example.com", role: "Customer", status: "Active" }
    ];
    res.json(users);
});

// Orders
router.get('/api/orders', requireAdmin, (req, res) => {
    const orders = [
        { id: "ORD001", customer: "John Doe", total: 299.99, status: "Pending", date: "2025-06-15" },
        { id: "ORD002", customer: "Jane Smith", total: 149.50, status: "Completed", date: "2025-06-14" }
    ];
    res.json(orders);
});

router.put('/api/orders/:id/status', requireAdmin, (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;
    res.json({ success: true, message: 'Order status updated', orderId, status });
});

module.exports = router;
