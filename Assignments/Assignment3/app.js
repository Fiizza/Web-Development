const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');
const expressLayouts = require('express-ejs-layouts');
const mongoose = require('mongoose');
const Product = require('./models/products');

const app = express();

let users = [];
let products = [];
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

const USERS_FILE = path.join(__dirname, 'users.json');

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
async function seedProducts() {
    try {
        const sampleProducts = getSampleProducts();
        await Product.insertMany(sampleProducts);
        console.log('Sample products inserted into database');
        return true;
    } catch (error) {
        console.error('Error seeding products:', error.message);
        return false;
    }
}

async function loadProducts() {
    try {
        
        if (mongoose.connection.readyState === 1) {
            console.log('Loading products from MongoDB...');
            const dbProducts = await Product.find({}).lean(); 
            
            if (dbProducts.length > 0) {
                products = dbProducts;
                console.log(`Loaded ${products.length} products from database`);
            } else {
                console.log('No products in database, seeding with sample data...');
                const seeded = await seedProducts();
                if (seeded) {
                    const newProducts = await Product.find({}).lean();
                    products = newProducts;
                    console.log(`Seeded and loaded ${products.length} products`);
                } else {
                    throw new Error('Failed to seed products');
                }
            }
        } else {
            throw new Error('MongoDB not connected');
        }
        
    } catch (error) {
        console.error('Error loading products from MongoDB:', error.message);
        console.log('Falling back to sample products...');
        products = getSampleProducts();
        console.log(`Using fallback products: ${products.length} items`);
    }
}

function loadUsers() {
    try {
        if (fs.existsSync(USERS_FILE)) {
            const userData = fs.readFileSync(USERS_FILE, 'utf8');
            if (userData.trim()) {
                users = JSON.parse(userData);
                console.log(`Loaded ${users.length} users from storage`);
            } else {
                users = [];
                console.log('Empty users file, starting fresh');
            }
        } else {
            users = [];
            console.log('No users file found, starting fresh');
        }
    } catch (error) {
        console.error('Error loading users:', error.message);
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
        console.log(`Saved ${users.length} users to storage`);
        return true;
    } catch (error) {
        console.error('Error saving users:', error.message);
        return false;
    }
}
let orders = [];

const ORDERS_FILE = path.join(__dirname, 'orders.json');

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
        console.error('Error loading orders:', error.message);
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
        console.log(`Saved ${orders.length} orders to storage`);
        return true;
    } catch (error) {
        console.error('Error saving orders:', error.message);
        return false;
    }
}
app.get('/orders', requireAuth, (req, res) => {
    const userOrders = orders.filter(order => order.userId === req.session.user.id)
                           .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    
    res.render('orders', { 
        title: 'My Orders - Fashion Trends',
        currentPage: 'orders',
        orders: userOrders
    });
});

app.post('/orders/create', requireAuth, (req, res) => {
    const { items, totalAmount, shippingAddress } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order items are required' });
    }
    
    if (!totalAmount || totalAmount <= 0) {
        return res.status(400).json({ error: 'Valid total amount is required' });
    }
    
    try {
        const newOrder = {
            id: 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            userId: req.session.user.id,
            userEmail: req.session.user.email,
            items: items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: parseInt(item.quantity),
                price: parseFloat(item.price),
                totalPrice: parseInt(item.quantity) * parseFloat(item.price)
            })),
            totalAmount: parseFloat(totalAmount),
            shippingAddress: shippingAddress || {},
            orderDate: new Date(),
            status: 'pending',
            estimatedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
        };
        
        orders.push(newOrder);
        saveOrders();
        
        console.log(`New order created: ${newOrder.id} for user ${req.session.user.email}`);
        
        res.json({ 
            success: true, 
            message: 'Order placed successfully!',
            orderId: newOrder.id
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

app.get('/orders/:orderId', requireAuth, (req, res) => {
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
});

async function connectToMongoDB() {
    if (mongoose.connection.readyState === 1) {
        console.log('MongoDB already connected');
        return true;
    }
    
    if (mongoose.connection.readyState === 2) {
        console.log('MongoDB connection in progress, waiting...');
        
        return new Promise((resolve) => {
            mongoose.connection.once('connected', () => resolve(true));
            mongoose.connection.once('error', () => resolve(false));
        });
    }
    
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect("mongodb://localhost:27017/fashionstore", {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            bufferCommands: false,
        });
        console.log("MongoDB Connected successfully");
        return true;
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        return false;
    }
}
async function startServer() {
    if (isServerStarted) {
        console.log('Server already started, skipping...');
        return serverInstance;
    }

    if (isShuttingDown) {
        throw new Error('Cannot start server during shutdown');
    }

    try {
        const PORT = process.env.PORT || 3000;
        
        return new Promise((resolve, reject) => {
            serverInstance = app.listen(PORT, () => {
                isServerStarted = true;
                console.log(`Express server running on port ${PORT}`);
                console.log(`Total registered users: ${users.length}`);
                console.log(`Total products: ${products.length}`);
                console.log(`MongoDB status: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'}`);
                console.log('Available routes:');
                console.log(`Home: http://localhost:${PORT}`);
                console.log(`Products: http://localhost:${PORT}/products`);
                console.log(`Login: http://localhost:${PORT}/auth/login`);
                console.log(`Register: http://localhost:${PORT}/auth/register`);
                console.log('\n Fashion Store server is ready!');
                resolve(serverInstance);
            });
            
            serverInstance.on('error', (error) => {
                isServerStarted = false;
                serverInstance = null;
                
                if (error.code === 'EADDRINUSE') {
                    console.error(`Port ${PORT} is already in use.`);
                    console.log('Solutions:');
                    console.log('   1. Kill the existing process using the port');
                    console.log('   2. Use a different port: PORT=3001 node app.js');
                    console.log('   3. Find and stop the process: lsof -ti:3000 | xargs kill -9');
                } else {
                    console.error('Server error:', error.message);
                }
                reject(error);
            });
        });
        
    } catch (error) {
        console.error('Failed to start server:', error.message);
        isServerStarted = false;
        serverInstance = null;
        throw error;
    }
}

async function initialize() {
    if (isInitializing) {
        console.log('Initialization already in progress, skipping...');
        return;
    }
    
    if (isServerStarted) {
        console.log('Server already initialized and running, skipping...');
        return;
    }
    
    if (isShuttingDown) {
        console.log('Cannot initialize during shutdown, skipping...');
        return;
    }
    
    isInitializing = true;
    
    try {
        console.log('Starting Fashion Store application...');
    
        console.log('Loading users...');
        loadUsers();
        
        console.log('Loading orders...');
        loadOrders();
    
        console.log(' Connecting to database...');
        const mongoConnected = await connectToMongoDB();
    
        console.log(' Loading products...');
        console.log(' Bypassing MongoDB and using sample products');
        products = getSampleProducts();

        
      
        console.log('Starting server...');
        await startServer();
        
        isInitializing = false;
        console.log('Initialization completed successfully!');
        
    } catch (error) {
        isInitializing = false;
        console.error('Initialization failed:', error.message);
        
        if (serverInstance) {
            try {
                serverInstance.close();
            } catch (closeError) {
                console.error('Error closing server:', closeError.message);
            }
        }
        
        if (mongoose.connection.readyState === 1) {
            try {
                await mongoose.connection.close();
            } catch (mongoError) {
                console.error('Error closing MongoDB:', mongoError.message);
            }
        }
        
        throw error;
    }
}


app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true
    }
}));

app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');


app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    next();
});

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


app.get('/products', async (req, res) => {
    try {
        const { category, search, sort } = req.query;
        let filteredProducts = [...products];

        if (category && category !== 'all') {
            filteredProducts = filteredProducts.filter(p => p.category === category);
        }

       
        if (search) {
            const searchTerm = search.toLowerCase();
            filteredProducts = filteredProducts.filter(p => 
                p.name.toLowerCase().includes(searchTerm) ||
                p.description.toLowerCase().includes(searchTerm)
            );
        }

       
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

app.get('/about', (req, res) => {
    res.render('about', { 
        title: 'About Us - Fashion Trends',
        currentPage: 'about'
    });
});

app.get('/contact', (req, res) => {
    res.render('contact', { 
        title: 'Contact Us - Fashion Trends',
        currentPage: 'contact',
        success: null,
        error: null
    });
});

app.post('/contact', (req, res) => {
    const { name, email, subject, message } = req.body;
    
    if (!name || !email || !subject || !message) {
        return res.render('contact', { 
            title: 'Contact Us - Fashion Trends',
            currentPage: 'contact',
            error: 'Please fill in all fields',
            success: null
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.render('contact', { 
            title: 'Contact Us - Fashion Trends',
            currentPage: 'contact',
            error: 'Please enter a valid email address',
            success: null
        });
    }

    console.log(`Contact form submission from ${name} (${email}): ${subject}`);
    
    res.render('contact', { 
        title: 'Contact Us - Fashion Trends',
        currentPage: 'contact',
        error: null,
        success: 'Thank you for your message! We\'ll get back to you soon.'
    });
});

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

        req.session.user = {
            id: user.id,
            email: user.email,
            name: user.name
        };

        console.log(`User ${user.email} logged in successfully`);
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

        console.log(`New user registered: ${email} (Total users: ${users.length})`);
        
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
            saveUsers();
        }
    } catch (err) {
        console.error('Profile update error:', err);
        error = 'Failed to update profile. Please try again.';
    }

    res.render('profile', { 
        title: 'My Profile - Fashion Trends',
        currentPage: 'profile',
        userDetails: user,
        success: success,
        error: error
    });
});
app.get('/orders', requireAuth, (req, res) => {
    const userOrders = orders.filter(order => order.userId === req.session.user.id)
                           .sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
    
    res.render('orders', { 
        title: 'My Orders - Fashion Trends',
        currentPage: 'orders',
        orders: userOrders 
    });
});

app.get('/wishlist', requireAuth, (req, res) => {
    res.render('wishlist', { 
        title: 'My Wishlist - Fashion Trends',
        currentPage: 'wishlist',
        wishlistItems: []
    });
});

app.get('/cart', requireAuth, (req, res) => {
    res.render('cart', { 
        title: 'Shopping Cart - Fashion Trends',
        currentPage: 'cart',
        cartItems: []
    });
});

app.get('/exclusive-deals', requireAuth, async (req, res) => {
    try {
        const exclusiveProducts = products.filter(p => p.inStock).slice(0, 6);
        res.render('exclusive-deals', { 
            title: 'Exclusive Deals - Fashion Trends',
            currentPage: 'exclusive-deals',
            exclusiveProducts: exclusiveProducts
        });
    } catch (error) {
        console.error('Error loading exclusive deals:', error);
        res.status(500).render('error', { 
            title: 'Server Error',
            currentPage: 'error',
            error: 'Failed to load exclusive deals'
        });
    }
});

app.get('/vip', requireAuth, (req, res) => {
    res.render('vip', { 
        title: 'VIP Section - Fashion Trends',
        currentPage: 'vip'
    });
});

app.get('/api/products', async (req, res) => {
    try {
        res.json(products);
    } catch (error) {
        console.error('API error loading products:', error);
        res.status(500).json({ error: 'Failed to load products' });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const product = products.find(p => p.id === productId);
        
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        res.json(product);
    } catch (error) {
        console.error('API error loading product:', error);
        res.status(500).json({ error: 'Failed to load product' });
    }
});

app.get('/api/categories', (req, res) => {
    res.json(categories);
});
app.post('/newsletter/subscribe', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    
    console.log(`Newsletter subscription: ${email}`);
    
    res.json({ success: true, message: 'Successfully subscribed to newsletter!' });
});

app.get('/health', async (req, res) => {
    let mongoStatus = 'disconnected';
    let productCount = products.length;
    
    try {
        if (mongoose.connection.readyState === 1) {
            mongoStatus = 'connected';
            const dbProductCount = await Product.countDocuments();
            productCount = dbProductCount;
        }
    } catch (error) {
        console.error('Health check error:', error.message);
    }
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        users: users.length,
        products: productCount,
        mongoStatus: mongoStatus,
        mongoReadyState: mongoose.connection.readyState
    });
});

app.get('/admin/refresh-products', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    
    try {
        await loadProducts();
        res.json({ 
            success: true, 
            message: 'Products refreshed successfully',
            productCount: products.length 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});
app.get('/debug/users', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ error: 'Not found' });
    }
    
    res.json({
        totalUsers: users.length,
        users: users.map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            createdAt: u.createdAt,
            loginCount: u.loginCount || 0,
            lastLogin: u.lastLogin
        }))
    });
});

app.use((req, res) => {
    res.status(404).render('404', { 
        title: 'Page Not Found - Fashion Trends',
        currentPage: '404'
    });
});
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).render('error', { 
        title: 'Server Error - Fashion Trends',
        currentPage: 'error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!'
    });
});

process.on('SIGINT', async () => {
    if (isShuttingDown) {
        console.log('\n Force shutdown requested...');
        process.exit(0);
        return;
    }
    
    isShuttingDown = true;
    console.log('\n Gracefully shutting down...');
    
    try {
       
        if (mongoose.connection.readyState === 1) {
            console.log('Closing MongoDB connection...');
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
        }
        
       
        if (users.length > 0) {
            console.log('Saving users data...');
            saveUsers();
        }
        
        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error.message);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    if (isShuttingDown) {
        process.exit(0);
        return;
    }
    
    isShuttingDown = true;
    console.log('Received SIGTERM, shutting down gracefully...');
    
    try {
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        saveUsers();
        process.exit(0);
    } catch (error) {
        console.error('Error during SIGTERM shutdown:', error.message);
        process.exit(1);
    }
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error.message);
    console.error(error.stack);
    
    if (!isShuttingDown) {
        isShuttingDown = true;
        console.log('Attempting graceful shutdown due to uncaught exception...');
        
        try {
            if (mongoose.connection.readyState === 1) {
                mongoose.connection.close();
            }
            saveUsers();
        } catch (shutdownError) {
            console.error('Error during emergency shutdown:', shutdownError.message);
        }
        
        process.exit(1);
    }
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    if (!isShuttingDown) {
        isShuttingDown = true;
        console.log('Attempting graceful shutdown due to unhandled rejection...');
        
        try {
            if (mongoose.connection.readyState === 1) {
                mongoose.connection.close();
            }
            saveUsers();
        } catch (shutdownError) {
            console.error('Error during emergency shutdown:', shutdownError.message);
        }
        
        process.exit(1);
    }
});

if (require.main === module) {
   
    initialize().catch((error) => {
        if (!isShuttingDown) {
            console.error(' Fatal initialization error:', error.message);
            process.exit(1);
        }
    });
}

module.exports = { app, initialize };

