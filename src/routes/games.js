const express = require("express");
const Game = require("../models/Game");
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();

// Protect /games endpoint
router.get("/", authenticateToken, async (req, res) => {
  try {
    const games = await Game.find().sort({ rank: 1, name: 1 }).select("-__v");
    console.log(`📊 Fetched ${games.length} games, sorted by rank`);
    res.json(games);
  } catch (err) {
    console.error("❌ Error fetching games:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string") {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const searchTerm = q.trim().toLowerCase();
    const games = await Game.find({
      $or: [
        { name: { $regex: searchTerm, $options: "i" } },
        { rank: { $regex: searchTerm, $options: "i" } },
        { description: { $regex: searchTerm, $options: "i" } },
      ],
    })
      .sort({ rank: 1, name: 1 })
      .limit(20);

    res.json({ success: true, games, count: games.length });
  } catch (err) {
    console.error("❌ Error searching games:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const game = await Game.findById(id);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }
    res.json({ success: true, game });
  } catch (err) {
    console.error("❌ Error fetching game:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, description, image, rank = "Unranked" } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Game name is required" });
    }
    if (!description || description.trim() === "") {
      return res.status(400).json({ success: false, message: "Game description is required" });
    }
    if (!image) {
      return res.status(400).json({ success: false, message: "Game image is required" });
    }
    if (!rank || rank.trim() === "") {
      return res.status(400).json({ success: false, message: "Game rank is required" });
    }

    const existingGame = await Game.findOne({ name: name.trim() });
    if (existingGame) {
      return res.status(400).json({ success: false, message: "Game with this name already exists" });
    }

    const newGame = new Game({
      name: name.trim(),
      description: description.trim(),
      image,
      rank: rank.trim(),
    });

    await newGame.save();
    console.log(`🎮 New game added: ${newGame.name} (${newGame.rank})`);
    res.json({
      success: true,
      message: "Game added successfully",
      game: newGame,
    });
  } catch (err) {
    console.error("❌ Error adding game:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rank } = req.body;

    if (!rank || rank.trim() === "") {
      return res.status(400).json({ success: false, message: "Rank is required and cannot be empty" });
    }

    const updatedGame = await Game.findByIdAndUpdate(id, { rank: rank.trim(), updatedAt: Date.now() }, { new: true, runValidators: true });

    if (!updatedGame) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    console.log(`🔄 Game rank updated: ${updatedGame.name} -> ${updatedGame.rank}`);
    res.json({
      success: true,
      message: "Rank updated successfully",
      game: updatedGame,
    });
  } catch (err) {
    console.error("❌ Error updating game rank:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put("/:id/full", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, rank } = req.body;

    if (!name || name.trim() === "") {
      return res.status(400).json({ success: false, message: "Game name is required" });
    }
    if (!description || description.trim() === "") {
      return res.status(400).json({ success: false, message: "Game description is required" });
    }
    if (!image) {
      return res.status(400).json({ success: false, message: "Game image is required" });
    }
    if (!rank || rank.trim() === "") {
      return res.status(400).json({ success: false, message: "Game rank is required" });
    }

    const existingGame = await Game.findOne({ name: name.trim(), _id: { $ne: id } });
    if (existingGame) {
      return res.status(400).json({ success: false, message: "Game with this name already exists" });
    }

    const updatedGame = await Game.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        description: description.trim(),
        image,
        rank: rank.trim(),
        updatedAt: Date.now(),
      },
      { new: true, runValidators: true }
    );

    if (!updatedGame) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    console.log(`🔄 Game fully updated: ${updatedGame.name} (${updatedGame.rank})`);
    res.json({
      success: true,
      message: "Game updated successfully",
      game: updatedGame,
    });
  } catch (err) {
    console.error("❌ Error updating game:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedGame = await Game.findById(id);

    if (!deletedGame) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    await Game.findByIdAndDelete(id);
    console.log(`🗑️ Game deleted: ${deletedGame.name}`);
    res.json({
      success: true,
      message: "Game deleted successfully",
      deletedGameName: deletedGame.name,
    });
  } catch (err) {
    console.error("❌ Error deleting game:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;