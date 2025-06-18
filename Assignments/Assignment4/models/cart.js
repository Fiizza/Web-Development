const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  userId: { type: String, required: true }, // Use string because your users are from JSON, not MongoDB
  items: [{
    productId: Number,
    name: String,
    price: Number,
    image: String,
    quantity: Number
  }]
});

module.exports = mongoose.model('Cart', cartSchema);

