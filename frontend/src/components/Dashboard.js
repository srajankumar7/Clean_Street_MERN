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
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
      };
    }
    // fallback: Hyderabad
    return { lat: 17.385, lng: 78.4867 };
  } catch (err) {
    console.error("Geocode error:", err);
    return { lat: 17.385, lng: 78.4867 };
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

const Dashboard = () => {
  const { user } = useAuth();
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

      const rawLists = [
        res.data?.localIssues,
        res.data?.myAreaReports,
        res.data?.otherIssues,
        res.data?.otherReports,
        res.data?.issues,
      ];
      const allFlat = [];
      rawLists.forEach((lst) => {
        if (Array.isArray(lst)) allFlat.push(...lst);
      });

      if (allFlat.length === 0 && Array.isArray(res.data)) {
        allFlat.push(...res.data);
      }

      const seen = new Set();
      const uniqueIssues = [];
      for (const issue of allFlat) {
        const id = issue?._id || issue?.id;
        if (!id) continue;
        if (!seen.has(String(id))) {
          seen.add(String(id));
          uniqueIssues.push(issue);
        }
      }

      const userPostal = (user?.postalCode || "").toString().trim();

      const myAreaIssues = [];
      const otherIssues = [];

      uniqueIssues.forEach((issue) => {
        const issuePostal = (issue.postalCode || "").toString().trim();
        if (userPostal && issuePostal && issuePostal === userPostal)
          myAreaIssues.push(issue);
        else otherIssues.push(issue);
      });
      // console.log("User postal in dashboard:", user?.postalCode);
      // console.log("Fetched issues:", uniqueIssues.length);
      // console.log("Matched issues (myArea):", myAreaIssues.length);
      // console.log(
      //   "Statuses:",
      //   myAreaIssues.map((i) => i.status)
      // );

      // Sort newest first
      const sortedArea = myAreaIssues.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Update dashboard UI
      setActivities(sortedArea.slice(0, 3));
      setStats({
        totalIssues: myAreaIssues.length,
        pending: myAreaIssues.filter(
          (i) => (i.status || "").toLowerCase() === "reported"
        ).length,
        inProgress: myAreaIssues.filter(
          (i) => (i.status || "").toLowerCase() === "in progress"
        ).length,
        resolved: myAreaIssues.filter(
          (i) => (i.status || "").toLowerCase() === "resolved"
        ).length,
      });

      setMapIssues(uniqueIssues);
    } catch (err) {
      console.error("Error fetching issues:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  useEffect(() => {
    if (!showMap || !user) return;

    const initMap = async () => {
      const { lat, lng } = await getCoordinatesFromPostalCode(
        user.postalCode,
        user.location
      );

      const center = fromLonLat([lng, lat]);

      if (!olMap.current) {
        olMap.current = new Map({
          target: mapRef.current,
          layers: [
            new TileLayer({ source: new OSM() }),
            vectorLayerRef.current,
          ],
          view: new View({
            center,
            zoom: 14,
          }),
        });
      } else {
        olMap.current.setTarget(mapRef.current);
        olMap.current.getView().setCenter(center);
        olMap.current.getView().setZoom(14);
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
          if (!lng || !lat || isNaN(lng) || isNaN(lat)) return null;

          const priority = (issue.priority || "").toLowerCase();
          let iconSrc = CleanStreetPointer;
          if (priority === "high") iconSrc = RedPointer;
          else if (priority === "medium") iconSrc = YellowPointer;
          else if (priority === "low") iconSrc;

          const feature = new Feature({
            geometry: new Point(fromLonLat([Number(lng), Number(lat)])),
          });

          feature.setStyle(
            new Style({
              image: new Icon({
                src: iconSrc,
                scale: 0.06,
                anchor: [0.5, 1],
                // color: color,
              }),
            })
          );

          return feature;
        })
        .filter(Boolean);

      vectorSourceRef.current.addFeatures(features);

      setTimeout(() => {
        olMap.current.updateSize();
        olMap.current.getView().setCenter(center);
      }, 400);
    };

    initMap();

    return () => {
      if (olMap.current) olMap.current.setTarget(null);
    };
  }, [showMap, user, mapIssues]);

  const getStatusClass = (status) => {
    const s = (status || "").toLowerCase();
    if (s === "resolved") return "status-resolved";
    if (s === "reported") return "status-reported";
    if (s === "updated") return "status-updated";
    if (s === "in progress") return "status-in-progress";
    return "";
  };

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-title">Dashboard</h1>
      <p className="dashboard-subtitle">
        See what issues your community is reporting and show your support
      </p>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <i className="bi bi-exclamation-triangle"></i>
          <h2>{stats.totalIssues}</h2>
          <p>Total Issues (your area)</p>
        </div>
        <div className="stat-card">
          <i class="bi bi-clock-history"></i>
          <h2>{stats.pending}</h2>
          <p>Pending</p>
        </div>
        <div className="stat-card">
          <i className="bi bi-hourglass-split"></i>
          <h2>{stats.inProgress}</h2>
          <p>In Progress</p>
        </div>
        <div className="stat-card">
          <i className="bi bi-check2-circle"></i>
          <h2>{stats.resolved}</h2>
          <p>Resolved</p>
        </div>
      </div>

      {/* Recent Activity + Quick Actions */}
      <div className="activity-actions-container">
        <div className="activity-section">
          <h3>Recent Activity (your area)</h3>
          <div className="activity-table">
            {activities.length ? (
              activities.map((a) => (
                <div key={a._id} className="activity-row">
                  <div className="activity-left">
                    <i
                      className={`bi ${
                        a.status === "resolved"
                          ? "bi-check2-circle"
                          : a.status === "reported"
                          ? "bi-plus-circle"
                          : " bi-hourglass-split"
                      }`}
                    ></i>
                    <div>
                      <h4>{a.title}</h4>
                      <p>{new Date(a.createdAt).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <span
                    className={`activity-status ${getStatusClass(a.status)}`}
                  >
                    {a.status
                      ? a.status.charAt(0).toUpperCase() + a.status.slice(1)
                      : "Reported"}
                  </span>
                </div>
              ))
            ) : (
              <p className="no-activity">No recent activity in your area</p>
            )}
          </div>
        </div>

        <div className="quick-actions">
          <h3>Quick Actions</h3>
          <Link to="/report-issue" className="btns primary">
            <i className="bi bi-plus-lg me-2"></i> Report New Issue
          </Link>

          <Link to="/complaints" className="btns secondary">
            <i className="bi bi-list-ul me-2"></i> View All Complaints
          </Link>

          <button className="btns secondary" onClick={() => setShowMap(true)}>
            <i className="bi bi-geo-alt-fill me-2"></i> Issue Map
          </button>
        </div>
      </div>

      {/* Map Modal */}
      {showMap && (
        <div className="modal-overlay" onClick={() => setShowMap(false)}>
          <div
            className="modal-box map-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Reported Issues Map</h2>
            <div ref={mapRef} id="issueMap" className="map-container"></div>
            <button className="btn close-btn" onClick={() => setShowMap(false)}>
              <i className="bi bi-x-lg"></i> Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
