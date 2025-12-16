const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const User = require("../models/user");
const Issue = require("../models/Issue");

function getStartDate(range) {
  const now = new Date();
  const start = new Date(now);
  if (range === "week") start.setDate(now.getDate() - 6);
  else if (range === "month") start.setDate(now.getDate() - 29);
  else if (range === "quarter") start.setMonth(now.getMonth() - 2);
  else if (range === "year") start.setFullYear(now.getFullYear() - 1);
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatDayLabel(date) {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString("en-GB", { month: "short" });
}

function getLastNDaysLabels(n, endDate = new Date()) {
  const labels = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(endDate.getDate() - i);
    labels.push({
      key: d.toISOString().slice(0, 10),
      date: d,
      label: formatDayLabel(d),
    });
  }
  return labels;
}

function getLastNWeeksLabels(n, endDate = new Date()) {
  const labels = [];
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  for (let i = n - 1; i >= 0; i--) {
    const weekEnd = new Date(end);
    weekEnd.setDate(end.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    labels.push({
      key: `${weekStart.toISOString().slice(0, 10)}_${weekEnd
        .toISOString()
        .slice(0, 10)}`,
      start: new Date(weekStart.setHours(0, 0, 0, 0)),
      end: new Date(weekEnd.setHours(23, 59, 59, 999)),
      label: `${formatDayLabel(weekStart)} - ${formatDayLabel(weekEnd)}`,
    });
  }
  return labels;
}

function getLastNMonthsLabels(n, endDate = new Date()) {
  const labels = [];
  const end = new Date(endDate);
  end.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(end.getFullYear(), end.getMonth() - i, 1);
    const monthStart = new Date(m.getFullYear(), m.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd = new Date(
      m.getFullYear(),
      m.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    labels.push({
      key: `${monthStart.getFullYear()}-${monthStart.getMonth() + 1}`,
      start: monthStart,
      end: monthEnd,
      label: formatMonthLabel(monthStart),
    });
  }
  return labels;
}

router.get("/", protect, async (req, res) => {
  try {
    if (!req.user || !["admin", "globaladmin"].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const adminPostal = req.user.postalCode;

    // GLOBAL ADMIN SUPPORT
    const postalFilter =
      req.user.role === "globaladmin"
        ? { postalCode: { $exists: true } }
        : { postalCode: req.user.postalCode };

    const range = (req.query.range || "month").toLowerCase();
    const startDate = getStartDate(range);

    const [
      totalUsers,
      newUsersThisRange,
      usersSinceStart,
      totalComplaints,
      resolvedComplaints,
      pendingComplaints,
      complaintTrendsRaw,
      issuesForMetrics,
    ] = await Promise.all([
      User.countDocuments(postalFilter),
      User.countDocuments({
        ...postalFilter,
        memberSince: { $gte: startDate },
      }),
      User.find({ ...postalFilter, memberSince: { $gte: startDate } })
        .select("memberSince")
        .lean(),

      Issue.countDocuments(postalFilter),
      Issue.countDocuments({ ...postalFilter, status: "resolved" }),
      Issue.countDocuments({ ...postalFilter, status: { $ne: "resolved" } }),

      Issue.aggregate([
        { $match: { ...postalFilter, createdAt: { $gte: startDate } } },
        { $group: { _id: "$issueType", count: { $sum: 1 } } },
      ]),

      Issue.find(postalFilter)
        .select("createdAt resolvedAt status upvotes downvotes updatedAt")
        .lean(),
    ]);

    // === USER GROWTH BUCKETING ===
    let userGrowth = [];
    if (range === "week") {
      const labels = getLastNDaysLabels(7);
      const counts = {};
      usersSinceStart.forEach((u) => {
        const key = u.memberSince.toISOString().slice(0, 10);
        counts[key] = (counts[key] || 0) + 1;
      });
      userGrowth = labels.map((l) => ({
        month: l.label,
        users: counts[l.key] || 0,
      }));
    } else if (range === "month") {
      const weekBuckets = getLastNWeeksLabels(4);
      userGrowth = weekBuckets.map((b) => ({
        month: b.label,
        users: usersSinceStart.filter((u) => {
          const d = new Date(u.memberSince);
          return d >= b.start && d <= b.end;
        }).length,
      }));
    } else if (range === "quarter") {
      const monthBuckets = getLastNMonthsLabels(3);
      userGrowth = monthBuckets.map((b) => ({
        month: b.label,
        users: usersSinceStart.filter((u) => {
          const d = new Date(u.memberSince);
          return d >= b.start && d <= b.end;
        }).length,
      }));
    } else {
      const monthBuckets = getLastNMonthsLabels(12);
      userGrowth = monthBuckets.map((b) => ({
        month: b.label,
        users: usersSinceStart.filter((u) => {
          const d = new Date(u.memberSince);
          return d >= b.start && d <= b.end;
        }).length,
      }));
    }

    const complaintTrends = (complaintTrendsRaw || []).map((c) => ({
      category: c._id,
      count: c.count,
    }));

    // === ISSUE STATUS COUNTS (TIME-RANGE BASED) ===
    const issueStatusCountsRaw = await Issue.aggregate([
      {
        $match: {
          ...postalFilter,
          createdAt: { $gte: startDate },
        },
      },

      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const issueStatusCounts = {
      reported: 0,
      "in progress": 0,
      resolved: 0,
      // rejected: 0,
    };

    issueStatusCountsRaw.forEach((s) => {
      issueStatusCounts[s._id] = s.count;
    });

    // === PRIORITY COUNTS (TIME-RANGE BASED) ===
    const priorityCountsRaw = await Issue.aggregate([
      {
        $match: {
          ...postalFilter,
          createdAt: { $gte: startDate },
        },
      },
      { $group: { _id: "$priority", count: { $sum: 1 } } },
    ]);

    const priorityCounts = { high: 0, medium: 0, low: 0 };
    priorityCountsRaw.forEach((p) => {
      priorityCounts[p._id] = p.count;
    });

    // === SYSTEM METRICS ===
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const activeSessions = await User.countDocuments({
      postalCode: adminPostal,
      lastActive: { $gte: tenMinutesAgo },
    });

    let totalUpvotes = 0,
      totalDownvotes = 0;
    issuesForMetrics.forEach((issue) => {
      totalUpvotes += issue.upvotes?.length || 0;
      totalDownvotes += issue.downvotes?.length || 0;
    });

    let satisfactionScore = 0;
    if (totalUpvotes + totalDownvotes > 0) {
      satisfactionScore = totalUpvotes / (totalUpvotes + totalDownvotes);
    }

    const userSatisfaction = `${(satisfactionScore * 5).toFixed(1)}/5`;

    const resolvedIssues = issuesForMetrics.filter(
      (i) => i.status === "resolved" && (i.resolvedAt || i.updatedAt)
    );

    let avgResponseTime = "N/A";
    if (resolvedIssues.length > 0) {
      const totalMs = resolvedIssues.reduce((sum, it) => {
        const created = new Date(it.createdAt).getTime();
        const resolved = new Date(it.resolvedAt || it.updatedAt).getTime();
        return sum + Math.max(0, resolved - created);
      }, 0);
      avgResponseTime = `${(
        totalMs /
        resolvedIssues.length /
        (1000 * 60 * 60)
      ).toFixed(2)}h`;
    }

    const systemMetrics = {
      avgResponseTime,
      userSatisfaction,
      systemUptime: `${((process.uptime() / 86400) * 100).toFixed(2)}%`,
      activeSessions,
    };

    const complaintResolutionRate =
      totalComplaints === 0
        ? 0
        : ((resolvedComplaints / totalComplaints) * 100).toFixed(2);

    return res.json({
      success: true,
      totalUsers,
      newUsersThisRange,
      userGrowth,
      totalComplaints,
      resolvedComplaints,
      pendingComplaints,
      complaintResolutionRate,
      complaintTrends,
      issueStatusCounts,
      priorityCounts,
      systemMetrics,
    });
  } catch (err) {
    console.error("Admin Reports error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
