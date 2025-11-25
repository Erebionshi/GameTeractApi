// src/routes/forum.js  ← REPLACE YOUR ENTIRE FILE WITH THIS ONE

const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const multer = require("multer");
const mongoose = require("mongoose");

const router = express.Router();

// Multer in memory – fixes all Authorization header issues
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    allowedTypes.includes(file.mimetype) ? cb(null, true) : cb(new Error("Invalid image type"));
  },
});

// Save image to GridFS
const saveImageToGridFS = async (file) => {
  if (!file?.buffer) return null;

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
  const filename = `${Date.now()}_${file.originalname}`;
  const uploadStream = bucket.openUploadStream(filename, { contentType: file.mimetype });

  return new Promise((resolve, reject) => {
    uploadStream.end(file.buffer);
    uploadStream.on("finish", () => resolve({
      fileId: uploadStream.id.toString(),
      filename: uploadStream.filename,
      contentType: file.mimetype,
    }));
    uploadStream.on("error", reject);
  });
};

// GET all posts
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
router.post("/", upload.single("image"), authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) return res.status(403).json({ message: "You are banned", banEndDate: user.banEndDate });

    const { game, subject, text } = req.body;
    if (!game || !subject?.trim() || !text?.trim())
      return res.status(400).json({ message: "Missing required fields" });

    const image = req.file ? await saveImageToGridFS(req.file) : null;

    const post = new ForumPost({
      game,
      subject: subject.trim(),
      text: text.trim(),
      userId: req.user.id,
      image,
    });

    await post.save();
    const populated = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ADD COMMENT
router.post("/:id/comment", upload.single("image"), authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.banned) return res.status(403).json({ message: "Forbidden" });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const image = req.file ? await saveImageToGridFS(req.file) : null;

    post.comments.push({ userId: req.user.id, text: text.trim(), image });
    await post.save();

    const updated = await ForumPost.findById(req.params.id)
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
router.post("/:id/comment/:commentId/reply", upload.single("image"), authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.banned) return res.status(403).json({ message: "Forbidden" });

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const image = req.file ? await saveImageToGridFS(req.file) : null;

    comment.replies.push({ userId: req.user.id, text: text.trim(), image });
    await post.save();

    const updated = await ForumPost.findById(req.params.id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE OWN POST
router.delete("/post/:postId", authenticateToken, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (post.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own posts" });
    }

    await ForumPost.findByIdAndDelete(req.params.postId);
    res.json({ message: "Post deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE OWN COMMENT
router.delete("/post/:postId/comment/:commentId", authenticateToken, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    if (comment.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own comments" });
    }

    comment.deleteOne();
    await post.save();

    const updated = await post.populate([
      { path: "userId", select: "username profilePic" },
      { path: "comments.userId", select: "username profilePic" },
      { path: "comments.replies.userId", select: "username profilePic" },
    ]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE OWN REPLY
router.delete("/post/:postId/comment/:commentId/reply/:replyId", authenticateToken, async (req, res) => {
  try {
    const post = await ForumPost.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    if (reply.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own replies" });
    }

    reply.deleteOne();
    await post.save();

    const updated = await post.populate([
      { path: "userId", select: "username profilePic" },
      { path: "comments.userId", select: "username profilePic" },
      { path: "comments.replies.userId", select: "username profilePic" },
    ]);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
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
    res.set("Cache-Control", "public, max-age=31536000");

    const stream = bucket.openDownloadStream(fileId);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ==================== BASE64 ENDPOINTS FOR WEB ====================

// CREATE POST WITH BASE64 (WEB)
router.post("/base64", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) return res.status(403).json({ message: "You are banned", banEndDate: user.banEndDate });

    const { game, subject, text, imageBase64 } = req.body;
    if (!game || !subject?.trim() || !text?.trim())
      return res.status(400).json({ message: "Missing required fields" });

    let image = null;
    if (imageBase64) {
      const matches = imageBase64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ message: "Invalid base64 image" });
      }

      const mimeType = matches[1];
      const buffer = Buffer.from(matches[2], "base64");

      const file = {
        buffer,
        originalname: `web_upload_${Date.now()}.jpg`,
        mimetype: mimeType,
      };

      image = await saveImageToGridFS(file);
    }

    const post = new ForumPost({
      game,
      subject: subject.trim(),
      text: text.trim(),
      userId: req.user.id,
      image,
    });

    await post.save();
    const populated = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Base64 post error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ADD COMMENT WITH BASE64 (WEB)
router.post("/:id/comment/base64", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.banned) return res.status(403).json({ message: "Forbidden" });

    const { text, imageBase64 } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    let image = null;
    if (imageBase64) {
      const matches = imageBase64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ message: "Invalid image" });

      const buffer = Buffer.from(matches[2], "base64");
      const file = {
        buffer,
        originalname: `comment_${Date.now()}`,
        mimetype: matches[1],
      };
      image = await saveImageToGridFS(file);
    }

    post.comments.push({ userId: req.user.id, text: text.trim(), image });
    await post.save();

    const updated = await post
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updated);
  } catch (err) {
    console.error("Base64 comment error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ADD REPLY WITH BASE64 (WEB)
router.post("/post/:id/comment/:commentId/reply/base64", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.banned) return res.status(403).json({ message: "Forbidden" });

    const { text, imageBase64 } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    let image = null;
    if (imageBase64) {
      const matches = imageBase64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      if (!matches) return res.status(400).json({ message: "Invalid image" });

      const buffer = Buffer.from(matches[2], "base64");
      const file = {
        buffer,
        originalname: `reply_${Date.now()}`,
        mimetype: matches[1],
      };
      image = await saveImageToGridFS(file);
    }

    comment.replies.push({ userId: req.user.id, text: text.trim(), image });
    await post.save();

    const updated = await post
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updated);
  } catch (err) {
    console.error("Base64 reply error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;