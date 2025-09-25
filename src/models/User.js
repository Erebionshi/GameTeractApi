const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: null },
  games: {
    type: Map,
    of: {
      ign: { type: String, required: true, trim: true },
      rank: { type: String, required: true, trim: true },
    },
    default: {},
  },
  gamesInfoComplete: { type: Boolean, default: false },
  violations: { type: Number, default: 0 },
  banned: { type: Boolean, default: false },
  banDuration: { type: Number, default: 0 },
  banStartDate: { type: Date, default: null },
  friends: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      addedAt: { type: Date, default: Date.now },
      rating: { type: Number, min: 1, max: 5 },
    }
  ],
  incomingFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);