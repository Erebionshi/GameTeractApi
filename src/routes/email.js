const express = require("express");
const router = express.Router();
const { sendEmail } = require("../utils/nodemailer"); 

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