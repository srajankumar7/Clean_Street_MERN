const User = require("../models/user");

exports.getUsers = async (req, res) => {
  try {
    const admin = req.user;

    let users;

    if (admin.role === "globaladmin") {
      // Global admin → can view all users + admins
      users = await User.find().select("-password");
    } else {
      // Local admin → can ONLY see users in same postal code
      users = await User.find({
        role: "user",
        postalCode: admin.postalCode,
      }).select("-password");
    }

    res.json({ success: true, users });
  } catch (error) {
    console.error("Admin Fetch Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error fetching users" });
  }
};

exports.toggleBlock = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    user.status = user.status === "ACTIVE" ? "BLOCKED" : "ACTIVE";
    await user.save();

    res.json({
      success: true,
      message: `User ${user.status.toLowerCase()} successfully.`,
    });
  } catch (error) {
    console.error("Block Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error updating status" });
  }
};

exports.changeRole = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    user.role = user.role === "user" ? "admin" : "user";
    await user.save();

    res.json({ success: true, message: `Role updated to ${user.role}.` });
  } catch (error) {
    console.error("Role Change Error:", error);
    res.status(500).json({ success: false, message: "Error updating role" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await User.findByIdAndDelete(id);

    res.json({ success: true, message: "User removed successfully." });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ success: false, message: "Error deleting user" });
  }
};
