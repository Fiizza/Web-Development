const express = require('express');
const router = express.Router();
const { products, categories } = require('../models/products');

// Products listing page
router.get('/', (req, res) => {
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
        currentPage: 'products',
        layout: 'layout'
    });
});

// Single product page
router.get('/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const product = products.find(p => p.id === productId);
    
    if (!product) {
        return res.status(404).render('404', { 
            title: 'Product Not Found',
            currentPage: '404',
            layout: 'layout'
        });
    }

    // Get related products (same category, different product)
    const relatedProducts = products
        .filter(p => p.category === product.category && p.id !== product.id)
        .slice(0, 4);

    res.render('product-detail', { 
        title: `${product.name} - Fashion Trends`,
        product: product,
        relatedProducts: relatedProducts,
        currentPage: 'products',
        layout: 'layout'
    });
});

module.exports = router;