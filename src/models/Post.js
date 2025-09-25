const mongoose = require("mongoose");

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
  rank: { type: String, required: true },
  team: { type: String, enum: ["Duo", "Trio", "Any"], required: true },
  vibe: { type: String, enum: ["Casual", "Fun", "Competitive"], required: true },
  mic: { type: String, enum: ["Open Mic", "Close Mic"], required: true },
  partyCode: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Post", postSchema);