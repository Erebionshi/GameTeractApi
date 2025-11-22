// src/routes/forum.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const multer = require("multer");
const mongoose = require("mongoose");

const router = express.Router();

// Multer: Store file in memory (no temp files, no Auth header issues)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, GIF, and WebP images are allowed"));
    }
  },
});

// Helper: Save image buffer to GridFS and return metadata
const saveImageToGridFS = async (file) => {
  if (!file || !file.buffer) return null;

  const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "uploads",
  });

  const filename = `${Date.now()}_${file.originalname}`;
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: file.mimetype,
  });

  uploadStream.end(file.buffer);

  return new Promise((resolve, reject) => {
    uploadStream.on("finish", () => {
      resolve({
        fileId: uploadStream.id.toString(),
        filename: uploadStream.filename,
        contentType: file.mimetype,
      });
    });
    uploadStream.on("error", (err) => {
      console.error("GridFS upload error:", err);
      reject(err);
    });
  });
};

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

// CREATE NEW POST
router.post("/", upload.single("image"), authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) {
      return res.status(403).json({
        message: "You are banned from posting",
        banEndDate: user.banEndDate,
      });
    }

    const { game, subject, text } = req.body;
    if (!game || !subject?.trim() || !text?.trim()) {
      return res.status(400).json({ message: "Game, subject, and text are required" });
    }

    let image = null;
    if (req.file) {
      try {
        image = await saveImageToGridFS(req.file);
      } catch (err) {
        return res.status(500).json({ message: "Failed to upload image" });
      }
    }

    const post = new ForumPost({
      game,
      subject: subject.trim(),
      text: text.trim(),
      userId: req.user.id,
      image,
    });

    await post.save();

    const populatedPost = await ForumPost.findById(post._id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.status(201).json(populatedPost);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ADD COMMENT TO POST
router.post("/:id/comment", upload.single("image"), authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) {
      return res.status(403).json({
        message: "You are banned from commenting",
        banEndDate: user.banEndDate,
      });
    }

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Comment text is required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    let image = null;
    if (req.file) {
      try {
        image = await saveImageToGridFS(req.file);
      } catch (err) {
        return res.status(500).json({ message: "Failed to upload image" });
      }
    }

    post.comments.push({
      userId: req.user.id,
      text: text.trim(),
      image,
    });

    await post.save();

    const updatedPost = await ForumPost.findById(req.params.id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updatedPost);
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// ADD REPLY TO COMMENT
router.post("/:id/comment/:commentId/reply", upload.single("image"), authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned) {
      return res.status(403).json({
        message: "You are banned from replying",
        banEndDate: user.banEndDate,
      });
    }

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Reply text is required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    let image = null;
    if (req.file) {
      try {
        image = await saveImageToGridFS(req.file);
      } catch (err) {
        return res.status(500).json({ message: "Failed to upload image" });
      }
    }

    comment.replies.push({
      userId: req.user.id,
      text: text.trim(),
      image,
    });

    await post.save();

    const updatedPost = await ForumPost.findById(req.params.id)
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.json(updatedPost);
  } catch (err) {
    console.error("Add reply error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// SERVE IMAGE FROM GRIDFS
router.get("/image/:fileId", async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "uploads",
    });

    const file = await bucket.find({ _id: fileId }).next();
    if (!file) {
      return res.status(404).json({ message: "Image not found" });
    }

    res.set("Content-Type", file.contentType);
    res.set("Cache-Control", "public, max-age=31536000"); // Optional: cache images

    const stream = bucket.openDownloadStream(fileId);
    stream.on("error", () => res.status(500).json({ message: "Stream error" }));
    stream.pipe(res);
  } catch (err) {
    console.error("Image serve error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;