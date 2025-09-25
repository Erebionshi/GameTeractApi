const express = require("express");
const Game = require("../models/Game");
const Post = require("../models/Post"); // Ensure Post model is imported
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

    // Validate party code for Valorant
    const isValorant = game.name.toLowerCase() === "valorant";
    if (isValorant && !partyCode) {
      return res.status(400).json({ success: false, message: "Party code is required for Valorant" });
    }

    // Create new post
    const post = new Post({
      userId: req.user.id,
      gameId,
      rank,
      team,
      vibe,
      mic,
      partyCode: isValorant ? partyCode : undefined,
    });

    await post.save();
    console.log(`🆕 New post created for game ${game.name} by user ${req.user.email}`);
    res.json({ success: true, post });
  } catch (err) {
    console.error("❌ Error creating post:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/friend/request/:userId", authenticateToken, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });
    if (targetUser._id.equals(req.user.id)) return res.status(400).json({ success: false, message: "Cannot add yourself" });

    const currentUser = await User.findById(req.user.id);
    if (currentUser.friends.includes(targetUser._id)) return res.status(400).json({ success: false, message: "Already friends" });
    if (targetUser.incomingFriendRequests.includes(currentUser._id)) return res.status(400).json({ success: false, message: "Request already sent" });

    targetUser.incomingFriendRequests.push(currentUser._id);
    await targetUser.save();

    console.log(`Friend request sent from ${currentUser.email} to ${targetUser.email}`);
    res.json({ success: true, message: "Friend request sent" });
  } catch (err) {
    console.error("❌ Error sending friend request:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Accept friend request
router.post("/friend/accept/:userId", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const sender = await User.findById(req.params.userId);
    if (!sender) return res.status(404).json({ success: false, message: "User not found" });
    if (!currentUser.incomingFriendRequests.includes(sender._id)) return res.status(400).json({ success: false, message: "No request from this user" });

    currentUser.incomingFriendRequests = currentUser.incomingFriendRequests.filter((id) => !id.equals(sender._id));
    currentUser.friends.push(sender._id);
    sender.friends.push(currentUser._id);

    await currentUser.save();
    await sender.save();

    console.log(`Friend request accepted: ${currentUser.email} and ${sender.email}`);
    res.json({ success: true, message: "Friend request accepted" });
  } catch (err) {
    console.error("❌ Error accepting friend request:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;