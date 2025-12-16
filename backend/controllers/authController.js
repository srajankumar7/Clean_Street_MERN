const User = require("../models/user");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const OTP = require("../models/OTP");
const nodemailer = require("nodemailer");
const { extractPostalCode } = require("../utils/extractPostalCode");

// Helper function to generate a JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};

// --- NODEMAILER TRANSPORTER SETUP ---
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// --- Registration  ---
exports.registerUser = async (req, res) => {
  const { name, username, email, phone, password, location } = req.body;

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ success: false, message: "Email already registered." });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const postalCode = extractPostalCode(location);
    user = new User({
      name,
      username,
      email,
      phone,
      location,
      postalCode,
      password: hashedPassword,
      role: email.includes("@admin.com") ? "admin" : "user",
    });
    await user.save();
    const token = generateToken(user._id);
    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        location: user.location,
        postalCode: user.postalCode,
        role: user.role,
        memberSince: user.memberSince,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error during registration" });
  }
};

// --- Login  ---
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (user.status === "BLOCKED") {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Contact support.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        location: user.location,
        role: user.role,
        memberSince: user.memberSince,
      },
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error during login" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("_id name");
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching all users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }

    // 1. Verify Current Password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect." });
    }

    // 2. Hash and Update New Password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during password change.",
    });
  }
};

// --- Dashboard Data ---
exports.getDashboardData = async (req, res) => {
  const userId = req.user._id;

  // MOCK DATA for initial setup:
  const stats = {
    totalIssues: 15,
    pending: 3,
    inProgress: 5,
    resolved: 7,
  };
  const activities = [
    {
      issue: "Pothole on Road HYD. (Your Report)",
      status: "resolved",
      time: "1 hour ago",
    },
    {
      issue: "Damage at Central Park",
      status: "in progress",
      time: "3 days ago",
    },
  ];

  res.status(200).json({ success: true, stats, activities });
};

// --- Profile Update ---
exports.updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.name = req.body.name || user.name;
      user.username = req.body.username || user.username;
      user.phone = req.body.phone || user.phone;
      user.location = req.body.location || user.location;
      user.postalCode = extractPostalCode(req.body.location) || user.postalCode;
      user.bio = req.body.bio || user.bio;

      const updatedUser = await user.save();

      res.json({
        success: true,
        message: "Profile updated successfully!",
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          username: updatedUser.username,
          email: updatedUser.email,
          phone: updatedUser.phone,
          location: updatedUser.location,
          bio: updatedUser.bio,
          role: updatedUser.role,
          memberSince: updatedUser.memberSince,
        },
      });
    } else {
      res.status(404).json({ success: false, message: "User not found" });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while updating profile" });
  }
};

// --- Send OTP (Forgot Password) ---
exports.sendOtp = async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: true,
        message: "This account doesn't exists, Please register to CleanStreet.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await OTP.findOneAndUpdate(
      { email },
      { otp, createdAt: Date.now() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const transporter = createTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "CleanStreet Password OTP",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <title>CleanStreet OTP</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #051F20; 
                    color: #DAF1DE; 
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                    background-color: #0B2B26; 
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    margin-top: 40px;
                    margin-bottom: 40px;
                }
                .content-box {
                    background-color: #DAF1DE; 
                    padding: 30px;
                    border-radius: 8px;
                    color: #163832; 
                }
                h1 {
                    color: #051F20; 
                    text-align: center;
                }
                .otp-section {
                    text-align: center;
                    padding: 20px 0;
                }
                .otp-code {
                    color: #235347; 
                    font-size: 32px;
                    font-weight: bold;
                    display: inline-block;
                    padding: 10px 20px;
                    margin: 10px 0;
                    border: 2px dashed #8EB69B; 
                    border-radius: 5px;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #8EB69B; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="content-box">
                    <h1>CleanStreet OTP</h1>

                    <p>You requested a OTP  for your **<b>CleanStreet</b>** account.</p>

                    <div class="otp-section">
                        <p>Your One-Time Password (OTP) is:</p>
                        <div class="otp-code">${otp}</div>
                    </div>

                    <p>This code will expire in **10 minutes**. Please enter it on the website to complete your OTP verification.</p>

                    <h3>About CleanStreet</h3>
                    <p>CleanStreet is your dedicated platform for **community well-being and environmental stewardship**. We make it easy for residents to report local issues—from litter and graffiti to broken infrastructure—and connect directly with local services to get them resolved quickly and efficiently. Together, we can keep our neighborhoods clean and thriving!</p>

                    <p>If you did not request this, please ignore this email. Your password will remain secure.</p>
                    <p>Thank you <b>${user.name}</b> for joining us to make a better society.</p>
                </div>
                
                <div class="footer">
                    &copy; 2025 CleanStreet. All rights reserved.
                </div>
            </div>
        </body>
        </html>
    `,
    });

    res.json({ success: true, message: `OTP sent to ${email}.` });
  } catch (error) {
    console.error("Send OTP Error:", error);
    res.status(500).json({ success: false, message: "Error sending OTP." });
  }
};

// --- Verify OTP (existing flow used for login/OTP-login) ---
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const otpRecord = await OTP.findOne({ email, otp });

    if (!otpRecord) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP." });
    }

    // Remove the OTP after successful use (one-time)
    await OTP.deleteOne({ email });

    const user = await User.findOne({ email });

    const token = generateToken(user._id);

    res.json({
      success: true,
      message: "OTP verified. Login successful.",
      token: token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
        memberSince: user.memberSince,
      },
    });
  } catch (error) {
    console.error("OTP Verification Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during verification." });
  }
};

exports.verifyOtpOnly = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res
      .status(400)
      .json({ success: false, message: "Email and OTP required." });
  }

  try {
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP." });
    }

    res.json({ success: true, message: "OTP verified." });
  } catch (error) {
    console.error("verifyOtpOnly error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error verifying OTP." });
  }
};

exports.resetPasswordWithOtp = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Email, OTP and new password are required.",
    });
  }

  try {
    const otpRecord = await OTP.findOne({ email, otp });
    if (!otpRecord) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP." });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found for supplied email.",
      });
    }

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    // remove OTP record once used
    await OTP.deleteOne({ email });

    res.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("resetPasswordWithOtp error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while resetting password.",
    });
  }
};
