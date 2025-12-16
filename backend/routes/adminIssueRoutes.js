const express = require("express");
const router = express.Router();
const {
  updateIssueStatus,
  deleteIssue,
} = require("../controllers/issueController");
const { protect } = require("../middleware/authMiddleware");

router.patch("/:issueId/status", protect, updateIssueStatus);

router.delete("/:issueId", protect, deleteIssue);

module.exports = router;
