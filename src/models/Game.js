const mongoose = require("mongoose");

const gameSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  rank: { type: String, default: "Unranked", required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

gameSchema.index({ rank: 1, name: 1 });
module.exports = mongoose.model("Game", gameSchema);