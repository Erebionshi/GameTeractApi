require("dotenv").config(); // Load .env
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increase limit to handle profile pic base64

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Mongo Error:", err));

// User schema
const userSchema = new mongoose.Schema({
  username: String,
  email: { type: String, unique: true },
  password: String,
  profilePic: String, // store image as base64 URL or link
  games: {
    valorant: { id: String, rank: String },
    dota: { id: String, rank: String },
    csgo: { id: String, rank: String },
  },
});
const User = mongoose.model("User", userSchema);

// Signup route
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password, profilePic, games } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ success: false, message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username,
      email,
      password: hashedPassword,
      profilePic: profilePic || null,
      games: games || {}, // optional
    });
    await user.save();

    res.json({ success: true, message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ success: false, message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fetch all users (Admin route)
app.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "username email profilePic games"); // include new fields

    const usersWithDefaults = users.map(user => ({
      _id: user._id,
      username: user.username || "Unknown",
      email: user.email,
      profilePic: user.profilePic || null,
      games: user.games || {},
      badge: "None",
      rating: 0,
      points: 0,
    }));

    console.log("📌 Users fetched from DB:", usersWithDefaults);

    res.json(usersWithDefaults);
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});


// Game schema
const gameSchema = new mongoose.Schema({
  name: String,
  image: String, // base64 string or URL
  createdAt: { type: Date, default: Date.now },
});
const Game = mongoose.model("Game", gameSchema);

// Add game route
app.post("/games", async (req, res) => {
  try {
    const { name, image } = req.body;
    if (!name || !image) {
      return res.status(400).json({ success: false, message: "Name and image are required" });
    }

    const newGame = new Game({ name, image });
    await newGame.save();
    res.json({ success: true, message: "Game added successfully", game: newGame });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fetch games
app.get("/games", async (req, res) => {
  try {
    const games = await Game.find().sort({ createdAt: -1 });
    res.json(games);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Test route
app.get("/", (req, res) => {
  res.send("Backend running!");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});