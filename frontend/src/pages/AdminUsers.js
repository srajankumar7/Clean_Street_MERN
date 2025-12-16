import React, { useState, useEffect, useRef, useCallback } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import "./AdminUsers.css";

const API_URL = "http://localhost:5000/api/admin/users";
const ITEMS_PER_PAGE = 15;

export default function AdminUsers() {
  let storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem("user"));
  } catch {
    storedUser = null;
  }

  const currentAdmin = storedUser || {
    id: "dummy",
    role: "globaladmin",
    postalCode: "509001",
  };

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("users");

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const scrollContainerRef = useRef(null);
  const searchTimeout = useRef(null);

  const fetchUsers = useCallback(
    async (pageNum, shouldReset = false, search = searchTerm) => {
      if (loading) return;
      setLoading(true);

      try {
        const token = localStorage.getItem("token");
        const query = `?page=${pageNum}&limit=${ITEMS_PER_PAGE}&search=${encodeURIComponent(
          search
        )}`;

        const res = await axios.get(`${API_URL}/users${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.data.success) {
          const fetchedUsers = res.data.users || [];

          if (fetchedUsers.length < ITEMS_PER_PAGE) {
            setHasMore(false);
          }

          if (shouldReset) {
            setUsers(fetchedUsers);
          } else {
            setUsers((prev) => {
              const existingIds = new Set(prev.map((u) => u._id));
              const uniqueNew = fetchedUsers.filter(
                (u) => !existingIds.has(u._id)
              );
              return [...prev, ...uniqueNew];
            });
          }
        }
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      fetchUsers(1, true, searchTerm);
    }, 500);

    return () => clearTimeout(searchTimeout.current);
  }, [searchTerm, activeTab]);
  const handleScroll = () => {
    if (!scrollContainerRef.current || loading || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;

    if (scrollTop + clientHeight >= scrollHeight - 50) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchUsers(nextPage, false, searchTerm);
    }
  };

  const displayUsers = users.filter((user) => {
    if (currentAdmin.role === "globaladmin") {
      if (activeTab === "users" && user.role !== "user") return false;
      if (activeTab === "admins" && user.role !== "admin") return false;
    } else if (currentAdmin.role === "admin") {
      if (user.role !== "user") return false;
      if (user.postalCode !== currentAdmin.postalCode) return false;
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.postalCode.includes(term)
      );
    }

    return true;
  });

  const toggleBlockStatus = async (id, status) => {
    const action = status === "ACTIVE" ? "Block" : "Unblock";
    const result = await Swal.fire({
      title: `${action} User?`,
      text: `Are you sure you want to ${action.toLowerCase()} this user?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#d33",
      confirmButtonText: action,
    });

    if (!result.isConfirmed) return;

    setUsers((prev) =>
      prev.map((u) =>
        u._id === id
          ? { ...u, status: status === "ACTIVE" ? "BLOCKED" : "ACTIVE" }
          : u
      )
    );

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_URL}/block/${id}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Swal.fire({
        title: "Updated!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      console.error(err);
      fetchUsers(1, true);
    }
  };

  const toggleRole = async (id, currentRole) => {
    if (currentAdmin.role !== "globaladmin") return;
    const newRole = currentRole === "user" ? "admin" : "user";

    const result = await Swal.fire({
      title: "Change Role?",
      text: `Promote this user to ${newRole}?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      confirmButtonText: "Yes, promote",
    });

    if (!result.isConfirmed) return;

    setUsers((prev) =>
      prev.map((u) => (u._id === id ? { ...u, role: newRole } : u))
    );

    try {
      const token = localStorage.getItem("token");
      await axios.put(
        `${API_URL}/role/${id}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      Swal.fire({
        title: "Success!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      fetchUsers(1, true);
    }
  };

  const deleteUser = async (id) => {
    const result = await Swal.fire({
      title: "Delete User?",
      text: "This action is permanent.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    setUsers((prev) => prev.filter((u) => u._id !== id));

    try {
      const token = localStorage.getItem("token");
      await axios.delete(`${API_URL}/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      Swal.fire({
        title: "Deleted!",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      fetchUsers(1, true);
    }
  };

  return (
    <div className="admin-users-page">
      <div className="container">
        {/* Header */}
        <div className="page-header">
          <div className="header-content">
            <h1>
              {currentAdmin.role === "globaladmin"
                ? "Admin Dashboard"
                : "Region Manager"}
            </h1>
            <p>
              {currentAdmin.role === "globaladmin"
                ? "Manage users and administrators."
                : `Managing Region: ${currentAdmin.postalCode}`}
            </p>
          </div>

          <div className="header-controls">
            {currentAdmin.role === "globaladmin" && (
              <div className="tabs-container">
                <button
                  className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
                  onClick={() => setActiveTab("users")}
                >
                  Users
                </button>
                <button
                  className={`tab-btn ${
                    activeTab === "admins" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("admins")}
                >
                  Admins
                </button>
              </div>
            )}

            <div className="search-container">
              <i className="bi bi-search search-icon"></i>
              <input
                type="text"
                placeholder="Search by name or email..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table Card with Scroll */}
        <div className="users-table-card">
          <div
            className="table-scroll-container"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <table className="user-table">
              <thead>
                <tr>
                  <th>User Details</th>
                  {currentAdmin.role === "globaladmin" && <th>Role</th>}
                  <th>Postal Code</th>
                  <th>Status</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayUsers.length > 0
                  ? displayUsers.map((user) => (
                      <tr key={user._id}>
                        <td>
                          <div className="user-info-cell">
                            <span className="user-name">{user.name}</span>
                            <span className="user-email">{user.email}</span>
                          </div>
                        </td>

                        {currentAdmin.role === "globaladmin" && (
                          <td>
                            <span className={`role-badge ${user.role}`}>
                              {user.role}
                            </span>
                          </td>
                        )}

                        <td>{user.postalCode || "N/A"}</td>

                        <td>
                          <span
                            className={`status-badge ${
                              user.status === "ACTIVE" ? "active" : "blocked"
                            }`}
                          >
                            <span className="status-dot"></span>
                            {user.status}
                          </span>
                        </td>

                        <td>
                          <div
                            className="actions-cell"
                            style={{ justifyContent: "center" }}
                          >
                            <button
                              className={`actions-btn ${
                                user.status === "ACTIVE"
                                  ? "btn-block"
                                  : "btn-unblock"
                              }`}
                              onClick={() =>
                                toggleBlockStatus(user._id, user.status)
                              }
                              title={
                                user.status === "ACTIVE" ? "Block" : "Unblock"
                              }
                            >
                              <i
                                className={`bi ${
                                  user.status === "ACTIVE"
                                    ? "bi-lock-fill"
                                    : "bi-unlock-fill"
                                }`}
                              ></i>
                            </button>

                            {currentAdmin.role === "globaladmin" && (
                              <button
                                className="actions-btn btn-promote"
                                onClick={() => toggleRole(user._id, user.role)}
                                title={
                                  user.role === "admin" ? "Demote" : "Promote"
                                }
                              >
                                <i
                                  className={`bi ${
                                    user.role === "admin"
                                      ? "bi-arrow-down-circle-fill"
                                      : "bi-arrow-up-circle"
                                  }`}
                                ></i>
                              </button>
                            )}

                            <button
                              className="actions-btn btn-delete"
                              onClick={() => deleteUser(user._id)}
                              title="Delete"
                            >
                              <i className="bi bi-trash3-fill"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  : !loading && (
                      <tr>
                        <td
                          colSpan="5"
                          style={{
                            textAlign: "center",
                            padding: "3rem",
                            color: "#999",
                          }}
                        >
                          No users found.
                        </td>
                      </tr>
                    )}
              </tbody>
            </table>

            {loading && (
              <div className="loading-indicator">Loading users...</div>
            )}
            {!hasMore && displayUsers.length > 0 && (
              <div className="end-message">End of list</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
