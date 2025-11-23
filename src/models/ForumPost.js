// src/models/ForumPost.js
import mongoose from 'mongoose';

const forumPostSchema = new mongoose.Schema({
  game: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  image: {
    fileId: String,
    filename: String,
    contentType: String,
    url: String,
  },

  date: { type: Date, default: Date.now },

  comments: [
    {
      text: String,
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      date: { type: Date, default: Date.now }
    }
  ]
});

export default mongoose.model('ForumPost', forumPostSchema);
