
const mongoose = require("mongoose");

const appRatingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  feedback: {
    type: String,
    trim: true,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});


appRatingSchema.index({ user: 1 }, { unique: true });

module.exports = mongoose.model("AppRating", appRatingSchema);