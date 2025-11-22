// routes/auth.js
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
      username,
      email,
      password: hashedPassword,
      profilePic,
      rating: 5,
    });

    await user.save();

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        profilePic: user.profilePic,
        rating: user.rating,
      },
    });
  } catch (err) {
    console.error("❌ Error during signup:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    console.time("login-total");
    const { email, password } = req.body;

    console.time("findUser");
    const user = await User.findOne({ email });
    console.timeEnd("findUser");

    if (!user) {
      console.log(`🔍 Login failed - user not found: ${email}`);
      console.timeEnd("login-total");
      return res.status(400).json({ success: false, message: "User not found" });
    }

    console.time("bcrypt-compare");
    const isMatch = await bcrypt.compare(password, user.password);
    console.timeEnd("bcrypt-compare");

    if (!isMatch) {
      console.log(`🔐 Invalid credentials for: ${email}`);
      console.timeEnd("login-total");
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    // Ban checks
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
        console.log(`⛔ User is temporarily banned: ${user.email}`);
        console.timeEnd("login-total");
        return res.status(403).json({
          success: false,
          message: `User is banned for ${user.banDuration} days`,
          banDuration: user.banDuration,
          violations: user.violations,
          user: {
            _id: user._id,
            username: user.username || "Unknown",
            email: user.email,
          },
        });
      }
    } else if (user.banned && user.banDuration === 0) {
      console.log(`⛔ User is permanently banned: ${user.email}`);
      console.timeEnd("login-total");
      return res.status(403).json({
        success: false,
        message: "User is permanently banned",
        banDuration: user.banDuration,
        violations: user.violations,
        user: {
          _id: user._id,
          username: user.username || "Unknown",
          email: user.email,
        },
      });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET || "supersecretkey", {
      expiresIn: "5h",
    });

    console.log(`🔐 User logged in: ${user.email}`);
    console.timeEnd("login-total");

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username || "Unknown",
        email: user.email,
        banned: user.banned || false,
        banDuration: user.banDuration || 0,
        banStartDate: user.banStartDate || null,
        violations: user.violations || 0,
        profilePic: user.profilePic || null,
      },
    });
  } catch (err) {
    console.error("❌ Error in login:", err.message, err.stack || err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
