// src/routes/forum.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const router = express.Router();

// Get posts for a game
router.get("/:game", authenticateToken, async (req, res) => {
  try {
    const game = decodeURIComponent(req.params.game);
    const posts = await ForumPost.find({ game }).sort({ date: -1 })
      .populate('userId', 'username profilePic')
      .populate('comments.userId', 'username profilePic')
      .populate('comments.replies.userId', 'username profilePic');
    res.json(posts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create post
router.post("/", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.banned) {
      if (user.banDuration > 0 && user.banStartDate) {
        const currentDate = new Date();
        const banEndDate = new Date(user.banStartDate);
        banEndDate.setDate(banEndDate.getDate() + user.banDuration);
        if (currentDate >= banEndDate) {
          user.banned = false;
          user.banDuration = 0;
          user.banStartDate = null;
          await user.save();
        } else {
          return res.status(403).json({
            message: `User is temporarily banned until ${banEndDate.toLocaleString()}`,
            banEndDate: banEndDate.toISOString(),
          });
        }
      } else {
        return res.status(403).json({
          message: "User is permanently banned",
        });
      }
    }

    const { game, subject, text } = req.body;
    const post = new ForumPost({
      game,
      subject,
      text,
      userId: req.user.id,
    });
    await post.save();
    const populatedPost = await ForumPost.findById(post._id)
      .populate('userId', 'username profilePic')
      .populate('comments.userId', 'username profilePic')
      .populate('comments.replies.userId', 'username profilePic');
    res.status(201).json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add comment
router.post("/:id/comment", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.banned) {
      if (user.banDuration > 0 && user.banStartDate) {
        const currentDate = new Date();
        const banEndDate = new Date(user.banStartDate);
        banEndDate.setDate(banEndDate.getDate() + user.banDuration);
        if (currentDate >= banEndDate) {
          user.banned = false;
          user.banDuration = 0;
          user.banStartDate = null;
          await user.save();
        } else {
          return res.status(403).json({
            message: `User is temporarily banned until ${banEndDate.toLocaleString()}`,
            banEndDate: banEndDate.toISOString(),
          });
        }
      } else {
        return res.status(403).json({
          message: "User is permanently banned",
        });
      }
    }

    const { text } = req.body;
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    post.comments.push({ userId: req.user.id, text });
    await post.save();
    const populatedPost = await ForumPost.findById(req.params.id)
      .populate('userId', 'username profilePic')
      .populate('comments.userId', 'username profilePic')
      .populate('comments.replies.userId', 'username profilePic');
    res.json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add reply to comment
router.post("/:id/comment/:commentId/reply", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.banned) {
      if (user.banDuration > 0 && user.banStartDate) {
        const currentDate = new Date();
        const banEndDate = new Date(user.banStartDate);
        banEndDate.setDate(banEndDate.getDate() + user.banDuration);
        if (currentDate >= banEndDate) {
          user.banned = false;
          user.banDuration = 0;
          user.banStartDate = null;
          await user.save();
        } else {
          return res.status(403).json({
            message: `User is temporarily banned until ${banEndDate.toLocaleString()}`,
            banEndDate: banEndDate.toISOString(),
          });
        }
      } else {
        return res.status(403).json({
          message: "User is permanently banned",
        });
      }
    }

    const { text } = req.body;
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });
    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });
    comment.replies.push({ userId: req.user.id, text });
    await post.save();
    const populatedPost = await ForumPost.findById(req.params.id)
      .populate('userId', 'username profilePic')
      .populate('comments.userId', 'username profilePic')
      .populate('comments.replies.userId', 'username profilePic');
    res.json(populatedPost);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;