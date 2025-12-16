const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const authRoutes = require("./routes/authRoutes");
const commentRoutes = require("./routes/commentRoutes");
const issueRoutes = require("./routes/issueRoutes");
const utilsRoutes = require("./routes/utilsRoutes");
const adminIssueRoutes = require("./routes/adminIssueRoutes");
const adminReportsRoutes = require("./routes/adminReports");
const adminUserRoutes = require("./routes/adminUserRoutes");

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();

// Middleware
app.use(cors()); // Allows frontend (on different port) to access backend
app.use(express.json()); // Allows parsing of JSON request body
app.use("/api/auth", authRoutes);
app.use("/api", commentRoutes);
app.use("/api/utils", utilsRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/admin/issues", adminIssueRoutes);
app.use("/api/admin/reports", adminReportsRoutes);
app.use("/api/admin/users", adminUserRoutes);
// Database Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully!");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

connectDB();

// Server Listening
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
