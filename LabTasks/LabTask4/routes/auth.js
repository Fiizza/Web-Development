const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// In-memory user storage (in production, use a database)
const users = [];

// Login page
router.get('/login', (req, res) => {
    res.render('login', { 
        title: 'Login - Fashion Trends',
        currentPage: 'login',
        error: null,
        layout: 'layout'
    });
});

// Register page
router.get('/register', (req, res) => {
    res.render('register', { 
        title: 'Register - Fashion Trends',
        currentPage: 'register',
        error: null,
        layout: 'layout'
    });
});

// Handle login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.render('login', { 
            title: 'Login - Fashion Trends',
            currentPage: 'login',
            error: 'Please fill in all fields',
            layout: 'layout'
        });
    }

    const user = users.find(u => u.email === email);
    
    if (!user) {
        return res.render('login', { 
            title: 'Login - Fashion Trends',
            currentPage: 'login',
            error: 'Invalid email or password',
            layout: 'layout'
        });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
        return res.render('login', { 
            title: 'Login - Fashion Trends',
            currentPage: 'login',
            error: 'Invalid email or password',
            layout: 'layout'
        });
    }

    req.session.user = {
        id: user.id,
        email: user.email,
        name: user.name
    };

    res.redirect('/');
});

// Handle register
router.post('/register', async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    
    if (!name || !email || !password || !confirmPassword) {
        return res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Please fill in all fields',
            layout: 'layout'
        });
    }

    if (password !== confirmPassword) {
        return res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Passwords do not match',
            layout: 'layout'
        });
    }

    if (password.length < 6) {
        return res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Password must be at least 6 characters long',
            layout: 'layout'
        });
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.render('register', { 
            title: 'Register - Fashion Trends',
            currentPage: 'register',
            error: 'Email already registered',
            layout: 'layout'
        });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
        id: users.length + 1,
        name,
        email,
        password: hashedPassword
    };
    
    users.push(newUser);

    req.session.user = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
    };

    res.redirect('/');
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        }
        res.redirect('/');
    });
});

module.exports = router;