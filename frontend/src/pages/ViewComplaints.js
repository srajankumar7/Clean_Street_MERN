import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import Swal from "sweetalert2";
import "./ViewComplaints.css";

// Placeholder for date-fns
const formatDistanceToNow = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + " years ago";
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + " months ago";
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + " days ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + " hours ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + " minutes ago";
  return "just now";
};

const BACKEND = process.env.REACT_APP_API_URL || "http://localhost:5000";
const PAGE_SIZE = 20;

const ViewComplaints = () => {
  const { user } = useAuth();
  const [myAreaReports, setMyAreaReports] = useState([]);
  const [otherReports, setOtherReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [selectedComplaintForComments, setSelectedComplaintForComments] =
    useState(null);
  const [commentsLocal, setCommentsLocal] = useState({});
  const [newComment, setNewComment] = useState("");
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const userId = user?._id || user?.id;
  const [comments, setComments] = useState([]);
  const [pageComments, setPageComments] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(true);

  const [pageComplaints, setPageComplaints] = useState(1);
  const [hasMoreComplaints, setHasMoreComplaints] = useState(true);
  const fetchedIdsRef = useRef(new Set());

  const updateIssueInState = (updatedIssue) => {
    if (!updatedIssue) return;
    const id = updatedIssue._id || updatedIssue.id;

    setMyAreaReports((prev) =>
      prev.map((i) => ((i._id || i.id) === id ? updatedIssue : i))
    );
    setOtherReports((prev) =>
      prev.map((i) => ((i._id || i.id) === id ? updatedIssue : i))
    );

    setCommentsLocal((prev) => ({
      ...prev,
      [id]: updatedIssue.comments || [],
    }));

    if (
      selectedComplaint &&
      (selectedComplaint._id || selectedComplaint.id) === id
    ) {
      setSelectedComplaint(updatedIssue);
    }
  };

  const fetchComments = async (issueId, pageNum = 1) => {
    if (loading) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${BACKEND}/api/issues/${issueId}/comments?page=${pageNum}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (pageNum === 1) setComments(res.data.comments);
      else setComments((prev) => [...prev, ...res.data.comments]);

      setTotalPages(res.data.totalPages || 1);
      setHasMoreComments(pageNum < (res.data.totalPages || 1));
      setPageComments(pageNum);
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      const modalBox = document.querySelector(".comments-list");
      if (!modalBox || loading || !hasMoreComments) return;

      const { scrollTop, scrollHeight, clientHeight } = modalBox;
      if (scrollTop + clientHeight >= scrollHeight - 10) {
        const next = pageComments + 1;
        fetchComments(
          selectedComplaintForComments._id || selectedComplaintForComments.id,
          next
        );
        setPageComments(next);
      }
    };

    const modalBox = document.querySelector(".comments-list");
    if (modalBox) modalBox.addEventListener("scroll", handleScroll);

    return () => {
      if (modalBox) modalBox.removeEventListener("scroll", handleScroll);
    };
  }, [loading, hasMoreComments, selectedComplaintForComments, pageComments]);

  const fetchComplaints = async (page = 1, { reset = false } = {}) => {
    if (loadingComplaints) return;
    try {
      setLoadingComplaints(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${BACKEND}/api/issues?page=${page}&limit=${PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const hasServerPagination = typeof res.data.totalPages !== "undefined";
      let myArea = [];
      let others = [];

      if (res.data?.success) {
        myArea = res.data.localIssues || [];
        others = res.data.otherIssues || [];
      } else {
        const issues = res.data.issues || res.data || [];
        const userPostal = (user?.postalCode || "").toString().trim();

        issues.forEach((issue) => {
          const ip = (issue.postalCode || "").toString().trim();
          if (userPostal && ip && ip === userPostal) myArea.push(issue);
          else others.push(issue);
        });
      }

      const appendUnique = (currentList, incomingList) => {
        const next = [...currentList];
        incomingList.forEach((issue) => {
          const id = issue._id || issue.id;
          if (!fetchedIdsRef.current.has(id)) {
            fetchedIdsRef.current.add(id);
            next.push(issue);
          }
        });
        return next;
      };

      if (reset) {
        fetchedIdsRef.current = new Set();
        myArea.forEach((issue) =>
          fetchedIdsRef.current.add(issue._id || issue.id)
        );
        others.forEach((issue) =>
          fetchedIdsRef.current.add(issue._id || issue.id)
        );
        setMyAreaReports(myArea);
        setOtherReports(others);
      } else {
        setMyAreaReports((prev) => appendUnique(prev, myArea));
        setOtherReports((prev) => appendUnique(prev, others));
      }

      setCommentsLocal((prev) => {
        const map = { ...(prev || {}) };
        [...myArea, ...others].forEach((issue) => {
          const id = issue._id || issue.id;
          map[id] = issue.comments || map[id] || [];
        });
        return map;
      });

      if (hasServerPagination) {
        setHasMoreComplaints(page < (res.data.totalPages || 1));
      } else {
        const returned = myArea.length + others.length || 0;
        setHasMoreComplaints(returned >= PAGE_SIZE);
      }

      setPageComplaints(page);
    } catch (err) {
      console.error("Error loading complaints:", err);
    } finally {
      setLoadingComplaints(false);
    }
  };

  useEffect(() => {
    fetchComplaints(1, { reset: true });
  }, []);

  useEffect(() => {
    const container = document.querySelector(".complaints-scroll-container");
    if (!container) return;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const { scrollTop, clientHeight, scrollHeight } = container;
        if (
          scrollTop + clientHeight >= scrollHeight - 150 &&
          !loadingComplaints &&
          hasMoreComplaints
        ) {
          const next = pageComplaints + 1;
          fetchComplaints(next);
        }
        ticking = false;
      });
    };

    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, [pageComplaints, loadingComplaints, hasMoreComplaints]);

  useEffect(() => {
    setMyAreaReports([]);
    setOtherReports([]);
    fetchedIdsRef.current = new Set();
    setHasMoreComplaints(true);
    setPageComplaints(1);
    fetchComplaints(1, { reset: true });
  }, [filter, sortBy]);

  const sortAndFilterReports = (reports) => {
    let filtered = [...reports];
    const priorityOrder = { high: 1, medium: 2, low: 3, undefined: 4 };

    if (filter !== "all") {
      filtered = filtered.filter((r) => r.priority === filter);
    }

    if (sortBy === "priority") {
      filtered.sort(
        (a, b) =>
          priorityOrder[a.priority] - priorityOrder[b.priority] ||
          new Date(b.createdAt) - new Date(a.createdAt)
      );
    } else if (sortBy === "newest") {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "comments") {
      filtered.sort((a, b) => (b.commentsCount || 0) - (a.commentsCount || 0));
    } else if (sortBy === "status") {
      const normalizeStatus = (status) =>
        (status || "").toString().toLowerCase().replace(/_/g, " ").trim();
      const statusOrder = {
        reported: 1,
        "in progress": 2,
        resolved: 3,
        closed: 4,
      };

      filtered.sort((a, b) => {
        const statusA = normalizeStatus(a.status);
        const statusB = normalizeStatus(b.status);
        return (statusOrder[statusA] || 5) - (statusOrder[statusB] || 5);
      });
    }
    return filtered;
  };

  const handleVote = async (issueId, type) => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${BACKEND}/api/issues/${issueId}/vote/${type}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success && res.data.issue) {
        updateIssueInState(res.data.issue);
        return;
      }

      const applyOptimistic = (list) =>
        list.map((c) => {
          if ((c._id || c.id) !== issueId) return c;
          const isUp = type === "up";
          const userIdStr = String(userId);
          const up = new Set((c.upvotes || []).map(String));
          const down = new Set((c.downvotes || []).map(String));

          if (isUp) {
            if (up.has(userIdStr)) up.delete(userIdStr);
            else {
              up.add(userIdStr);
              down.delete(userIdStr);
            }
          } else {
            if (down.has(userIdStr)) down.delete(userIdStr);
            else {
              down.add(userIdStr);
              up.delete(userIdStr);
            }
          }
          return { ...c, upvotes: Array.from(up), downvotes: Array.from(down) };
        });

      setMyAreaReports((prev) => applyOptimistic(prev));
      setOtherReports((prev) => applyOptimistic(prev));

      if (
        selectedComplaint &&
        (selectedComplaint._id || selectedComplaint.id) === issueId
      ) {
        setSelectedComplaint((prev) => applyOptimistic([prev])[0] || prev);
      }
    } catch (err) {
      console.error("Vote error:", err);
      alert("Failed to submit vote. Make sure you're logged in and try again.");
    }
  };

  const handleAddComment = async (issueId) => {
    const text = (newComment || "").trim();
    if (!text || !issueId) {
      if (!text) alert("Please enter a comment.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${BACKEND}/api/issues/${issueId}/comments`,
        { text },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        if (res.data.comment) {
          setComments((prev) => [res.data.comment, ...(prev || [])]);
        }
        setCommentsLocal((prev) => ({
          ...(prev || {}),
          [issueId]: [res.data.comment, ...(prev?.[issueId] || [])],
        }));

        if (res.data.issue) {
          updateIssueInState(res.data.issue);
        } else {
          setMyAreaReports((prev) =>
            prev.map((i) =>
              (i._id || i.id) === issueId
                ? { ...i, commentsCount: (i.commentsCount || 0) + 1 }
                : i
            )
          );
          setOtherReports((prev) =>
            prev.map((i) =>
              (i._id || i.id) === issueId
                ? { ...i, commentsCount: (i.commentsCount || 0) + 1 }
                : i
            )
          );
        }
        setNewComment("");
      }
    } catch (err) {
      console.error("Error posting comment:", err);
      alert("Failed to post comment.");
    }
  };

  const handleDeleteComment = async (issueId, commentId) => {
    const confirmResult = await Swal.fire({
      title: "Delete Comment?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#005347",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!",
    });

    if (!confirmResult.isConfirmed) return;

    try {
      const token = localStorage.getItem("token");
      const res = await axios.delete(
        `${BACKEND}/api/issues/${issueId}/comments/${commentId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        setComments((prev) => prev.filter((c) => c._id !== commentId));

        setMyAreaReports((prev) =>
          prev.map((i) =>
            (i._id || i.id) === issueId
              ? { ...i, commentsCount: Math.max((i.commentsCount || 1) - 1, 0) }
              : i
          )
        );
        setOtherReports((prev) =>
          prev.map((i) =>
            (i._id || i.id) === issueId
              ? { ...i, commentsCount: Math.max((i.commentsCount || 1) - 1, 0) }
              : i
          )
        );
        Swal.fire({
          title: "Deleted",
          icon: "success",
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      console.error("Error deleting comment:", err);
      Swal.fire({
        title: "Error",
        text: "Could not delete comment",
        icon: "error",
      });
    }
  };

  const openDetails = (complaint) => {
    setSelectedComplaint(complaint);
    setModalImageIndex(0);
    document.body.classList.add("modal-open");
  };

  const closeDetailsModal = () => {
    setSelectedComplaint(null);
    setModalImageIndex(0);
    document.body.classList.remove("modal-open");
  };

  const openComments = (complaint) => {
    setSelectedComplaintForComments(complaint);
    fetchComments(complaint._id || complaint.id, 1);
    setPageComments(1);
    document.body.classList.add("modal-open");
  };
  const closeCommentsModal = () => {
    setSelectedComplaintForComments(null);
    setNewComment("");
    setComments([]);
    setPageComments(1);
    setTotalPages(1);
    setHasMoreComments(true);
    document.body.classList.remove("modal-open");
  };

  const prevImage = () => {
    if (!selectedComplaint?.imageUrls?.length) return;
    setModalImageIndex(
      (i) =>
        (i - 1 + selectedComplaint.imageUrls.length) %
        selectedComplaint.imageUrls.length
    );
  };
  const nextImage = () => {
    if (!selectedComplaint?.imageUrls?.length) return;
    setModalImageIndex((i) => (i + 1) % selectedComplaint.imageUrls.length);
  };

  const openLocationInMaps = (complaint) => {
    const q = complaint.address || complaint.location || complaint.title;
    if (q)
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          q
        )}`,
        "_blank"
      );
  };

  const renderComplaintCard = (complaint) => {
    const id = complaint._id || complaint.id;
    const upvotes = Array.isArray(complaint.upvotes)
      ? complaint.upvotes.length
      : complaint.upvotes || 0;
    const downvotes = Array.isArray(complaint.downvotes)
      ? complaint.downvotes.length
      : complaint.downvotes || 0;

    const priorityColor =
      { high: "#e63946", medium: "#ffb703", low: "#2a9d8f" }[
        complaint.priority
      ] || "#6c757d";
    const rawStatus = (complaint.status || "Reported")
      .toLowerCase()
      .replace(/_/g, " ");
    const statusColorMap = {
      reported: "#ff075eff",
      "in progress": "#1410e2ff",
      resolved: "#2a703aff",
      closed: "#6c757d",
    };
    const statusColor = statusColorMap[rawStatus] || "#999999";
    const displayStatus = rawStatus.replace(/\b\w/g, (c) => c.toUpperCase());

    const hasUpvoted = (complaint.upvotes || [])
      .map(String)
      .includes(String(userId));
    const hasDownvoted = (complaint.downvotes || [])
      .map(String)
      .includes(String(userId));

    return (
      <article
        key={id}
        className="complaint-card"
        aria-labelledby={`title-${id}`}
      >
        <div
          className="card-image-wrapper"
          onClick={() => openDetails(complaint)}
        >
          <div className="card-badges">
            <div className="badge-group">
              <span className="badge" style={{ background: priorityColor }}>
                {complaint.priority?.toUpperCase() || "N/A"}
              </span>
              <span className="badge" style={{ background: statusColor }}>
                {displayStatus}
              </span>
            </div>
            <span className="time-badge">
              {formatDistanceToNow(new Date(complaint.createdAt))}
            </span>
          </div>

          <img
            src={
              (complaint.imageUrls && complaint.imageUrls[0]) ||
              "/placeholder.jpg"
            }
            alt={complaint.title}
            className="complaint-image"
          />
        </div>

        <div className="complaint-content">
          <p id={`title-${id}`} className="complaint-title">
            {complaint.title}
          </p>
          <p className="complaint-description">
            {complaint.description || "No description available."}
          </p>
        </div>

        <div className="complaint-actions">
          <div className="vote-group">
            <button
              className={`action-btn btn-vote ${hasUpvoted ? "active-up" : ""}`}
              onClick={() => handleVote(id, "up")}
              title="Upvote"
            >
              <i className="bi bi-hand-thumbs-up" /> {upvotes}
            </button>
            <button
              className={`action-btn btn-vote ${
                hasDownvoted ? "active-down" : ""
              }`}
              onClick={() => handleVote(id, "down")}
              title="Downvote"
            >
              <i className="bi bi-hand-thumbs-down" />
              {downvotes}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="action-btn btn-comment"
              onClick={() => openComments(complaint)}
            >
              <i className="bi bi-chat-left-text" />{" "}
              {complaint.commentsCount || 0}
            </button>
            <button
              className="action-btn btn-view"
              onClick={() => openDetails(complaint)}
            >
              <i className="bi bi-eye"></i>
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="view-complaints-page">
      {/* HEADER */}
      <div className="complaints-page-header">
        <div className="header-titles">
          <h1>Community Reports</h1>
          <p>
            See what issues your community is reporting and show your support
          </p>
        </div>

        <div className="header-controls">
          <div className="filter-group">
            <label>Priority</label>
            <select
              className="modern-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Sort By</label>
            <select
              className="modern-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="priority">Priority</option>
              <option value="newest">Newest</option>
              <option value="comments">Most Comments</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {loadingComplaints && (
        <p style={{ textAlign: "center", color: "#fff" }}>Loading reports…</p>
      )}

      {/* SCROLLABLE CONTENT AREA */}
      <div className="complaints-scroll-container">
        <section aria-label="Your area reports">
          <h2 className="section-title">Reports in your area</h2>
          {sortAndFilterReports(myAreaReports).length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--g-accent)" }}>
              No reports found in your postal code matching current filters.
            </p>
          ) : (
            <div className="complaints-grid">
              {sortAndFilterReports(myAreaReports).map(renderComplaintCard)}
            </div>
          )}
        </section>

        <section aria-label="Other reports" style={{ marginTop: "3rem" }}>
          <h2 className="section-title">Other reports</h2>
          {sortAndFilterReports(otherReports).length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--g-accent)" }}>
              No other reports found matching current filters.
            </p>
          ) : (
            <div className="complaints-grid">
              {sortAndFilterReports(otherReports).map(renderComplaintCard)}
            </div>
          )}
        </section>
      </div>

      {/* Details Modal */}
      {selectedComplaint && (
        <div className="modal-overlay" onClick={closeDetailsModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <h2>{selectedComplaint.title}</h2>
              <button
                className="action-btn"
                onClick={closeDetailsModal}
                style={{ background: "#eee", color: "#333" }}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="modal-image-container">
              {selectedComplaint.imageUrls &&
              selectedComplaint.imageUrls.length > 0 ? (
                <>
                  <img
                    src={selectedComplaint.imageUrls[modalImageIndex]}
                    alt="Evidence"
                    className="modal-image"
                    onClick={() =>
                      window.open(
                        selectedComplaint.imageUrls[modalImageIndex],
                        "_blank"
                      )
                    }
                    style={{ cursor: "pointer" }}
                    title="Click to open full image in new tab"
                  />
                  {selectedComplaint.imageUrls.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        style={{
                          position: "absolute",
                          left: 10,
                          background: "rgba(255,255,255,0.8)",
                          border: "none",
                          borderRadius: "50%",
                          width: 36,
                          height: 36,
                          cursor: "pointer",
                        }}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                      <button
                        onClick={nextImage}
                        style={{
                          position: "absolute",
                          right: 10,
                          background: "rgba(255,255,255,0.8)",
                          border: "none",
                          borderRadius: "50%",
                          width: 36,
                          height: 36,
                          cursor: "pointer",
                        }}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <p style={{ color: "#888" }}>No images provided</p>
              )}
            </div>
            <div className="modal-info-row">
              <div
                className="info-item"
                onClick={() => openLocationInMaps(selectedComplaint)}
                title={selectedComplaint.address || selectedComplaint.location}
                style={{
                  cursor: "pointer",
                  alignItems: "flex-start",
                  maxWidth: "90%",
                }}
              >
                <i
                  className="bi bi-geo-alt-fill"
                  style={{ marginTop: "4px", flexShrink: 0 }}
                />

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      maxWidth: "600px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {selectedComplaint.address ||
                      selectedComplaint.location ||
                      "Location not set"}
                  </span>

                  {/* Landmark */}
                  {selectedComplaint.landmark && (
                    <span
                      style={{
                        fontSize: "0.85rem",
                        color: "#888",
                        marginTop: "2px",
                      }}
                    >
                      Landmark: {selectedComplaint.landmark}
                    </span>
                  )}
                </div>
              </div>

              {/* User Name Section */}
              <div className="info-item" style={{ minWidth: "150px" }}>
                <i className="bi bi-person-fill" style={{ flexShrink: 0 }} />
                {selectedComplaint.reportedBy?.name ||
                  selectedComplaint.reportedBy?.username ||
                  "Anonymous User"}
              </div>
            </div>

            <p style={{ lineHeight: 1.6, color: "#444", marginBottom: "2rem" }}>
              {selectedComplaint.description}
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="action-btn btn-view"
                onClick={() => {
                  closeDetailsModal();
                  openComments(selectedComplaint);
                }}
              >
                <i className="bi bi-chat-left-text"></i> View Discussion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {selectedComplaintForComments && (
        <div className="modal-overlay" onClick={closeCommentsModal}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <h2>Discussion: {selectedComplaintForComments.title}</h2>
              <button
                className="action-btn"
                onClick={closeCommentsModal}
                style={{ background: "#eee", color: "#333" }}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div
              className="comments-section"
              style={{
                marginTop: "1rem",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
                <textarea
                  style={{
                    flex: 1,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #ddd",
                  }}
                  rows="2"
                  placeholder="Write a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button
                  className="action-btn btn-view"
                  onClick={() =>
                    handleAddComment(
                      selectedComplaintForComments._id ||
                        selectedComplaintForComments.id
                    )
                  }
                  style={{ height: "fit-content", alignSelf: "center" }}
                >
                  Post
                </button>
              </div>

              <div
                className="comments-list"
                style={{ overflowY: "auto", flex: 1 }}
              >
                {comments.length > 0 ? (
                  comments.map((c, idx) => {
                    const username =
                      (c.userId &&
                        typeof c.userId === "object" &&
                        (c.userId.name || c.userId.username)) ||
                      "User";
                    const isAuthor =
                      c.userId &&
                      (typeof c.userId === "object"
                        ? c.userId._id
                        : c.userId.toString()) === (user?._id || user?.id);

                    return (
                      <div
                        key={idx}
                        style={{
                          background: "#f9f9f9",
                          padding: "0.8rem",
                          borderRadius: 10,
                          marginBottom: "0.5rem",
                          borderLeft: "4px solid var(--g-accent)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 5,
                          }}
                        >
                          <strong>{username}</strong>
                          <span style={{ fontSize: "0.75rem", color: "#888" }}>
                            {formatDistanceToNow(new Date(c.createdAt))}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: "#333" }}>{c.text}</p>
                        {isAuthor && (
                          <button
                            onClick={() =>
                              handleDeleteComment(
                                selectedComplaintForComments._id ||
                                  selectedComplaintForComments.id,
                                c._id
                              )
                            }
                            style={{
                              background: "none",
                              border: "none",
                              color: "#d33",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              marginTop: 5,
                              padding: 0,
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    );
                  })
                ) : loading ? (
                  <p>Loading...</p>
                ) : (
                  <p>No comments yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewComplaints;
