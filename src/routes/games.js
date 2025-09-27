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
    res.json({ success: true, games });
  } catch (err) {
    console.error("❌ Error fetching games:", err.message);
    res.status(500).json({ success: false, message: "Failed to fetch games" });
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
    res.status(500).json({ success: false, message: "Failed to search games" });
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
    res.status(500).json({ success: false, message: "Failed to fetch game" });
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
    res.status(500).json({ success: false, message: "Failed to add game" });
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
    res.status(500).json({ success: false, message: "Failed to update game rank" });
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
    res.status(500).json({ success: false, message: "Failed to update game" });
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
    res.status(500).json({ success: false, message: "Failed to delete game" });
  }
});

// Create a post
router.post("/:gameId/posts", authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { rank, team, vibe, mic, partyCode } = req.body;

    // Validate required fields
    if (!rank || !team || !vibe || !mic) {
      return res.status(400).json({ success: false, message: "Rank, team, vibe, and mic are required" });
    }

    // Validate allowed values
    const validTeams = ["Duo", "Trio", "Any"];
    const validVibes = ["Casual", "Fun", "Competitive"];
    const validMics = ["Open Mic", "Close Mic"];
    if (!validTeams.includes(team)) {
      return res.status(400).json({ success: false, message: `Team must be one of: ${validTeams.join(", ")}` });
    }
    if (!validVibes.includes(vibe)) {
      return res.status(400).json({ success: false, message: `Vibe must be one of: ${validVibes.join(", ")}` });
    }
    if (!validMics.includes(mic)) {
      return res.status(400).json({ success: false, message: `Mic must be one of: ${validMics.join(", ")}` });
    }

    // Check if the game exists
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    // Validate rank against game ranks
    const validRanks = Array.isArray(game.rank) ? game.rank : game.rank.split(",").map(r => r.trim());
    if (!validRanks.includes(rank)) {
      return res.status(400).json({ success: false, message: `Rank must be one of: ${validRanks.join(", ")}` });
    }

    const lowerName = game.name.toLowerCase();
    const requiresPrivateCode = lowerName === "valorant" || lowerName.includes("csgo") || lowerName.includes("dota");
    if (requiresPrivateCode && !partyCode) {
      return res.status(400).json({ success: false, message: `${lowerName === "valorant" ? "Party Code" : "Steam IGN"} is required for ${game.name}` });
    }

    // Check if user has game data
    const user = await User.findById(req.user.id);
    if (!user.games.has(gameId)) {
      return res.status(400).json({ success: false, message: "User has not set up game data for this game" });
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
    res.json({ success: true, message: "Post created successfully", post });
  } catch (err) {
    console.error("❌ Error creating post:", err.message, err.stack);
    res.status(500).json({ success: false, message: "Failed to create post" });
  }
});

// Fetch posts
router.get("/:gameId/posts", authenticateToken, async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await Game.findById(gameId);
    if (!game) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    const lowerName = game.name.toLowerCase();
    const requiresPrivateCode = lowerName === "valorant" || lowerName.includes("csgo") || lowerName.includes("dota");

    // Fetch posts and populate user data
    let posts = await Post.find({ gameId })
      .populate("userId", "profilePic username games friends")
      .sort({ createdAt: -1 });

    // Filter out posts where userId failed to populate
    posts = posts.filter(post => post.userId);

    // Transform posts for response
    posts = posts.map((post) => {
      const postObj = post.toObject();
      const isFriend = postObj.userId.friends.some((f) => f.user.toString() === req.user.id);
      if (requiresPrivateCode && !isFriend) {
        postObj.partyCode = undefined; // Hide partyCode for non-friends
      }
      postObj.username = postObj.userId.games.get(gameId)?.ign || postObj.userId.username || 'Unknown';
      delete postObj.userId.games;
      delete postObj.userId.friends;
      return postObj;
    });

    res.json({ success: true, posts });
  } catch (err) {
    console.error("❌ Error fetching posts:", err.message, err.stack);
    res.status(500).json({ success: false, message: "Failed to fetch posts" });
  }
});

module.exports = router;