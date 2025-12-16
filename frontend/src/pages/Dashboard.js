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
    return { lat: 17.385, lng: 78.4867 };
  } catch (err) {
    return { lat: 17.385, lng: 78.4867 };
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

      uniqueIssues.forEach((issue) => {
        const issuePostal = (issue.postalCode || "").toString().trim();
        if (userPostal && issuePostal && issuePostal === userPostal)
          myAreaIssues.push(issue);
      });

      const sortedArea = myAreaIssues.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      setActivities(sortedArea.slice(0, 4));
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

          const feature = new Feature({
            geometry: new Point(fromLonLat([Number(lng), Number(lat)])),
          });

          feature.setStyle(
            new Style({
              image: new Icon({
                src: iconSrc,
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
  }, [showMap, user, mapIssues]);

  const getStatusClass = (status) => {
    const s = (status || "").toLowerCase().replace(" ", "");
    return `status-${s}`;
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1 className="dashboard-title">My Dashboard</h1>
        <p className="dashboard-subtitle">
          See what issues your community is reporting and show your support.
        </p>
      </header>

      {/* Stats Grid */}
      <div className="stats-grids">
        <div className="stat-cards">
          <div className="stat-icon-wrappers">
            <i className="bi bi-geo-alt"></i>
          </div>
          <div className="stat-labels">
            <i className="bi bi-files"></i> Local Reports
          </div>
          <div className="stat-values">{stats.totalIssues}</div>
        </div>
        <div className="stat-cards">
          <div className="stat-icon-wrappers">
            <i className="bi bi-clock"></i>
          </div>
          <div className="stat-labels">
            <i className="bi bi-clock"></i> Pending
          </div>
          <div className="stat-values">{stats.pending}</div>
        </div>
        <div className="stat-cards">
          <div className="stat-icon-wrappers">
            <i className="bi bi-hammer"></i>
          </div>
          <div className="stat-labels">
            <i className="bi bi-hourglass-split"></i> In Progress
          </div>
          <div className="stat-values">{stats.inProgress}</div>
        </div>
        <div className="stat-cards">
          <div className="stat-icon-wrappers">
            <i className="bi bi-trophy"></i>
          </div>
          <div className="stat-labels">
            <i className="bi bi-check2-circle"></i> Resolved
          </div>
          <div className="stat-values">{stats.resolved}</div>
        </div>
      </div>

      <div className="dashboard-content">
        {/* Left: Recent Activity */}
        <div className="content-section">
          <h3 className="section-titles">
            Recent Reports in Your Area
            <i className="bi bi-broadcast" style={{ opacity: 0.5 }}></i>
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
                            : "bi-geo-alt-fill"
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
              <div className="no-data">No recent activity in your area</div>
            )}
          </div>
        </div>

        {/* Right: Quick Actions */}
        <div className="content-section" style={{ height: "fit-content" }}>
          <h3 className="section-titles">Quick Actions</h3>
          <div className="actions-grid">
            <Link to="/report-issue" className="dashboard-btn btns-primary">
              <i className="bi bi-plus-circle-fill"></i> Report New Issue
            </Link>
            <Link to="/complaints" className="dashboard-btn btn-secondary">
              <i className="bi bi-list-check"></i> View All Complaints
            </Link>
            <button
              className="dashboard-btn btn-tertiary"
              onClick={() => setShowMap(true)}
            >
              <i className="bi bi-map-fill"></i> View Issue Map
            </button>
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {showMap && (
        <div className="modal-overlay" onClick={() => setShowMap(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Community Map</h2>
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

export default Dashboard;
