// src/models/ForumPost.js
const forumPostSchema = new mongoose.Schema({
  game: { type: String, required: true },
  subject: { type: String, required: true },
  text: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  image: {
    fileId: String,
    filename: String,
    contentType: String,
    // Optional: keep URL for faster loading
    url: String,
  },
  date: { type: Date, default: Date.now },
  comments: [/* same as before */]
});