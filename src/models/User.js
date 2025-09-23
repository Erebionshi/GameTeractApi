const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, trim: true },
  email: { type: String, unique: true, required: true, trim: true },
  password: { type: String, required: true },
  profilePic: { type: String, default: null },
  violations: { type: Number, default: 0 },
  banned: { type: Boolean, default: false },
  banDuration: { type: Number, default: 0 }, // Days, 0 for permanent
  banStartDate: { type: Date, default: null },
  games: {
    type: Map,
    of: {
      ign: { type: String, default: "", trim: true },
      rank: { type: String, default: "Unranked", trim: true },
    },
  },
});

userSchema.index({ email: 1 });
module.exports = mongoose.model("User", userSchema);