// src/routes/forum.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const multer = require("multer");
const { storage } = require("../config/gridfs");
const mongoose = require("mongoose");

const router = express.Router();

// Multer config (15 MB limit, only images)
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only images allowed"));
  },
});

// Fix: multer + Authorization header together
const multerWithAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    req._tempAuth = authHeader;
    delete req.headers.authorization;
  }

  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });

    if (req._tempAuth) {
      req.headers.authorization = req._tempAuth;
    }
    next();
  });
};

// GET posts by game (you can keep it protected or public – your choice)
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
    res.status(500).json({ message: err.message });
  }
});

// CREATE POST
router.post("/", multerWithAuth, authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned)
      return res.status(403).json({ message: "You are banned", banEndDate: user.banEndDate });

    const { game, subject, text } = req.body;
    if (!game || !subject?.trim() || !text?.trim())
      return res.status(400).json({ message: "Missing required fields" });

    const image = req.file
      ? {
          fileId: req.file.id.toString(),
          filename: req.file.filename,
          contentType: req.file.contentType,
        }
      : null;

    const post = new ForumPost({ game, subject: subject.trim(), text: text.trim(), userId: req.user.id, image });
    await post.save();

    const populated = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ADD COMMENT (images now work)
router.post("/:id/comment", multerWithAuth, authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned)
      return res.status(403).json({ message: "You are banned", banEndDate: user.banEndDate });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const image = req.file
      ? {
          fileId: req.file.id.toString(),
          filename: req.file.filename,
          contentType: req.file.contentType,
        }
      : null;

    post.comments.push({ userId: req.user.id, text: text.trim(), image });
    await post.save();

    const populated = await ForumPost.findById(req.params.id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(populated);
  } catch (err) {
    console.error("Comment error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ADD REPLY (images now work)
router.post("/:id/comment/:commentId/reply", multerWithAuth, authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned)
      return res.status(403).json({ message: "You are banned", banEndDate: user.banEndDate });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const image = req.file
      ? {
          fileId: req.file.id.toString(),
          filename: req.file.filename,
          contentType: req.file.contentType,
        }
      : null;

    comment.replies.push({ userId: req.user.id, text: text.trim(), image });
    await post.save();

    const populated = await ForumPost.findById(req.params.id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(populated);
  } catch (err) {
    console.error("Reply error:", err);
    res.status(500).json({ message: err.message });
  }
});

// SERVE IMAGE
router.get("/image/:fileId", async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });

    const file = await bucket.find({ _id: fileId }).next();
    if (!file) return res.status(404).json({ message: "Image not found" });

    res.set("Content-Type", file.contentType);
    const stream = bucket.openDownloadStream(fileId);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;