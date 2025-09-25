const express = require("express");
const User = require("../models/User");
const { authenticateToken } = require("../middleware/auth");
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
    console.error("❌ Error fetching users:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ✅ Update current logged-in user
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
    console.error("❌ Error updating current user:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Existing PUT /users/:id (for admin actions like banning)
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
    console.error("❌ Error updating user:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
