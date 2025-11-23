// src/routes/forum.js ← REPLACE ENTIRE FILE WITH THIS

const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const ForumPost = require("../models/ForumPost");
const User = require("../models/User");
const multer = require("multer");
const mongoose = require("mongoose");

const router = express.Router();

// === MULTER (for mobile FormData uploads) ===
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Invalid image type"));
  },
});

// === GRIDFS BUCKET (initialized once) ===
let gfs;
mongoose.connection.once("open", () => {
  gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "uploads" });
  console.log("GridFS bucket ready");
});

// === SAVE IMAGE (from buffer or base64) ===
const saveImage = async (fileOrBase64) => {
  if (!fileOrBase64) return null;

  let buffer, contentType, filename;

  if (typeof fileOrBase64 === "string") {
    // Base64 from web
    const matches = fileOrBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) throw new Error("Invalid base64");
    contentType = matches[1];
    buffer = Buffer.from(matches[2], "base64");
    filename = `web_${Date.now()}.jpg`;
  } else {
    // Buffer from mobile (multer)
    buffer = fileOrBase64.buffer;
    contentType = fileOrBase64.mimetype;
    filename = `${Date.now()}_${fileOrBase64.originalname}`;
  }

  const uploadStream = gfs.openUploadStream(filename, { contentType });

  return new Promise((resolve, reject) => {
    uploadStream.end(buffer);
    uploadStream.on("finish", () => {
      resolve({
        fileId: uploadStream.id.toString(),
        filename: uploadStream.filename,
        contentType,
      });
    });
    uploadStream.on("error", reject);
  });
};

// === GET ALL POSTS ===
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

// === CREATE POST - MOBILE (FormData) ===
router.post("/", upload.single("image"), authenticateToken, async (req, res) => {
  await handleCreatePost(req, res);
});

// === CREATE POST - WEB (base64 fallback) ===
router.post("/base64", authenticateToken, async (req, res) => {
  req.file = null; // pretend no file
  req.body.image = req.body.imageBase64; // map base64 → image
  await handleCreatePost(req, res);
});

// Unified handler
const handleCreatePost = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.banned)
      return res.status(403).json({ message: "You are banned", banEndDate: user.banEndDate });

    const { game, subject, text, imageBase64 } = req.body;
    if (!game || !subject?.trim() || !text?.trim())
      return res.status(400).json({ message: "Missing required fields" });

    let image = null;
    if (req.file || imageBase64) {
      image = await saveImage(req.file || imageBase64);
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
      .populate("userId", "username profilePic")
      .populate("comments.userId", "username profilePic")
      .populate("comments.replies.userId", "username profilePic");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Create post error:", err);
    res.status(500).json({ message: err.message || "Server error" });
  }
};

// === ADD COMMENT - MOBILE ===
router.post("/:id/comment", upload.single("image"), authenticateToken, async (req, res) => {
  await handleAddComment(req, res);
});

// === ADD COMMENT - WEB (base64) ===
router.post("/:id/comment/base64", authenticateToken, async (req, res) => {
  req.file = null;
  req.body.imageBase64 = req.body.imageBase64;
  await handleAddComment(req, res);
});

const handleAddComment = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.banned) return res.status(403).json({ message: "Forbidden" });

    const { text, imageBase64 } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: "Text required" });

    const post = await ForumPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post not found" });

    let image = null;
    if (req.file || imageBase64) {
      image = await saveImage(req.file || imageBase64);
    }

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
};

// === ADD REPLY - MOBILE ===
router.post("/:id/comment/:commentId/reply", upload.single("image"), authenticateToken, async (req, res) => {
  await handleAddReply(req, res);
});

// === ADD REPLY - WEB (base64) ===
router.post("/:id/comment/:commentId/reply/base64", authenticateToken, async (req, res) => {
  req.file = null;
  req.body.imageBase64 = req.body.imageBase64;
  await handleAddReply(req, res);
});

const handleAddReply = async (req, res) => {
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
    if (req.file || imageBase64) {
      image = await saveImage(req.file || imageBase64);
    }

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
};

// === DELETE ROUTES (unchanged - keep as-is) ===
router.delete("/post/:postId", authenticateToken, async (req, res) => { /* your existing code */ });
router.delete("/post/:postId/comment/:commentId", authenticateToken, async (req, res) => { /* your existing code */ });
router.delete("/post/:postId/comment/:commentId/reply/:replyId", authenticateToken, async (req, res) => { /* your existing code */ });

// === SERVE IMAGE ===
router.get("/image/:fileId", async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.fileId);
    const file = await gfs.find({ _id: fileId }).next();
    if (!file) return res.status(404).json({ message: "Image not found" });

    res.set("Content-Type", file.contentType || "image/jpeg");
    res.set("Cache-Control", "public, max-age=31536000");

    const stream = gfs.openDownloadStream(fileId);
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;