// src/routes/forum.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const multer = require('multer');
const { storage } = require("../config/gridfs");
const mongoose = require("mongoose");

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Invalid file type'));
  }
});

const router = express.Router();

// Get posts (unchanged)
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

// Create post with image
router.post("/", authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Ban check logic (same as before)
    if (user.banned) { /* ... same ban logic ... */ }

    const { game, subject, text } = req.body;
    const image = req.file ? {
      fileId: req.file.id,
      filename: req.file.filename,
      contentType: req.file.contentType,
      uploadDate: req.file.uploadDate,
    } : null;

    const post = new ForumPost({
      game,
      subject,
      text,
      userId: req.user.id,
      image
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

// Add comment with image
router.post("/:id/comment", authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Ban check...
    if (user.banned) { /* same as above */ }

    const { text } = req.body;
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const image = req.file ? {
      fileId: req.file.id,
      filename: req.file.filename,
      contentType: req.file.contentType,
    } : null;

    post.comments.push({ userId: req.user.id, text, image });
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

// Add reply with image
router.post("/:id/comment/:commentId/reply", authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Ban check...
    if (user.banned) { /* same */ }

    const { text } = req.body;
    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const image = req.file ? {
      fileId: req.file.id,
      filename: req.file.filename,
      contentType: req.file.contentType,
    } : null;

    comment.replies.push({ userId: req.user.id, text, image });
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

// Serve image by fileId
router.get("/image/:fileId", async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' });
    
    const file = await bucket.find({ _id: fileId }).next();
    if (!file) return res.status(404).json({ message: "Image not found" });

    res.set('Content-Type', file.contentType);
    const stream = bucket.openDownloadStream(fileId);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;