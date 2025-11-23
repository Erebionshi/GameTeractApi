
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const AppRating = require("../models/AppRating");
const router = express.Router();

// POST - Submit or update app rating (protected)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { rating, feedback } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: "Rating must be 1–5" });
    }

    const existing = await AppRating.findOne({ user: req.user.id });

    if (existing) {
      existing.rating = rating;
      existing.feedback = feedback?.trim() || existing.feedback;
      await existing.save();
      return res.json({ success: true, message: "Your rating has been updated!", rating: existing });
    }

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


router.get("/all", async (req, res) => {
  try {
    const ratings = await AppRating.find({})
      .populate("user", "username profilePic") 
      .sort({ createdAt: -1 })
      .lean();

    const total = ratings.length;
    const average = total > 0
      ? Number((ratings.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(2))
      : 0;

    const distribution = {
      5: ratings.filter(r => r.rating === 5).length,
      4: ratings.filter(r => r.rating === 4).length,
      3: ratings.filter(r => r.rating === 3).length,
      2: ratings.filter(r => r.rating === 2).length,
      1: ratings.filter(r => r.rating === 1).length,
    };

    res.json({
      success: true,
      ratings,                    
      stats: {
        total,
        average,
        distribution
      }
    });
  } catch (err) {
    console.error("Error fetching public app ratings:", err);
    res.status(500).json({ success: false, message: "Failed to load ratings" });
  }
});

module.exports = router;