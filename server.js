require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/auth");
const userRoutes = require("./src/routes/users");
const gameRoutes = require("./src/routes/games");
const emailRoutes = require("./src/routes/email");
const forumRoutes = require("./src/routes/forum");
const { authenticateToken } = require("./src/middleware/auth");
const appRatingRoutes = require("./src/routes/appRating");
const { storage } = require("./src/config/gridfs");
const multer = require('multer');


const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (jpeg, png, gif, webp) are allowed'));
    }
  }
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true })); // ADD THIS LINE

// Connect to MongoDB
connectDB();

// Routes
app.use("/auth", authRoutes); // Fixed path
app.use("/users", userRoutes); // Fixed path
app.use("/games", gameRoutes); // Fixed path
app.use("/email", emailRoutes); // Fixed path
app.use("/forum", forumRoutes); // Fixed path
app.use("/app-rating", appRatingRoutes);

// Protected endpoint to fetch PandaScore API key
app.get("/api-key", authenticateToken, (req, res) => {
  try {
    const apiKey = process.env.PANDASCORE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: "PandaScore API key not configured on server" });
    }
    console.log(`🔑 API key requested by user: ${req.user.email}`);
    res.json({ success: true, apiKey });
  } catch (err) {
    console.error("❌ Error fetching API key:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API is healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root response
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>GameTeract API</title>
        <style>
          body { font-family: Arial, sans-serif; background: linear-gradient(135deg, #0c1325, #1a2238); color: white; text-align: center; padding: 50px; }
          h1 { color: #6b48ff; }
          .card { background: #273469; padding: 20px; border-radius: 12px; display: inline-block; margin-top: 20px; max-width: 600px; }
          p { margin: 5px 0; }
          .status { color: #4ade80; font-weight: bold; }
          .routes { text-align: left; margin: 20px 0; }
          .routes ul { list-style: none; padding: 0; }
          .routes li { margin: 10px 0; padding: 8px; background: rgba(255,255,255,0.1); border-radius: 6px; }
          code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: #6b48ff; }
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
              <li>🔹 <code>GET /users</code> - Fetch all users</li>
              <li>🔹 <code>PUT /users/:id</code> - Update user</li>
              <li>🔹 <code>GET /games</code> - Fetch all games (protected)</li>
              <li>🔹 <code>GET /games/:id</code> - Get single game</li>
              <li>🔹 <code>POST /games</code> - Add new game</li>
              <li>🔹 <code>PUT /games/:id</code> - Update game rank</li>
              <li>🔹 <code>PUT /games/:id/full</code> - Full game update</li>
              <li>🔹 <code>DELETE /games/:id</code> - Delete game</li>
              <li>🔹 <code>GET /games/search?q=term</code> - Search games</li>
              <li>🔹 <code>POST /auth/signup</code> - User registration</li>
              <li>🔹 <code>POST /auth/login</code> - User login</li>
              <li>🔹 <code>POST /email/send-email</code> - Send email</li>
              <li>🔹 <code>GET /health</code> - Health check</li>
              <li>🔹 <code>GET /api-key</code> - Fetch PandaScore API key (protected)</li>
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
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}`);
});