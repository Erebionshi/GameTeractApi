const express = require("express");
const Game = require("../models/Game");
const Post = require("../models/Post");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");
const router = express.Router();

// Public GET
router.get("/", async (req, res) => {
  try {
    const games = await Game.find().sort({ rank: 1, name: 1 }).select("-__v");
    res.json(games);
  } catch (err) {
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

// New route to create a post
router.post("/:gameId/posts", authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { rank, team, vibe, mic, partyCode } = req.body;

    // Validate required fields
    if (!rank || !team || !vibe || !mic) {
      return res.status(400).json({ success: false, message: "Rank, team, vibe, and mic are required" });
    }

    // Check if the game exists
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const lowerName = game.name.toLowerCase();
    const requiresPrivateCode = lowerName === "valorant" || lowerName.includes("csgo") || lowerName.includes("dota");
    if (requiresPrivateCode && !partyCode) {
      return res.status(400).json({ success: false, message: "Private code is required for this game" });
    }

    // Create new post
    const post = new Post({
      userId: req.user.id,
      gameId,
      rank,
      team,
      vibe,
      mic,
      partyCode: requiresPrivateCode ? partyCode : undefined,
    });

    await post.save();
    console.log(`🆕 New post created for game ${game.name} by user ${req.user.email}`);
    res.json({ success: true, post });
  } catch (err) {
    console.error("❌ Error creating post:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// New route to fetch posts
router.get("/:gameId/posts", authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const lowerName = game.name.toLowerCase();
    const requiresPrivateCode = lowerName === "valorant" || lowerName.includes("csgo") || lowerName.includes("dota");

    let posts = await Post.find({ gameId }).populate("userId", "profilePic games friends");

    posts = posts.map((post) => {
      post = post.toObject();
      const isFriend = post.userId.friends.some((f) => f.toString() === req.user.id);
      if (requiresPrivateCode && !isFriend) {
        post.partyCode = undefined;
      }
      post.username = post.userId.games.get(gameId)?.ign || 'Unknown';
      delete post.userId.games;
      delete post.userId.friends;
      return post;
    });

    res.json({ success: true, posts });
  } catch (err) {
    console.error("❌ Error fetching posts:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;