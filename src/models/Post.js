
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Game",
    required: true,
  },
  rank: { type: String, required: true },
  team: {
    type: String,
    enum: ["Duo", "Trio", "Five", "Any"],
    required: true,
  },
  vibe: {
    type: String,
    enum: ["Casual", "Fun", "Competitive"],
    required: true,
  },
  mic: {
    type: String,
    enum: ["Open Mic", "Close Mic"],
    required: true,
  },
  partyCode: { type: String },
  userRating: { type: Number, min: 1, max: 5, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600,
  },
});

module.exports = mongoose.model("Post", postSchema);