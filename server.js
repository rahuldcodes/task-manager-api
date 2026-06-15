const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// 1. MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "MeraSuperSecretKey123"; // Token sign karne ke liye secret

mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB connected successfully! 🍃"))
  .catch((err) => console.log("Database connection error ❌:", err));

// 2. User Schema & Model
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// Password Hashing Middleware (Database mein save hone se pehle hash karega)
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

const User = mongoose.model('User', UserSchema);

// 3. Authentication Endpoints

// 👉 [POST] SIGNUP: Register a new user
app.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: "User already exists!" });

    const newUser = new User({ email, password });
    await newUser.save();
    res.status(201).json({ message: "User registered successfully! 🎉" });
  } catch (err) {
    res.status(500).json({ error: "Signup failed" });
  }
});

// 👉 [POST] LOGIN: Verify credentials & issue JWT
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    // Check user and compare password
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password ❌" });
    }

    // Issue JWT Token (Valid for 1 hour)
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: "Login successful! 🔓", token });
  } catch (err) {
    res.status(500).json({ error: "Login failed" });
  }
});

// 4. Auth Middleware (Security Guard)
function authMiddleware(req, res, next) {
  // Header se token nikalna (Format: Bearer <TOKEN>)
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access Denied! No token provided. 🛑" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Decoded userId ko request mein attach kar rahe hain
    next(); // Aage jaane do
  } catch (err) {
    res.status(400).json({ error: "Invalid or expired token ❌" });
  }
}

// 👉 [GET] PROTECTED PROFILE: Middleware protected route
app.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password'); // Password chhupa kar data bhejenge
    res.json({ message: "Welcome to your secure profile! 🛡️", user });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Welcome Route for Home '/'
app.get('/', (req, res) => {
  res.send("Authentication API is running live! 🚀");
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} 🚀`);
});
