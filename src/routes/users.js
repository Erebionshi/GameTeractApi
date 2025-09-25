// Updated src/routes/users.js
const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const User = require("../models/User");
const router = express.Router();

// Fetch all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find(
      {},
      "username email profilePic games violations banned banDuration banStartDate"
    );
    const usersWithDefaults = users.map((user) => ({
      _id: user._id,
      username: user.username || "Unknown",
      email: user.email,
      profilePic: user.profilePic || null,
      games: user.games || {},
      violations: user.violations || 0,
      banned: user.banned || false,
      banDuration: user.banDuration || 0,
      banStartDate: user.banStartDate || null,
    }));

    res.json(usersWithDefaults);
  } catch (err) {
    console.error("❌ Error fetching users:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get current user
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('_id email username profilePic friends incomingFriendRequests games');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error("❌ Error fetching current user:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update current logged-in user
router.put("/me", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { username, profilePic } = req.body;

    const updateData = {};
    if (username !== undefined) updateData.username = username;
    if (profilePic !== undefined) updateData.profilePic = profilePic;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log(`🔄 User updated: ${updatedUser.email} (username: ${updatedUser.username})`);
    res.json(updatedUser);
  } catch (err) {
    console.error("❌ Error updating current user:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update user (for admin actions like banning)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { banned, banDuration, violations } = req.body;

    const updateData = {};
    if (banned !== undefined) updateData.banned = banned;
    if (banDuration !== undefined) updateData.banDuration = banDuration;
    if (violations !== undefined) updateData.violations = violations;
    if (banned && banDuration !== undefined) updateData.banStartDate = new Date();

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log(`🔄 User updated: ${updatedUser.email}`);
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("❌ Error updating user:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user's game data
router.get("/me/games", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('games');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    console.log(`Fetched games for user ${req.user.email}:`, user.games);
    res.json(user.games || {});
  } catch (err) {
    console.error("❌ Error fetching user game data:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Save user's game data
router.post("/me/games", authenticateToken, async (req, res) => {
  try {
    const { gameId, ign, rank } = req.body;
    if (!gameId || !ign || !rank) {
      console.error("Missing required fields:", { gameId, ign, rank });
      return res.status(400).json({ success: false, message: "Game ID, IGN, and rank are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    user.games.set(gameId, { ign: ign.trim(), rank: rank.trim() });
    await user.save();

    console.log(`🆕 Game data saved for user ${user.email}: ${gameId} (IGN: ${ign}, Rank: ${rank})`);
    res.json({ success: true, message: "Game data saved successfully" });
  } catch (err) {
    console.error("❌ Error saving game data:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Send friend request
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