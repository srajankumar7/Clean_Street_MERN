const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  issueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Issue",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  text: {
    type: String,
    required: true,
    maxlength: 2000,
  },
  parentCommentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    default: null,
  },
  likes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  createdAt: { type: Date, default: Date.now },
});
commentSchema.post("remove", async function (doc) {
  try {
    const Issue = require("./Issue");
    const issueId = doc.issueId;
    const count = await mongoose.model("Comment").countDocuments({ issueId });
    const latest = await mongoose
      .model("Comment")
      .findOne({ issueId })
      .sort({ createdAt: -1 })
      .lean();
    await Issue.findByIdAndUpdate(issueId, {
      commentsCount: count,
      latestComment: latest
        ? {
            text: latest.text,
            user: latest.userId,
            createdAt: latest.createdAt,
          }
        : null,
    });
  } catch (err) {
    console.error("Comment post-remove hook failed:", err);
  }
});

// Indexes for performance
commentSchema.index({ issueId: 1, createdAt: -1 });
commentSchema.index({ userId: 1 });

module.exports = mongoose.model("Comment", commentSchema);
