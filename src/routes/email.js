const express = require("express");
const router = express.Router();
const { sendEmail } = require("../utils/nodemailer"); // Adjust path based on structure

router.post("/send-email", async (req, res) => {
  const { email, message } = req.body;
  try {
    await sendEmail(email, message);
    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error.message);
    res.status(500).json({ success: false, message: "Failed to send email" });
  }
});

module.exports = router;