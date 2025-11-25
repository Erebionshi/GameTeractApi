// src/routes/forum.js — REPLACE ENTIRE FILE WITH THIS

const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const router = express.Router();

// GET all posts for a game
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
    console.error("GET posts error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// CREATE POST — ONLY JSON + BASE64
router.post("/", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) {
      return res.status(403).json({
        message: "You are banned from posting",
        banEndDate: user.banStartDate
          ? new Date(new Date(user.banStartDate).getTime() + user.banDuration * 24 * 60 * 60 * 1000)
          : null,
      });
    }

    const { game, subject, text, image } = req.body; // image = base64 string

    if (!game || !subject?.trim() || !text?.trim()) {
      return res.status(400).json({ message: "Game, subject, and text are required" });
    }

    const post = new ForumPost({
      game,
      subject: subject.trim(),
      text: text.trim(),
      userId: req.user.id,
      image: image || null, // ← base64 string or null
    });

    await post.save();

    const populatedPost = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic");

    res.status(201).json(populatedPost);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ADD COMMENT - FIXED
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
      image: image || null,
      date: Date.now(),
    });

    await post.save();

    // Re-fetch with full population
    const updatedPost = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updatedPost);
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ADD REPLY - FIXED
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
      image: image || null,
      date: Date.now(),
    });

    await post.save();

    // Re-fetch fully populated
    const updatedPost = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updatedPost);
  } catch (err) {
    console.error("Add reply error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE POST
router.delete("/post/:postId", authenticateToken, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.userId.toString() !== req.user.id) return res.status(403).json({ message: "Not authorized" });

    await ForumPost.deleteOne({ _id: req.params.postId });
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE COMMENT - FIXED
router.delete("/post/:postId/comment/:commentId", authenticateToken, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment || comment.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    comment.remove();
    await post.save();

    // Re-fetch populated version
    const updatedPost = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updatedPost);
  } catch (err) {
    console.error("Delete comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// DELETE REPLY - FIXED (this is the one you asked for)
router.delete("/post/:postId/comment/:commentId/reply/:replyId", authenticateToken, async (req, res) => {
  try {
    const { postId, commentId, replyId } = req.params;

    const post = await ForumPost.findById(postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    if (reply.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    reply.remove();
    await post.save();

    const updatedPost = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updatedPost);
  } catch (err) {
    console.error("Delete reply error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;