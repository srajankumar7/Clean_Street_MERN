import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Home.css";
import axios from "axios";

export default function Home() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalIssues: 0,
    postalCodes: 0,
  });

  const [recentlySolved, setRecentlySolved] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const usersRes = await axios.get(
        "http://localhost:5000/api/auth/public/users-count"
      );
      const totalUsers = usersRes.data.count || 0;

      try {
        let totalUsers = 0;
        try {
          const res = await axios.get(
            "http://localhost:5000/api/auth/allusers"
          );
          totalUsers = Array.isArray(res.data) ? res.data.length : 0;
        } catch (err) {
          console.warn("Users endpoint not found");
        }

        const issuesRes = await axios.get(
          "http://localhost:5000/api/issues/public"
        );

        const all = issuesRes.data.issues || [];
        const seen = new Set();
        const uniqueIssues = [];

        for (const issue of all) {
          if (issue?._id && !seen.has(issue._id)) {
            seen.add(issue._id);
            uniqueIssues.push(issue);
          }
        }

        const totalIssues = uniqueIssues.length;
        const postalRes = await axios.get(
          "http://localhost:5000/api/auth/public/postal-codes"
        );

        const postalCodes = postalRes.data.postalCodes.length;

        const resolvedIssues = uniqueIssues
          .filter((i) => (i.status || "").toLowerCase() === "resolved")
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 3);

        setRecentlySolved(
          resolvedIssues.map((i) => ({
            id: i._id,
            title: i.title,
            date: new Date(i.createdAt).toLocaleDateString(),
          }))
        );

        // Set Stats
        setStats({
          totalUsers,
          totalIssues,
          postalCodes,
        });
      } catch (err) {
        console.error("Error loading homepage data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="landing-container">
      {/* SECTION 1: HERO */}
      <section className="home-section hero">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <div className="hero-left">
            <h1>
              Clean<span className="highlight">Street</span>
            </h1>
            <p className="caption">Report. Track. Resolve.</p>
            <p className="brief">
              A community-driven platform to build cleaner, smarter
              neighborhoods. Report issues like potholes and garbage in
              real-time and watch them get resolved.
            </p>

            <div className="hero-actions">
              {!user ? (
                <>
                  <Link to="/register" className="btn primary-btn">
                    Get Started
                  </Link>
                  <Link to="/login" className="btn outline-btn">
                    Login
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/report-issue" className="btn primary-btn">
                    Report Issue
                  </Link>
                  <Link to="/complaints" className="btn outline-btn">
                    View Complaints
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="scroll-indicator">
          <span>Scroll to Explore</span>
          <div className="arrow">↓</div>
        </div>
      </section>

      {/* SECTION 2: LIVE STATISTICS */}
      <section className="home-section stat-section">
        <div className="section-headers">
          <h2>Our Impact</h2>
          <p>Real-time data empowering our city</p>
        </div>

        <div className="stat-grids">
          <div className="stats-card">
            <div className="icons">
              <i class="bi bi-people-fill"></i>
            </div>
            <h3>{loading ? "..." : stats.totalUsers}+</h3>
            <p>Active Citizens</p>
          </div>
          <div className="stats-card featured">
            <div className="icons">
              <i class="bi bi-megaphone-fill"></i>
            </div>
            <h3>{loading ? "..." : stats.totalIssues}+</h3>
            <p>Issues Reported</p>
          </div>
          <div className="stats-card">
            <div className="icons">
              <i class="bi bi-geo-fill"></i>
            </div>
            <h3>{loading ? "..." : stats.postalCodes}</h3>
            <p>Postal Zones</p>
          </div>
        </div>
      </section>

      {/* SECTION 3: RECENT ACTIVITY */}
      <section className="home-section recent-section">
        <div className="content-wrapper">
          <h2>Recently Solved</h2>
          <p className="subtitle">See what's happening in your neighborhood</p>

          <div className="recent-list">
            {recentlySolved.map((item) => (
              <div key={item.id} className="recent-item">
                <div className="status-indicator resolved">✔</div>
                <div className="recent-info">
                  <h4>{item.title}</h4>
                  <span className="date">{item.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <footer className="footer">
          <p>
            © {new Date().getFullYear()} CleanStreet. Together for a cleaner
            tomorrow.
          </p>
        </footer>
      </section>
    </div>
  );
}
