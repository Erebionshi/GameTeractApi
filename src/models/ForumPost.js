// src/models/ForumPost.js
const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String },
  date: { type: Date, default: Date.now }
});

const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  text: { type: String },
  image: {
    fileId: String,
    filename: String,
    contentType: String,
  },
  date: { type: Date, default: Date.now },
  replies: [replySchema]
});

const forumPostSchema = new mongoose.Schema({
  game: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image: {
    fileId: String,
    filename: String,
    contentType: String,
  },
  date: { type: Date, default: Date.now },
  comments: [commentSchema]
});

module.exports = mongoose.model("ForumPost", forumPostSchema);