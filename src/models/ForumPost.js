
const mongoose = require("mongoose");

// models/ForumPost.js
const forumPostSchema = new mongoose.Schema({
  game: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image: { type: String }, // ← Now just a base64 string or URL
  date: { type: Date, default: Date.now },
  comments: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: { type: String },
      image: { type: String }, // ← base64 string
      date: { type: Date, default: Date.now },
      replies: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          text: { type: String },
          image: { type: String }, // ← base64 string
          date: { type: Date, default: Date.now },
        },
      ],
    },
  ],
});

module.exports = mongoose.model("ForumPost", forumPostSchema);