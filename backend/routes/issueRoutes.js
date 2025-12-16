const express = require("express");
const {
  reportIssue,
  getAllIssues,
  getAllIssuesPublicSafe,
  toggleVote,
  updateIssueStatus,
  deleteIssue,
} = require("../controllers/issueController");

const { protect } = require("../middleware/authMiddleware");
const multer = require("multer");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
});

router.post("/", protect, upload.array("images", 3), reportIssue);
router.get("/", protect, getAllIssues);
router.get("/public", getAllIssuesPublicSafe);

router.post("/:id/vote/:type", protect, toggleVote);

router.patch("/admin/issues/:issueId/status", protect, updateIssueStatus);

router.delete("/admin/issues/:issueId", protect, deleteIssue);

module.exports = router;
