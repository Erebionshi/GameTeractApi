// src/routes/forum.js → REPLACE ALL IMAGE LOGIC

const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const router = express.Router();

// GET posts
router.get("/:game", async (req, res) => {
  try {
    const game = decodeURIComponent(req.params.game);
    const posts = await ForumPost.find({ game })
      .sort({ date: -1 })
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// CREATE POST
router.post("/", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) return res.status(403).json({ message: "You are banned", banEndDate: user.banEndDate });

    const { game, subject, text, image } = req.body; // image = base64 string

    const post = new ForumPost({
      game,
      subject: subject.trim(),
      text: text.trim(),
      userId: req.user.id,
      image, // ← just save the base64 string!
    });

    await post.save();
    const populated = await post
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ADD COMMENT
router.post("/:id/comment", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.banned) return res.status(403).json({ message: "Forbidden" });

    const { text, image } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.comments.push({
      userId: req.user.id,
      text: text.trim(),
      image, // ← base64 string
    });

    await post.save();
    const updated = await post
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ADD REPLY
router.post("/:id/comment/:commentId/reply", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.banned) return res.status(403).json({ message: "Forbidden" });

    const { text, image } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({
      userId: req.user.id,
      text: text.trim(),
      image,
    });

    await post.save();
    const updated = await post
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE routes stay the same (no change needed)
router.delete("/post/:postId", authenticateToken, async (req, res) => { /* ... same as before */ });
router.delete("/post/:postId/comment/:commentId", authenticateToken, async (req, res) => { /* ... */ });
router.delete("/post/:postId/comment/:commentId/reply/:replyId", authenticateToken, async (req, res) => { /* ... */ });

module.exports = router;