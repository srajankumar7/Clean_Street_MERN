const mongoose = require("mongoose");
const Issue = require("../models/Issue");
const Comment = require("../models/Comment");

// Add a new comment
exports.addComment = async (req, res) => {
  try {
    const { text, parentCommentId } = req.body;
    const issueId = req.params.issueId;
    const userId = req.user._id;

    if (!text || !text.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Comment text required" });
    }

    // create the comment document
    const comment = await Comment.create({
      issueId,
      userId,
      text: text.trim(),
      parentCommentId: parentCommentId || null,
    });

    // update issue metadata atomically
    await Issue.findByIdAndUpdate(issueId, {
      $inc: { commentsCount: 1 },
      $set: {
        latestComment: {
          text: comment.text,
          user: userId,
          createdAt: comment.createdAt,
        },
      },
    });

    // re-fetch the updated issue and populate the fields the client needs
    const updatedIssue = await Issue.findById(issueId)
      .populate({ path: "reportedBy", select: "name postalCode" })
      .populate({ path: "latestComment.user", select: "name" })
      .lean();

    // populate the comment's user
    const populatedComment = await Comment.findById(comment._id)
      .populate("userId", "name")
      .lean();

    res
      .status(201)
      .json({ success: true, comment: populatedComment, issue: updatedIssue });
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteComment = async (req, res) => {
  const { issueId, commentId } = req.params;
  const userId = req.user && req.user._id;

  try {
    if (
      !mongoose.Types.ObjectId.isValid(issueId) ||
      !mongoose.Types.ObjectId.isValid(commentId)
    ) {
      return res.status(400).json({ success: false, message: "Invalid IDs" });
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });
    }

    const isCommentAuthor = String(comment.userId) === String(userId);
    const isAdmin =
      req.user?.role === "admin" || req.user?.role === "globaladmin";

    if (!isCommentAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this comment",
      });
    }

    await Comment.deleteOne({ _id: commentId });

    const newCount = await Comment.countDocuments({ issueId });
    const latest = await Comment.findOne({ issueId })
      .sort({ createdAt: -1 })
      .lean();

    const latestCommentObj = latest
      ? {
          text: latest.text,
          user: latest.userId,
          createdAt: latest.createdAt,
        }
      : null;

    await Issue.findByIdAndUpdate(issueId, {
      $set: { commentsCount: newCount, latestComment: latestCommentObj },
    });

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
      commentsCount: newCount,
      latestComment: latestCommentObj,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getCommentsByIssue = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.max(1, parseInt(req.query.limit || "10", 10));

    const comments = await Comment.find({ issueId: req.params.issueId })
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Comment.countDocuments({ issueId: req.params.issueId });

    res.json({
      success: true,
      comments,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId);
    if (!comment)
      return res
        .status(404)
        .json({ success: false, message: "Comment not found" });

    const alreadyLiked = comment.likes.some(
      (u) => u.toString() === userId.toString()
    );
    if (alreadyLiked) comment.likes.pull(userId);
    else comment.likes.push(userId);

    await comment.save();
    res.json({ success: true, likesCount: comment.likes.length });
  } catch (error) {
    console.error("Error toggling like:", error);
    res.status(500).json({ success: false, message: "Error toggling like" });
  }
};
