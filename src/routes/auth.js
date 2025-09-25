const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, profilePic } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username: username?.trim() || undefined,
      email: email.trim(),
      password: hashedPassword,
      profilePic: profilePic || null,
      games: {},
      violations: 0,
      banned: false,
      banDuration: 0,
      banStartDate: null,
    });
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "supersecretkey", {
      expiresIn: "1h",
    });

    console.log(`🆕 New user registered: ${user.email}`);
    res.json({ success: true, message: "User registered successfully", token });
  } catch (err) {
    console.error("❌ Error in signup:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    if (user.banned && user.banDuration > 0 && user.banStartDate) {
      const currentDate = new Date();
      const banEndDate = new Date(user.banStartDate);
      banEndDate.setDate(banEndDate.getDate() + user.banDuration);

      if (currentDate >= banEndDate) {
        user.banned = false;
        user.banDuration = 0;
        user.banStartDate = null;
        await user.save();
        console.log(`🔓 Ban expired for user: ${user.email}`);
      } else {
        return res.status(403).json({
          success: false,
          message: `User is banned for ${user.banDuration} days`,
          banDuration: user.banDuration,
          violations: user.violations,
        });
      }
    } else if (user.banned && user.banDuration === 0) {
      return res.status(403).json({
        success: false,
        message: "User is permanently banned",
        banDuration: user.banDuration,
        violations: user.violations,
      });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "supersecretkey", {
      expiresIn: "1h",
    });
    console.log(`🔐 User logged in: ${user.email}`);
    res.json({ success: true, token, username: user.username || "Unknown" });
  } catch (err) {
    console.error("❌ Error in login:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;