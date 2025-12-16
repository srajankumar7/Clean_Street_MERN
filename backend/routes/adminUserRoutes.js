const express = require("express");
const router = express.Router();

const {
  getUsers,
  toggleBlock,
  changeRole,
  deleteUser,
} = require("../controllers/adminUserController");

const { protect } = require("../middleware/authMiddleware");
const { isAdmin, isGlobalAdmin } = require("../middleware/authMiddleware");

router.get("/users", protect, isAdmin, getUsers);

router.put("/block/:id", protect, isAdmin, toggleBlock);

router.put("/role/:id", protect, isGlobalAdmin, changeRole);

router.delete("/:id", protect, isAdmin, deleteUser);

module.exports = router;
