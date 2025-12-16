const Issue = require("../models/Issue");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const { extractPostalCode } = require("../utils/extractPostalCode");
const { getCoordinatesFromAddress } = require("../utils/geocodingUtils");
const User = require("../models/user");
const Comment = require("../models/Comment");

const uploadBufferToCloudinary = (
  fileBuffer,
  options = {},
  timeoutMs = 30000
) => {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        reject(new Error("Cloudinary upload timeout"));
      }
    }, timeoutMs);

    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        clearTimeout(timer);
        if (finished) return;
        finished = true;
        if (error) return reject(error);
        return resolve(result.secure_url || result.url);
      }
    );

    // handle stream errors
    streamifier
      .createReadStream(fileBuffer)
      .on("error", (streamErr) => {
        clearTimeout(timer);
        if (finished) return;
        finished = true;
        reject(streamErr);
      })
      .pipe(uploadStream);
  });
};

exports.reportIssue = async (req, res) => {
  // console.log("REPORT ISSUE: incoming request. user:", req.user?._id);
  const { title, issueType, priority, address, landmark, description } =
    req.body;
  const imageFiles = req.files;

  if (!title || !issueType || !address || !description) {
    console.log("REPORT ISSUE: validation failed");
    return res.status(400).json({
      success: false,
      message: "Please include all required issue fields.",
    });
  }

  try {
    const uploadedImages = [];

    if (imageFiles && imageFiles.length > 0) {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        try {
          const url = await uploadBufferToCloudinary(
            file.buffer,
            { folder: "cleanstreet_issues" },
            30000
          );
          uploadedImages.push(url);
        } catch (uploadErr) {
          console.error(
            `REPORT ISSUE: image upload failed for ${file.originalname}:`,
            uploadErr.message || uploadErr
          );
          return res.status(500).json({
            success: false,
            message: "Image upload failed",
            details: uploadErr.message || String(uploadErr),
          });
        }
      }
    }
    let latitude = null;
    let longitude = null;
    try {
      const coords = await getCoordinatesFromAddress(address);

      if (
        coords &&
        typeof coords.lat === "number" &&
        typeof coords.lng === "number"
      ) {
        latitude = coords.lat;
        longitude = coords.lng;
      } else {
        console.warn(
          "Geocoding returned invalid/non-numeric coordinates for:",
          address
        );
      }
    } catch (geoError) {
      console.warn("Geocoding failed for address:", address, geoError.message);
    }

    console.log("REPORT ISSUE: creating DB record...");
    const postalCode = extractPostalCode(address);
    const newIssue = await Issue.create({
      title,
      issueType,
      priority,
      address,
      postalCode,
      landmark,
      description,
      imageUrls: uploadedImages,
      reportedBy: req.user._id,
      latitude: latitude,
      longitude: longitude,
    });

    console.log("REPORT ISSUE: issue saved:", newIssue._id);
    res.status(201).json({
      success: true,
      message: "Issue reported successfully!",
      issue: newIssue,
    });
  } catch (error) {
    console.error("REPORT ISSUE: unexpected error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during issue submission.",
      details: error.message,
    });
  }
};

const normalizePostal = (p) => {
  if (!p && p !== 0) return "";
  try {
    return String(p)
      .replace(/[^0-9a-zA-Z]/g, "")
      .toLowerCase()
      .trim();
  } catch (e) {
    return String(p || "").trim();
  }
};

exports.getAllIssues = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    const selection = { __v: 0 };

    const populationOptions = [
      // include username + name so frontend can show either
      { path: "reportedBy", select: "name username postalCode" },
      { path: "latestComment.user", select: "name" },
    ];

    let myAreaReports = [];
    let otherReports = [];

    const userPostalRaw = user && user.postalCode ? user.postalCode : "";
    const userPostalNorm = normalizePostal(userPostalRaw);

    if (user.role === "globaladmin") {
      // GLOBAL ADMIN GETS ALL ISSUES
      myAreaReports = await Issue.find()
        .populate(populationOptions)
        .select(selection)
        .sort({ createdAt: -1 });

      otherReports = [];
    } else if (userPostalNorm) {
      myAreaReports = await Issue.find({ postalCode: userPostalRaw })
        .populate(populationOptions)
        .select(selection)
        .sort({ createdAt: -1 });
      otherReports = await Issue.find({ postalCode: { $ne: userPostalRaw } })
        .populate(populationOptions)
        .select(selection)
        .sort({ createdAt: -1 });
    } else {
      let issues = await Issue.find()
        .populate(populationOptions)
        .select(selection)
        .sort({ createdAt: -1 });
      otherReports = issues;
    }

    res.status(200).json({
      success: true,
      localIssues: myAreaReports,
      otherIssues: otherReports,
    });
  } catch (error) {
    console.error("Error fetching issues:", error);
    res.status(500).json({ success: false, message: "Failed to load issues" });
  }
};

exports.toggleVote = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!["up", "down"].includes(type)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid vote type" });
    }

    const issue = await Issue.findById(id);
    if (!issue)
      return res
        .status(404)
        .json({ success: false, message: "Issue not found" });

    const userId = req.user._id.toString();
    const isUpvote = type === "up";

    const upvotesBefore = issue.upvotes.map((u) => u.toString());
    const downvotesBefore = issue.downvotes.map((u) => u.toString());

    const wasAlreadyTargetVoter = isUpvote
      ? upvotesBefore.includes(userId)
      : downvotesBefore.includes(userId);

    issue.upvotes = issue.upvotes.filter((u) => u.toString() !== userId);
    issue.downvotes = issue.downvotes.filter((u) => u.toString() !== userId);

    if (!wasAlreadyTargetVoter) {
      const targetArray = isUpvote ? issue.upvotes : issue.downvotes;
      targetArray.push(req.user._id);
    }

    await issue.save();

    await issue.populate([{ path: "reportedBy", select: "name" }]);

    res.status(200).json({ success: true, issue });
  } catch (error) {
    console.error("Vote error:", error);
    res.status(500).json({ success: false, message: "Vote failed" });
  }
};

exports.updateIssueStatus = async (req, res) => {
  const { issueId } = req.params;
  const { status } = req.body;
  const user = req.user;

  if (user.role !== "admin" && user.role !== "globaladmin") {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  const validStatuses = ["reported", "in progress", "resolved", "closed"];
  if (!status || !validStatuses.includes(status.toLowerCase())) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid status provided." });
  }

  try {
    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res
        .status(404)
        .json({ success: false, message: "Issue not found." });
    }

    const isGlobal = user.role === "globaladmin";
    const isLocalIssue =
      normalizePostal(issue.postalCode) === normalizePostal(user.postalCode);

    if (!isGlobal && !isLocalIssue) {
      return res.status(403).json({
        success: false,
        message:
          "You can only update issues within your assigned postal code area.",
      });
    }

    const update = { status: status.toLowerCase() };
    if (update.status === "resolved" || update.status === "closed") {
      update.resolvedAt = new Date();
    } else {
      update.resolvedAt = null;
    }

    const updatedIssue = await Issue.findByIdAndUpdate(
      issueId,
      { $set: update },
      { new: true }
    ).populate([
      { path: "reportedBy", select: "name postalCode" },
      { path: "latestComment.user", select: "name" },
    ]);

    res.status(200).json({ success: true, issue: updatedIssue });
  } catch (error) {
    console.error("Update status error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during status update." });
  }
};

exports.getAllIssuesPublicSafe = async (req, res) => {
  try {
    const issues = await Issue.find()
      .populate([
        { path: "reportedBy", select: "name postalCode" },
        { path: "latestComment.user", select: "name" },
      ])
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      issues,
    });
  } catch (error) {
    console.error("Public issues error:", error);
    res.status(500).json({ success: false, message: "Failed to load issues" });
  }
};

exports.deleteIssue = async (req, res) => {
  const { issueId } = req.params;
  const user = req.user;

  if (user.role !== "admin" && user.role !== "globaladmin") {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  try {
    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res
        .status(404)
        .json({ success: false, message: "Issue not found." });
    }

    const isGlobal = user.role === "globaladmin";
    const isLocalIssue =
      normalizePostal(issue.postalCode) === normalizePostal(user.postalCode);

    if (!isGlobal && !isLocalIssue) {
      return res.status(403).json({
        success: false,
        message:
          "You can only delete issues within your assigned postal code area.",
      });
    }

    await Comment.deleteMany({ issueId });

    await Issue.deleteOne({ _id: issueId });

    res.status(200).json({
      success: true,
      message: "Issue and associated data deleted successfully.",
    });
  } catch (error) {
    console.error("Delete issue error:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error during issue deletion." });
  }
};
