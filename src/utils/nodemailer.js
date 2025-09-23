const nodemailer = require("nodemailer");

const sendEmail = async (email, message) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Violation Notification from GameTeract",
    text: message,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent to: ${email}`);
    return { success: true, message: "Email sent successfully" };
  } catch (err) {
    console.error("❌ Error sending email:", err.message);
    throw new Error(err.message);
  }
};

module.exports = { sendEmail };