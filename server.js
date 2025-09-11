require("dotenv").config(); // Load .env
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // Increase limit to handle profile pic base64

// Environment variables
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// Connect to MongoDB
mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ Mongo Error:", err));

// User schema
const userSchema = new mongoose.Schema({
  username: { type: String, trim: true },
  email: { type: String, unique: true, required: true, trim: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: null },
  violations: { type: Number, default: 0 },
  banned: { type: Boolean, default: false },
  banDuration: { type: Number, default: 0 }, // Days, 0 for permanent
  games: {
    type: Map,
    of: {
      ign: { type: String, default: "", trim: true },
      rank: { type: String, default: "Unranked", trim: true }
    }
  }
});

// Create indexes for better querying
userSchema.index({ email: 1 });
const User = mongoose.model("User", userSchema);

// Game schema
const gameSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  rank: { type: String, default: "Unranked", required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

// Create indexes for better sorting
gameSchema.index({ rank: 1, name: 1 });
const Game = mongoose.model("Game", gameSchema);

// Middleware to verify JWT (for protected routes)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: "Token required" });
  }
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

// Signup route
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password, profilePic, games } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username: username?.trim() || undefined,
      email: email.trim(),
      password: hashedPassword,
      profilePic: profilePic || null,
      games: games || {},
      violations: 0,
      banned: false,
      banDuration: 0
    });
    await user.save();

    console.log(`🆕 New user registered: ${user.email}`);
    res.json({ success: true, message: "User registered successfully" });
  } catch (err) {
    console.error("❌ Error in signup:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    if (user.banned) {
      return res.status(403).json({
        success: false,
        message: `User is banned ${user.banDuration === 0 ? "permanently" : `for ${user.banDuration} days`}`
      });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "1h" });
    console.log(`🔐 User logged in: ${user.email}`);
    res.json({ success: true, token });
  } catch (err) {
    console.error("❌ Error in login:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fetch all users (Admin route, protected)
app.get("/users", authenticateToken, async (req, res) => {
  try {
    const users = await User.find({}, "username email profilePic games violations banned banDuration");

    const usersWithDefaults = users.map(user => ({
      _id: user._id,
      username: user.username || "Unknown",
      email: user.email,
      profilePic: user.profilePic || null,
      games: user.games || {},
      violations: user.violations || 0,
      banned: user.banned || false,
      banDuration: user.banDuration || 0,
    }));

    console.log("📌 Users fetched from DB:", usersWithDefaults);
    res.json(usersWithDefaults);
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update user (for ban, violations, etc.)
app.put("/users/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { banned, banDuration, violations } = req.body;

    const updateData = {};
    if (banned !== undefined) updateData.banned = banned;
    if (banDuration !== undefined) updateData.banDuration = banDuration;
    if (violations !== undefined) updateData.violations = violations;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log(`🔄 User updated: ${updatedUser.email} (banned: ${updatedUser.banned}, banDuration: ${updatedUser.banDuration})`);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("❌ Error updating user:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Send email
app.post("/send-email", async (req, res) => {
  const { email, message } = req.body;
  if (!email || !message) {
    return res.status(400).json({ success: false, message: "Email and message are required" });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  });

  const mailOptions = {
    from: EMAIL_USER,
    to: email,
    subject: "Violation Notification from GameTeract",
    text: message
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to: ${email}`);
    res.json({ success: true, message: "Email sent successfully" });
  } catch (err) {
    console.error("❌ Error sending email:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add game route
app.post("/games", async (req, res) => {
  try {
    const { name, description, image, rank = "Unranked" } = req.body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Game name is required" });
    }
    if (!description || description.trim() === "") {
      return res.status(400).json({ success: false, message: "Game description is required" });
    }
    if (!image) {
      return res.status(400).json({ success: false, message: "Game image is required" });
    }
    if (!rank || rank.trim() === "") {
      return res.status(400).json({ success: false, message: "Game rank is required" });
    }

    // Check for duplicate game names
    const existingGame = await Game.findOne({ name: name.trim() });
    if (existingGame) {
      return res.status(400).json({ success: false, message: "Game with this name already exists" });
    }

    const newGame = new Game({
      name: name.trim(),
      description: description.trim(),
      image,
      rank: rank.trim()
    });

    await newGame.save();
    console.log(`🎮 New game added: ${newGame.name} (${newGame.rank})`);
    res.json({
      success: true,
      message: "Game added successfully",
      game: newGame
    });
  } catch (err) {
    console.error("❌ Error adding game:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fetch games
app.get("/games", async (req, res) => {
  try {
    const games = await Game.find().sort({
      rank: 1, // Sort by rank alphabetically (A-Z)
      name: 1  // Then by name if ranks are the same
    }).select('-__v'); // Exclude __v field

    console.log(`📊 Fetched ${games.length} games, sorted by rank`);
    res.json(games);
  } catch (err) {
    console.error("❌ Error fetching games:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get single game
app.get("/games/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const game = await Game.findById(id);

    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    res.json({ success: true, game });
  } catch (err) {
    console.error("❌ Error fetching game:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete game
app.delete("/games/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedGame = await Game.findById(id);

    if (!deletedGame) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    await Game.findByIdAndDelete(id);
    console.log(`🗑️ Game deleted: ${deletedGame.name}`);
    res.json({
      success: true,
      message: "Game deleted successfully",
      deletedGameName: deletedGame.name
    });
  } catch (err) {
    console.error("❌ Error deleting game:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update game rank
app.put("/games/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rank } = req.body;

    if (!rank || rank.trim() === "") {
      return res.status(400).json({ success: false, message: "Rank is required and cannot be empty" });
    }

    const updatedGame = await Game.findByIdAndUpdate(
      id,
      {
        rank: rank.trim(),
        updatedAt: Date.now()
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedGame) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    console.log(`🔄 Game rank updated: ${updatedGame.name} -> ${updatedGame.rank}`);
    res.json({
      success: true,
      message: "Rank updated successfully",
      game: updatedGame
    });
  } catch (err) {
    console.error("❌ Error updating game rank:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update game (full update)
app.put("/games/:id/full", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, rank } = req.body;

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Game name is required" });
    }
    if (!description || description.trim() === "") {
      return res.status(400).json({ success: false, message: "Game description is required" });
    }
    if (!image) {
      return res.status(400).json({ success: false, message: "Game image is required" });
    }
    if (!rank || rank.trim() === "") {
      return res.status(400).json({ success: false, message: "Game rank is required" });
    }

    // Check for duplicate game names (excluding current game)
    const existingGame = await Game.findOne({
      name: name.trim(),
      _id: { $ne: id }
    });
    if (existingGame) {
      return res.status(400).json({ success: false, message: "Game with this name already exists" });
    }

    const updatedGame = await Game.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        description: description.trim(),
        image,
        rank: rank.trim(),
        updatedAt: Date.now()
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!updatedGame) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    console.log(`🔄 Game fully updated: ${updatedGame.name} (${updatedGame.rank})`);
    res.json({
      success: true,
      message: "Game updated successfully",
      game: updatedGame
    });
  } catch (err) {
    console.error("❌ Error updating game:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Search games by name or rank
app.get("/games/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const searchTerm = q.trim().toLowerCase();
    const games = await Game.find({
      $or: [
        { name: { $regex: searchTerm, $options: 'i' } },
        { rank: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } }
      ]
    }).sort({ rank: 1, name: 1 }).limit(20);

    res.json({ success: true, games, count: games.length });
  } catch (err) {
    console.error("❌ Error searching games:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root response
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>GameTeract API</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #0c1325, #1a2238);
            color: white;
            text-align: center;
            padding: 50px;
          }
          h1 {
            color: #6b48ff;
          }
          .card {
            background: #273469;
            padding: 20px;
            border-radius: 12px;
            display: inline-block;
            margin-top: 20px;
            max-width: 600px;
          }
          p {
            margin: 5px 0;
          }
          .status {
            color: #4ade80;
            font-weight: bold;
          }
          .routes {
            text-align: left;
            margin: 20px 0;
          }
          .routes ul {
            list-style: none;
            padding: 0;
          }
          .routes li {
            margin: 10px 0;
            padding: 8px;
            background: rgba(255,255,255,0.1);
            border-radius: 6px;
          }
          code {
            background: rgba(0,0,0,0.3);
            padding: 2px 6px;
            border-radius: 4px;
            color: #6b48ff;
          }
        </style>
      </head>
      <body>
        <h1>🚀 GameTeract API</h1>
        <div class="card">
          <p class="status">✅ Backend is running!</p>
          <p>MongoDB connected successfully</p>
          <p>Server Uptime: <span id="uptime">${Math.floor(process.uptime())}</span> seconds</p>
          <p>Available Routes:</p>
          <div class="routes">
            <ul>
              <li>🔹 <code>GET /users</code> - Fetch all users (protected)</li>
              <li>🔹 <code>PUT /users/:id</code> - Update user (protected)</li>
              <li>🔹 <code>GET /games</code> - Fetch all games</li>
              <li>🔹 <code>GET /games/:id</code> - Get single game</li>
              <li>🔹 <code>POST /games</code> - Add new game</li>
              <li>🔹 <code>PUT /games/:id</code> - Update game rank</li>
              <li>🔹 <code>PUT /games/:id/full</code> - Full game update</li>
              <li>🔹 <code>DELETE /games/:id</code> - Delete game</li>
              <li>🔹 <code>GET /games/search?q=term</code> - Search games</li>
              <li>🔹 <code>POST /signup</code> - User registration</li>
              <li>🔹 <code>POST /login</code> - User login</li>
              <li>🔹 <code>POST /send-email</code> - Send email</li>
              <li>🔹 <code>GET /health</code> - Health check</li>
            </ul>
          </div>
          <p><strong>Game Ranks:</strong> Supports manual input (Iron 1, Silver 3, Radiant, etc.)</p>
        </div>
      </body>
    </html>
  `);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}`);
  console.log(`📱 Test the API at http://localhost:${PORT}/`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('✅ MongoDB connection closed');
    process.exit(0);
  });
});