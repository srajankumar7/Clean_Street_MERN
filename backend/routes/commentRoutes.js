const express = require("express");
const router = express.Router();

const commentController = require("../controllers/commentController");

const { protect } = require("../middleware/authMiddleware");

router.post("/issues/:issueId/comments", protect, commentController.addComment);
router.get("/issues/:issueId/comments", commentController.getCommentsByIssue);
router.delete(
  "/issues/:issueId/comments/:commentId",
  protect,
  commentController.deleteComment
);
router.post("/comments/:id/like", protect, commentController.toggleLike);

module.exports = router;
