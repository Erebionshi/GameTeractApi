const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const User = require("../models/User");
const router = express.Router();

// Fetch all users
router.get("/", async (req, res) => {
  try {
    const users = await User.find(
      {},
      "username email profilePic games violations banned banDuration banStartDate rating" // Added rating
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
      rating: user.rating || 5, // Include rating with default
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
    const user = await User.findById(req.user.id)
      .select('_id email username profilePic friends incomingFriendRequests games rating') // Added rating
      .populate('friends.user', '_id username profilePic games rating raters') // Added rating to populate
      .populate('incomingFriendRequests', '_id username profilePic games rating'); // Added rating to populate
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
    console.log('Received game data:', { gameId, ign, rank }); // Debug log
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
    if (!currentUser) return res.status(404).json({ success: false, message: "Current user not found" });

    // Check if already friends, handling invalid friend entries
    const isAlreadyFriend = currentUser.friends.some(f => {
      if (!f || !f.user) {
        console.warn(`Invalid friend entry in user ${currentUser._id}:`, f);
        return false;
      }
      return f.user.equals(targetUser._id);
    });
    if (isAlreadyFriend) return res.status(400).json({ success: false, message: "Already friends" });

    // Check if request already sent
    if (targetUser.incomingFriendRequests.some(id => id.equals(currentUser._id))) {
      return res.status(400).json({ success: false, message: "Request already sent" });
    }

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
    if (!currentUser.incomingFriendRequests.some(id => id.equals(sender._id))) {
      return res.status(400).json({ success: false, message: "No request from this user" });
    }

    currentUser.incomingFriendRequests = currentUser.incomingFriendRequests.filter((id) => !id.equals(sender._id));
    // Ensure correct friend entry format
    currentUser.friends.push({ user: sender._id, addedAt: new Date() });
    sender.friends.push({ user: currentUser._id, addedAt: new Date() });

    await currentUser.save();
    await sender.save();

    console.log(`Friend request accepted: ${currentUser.email} and ${sender.email}`);
    res.json({ success: true, message: "Friend request accepted" });
  } catch (err) {
    console.error("❌ Error accepting friend request:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reject friend request
router.post("/friend/reject/:userId", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const senderId = req.params.userId;
    if (!currentUser.incomingFriendRequests.some(id => id.equals(senderId))) return res.status(400).json({ success: false, message: "No request from this user" });

    currentUser.incomingFriendRequests = currentUser.incomingFriendRequests.filter((id) => !id.equals(senderId));
    await currentUser.save();

    console.log(`Friend request rejected for user ${req.user.email} from ${senderId}`);
    res.json({ success: true, message: "Friend request rejected" });
  } catch (err) {
    console.error("❌ Error rejecting friend request:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Unfriend
router.post("/friend/unfriend/:userId", authenticateToken, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const friendId = req.params.userId;
    if (!currentUser.friends.some(f => f.user.equals(friendId))) return res.status(400).json({ success: false, message: "Not friends" });

    currentUser.friends = currentUser.friends.filter(f => !f.user.equals(friendId));
    const friend = await User.findById(friendId);
    friend.friends = friend.friends.filter(f => !f.user.equals(currentUser._id));

    await currentUser.save();
    await friend.save();

    console.log(`Unfriended: ${currentUser.email} and ${friend.email}`);
    res.json({ success: true, message: "Unfriended successfully" });
  } catch (err) {
    console.error("❌ Error unfriending:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Rate friend
router.post("/friend/rate/:userId", authenticateToken, async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });

    const targetId = req.params.userId;
    const currentUser = await User.findById(req.user.id);
    const targetUser = await User.findById(targetId);
    if (!targetUser) return res.status(404).json({ success: false, message: "User not found" });
    // Check if friends
    if (!currentUser.friends.some(f => f.user.equals(targetId))) return res.status(400).json({ success: false, message: "Not friends" });
    // Check if already rated
    if (targetUser.raters.some(r => r.from.equals(req.user.id))) return res.status(400).json({ success: false, message: "Already rated this user" });
    // Add rating
    targetUser.raters.push({ from: req.user.id, rating });
    // Compute average
    const total = targetUser.raters.reduce((sum, r) => sum + r.rating, 0);
    const avg = targetUser.raters.length > 0 ? total / targetUser.raters.length : 5;
    targetUser.rating = avg;
    await targetUser.save();

    console.log(`Rated user ${targetId} by ${currentUser.email} with ${rating}. Updated rating to ${avg}`);
    res.json({ success: true, message: "User rated successfully" });
  } catch (err) {
    console.error("❌ Error rating friend:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;