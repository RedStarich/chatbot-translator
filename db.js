const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Get MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-chatbot';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });

// Define user schema
const userSchema = new mongoose.Schema({
  chatId: { type: Number, required: true, unique: true },
  language: { type: String, default: null },
  gender: { type: Number, default: null },
  friends: [{ type: Number }],
  connected: { type: Boolean, default: false },
  currentConnection: { type: Number, default: null },
  name: { type: String, default: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// Create User model
const User = mongoose.model('User', userSchema);

module.exports = { User };
