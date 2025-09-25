// Add this to your backend: src/models/ForumPost.js
const mongoose = require("mongoose");

const forumPostSchema = new mongoose.Schema({
  game: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  comments: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String },
    date: { type: Date, default: Date.now }
  }]
});

module.exports = mongoose.model("ForumPost", forumPostSchema);