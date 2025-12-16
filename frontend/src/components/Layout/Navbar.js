import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Navbar.css";

import logoSrc from "../../assets/cleanStreet.png";

const Navbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setOpen(false);
  };

  const toggleMenu = () => setOpen((s) => !s);

  const isActive = (path) => {
    if (path === "/admin/overview") {
      return (
        location.pathname === "/admin" ||
        location.pathname === "/admin/overview"
      );
    }
    return location.pathname === path;
  };

  return (
    <nav className="navbar" aria-label="Primary navigation">
      <div className={`nav-container ${open ? "open-menu" : ""}`}>
        <Link to="/" className="nav-logo" onClick={() => setOpen(false)}>
          <img src={logoSrc} alt="cleanStreet logo" />
          <span className="brand-text">
            <span className="title">CleanStreet</span>
            <span className="subtitle">Keep the streets clean</span>
          </span>
        </Link>

        {/* Hamburger for mobile */}
        <button
          className="nav-toggle"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={toggleMenu}
        >
          <span
            className="bar"
            style={{
              transform: open ? "rotate(45deg) translate(3px, 3px)" : "none",
            }}
          />
          <span className="bar" style={{ opacity: open ? 0 : 1 }} />
          <span
            className="bar"
            style={{
              transform: open ? "rotate(-45deg) translate(3px, -3px)" : "none",
            }}
          />
        </button>

        <div
          className="nav-menu"
          role="menu"
          aria-hidden={!open && window.innerWidth < 860}
        >
          <Link
            to="/"
            className={`nav-link ${isActive("/") ? "active" : ""}`}
            onClick={() => setOpen(false)}
          >
            <i
              className="bi bi-house-door-fill"
              aria-hidden="true"
              style={{ color: "var(--g-3)" }}
            ></i>
            Home
          </Link>

          {user ? (
            <>
              {/* ADMIN USER NAVIGATION */}
              {user.role === "admin" || user.role === "globaladmin" ? (
                <>
                  <Link
                    to="/admin/overview"
                    className={`nav-link ${
                      isActive("/admin/overview") ? "active" : ""
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <i
                      className="bi bi-speedometer2"
                      aria-hidden="true"
                      style={{ color: "var(--g-3)" }}
                    ></i>
                    Overview
                  </Link>

                  <Link
                    to="/admin/complaints"
                    className={`nav-link ${
                      isActive("/admin/complaints") ? "active" : ""
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <i
                      className="bi bi-inbox-fill"
                      aria-hidden="true"
                      style={{ color: "var(--g-3)" }}
                    ></i>
                    Manage Complaints
                  </Link>

                  <Link
                    to="/admin/users"
                    className={`nav-link ${
                      isActive("/admin/users") ? "active" : ""
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <i
                      className="bi bi-people-fill"
                      aria-hidden="true"
                      style={{ color: "var(--g-3)" }}
                    ></i>
                    Users
                  </Link>

                  <Link
                    to="/admin/reports"
                    className={`nav-link ${
                      isActive("/admin/reports") ? "active" : ""
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <i
                      className="bi bi-graph-up"
                      aria-hidden="true"
                      style={{ color: "var(--g-3)" }}
                    ></i>
                    Reports
                  </Link>
                </>
              ) : (
                // REGULAR USER NAVIGATION
                <>
                  <Link
                    to="/dashboard"
                    className={`nav-link ${
                      isActive("/dashboard") ? "active" : ""
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <i
                      className="bi bi-speedometer2"
                      aria-hidden="true"
                      style={{ color: "var(--g-3)" }}
                    ></i>
                    Dashboard
                  </Link>

                  <Link
                    to="/report-issue"
                    className={`nav-link ${
                      isActive("/report-issue") ? "active" : ""
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <i
                      className="bi bi-exclamation-circle"
                      aria-hidden="true"
                      style={{ color: "var(--g-3)" }}
                    ></i>
                    Report Issue
                  </Link>

                  <Link
                    to="/complaints"
                    className={`nav-link ${
                      isActive("/complaints") ? "active" : ""
                    }`}
                    onClick={() => setOpen(false)}
                  >
                    <i
                      className="bi bi-inbox-fill"
                      aria-hidden="true"
                      style={{ color: "var(--g-3)" }}
                    ></i>
                    View Complaints
                  </Link>
                </>
              )}

              <div className="nav-user">
                <Link
                  to="/profile"
                  className={`nav-link ${isActive("/profile") ? "active" : ""}`}
                  onClick={() => setOpen(false)}
                >
                  <i
                    className="bi bi-person-circle"
                    aria-hidden="true"
                    style={{ color: "var(--g-3)" }}
                  ></i>
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="nav-logout"
                  aria-label="Logout"
                >
                  Logout
                </button>
              </div>
            </>
          ) : (
            <div className="nav-auth">
              <Link
                to="/login"
                className={`nav-link ${isActive("/login") ? "active" : ""}`}
                onClick={() => setOpen(false)}
              >
                <i
                  className="bi bi-box-arrow-in-right"
                  aria-hidden="true"
                  style={{ color: "var(--g-3)" }}
                ></i>
                Login
              </Link>
              <Link
                to="/register"
                className={`nav-link register ${
                  isActive("/register") ? "active" : ""
                }`}
                onClick={() => setOpen(false)}
              >
                <i
                  className="bi bi-pencil-square"
                  aria-hidden="true"
                  style={{ color: "var(--g-pale)" }}
                ></i>
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
