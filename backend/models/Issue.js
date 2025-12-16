const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema({
  title: { type: String, required: true },
  issueType: { type: String, required: true },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  address: { type: String, required: true },
  latitude: { type: Number, required: false },
  longitude: { type: Number, required: false },
  postalCode: {
    type: String,
    trim: true,
    required: false,
  },
  landmark: { type: String },
  description: { type: String, required: true },
  // MULTI-IMAGE SUPPORT: Array of image URLs from Cloudinary
  imageUrls: [{ type: String }],
  // Reference the User who reported it
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["reported", "in progress", "resolved", "rejected"],
    default: "reported",
  },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  commentsCount: { type: Number, default: 0 },
  latestComment: {
    text: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: Date,
  },
  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

module.exports = mongoose.model("Issue", issueSchema);
