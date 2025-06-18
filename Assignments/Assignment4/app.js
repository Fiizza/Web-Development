const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const Product = require('./models/products');
const Cart = require('./models/cart');
const MongoStore = require('connect-mongo');

const app = express();

let users = [];
let products = [];
let orders = [];
let isServerStarted = false;
let isShuttingDown = false;
let isInitializing = false;
let serverInstance = null;

const categories = [
    { id: 'all', name: 'All Products' },
    { id: 't-shirts', name: 'T-Shirts' },
    { id: 'shirts', name: 'Shirts' },
    { id: 'jeans', name: 'Jeans' },
    { id: 'jackets', name: 'Jackets' },
    { id: 'shoes', name: 'Shoes' }
];

// File paths
const USERS_FILE = path.join(__dirname, 'users.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');

// =====================================
// MIDDLEWARE SETUP (MOVED TO TOP)
// =====================================

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration (SINGLE CONFIGURATION)
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: 'mongodb://localhost:27017/fashionstore',
        collectionName: 'sessions'
    }),
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Set up EJS with layouts
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');

// Make user session available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    next();
});

// =====================================
// UTILITY FUNCTIONS
// =====================================

function getSampleProducts() {
    return [
        {
            id: 1,
            name: 'Classic T-Shirts',
            description: 'Comfortable cotton t-shirt perfect for everyday wear',
            price: 25.99,
            category: 't-shirts',
            image: 'https://images.asos-media.com/products/asos-design-oversized-t-shirt-with-puff-text-graphic-in-black/208641312-1-black?$n_640w$&wid=513&fit=constrain',
            inStock: true,
            dateAdded: new Date()
        },
        {
            id: 2,
            name: 'Denim Jackets',
            description: 'Stylish denim jacket for a casual look',
            price: 89.99,
            category: 'jackets',
            image: 'https://images.asos-media.com/products/jack-jones-boxy-denim-jacket-in-light-blue-denim/207428462-1-lightbluedenim/?$n_480w$&wid=476&fit=constrain',
            inStock: true,
            dateAdded: new Date()
        },
        {
            id: 3,
            name: 'Slim Fit Jeans',
            description: 'Modern slim fit jeans in dark wash',
            price: 79.99,
            category: 'jeans',
            image: 'https://images.asos-media.com/products/asos-design-slim-jeans-in-washed-black-with-green-tint/206538682-3?$n_640w$&wid=513&fit=constrain',
            inStock: true,
            dateAdded: new Date()
        },
        {
            id: 4,
            name: 'Formal Shirts',
            description: 'Crisp white formal shirt for business occasions',
            price: 45.99,
            category: 'shirts',
            image: 'https://images.asos-media.com/products/asos-design-slim-fit-shirt-with-70s-collar-in-cream-satin/207533088-1-cream?$n_640w$&wid=513&fit=constrain',
            inStock: true,
            dateAdded: new Date()
        },
        {
            id: 5,
            name: 'Casual Sneakers',
            description: 'Comfortable sneakers for daily activities',
            price: 129.99,
            category: 'shoes',
            image: 'https://images.asos-media.com/products/asos-design-chunky-lace-up-trainers-in-white/204262366-1-white?$n_750w$&wid=750&hei=750&fit=crop',
            inStock: true,
            dateAdded: new Date()
        },
        {
            id: 6,
            name: 'Graphic T-Shirts',
            description: 'Trendy graphic t-shirt with modern design',
            price: 29.99,
            category: 't-shirts',
            image: 'https://content.asos-media.com/-/media/images/articles/men/2021/06/13-sun/pgeimagedisplay.jpg?la=en-GB&h=1110&w=870&hash=CDCDA30F1D6AC896BFAB04C829682570',
            inStock: true,
            dateAdded: new Date()
        },
        {
            id: 7,
            name: 'Leather Jackets',
            description: 'Premium leather jacket for a bold look',
            price: 199.99,
            category: 'jackets',
            image: 'https://images.asos-media.com/products/asos-design-premium-real-leather-jacket-in-black/206042023-1-black?$n_640w$&wid=513&fit=constrain',
            inStock: true,
            dateAdded: new Date()
        },
        {
            id: 8,
            name: 'Cargo Pants',
            description: 'Utility cargo pants with multiple pockets',
            price: 59.99,
            category: 'jeans',
            image: 'https://content.asos-media.com/-/media/images/articles/men/2023/06/30-fri/pgeimagedisplay-1.jpg?la=en-GB&h=1110&w=870&hash=2AA5D162DDE58924350C1E8878D59E03',
            inStock: true,
            dateAdded: new Date()
        }
    ];
}

const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/auth/login');
    }
    next();
};

// User management functions
function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const userData = fs.readFileSync(USERS_FILE, 'utf8');
            if (userData.trim()) {
                users = JSON.parse(userData);
                console.log(`✓ Loaded ${users.length} users from storage`);
            } else {
                users = [];
                console.log('Empty users file, starting fresh');
            }
        } else {
            users = [];
            console.log('No users file found, starting fresh');
        }
    } catch (error) {
        console.error('❌ Error loading users:', error.message);
        users = [];
    }
}

function saveUsers() {
    try {
        const dir = path.dirname(USERS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
        console.log(`✓ Saved ${users.length} users to storage`);
        return true;
    } catch (error) {
        console.error('❌ Error saving users:', error.message);
        return false;
    }
}

// Order management functions
function loadOrders() {
    try {
        if (fs.existsSync(ORDERS_FILE)) {
            const orderData = fs.readFileSync(ORDERS_FILE, 'utf8');
            if (orderData.trim()) {
                orders = JSON.parse(orderData);
                console.log(`✓ Loaded ${orders.length} orders from storage`);
            } else {
                orders = [];
                console.log('Empty orders file, starting fresh');
            }
        } else {
            orders = [];
            console.log('No orders file found, starting fresh');
        }
    } catch (error) {
        console.error('❌ Error loading orders:', error.message);
        orders = [];
    }
}

function saveOrders() {
    try {
        const dir = path.dirname(ORDERS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
        console.log(`✓ Saved ${orders.length} orders to storage`);
        return true;
    } catch (error) {
        console.error('❌ Error saving orders:', error.message);
        return false;
    }
}

// Database functions
async function connectToMongoDB() {
    if (mongoose.connection.readyState === 1) {
        console.log('✓ MongoDB already connected');
        return true;
    }
    
    if (mongoose.connection.readyState === 2) {
        console.log('🔄 MongoDB connection in progress, waiting...');
        return new Promise((resolve) => {
            mongoose.connection.once('connected', () => resolve(true));
            mongoose.connection.once('error', () => resolve(false));
        });
    }
    
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect("mongodb://localhost:27017/fashionstore", {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            bufferCommands: false,
        });
        console.log("✓ MongoDB Connected successfully");
        return true;
    } catch (error) {
        console.error("❌ MongoDB connection error:", error.message);
        return false;
    }
}

async function loadProducts() {
    try {
        console.log('📦 Loading products...');
        products = getSampleProducts();
        console.log(`✓ Loaded ${products.length} products`);
    } catch (error) {
        console.error('❌ Error loading products:', error.message);
        products = getSampleProducts();
    }
}

// =====================================
// AUTHENTICATION ROUTES (FIXED)
// =====================================

// GET routes for login and register pages
app.get('/auth/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    
    res.render('login', { 
        title: 'Login - Fashion Trends',
        currentPage: 'login',
        error: null,
        success: null
    });
});

app.get('/auth/register', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    
    res.render('register', { 
        title: 'Register - Fashion Trends',
        currentPage: 'register',
        error: null,
        success: null
    });
});

// POST login route
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    if (req.session.user) {
        return res.redirect('/');
    }

    if (!email || !password) {
        return res.render('login', {
            title: 'Login - Fashion Trends',
            currentPage: 'login',
            error: 'Please fill in all fields',
            success: null
        });
    }

    try {
        const user = users.find(u => u.email === email.toLowerCase());

        if (!user) {
            return res.render('login', {
                title: 'Login - Fashion Trends',
                currentPage: 'login',
                error: 'Invalid email or password',
                success: null
            });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.render('login', {
                title: 'Login - Fashion Trends',
                currentPage: 'login',
                error: 'Invalid email or password',
                success: null
            });
        }

        user.loginCount = (user.loginCount || 0) + 1;
        user.lastLogin = new Date();
        saveUsers();

        // Set session user
        req.session.user = {
            id: user.id,
            email: user.email,
            name: user.name
        };

        // Initialize cart from session
        if (!req.session.cart) {
            req.session.cart = [];
        }

        console.log(`✓ User ${user.email} logged in successfully`);
        res.redirect('/');
    } catch (error) {
        console.error('Login error:', error);
        res.render('login', {
            title: 'Login - Fashion Trends',
            currentPage: 'login',
            error: 'Login failed. Please try again.',
            success: null
        });
    }
});

// POST register route
app.post('/auth/register', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    
    if (req.session.user) {
        return res.redirect('/');
    }
    
    if (!name || !email || !password || !confirmPassword) {
        return res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Please fill in all fields',
            success: null
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Please enter a valid email address',
            success: null
        });
    }

    if (password !== confirmPassword) {
        return res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Passwords do not match',
            success: null
        });
    }

    if (password.length < 6) {
        return res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Password must be at least 6 characters long',
            success: null
        });
    }

    try {
        const existingUser = users.find(u => u.email === email.toLowerCase());
        if (existingUser) {
            return res.render('register', { 
                title: 'Register - Fashion Trends',
                currentPage: 'register',
                error: 'Email already registered. Please use a different email or login instead.',
                success: null
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            id: Date.now() + Math.random(),
            name: name.trim(),
            email: email.toLowerCase(),
            password: hashedPassword,
            createdAt: new Date(),
            loginCount: 0,
            lastLogin: null
        };
        
        users.push(newUser);
        
        const saved = saveUsers();
        if (!saved) {
            console.error('Failed to save user registration');
            return res.render('register', { 
                title: 'Register - Fashion Trends',
                currentPage: 'register',
                error: 'Registration failed. Please try again.',
                success: null
            });
        }

        console.log(`✓ New user registered: ${email} (Total users: ${users.length})`);
        
        res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: null,
            success: 'Registration successful! You can now login with your credentials.'
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Registration failed. Please try again.',
            success: null
        });
    }
});

// Logout route
app.post('/auth/logout', (req, res) => {
    const userEmail = req.session.user?.email;
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        } else {
            console.log(`✓ User ${userEmail} logged out`);
        }
        res.redirect('/');
    });
});

// =====================================
// MAIN ROUTES
// =====================================

// Home route
app.get('/', async (req, res) => {
    try {
        const featuredProducts = products.slice(0, 8);
        
        res.render('index', { 
            title: 'Men Clothing | Groom Trends & Accessories for Men\'s Fashion',
            products: featuredProducts,
            currentPage: 'home'
        });
    } catch (error) {
        console.error('Error loading home page:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            currentPage: 'error',
            error: 'Failed to load products'
        });
    }
});

// Products routes
app.get('/products', async (req, res) => {
    try {
        const { category, search, sort } = req.query;
        let filteredProducts = [...products];

        // Filter by category
        if (category && category !== 'all') {
            filteredProducts = filteredProducts.filter(p => p.category === category);
        }

        // Search functionality
        if (search) {
            const searchTerm = search.toLowerCase();
            filteredProducts = filteredProducts.filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                p.description.toLowerCase().includes(searchTerm)
            );
        }

        // Sort products
        if (sort) {
            switch (sort) {
                case 'price-low':
                    filteredProducts.sort((a, b) => a.price - b.price);
                    break;
                case 'price-high':
                    filteredProducts.sort((a, b) => b.price - a.price);
                    break;
                case 'name':
                    filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
                    break;
                case 'newest':
                    filteredProducts.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
                    break;
            }
        }

        res.render('products', { 
            title: 'Products - Fashion Trends',
            products: filteredProducts,
            categories: categories,
            currentCategory: category || 'all',
            currentSearch: search || '',
            currentSort: sort || '',
            currentPage: 'products'
        });
    } catch (error) {
        console.error('Error loading products page:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            currentPage: 'error',
            error: 'Failed to load products'
        });
    }
});

// Single product route
app.get('/products/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            return res.status(404).render('404', { 
                title: 'Product Not Found',
                currentPage: '404'
            });
        }

        const relatedProducts = products
            .filter(p => p.category === product.category && p.id !== product.id)
            .slice(0, 4);

        res.render('product-detail', { 
            title: `${product.name} - Fashion Trends`,
            product: product,
            relatedProducts: relatedProducts,
            currentPage: 'products'
        });
    } catch (error) {
        console.error('Error loading product detail:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            currentPage: 'error',
            error: 'Failed to load product'
        });
    }
});

// =====================================
// CART ROUTES (FIXED)
// =====================================

// Add to cart route (FIXED)
app.post('/cart/add/:id', requireAuth, (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Initialize cart if it doesn't exist
        if (!req.session.cart) {
            req.session.cart = [];
        }

        // Check if item already exists in cart
        const existingItem = req.session.cart.find(item => item.productId === productId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            req.session.cart.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: 1
            });
        }

        console.log(`✓ Product ${product.name} added to cart for user ${req.session.user.email}`);
        
        // If it's an AJAX request, return JSON
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.json({ 
                success: true, 
                message: 'Product added to cart!',
                cartCount: req.session.cart.reduce((sum, item) => sum + item.quantity, 0)
            });
        }
        
        // Otherwise redirect to cart
        res.redirect('/cart');
    } catch (error) {
        console.error('Error adding to cart:', error);
        
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
            return res.status(500).json({ error: 'Failed to add product to cart' });
        }
        
        res.redirect('/products');
    }
});

// Remove from cart
app.post('/cart/remove/:id', requireAuth, (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        if (req.session.cart) {
            req.session.cart = req.session.cart.filter(item => item.productId !== productId);
        }
        res.redirect('/cart');
    } catch (error) {
        console.error('Error removing from cart:', error);
        res.redirect('/cart');
    }
});

// Update cart quantity
app.post('/cart/update/:id', requireAuth, (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const quantity = parseInt(req.body.quantity);
        
        if (req.session.cart && quantity > 0) {
            const item = req.session.cart.find(i => i.productId === productId);
            if (item) {
                item.quantity = quantity;
            }
        }
        
        res.redirect('/cart');
    } catch (error) {
        console.error('Error updating cart:', error);
        res.redirect('/cart');
    }
});

// View cart
app.get('/cart', requireAuth, (req, res) => {
    try {
        const cartItems = req.session.cart || [];
        const totalPrice = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        res.render('cart', {
            title: 'Shopping Cart - Fashion Trends',
            currentPage: 'cart',
            cartItems: cartItems,
            totalPrice: totalPrice.toFixed(2)
        });
    } catch (error) {
        console.error('Error loading cart:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            currentPage: 'error',
            error: 'Failed to load cart'
        });
    }
});

// =====================================
// ORDER ROUTES
// =====================================

// Checkout page
app.get('/checkout', requireAuth, (req, res) => {
    try {
        const cartItems = req.session.cart || [];
        
        if (cartItems.length === 0) {
            return res.redirect('/cart');
        }
        
        const totalPrice = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        res.render('checkout', { 
            title: 'Checkout - Fashion Trends',
            currentPage: 'checkout',
            cartItems: cartItems, 
            totalPrice: totalPrice.toFixed(2)
        });
    } catch (error) {
        console.error('Error loading checkout:', error);
        res.redirect('/cart');
    }
});

// Process checkout
app.post('/checkout', requireAuth, (req, res) => {
    try {
        const { fullName, phone, address } = req.body;
        const cartItems = req.session.cart || [];
        
        if (cartItems.length === 0) {
            return res.redirect('/cart');
        }

        if (!fullName || !phone || !address) {
            return res.render('checkout', {
                title: 'Checkout - Fashion Trends',
                currentPage: 'checkout',
                cartItems: cartItems,
                totalPrice: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2),
                error: 'Please fill in all shipping details'
            });
        }

        const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        const newOrder = {
            id: 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            userId: req.session.user.id,
            userEmail: req.session.user.email,
            items: cartItems.map(item => ({
                productId: item.productId,
                productName: item.name,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.quantity * item.price
            })),
            totalAmount: totalAmount,
            shippingAddress: { fullName, phone, address },
            orderDate: new Date(),
            status: 'Pending',
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        orders.push(newOrder);
        saveOrders();
        
        // Clear cart
        req.session.cart = [];
        
        console.log(`✓ Order created: ${newOrder.id} for user ${req.session.user.email}`);
        res.redirect('/orders');
    } catch (error) {
        console.error('Error processing checkout:', error);
        res.redirect('/cart');
    }
});

// View orders
app.get('/orders', requireAuth, (req, res) => {
    try {
        const userOrders = orders.filter(order => order.userId === req.session.user.id)
                               .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
        
        res.render('orders', { 
            title: 'My Orders - Fashion Trends',
            currentPage: 'orders',
            orders: userOrders
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            currentPage: 'error',
            error: 'Failed to load orders'
        });
    }
});

// View single order
app.get('/orders/:orderId', requireAuth, (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = orders.find(o => o.id === orderId && o.userId === req.session.user.id);
        
        if (!order) {
            return res.status(404).render('404', { 
                title: 'Order Not Found',
                currentPage: '404'
            });
        }
        
        res.render('order-detail', { 
            title: `Order ${order.id} - Fashion Trends`,
            currentPage: 'orders',
            order: order
        });
    } catch (error) {
        console.error('Error loading order detail:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            currentPage: 'error',
            error: 'Failed to load order'
        });
    }
});



// Profile routes
app.get('/profile', requireAuth, (req, res) => {
    const user = users.find(u => u.id === req.session.user.id);
    if (!user) {
        return res.redirect('/auth/login');
    }
    
    res.render('profile', { 
        title: 'My Profile - Fashion Trends',
        currentPage: 'profile',
        userDetails: user,
        success: null,
        error: null
    });
});

app.post('/profile/update', requireAuth, async (req, res) => {
    const { name, currentPassword, newPassword, confirmNewPassword } = req.body;
    const user = users.find(u => u.id === req.session.user.id);
    
    if (!user) {
        return res.redirect('/auth/login');
    }

    let error = null;
    let success = null;

    try {
        if (name && name.trim() !== user.name) {
            user.name = name.trim();
            req.session.user.name = user.name;
            success = 'Profile updated successfully!';
        }

        if (newPassword) {
            if (!currentPassword) {
                error = 'Current password is required to change password';
            } else if (newPassword !== confirmNewPassword) {
                error = 'New passwords do not match';
            } else if (newPassword.length < 6) {
                error = 'New password must be at least 6 characters long';
            } else {
                const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password);
                if (!isValidCurrentPassword) {
                    error = 'Current password is incorrect';
                } else {
                    user.password = await bcrypt.hash(newPassword, 10);
                    success = 'Password updated successfully!';
                }
            }
        }

        if (!error) {
            const saved = saveUsers();
            if (!saved) {
                error = 'Failed to save profile changes';
                success = null;
            }
        }

        res.render('profile', {
            title: 'My Profile - Fashion Trends',
            currentPage: 'profile',
            userDetails: user,
            success: success,
            error: error
        });
    } catch (err) {
        console.error('Error updating profile:', err);
        res.render('profile', {
            title: 'My Profile - Fashion Trends',
            currentPage: 'profile',
            userDetails: user,
            success: null,
            error: 'An error occurred while updating profile'
        });
    }
});

// Contact route
app.get('/contact', (req, res) => {
    res.render('contact', { 
        title: 'Contact Us - Fashion Trends',
        currentPage: 'contact'
    });
});

// About route
app.get('/about', (req, res) => {
    res.render('about', { 
        title: 'About Us - Fashion Trends',
        currentPage: 'about'
    });
});

// Search API endpoint
app.get('/api/search', (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.json([]);
        }

        const searchResults = products.filter(product => 
            product.name.toLowerCase().includes(query.toLowerCase()) ||
            product.description.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5);

        res.json(searchResults);
    } catch (error) {
        console.error('Search API error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// Cart count endpoint
app.get('/api/cart/count', requireAuth, (req, res) => {
    try {
        const cartCount = req.session.cart ? 
            req.session.cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
        res.json({ count: cartCount });
    } catch (error) {
        console.error('Cart count API error:', error);
        res.status(500).json({ error: 'Failed to get cart count' });
    }
});



// 404 handler
app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Page Not Found - Fashion Trends',
        currentPage: '404'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error handler:', error);
    res.status(500).render('error', { 
        title: 'Server Error - Fashion Trends',
        currentPage: 'error',
        error: process.env.NODE_ENV === 'production' ? 
            'Something went wrong on our end' : 
            error.message
    });
});

// =====================================
// SERVER INITIALIZATION (FIXED)
// =====================================

async function initializeServer() {
    if (isInitializing) {
        console.log('⏳ Server initialization already in progress...');
        return false;
    }

    if (isServerStarted) {
        console.log('✓ Server is already running');
        return true;
    }

    isInitializing = true;
    console.log('🚀 Initializing Fashion Trends E-commerce Server...');

    try {
        // Load initial data
        console.log('📋 Loading application data...');
        loadUsers();
        loadOrders();
        
        // Connect to MongoDB (optional - server will work without it)
        const mongoConnected = await connectToMongoDB();
        if (!mongoConnected) {
            console.log('⚠️  MongoDB connection failed - continuing with file-based storage');
        }
        
        // Load products
        await loadProducts();
        
        console.log('✅ Server initialization completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Server initialization failed:', error);
        return false;
    } finally {
        isInitializing = false;
    }
}

async function startServer() {
    if (isServerStarted) {
        console.log('✓ Server is already running');
        return;
    }

    if (isShuttingDown) {
        console.log('⏳ Server is shutting down, please wait...');
        return;
    }

    try {
        const initialized = await initializeServer();
        if (!initialized) {
            console.error('❌ Failed to initialize server');
            return;
        }

        const PORT = process.env.PORT || 3000;
        serverInstance = app.listen(PORT, () => {
            isServerStarted = true;
            console.log('🎉 Fashion Trends E-commerce Server Started!');
            console.log(`🌐 Server running on http://localhost:${PORT}`);
            console.log(`📊 Users: ${users.length}, Products: ${products.length}, Orders: ${orders.length}`);
            console.log('🔐 Available routes:');
            console.log('   • GET  /                    - Home page');
            console.log('   • GET  /products            - Products listing');
            console.log('   • GET  /products/:id        - Product details');
            console.log('   • GET  /auth/login          - Login page');
            console.log('   • GET  /auth/register       - Register page');
            console.log('   • GET  /cart                - Shopping cart (auth required)');
            console.log('   • GET  /checkout            - Checkout page (auth required)');
            console.log('   • GET  /orders              - User orders (auth required)');
            console.log('   • GET  /profile             - User profile (auth required)');
            console.log('   • GET  /contact             - Contact page');
            console.log('   • GET  /about               - About page');
            console.log('📱 Ready to accept connections!');
        });

        // Handle server errors
        serverInstance.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use. Please try a different port.`);
            } else {
                console.error('❌ Server error:', error);
            }
            isServerStarted = false;
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        isServerStarted = false;
    }
}

// Graceful shutdown
function gracefulShutdown() {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.log('\n🛑 Shutting down Fashion Trends server...');

    if (serverInstance) {
        serverInstance.close(() => {
            console.log('✓ HTTP server closed');
            
            if (mongoose.connection.readyState === 1) {
                mongoose.connection.close(() => {
                    console.log('✓ MongoDB connection closed');
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        });

        // Force close after 10 seconds
        setTimeout(() => {
            console.log('❌ Forced shutdown');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
}

// Handle process termination
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    gracefulShutdown();
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown();
});

// Export for testing or external use
module.exports = {
    app,
    startServer,
    gracefulShutdown,
    isServerStarted: () => isServerStarted,
    getUsers: () => users,
    getProducts: () => products,
    getOrders: () => orders
};

// Start server if this file is run directly
if (require.main === module) {
    startServer();
}