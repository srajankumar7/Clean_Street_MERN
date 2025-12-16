const express = require("express");
const {
  registerUser,
  loginUser,
  getDashboardData,
  updateUserProfile,
  sendOtp,
  verifyOtp,
  changePassword,
  verifyOtpOnly,
  resetPasswordWithOtp,
  getAllUsers,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");
const User = require("../models/user");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

// New endpoints for OTP-only verification and reset-with-OTP
router.post("/verify-otp-only", verifyOtpOnly);
router.post("/reset-password", resetPasswordWithOtp);

router.get("/dashboard", protect, getDashboardData);

// Protected profile update and change-password
router.put("/profile", protect, updateUserProfile);
router.put("/change-password", protect, changePassword);
router.get("/allusers", getAllUsers);

router.get("/public/users-count", async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: "Error fetching user count" });
  }
});
router.get("/public/postal-codes", async (req, res) => {
  try {
    const users = await User.find().select("postalCode");
    const postalSet = new Set(
      users.map((u) => u.postalCode).filter((p) => p && /^[0-9]{6}$/.test(p))
    );
    res.json({ postalCodes: Array.from(postalSet) });
  } catch (err) {
    res.status(500).json({ error: "Error fetching postal codes" });
  }
});

module.exports = router;
