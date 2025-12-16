const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  username: { type: String, required: true, unique: true, trim: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  phone: { type: String, default: "" },
  location: { type: String, required: true },
  postalCode: {
    type: String,
    trim: true,
    required: false,
  },
  password: { type: String, required: true, minlength: 6 }, // Stores the HASHED password
  role: { type: String, default: "user" },
  status: {
    type: String,
    enum: ["ACTIVE", "BLOCKED"],
    default: "ACTIVE",
  },
  memberSince: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
