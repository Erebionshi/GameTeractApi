// Add this to your backend: src/routes/forum.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const router = express.Router();

// Get posts for a game
router.get("/:game", authenticateToken, async (req, res) => {
  try {
    const posts = await ForumPost.find({ game: req.params.game }).sort({ date: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create post
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { game, subject, text } = req.body;
    const post = new ForumPost({
      game,
      subject,
      text,
      userId: req.user.id
    });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add comment (optional, expand as needed)
router.post("/:id/comment", authenticateToken, async (req, res) => {
  try {
    const { text } = req.body;
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    post.comments.push({ userId: req.user.id, text });
    await post.save();
    res.json(post);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;