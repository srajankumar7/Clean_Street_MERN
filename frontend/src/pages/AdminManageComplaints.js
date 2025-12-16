import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import Swal from "sweetalert2";
import "./AdminManageComplaints.css";

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

const AdminManageComplaints = () => {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "globaladmin";
  const isAdmin = isGlobalAdmin || user?.role === "admin";

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

  const statusOptions = ["reported", "in progress", "resolved", "closed"];

  const updateIssueInState = (updatedIssue) => {
    if (!updatedIssue) return;

    const id = updatedIssue._id || updatedIssue.id;

    const updateList = (prev) =>
      prev.map((i) => ((i._id || i.id) === id ? updatedIssue : i));

    setMyAreaReports(updateList);
    setOtherReports(updateList);

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
    if (
      selectedComplaintForComments &&
      (selectedComplaintForComments._id || selectedComplaintForComments.id) ===
        id
    ) {
      setSelectedComplaintForComments(updatedIssue);
    }
  };

  const removeIssueFromState = (issueId) => {
    const removeId = (i) => (i._id || i.id) !== issueId;
    setMyAreaReports((prev) => prev.filter(removeId));
    setOtherReports((prev) => prev.filter(removeId));

    if (
      selectedComplaint &&
      (selectedComplaint._id || selectedComplaint.id) === issueId
    ) {
      setSelectedComplaint(null);
    }
    if (
      selectedComplaintForComments &&
      (selectedComplaintForComments._id || selectedComplaintForComments.id) ===
        issueId
    ) {
      setSelectedComplaintForComments(null);
    }
    fetchedIdsRef.current.delete(issueId);
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
        myArea = myArea.filter((issue) => {
          const id = issue._id || issue.id;
          fetchedIdsRef.current.add(id);
          return true;
        });
        others = others.filter((issue) => {
          const id = issue._id || issue.id;
          fetchedIdsRef.current.add(id);
          return true;
        });
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

    // 1. Filter
    if (filter !== "all") {
      filtered = filtered.filter((r) => r.priority === filter);
    }

    // 2. Sort
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

  const handleUpdateStatus = async (issueId, newStatus) => {
    const currentIssue = [...myAreaReports, ...otherReports].find(
      (i) => (i._id || i.id) === issueId
    );
    if (newStatus === currentIssue?.status) return;

    const isLocalReport = myAreaReports.some(
      (i) => (i._id || i.id) === issueId
    );
    if (!isGlobalAdmin && !isLocalReport) {
      Swal.fire({
        icon: "warning",
        title: "Access Denied",
        text: "You can only update the status of reports in your designated area.",
        confirmButtonColor: "#005347",
      });
      return;
    }

    try {
      const token = localStorage.getItem("token");

      const res = await axios.patch(
        `${BACKEND}/api/admin/issues/${issueId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success && res.data.issue) {
        updateIssueInState(res.data.issue);
        Swal.fire({
          icon: "success",
          title: "Status Updated!",
          text: `Complaint status changed to "${newStatus.toUpperCase()}".`,
          confirmButtonColor: "#005347",
          timer: 3000,
          timerProgressBar: true,
        });
      }
    } catch (err) {
      console.error("Status update error:", err);
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err.response?.data?.message || "Could not update status.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const handleDeleteIssue = async (issueId) => {
    const isLocalReport = myAreaReports.some(
      (i) => (i._id || i.id) === issueId
    );
    if (!isGlobalAdmin && !isLocalReport) {
      Swal.fire({
        icon: "warning",
        title: "Access Denied",
        text: "You can only delete reports from your designated area.",
        confirmButtonColor: "#005347",
      });
      return;
    }

    const confirmResult = await Swal.fire({
      title: "Confirm Deletion?",
      text: "This issue and all associated data will be PERMANENTLY DELETED. This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#005347",
      confirmButtonText: "Yes, Delete Post",
      cancelButtonText: "Cancel",
      className: "swalalerts",
    });

    if (!confirmResult.isConfirmed) return;

    try {
      const token = localStorage.getItem("token");

      const res = await axios.delete(`${BACKEND}/api/admin/issues/${issueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        removeIssueFromState(issueId);
        closeDetailsModal();
        Swal.fire({
          icon: "success",
          title: "Issue Deleted!",
          text: "The complaint has been permanently removed.",
          confirmButtonColor: "#005347",
          timer: 3000,
          timerProgressBar: true,
        });
      }
    } catch (err) {
      console.error("Issue deletion error:", err);
      Swal.fire({
        icon: "error",
        title: "Deletion Failed",
        text: err.response?.data?.message || "Could not delete issue.",
        confirmButtonColor: "#d33",
      });
    }
  };

  const renderComplaintCard = (complaint) => {
    const id = complaint._id || complaint.id;
    const priorityColor =
      {
        high: "#e63946",
        medium: "#ffb703",
        low: "#2a9d8f",
      }[complaint.priority] || "#6c757d";

    const rawStatus = (complaint.status || "reported")
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

    const isLocalIssue = myAreaReports.some((i) => (i._id || i.id) === id);
    const canPerformActions = isGlobalAdmin || isLocalIssue;

    return (
      <article
        key={id}
        className="complaint-card"
        aria-labelledby={`title-${id}`}
      >
        {/* Image Section */}
        <div
          className="card-image-wrapper"
          onClick={() => openDetails(complaint)}
        >
          {/* Badges Overlay */}
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

        {/* Content */}
        <div className="complaint-content">
          <p id={`title-${id}`} className="complaint-title">
            {complaint.title}
          </p>
          <p className="complaint-description">
            {complaint.description || "No description available."}
          </p>
        </div>

        {/* Footer Actions */}
        <div
          className={`complaint-actions ${
            canPerformActions ? "admin-card-controls" : "user-card-controls"
          }`}
        >
          {canPerformActions ? (
            <>
              <div className="status-control">
                <select
                  className="btn-status-select"
                  value={rawStatus}
                  onChange={(e) => handleUpdateStatus(id, e.target.value)}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="action-btn btn-comment"
                onClick={() => openComments(complaint)}
                title="Comments"
              >
                <i className="bi bi-chat-left-text" />{" "}
                {complaint.commentsCount || 0}
              </button>

              <button
                className="action-btn btn-view"
                onClick={() => openDetails(complaint)}
                title="View Details"
              >
                <i className="bi bi-eye"></i>
              </button>

              <button
                className="action-btn btn-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteIssue(id);
                }}
                title="Delete Issue"
              >
                <i className="bi bi-trash-fill"></i>
              </button>
            </>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "#999",
                  fontSize: "0.8rem",
                }}
              >
                <i className="bi bi-info-circle" style={{ marginRight: 5 }}></i>{" "}
                Non-local
              </div>
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
                View
              </button>
            </>
          )}
        </div>
      </article>
    );
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

        // Update local maps
        setCommentsLocal((prev) => ({
          ...(prev || {}),
          [issueId]: [res.data.comment, ...(prev?.[issueId] || [])],
        }));

        if (res.data.issue) {
          updateIssueInState(res.data.issue);
        } else {
          // fallback optimistic update
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
      text: "This cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#005347",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it",
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
        // Update counts optimistically
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
      console.error(err);
      Swal.fire("Error", "Could not delete comment", "error");
    }
  };

  // --- Modal and image navigation helpers ---
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

  // Map link helper
  const openLocationInMaps = (complaint) => {
    const q = complaint.address || complaint.location || complaint.title;
    if (q) {
      window.open(
        `https://www.google.com/maps?q=${encodeURIComponent(q)}`,
        "_blank"
      );
    }
  };

  return (
    <div className="view-complaints-page">
      {/* HEADER SECTION */}
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
              <option value="all">All Priorities</option>
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
              <option value="newest">Newest First</option>
              <option value="comments">Most Active</option>
              <option value="status">Status</option>
            </select>
          </div>
        </div>
      </div>

      {loadingComplaints && (
        <p style={{ textAlign: "center", color: "#fff" }}>Loading reports…</p>
      )}
      <div className="complaints-scroll-container">
        {/* User area reports */}
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

        {/* Other reports */}
        <section aria-label="Other reports" style={{ marginTop: "4rem" }}>
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

      {/* --- DETAIL MODAL --- */}
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
                style={{ background: "#eee" }}
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
                    alt="Complaint Proof"
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
                    <div
                      onClick={window.open}
                      style={{
                        position: "absolute",
                        bottom: 10,
                        background: "rgba(0,0,0,0.5)",
                        color: "white",
                        padding: "4px 8px",
                        borderRadius: 10,
                        fontSize: "0.8rem",
                      }}
                    >
                      {modalImageIndex + 1} /{" "}
                      {selectedComplaint.imageUrls.length}
                    </div>
                  )}
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

      {/* --- COMMENTS MODAL --- */}
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
                style={{ background: "#eee" }}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>

            <div className="comments-section">
              <div className="comment-input-area">
                <textarea
                  className="comment-input"
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

              <div className="comments-list">
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
                      <div key={idx} className="comment-bubble">
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
                        {(isAuthor || isAdmin) && (
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
                              fontSize: "0.8rem",
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
                  <p>Loading comments...</p>
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

export default AdminManageComplaints;
