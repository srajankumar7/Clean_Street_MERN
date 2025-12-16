import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Dashboard.css";
import axios from "axios";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import { fromLonLat } from "ol/proj";
import { Feature } from "ol";
import Point from "ol/geom/Point";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { Icon, Style } from "ol/style";

import CleanStreetPointer from "../assets/cleanstreetPointer.png";
import RedPointer from "../assets/redpointer.png";
import YellowPointer from "../assets/yellowpointer.png";

const BACKEND_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const getCoordinatesFromPostalCode = async (postalCode, locationText) => {
  try {
    const query = postalCode || locationText;
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}`
    );

    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return { lat: 17.385, lng: 78.4867 };
  } catch (err) {
    return { lat: 17.385, lng: 78.4867 };
  }
};

const AdminDashboard = () => {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "globaladmin";

  const [stats, setStats] = useState({
    totalIssues: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  });

  const [activities, setActivities] = useState([]);
  const [mapIssues, setMapIssues] = useState([]);
  const [showMap, setShowMap] = useState(false);

  const mapRef = useRef(null);
  const olMap = useRef(null);
  const vectorSourceRef = useRef(new VectorSource());
  const vectorLayerRef = useRef(
    new VectorLayer({ source: vectorSourceRef.current })
  );

  const fetchIssues = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await axios.get(`${BACKEND_URL}/api/issues`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const lists = [
        res.data?.localIssues,
        res.data?.myAreaReports,
        res.data?.otherIssues,
        res.data?.otherReports,
        res.data?.issues,
      ];

      const all = [];
      lists.forEach((l) => Array.isArray(l) && all.push(...l));

      if (all.length === 0 && Array.isArray(res.data)) {
        all.push(...res.data);
      }

      const seen = new Set();
      const unique = [];

      for (const issue of all) {
        const id = issue?._id || issue?.id;
        if (!id) continue;
        if (!seen.has(id)) {
          seen.add(id);
          unique.push(issue);
        }
      }

      const userPostal = (user?.postalCode || "").trim();
      let issuesToDisplay = [];

      if (isGlobalAdmin) {
        issuesToDisplay = unique;
      } else {
        issuesToDisplay = unique.filter(
          (i) => (i.postalCode || "").toString().trim() === userPostal
        );
      }

      const sorted = [...issuesToDisplay].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setActivities(sorted.slice(0, 4));

      setStats({
        totalIssues: issuesToDisplay.length,
        pending: issuesToDisplay.filter(
          (i) => (i.status || "").toLowerCase() === "reported"
        ).length,
        inProgress: issuesToDisplay.filter(
          (i) => (i.status || "").toLowerCase() === "in progress"
        ).length,
        resolved: issuesToDisplay.filter(
          (i) => (i.status || "").toLowerCase() === "resolved"
        ).length,
      });

      setMapIssues(issuesToDisplay);
    } catch (err) {
      console.error("Error fetching issues:", err);
    }
  }, [user, isGlobalAdmin]);

  useEffect(() => {
    if (user) fetchIssues();
  }, [user, fetchIssues]);

  useEffect(() => {
    if (!showMap || !user) return;

    const initMap = async () => {
      let coords;
      if (isGlobalAdmin) {
        coords = { lat: 20.5937, lng: 78.9629 };
      } else {
        coords = await getCoordinatesFromPostalCode(
          user.postalCode,
          user.location
        );
      }

      const center = fromLonLat([coords.lng, coords.lat]);

      if (!olMap.current) {
        olMap.current = new Map({
          target: mapRef.current,
          layers: [
            new TileLayer({ source: new OSM() }),
            vectorLayerRef.current,
          ],
          view: new View({
            center,
            zoom: isGlobalAdmin ? 5 : 14,
          }),
        });
      } else {
        olMap.current.setTarget(mapRef.current);
        olMap.current.getView().setCenter(center);
        olMap.current.getView().setZoom(isGlobalAdmin ? 5 : 14);
      }

      vectorSourceRef.current.clear();
      const features = mapIssues
        .map((issue) => {
          const lng =
            issue.location?.lng ||
            issue.longitude ||
            issue.location?.coordinates?.[0];
          const lat =
            issue.location?.lat ||
            issue.latitude ||
            issue.location?.coordinates?.[1];

          if (!lng || !lat) return null;

          const priority = (issue.priority || "").toLowerCase();
          let icon = CleanStreetPointer;
          if (priority === "high") icon = RedPointer;
          else if (priority === "medium") icon = YellowPointer;

          const feature = new Feature({
            geometry: new Point(fromLonLat([Number(lng), Number(lat)])),
          });

          feature.setStyle(
            new Style({
              image: new Icon({
                src: icon,
                scale: 0.06,
                anchor: [0.5, 1],
              }),
            })
          );
          return feature;
        })
        .filter(Boolean);

      vectorSourceRef.current.addFeatures(features);
      setTimeout(() => {
        olMap.current.updateSize();
      }, 200);
    };

    initMap();
    return () => {
      if (olMap.current) olMap.current.setTarget(null);
    };
  }, [showMap, mapIssues, user, isGlobalAdmin]);

  const getStatusClass = (status) => {
    const s = (status || "").toLowerCase().replace(" ", "");
    return `status-${s}`;
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">
          {isGlobalAdmin ? "Admin Overview" : "Community Dashboard"}
        </h1>
        <p className="dashboard-subtitle">
          {isGlobalAdmin
            ? "Monitor complaints and activities across all regions."
            : "Track issues in your area and contribute to a cleaner community."}
        </p>
      </header>

      {/* Stats Grid */}
      <div className="stats-grids">
        <div className="stat-cards">
          <div className="stat-icon-wrappers">
            <i className="bi bi-grid-fill"></i>
          </div>
          <div className="stat-labels">
            <i className="bi bi-files"></i> Total Issues
          </div>
          <div className="stat-values">{stats.totalIssues}</div>
        </div>
        <div className="stat-cards">
          <div className="stat-icon-wrappers">
            <i className="bi bi-clock-history"></i>
          </div>
          <div className="stat-labels">
            <i className="bi bi-clock"></i> Pending
          </div>
          <div className="stat-values">{stats.pending}</div>
        </div>
        <div className="stat-cards">
          <div className="stat-icon-wrappers">
            <i className="bi bi-tools"></i>
          </div>
          <div className="stat-labels">
            <i className="bi bi-hourglass-split"></i> In Progress
          </div>
          <div className="stat-values">{stats.inProgress}</div>
        </div>
        <div className="stat-cards">
          <div className="stat-icon-wrappers">
            <i className="bi bi-check-circle-fill"></i>
          </div>
          <div className="stat-labels">
            <i className="bi bi-check2-circle"></i> Resolved
          </div>
          <div className="stat-values">{stats.resolved}</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="dashboard-content">
        {/* Left: Recent Activity */}
        <div className="content-section">
          <h3 className="section-titles">
            {isGlobalAdmin ? "Global Activity" : "Recent Reports"}
            <i className="bi bi-activity" style={{ opacity: 0.5 }}></i>
          </h3>

          <div className="activity-list">
            {activities.length > 0 ? (
              activities.map((a) => (
                <div key={a._id} className="activity-item">
                  <div className="activity-info">
                    <div className="activity-icon">
                      <i
                        className={`bi ${
                          a.status === "resolved"
                            ? "bi-check-lg"
                            : "bi-exclamation-lg"
                        }`}
                      ></i>
                    </div>
                    <div className="activity-details">
                      <h4>{a.title}</h4>
                      <p>
                        {new Date(a.createdAt).toLocaleDateString()} •{" "}
                        {new Date(a.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`status-badge ${getStatusClass(
                      a.status || "reported"
                    )}`}
                  >
                    {a.status || "Reported"}
                  </span>
                </div>
              ))
            ) : (
              <div className="no-data">No recent activity found.</div>
            )}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="content-section" style={{ height: "fit-content" }}>
          <h3 className="section-titles">Quick Actions</h3>
          <div className="actions-grid">
            <Link to="/report-issue" className="dashboard-btn btn-primary">
              <i className="bi bi-plus-circle-fill"></i> Report Issue
            </Link>
            <Link to="/complaints" className="dashboard-btn btn-secondary">
              <i className="bi bi-list-check"></i> Manage Complaints
            </Link>
            <button
              className="dashboard-btn btn-tertiary"
              onClick={() => setShowMap(true)}
            >
              <i className="bi bi-map-fill"></i> View Map
            </button>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {showMap && (
        <div className="modal-overlay" onClick={() => setShowMap(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Issue Map</h2>
              <button
                className="btn-close-icon"
                onClick={() => setShowMap(false)}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </div>
            <div ref={mapRef} className="map-wrapper"></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
