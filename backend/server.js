const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const path = require("path");

// --------------------------------------------------
// Load environment variables (BULLETPROOF for Windows)
// --------------------------------------------------
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
});

// --------------------------------------------------
// Routes
// --------------------------------------------------
const authRoutes = require("./routes/authRoutes");
const commentRoutes = require("./routes/commentRoutes");
const issueRoutes = require("./routes/issueRoutes");
const utilsRoutes = require("./routes/utilsRoutes");
const adminIssueRoutes = require("./routes/adminIssueRoutes");
const adminReportsRoutes = require("./routes/adminReports");
const adminUserRoutes = require("./routes/adminUserRoutes");

// --------------------------------------------------
// App Init
// --------------------------------------------------
const app = express();

// --------------------------------------------------
// Middleware
// --------------------------------------------------
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// --------------------------------------------------
// Cloudinary Config
// --------------------------------------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --------------------------------------------------
// Routes
// --------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api", commentRoutes);
app.use("/api/utils", utilsRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/admin/issues", adminIssueRoutes);
app.use("/api/admin/reports", adminReportsRoutes);
app.use("/api/admin/users", adminUserRoutes);

// --------------------------------------------------
// Database Connection
// --------------------------------------------------
console.log("MONGO_URI =", process.env.MONGO_URI);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

connectDB();

// --------------------------------------------------
// Server Start
// --------------------------------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
