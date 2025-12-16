const jwt = require("jsonwebtoken");
const User = require("../models/user");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select("-password");
      req.user.lastActive = new Date();
      await req.user.save();

      return next();
    } catch (error) {
      console.error("Token verification error:", error);
      return res
        .status(401)
        .json({ success: false, message: "Not authorized, token failed" });
    }
  }

  return res
    .status(401)
    .json({ success: false, message: "Not authorized, no token" });
};

const isAdmin = (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: "No user found" });

  if (req.user.role !== "admin" && req.user.role !== "globaladmin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Admin only.",
    });
  }
  next();
};

const isGlobalAdmin = (req, res, next) => {
  if (!req.user)
    return res.status(401).json({ success: false, message: "No user found" });

  if (req.user.role !== "globaladmin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Global admin only.",
    });
  }
  next();
};

module.exports = { protect, isAdmin, isGlobalAdmin };
