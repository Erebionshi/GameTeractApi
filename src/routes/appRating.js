// src/routes/appRating.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const AppRating = require("../models/AppRating");
const User = require("../models/User");
const router = express.Router();

// Submit or update app rating
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1–5" });
    }

    const existing = await AppRating.findOne({ user: req.user.id });

    if (existing) {
      // Update existing rating
      existing.rating = rating;
      existing.feedback = feedback || existing.feedback;
      await existing.save();
      return res.json({ success: true, message: "Thank you! Your rating has been updated", rating: existing });
    }

    // Create new
    const appRating = new AppRating({
      user: req.user.id,
      rating,
      feedback: feedback?.trim(),
    });
    await appRating.save();

    res.json({ success: true, message: "Thank you for your feedback!", rating: appRating });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: "You have already rated the app" });
    }
    console.error("Error submitting app rating:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all app ratings (Admin only – you can add admin check later)
router.get("/admin", authenticateToken, async (req, res) => {
  try {
    // Optional: Add admin check here later
    // if (!req.user.isAdmin) return res.status(403).json(...)

    const ratings = await AppRating.find()
      .populate("user", "username email profilePic")
      .sort({ createdAt: -1 });

    const stats = {
      total: ratings.length,
      average: ratings.length > 0
        ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(2)
        : 0,
      distribution: {
        5: ratings.filter(r => r.rating === 5).length,
        4: ratings.filter(r => r.rating === 4).length,
        3: ratings.filter(r => r.rating === 3).length,
        2: ratings.filter(r => r.rating === 2).length,
        1: ratings.filter(r => r.rating === 1).length,
      }
    };

    res.json({ success: true, ratings, stats });
  } catch (err) {
    console.error("Error fetching app ratings:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;