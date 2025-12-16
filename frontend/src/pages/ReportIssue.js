import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import "./ReportIssue.css";
import "ol/ol.css";
import Swal from "sweetalert2";
// OpenLayers Imports
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import Point from "ol/geom/Point";
import Feature from "ol/Feature";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import Style from "ol/style/Style";
import Icon from "ol/style/Icon";
import { toLonLat } from "ol/proj";

import { reverseGeocode, getInitialCenterForAddress } from "../utils/MapUtils";

const API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/issues`
  : "http://localhost:5000/api/issues";

const ReportIssue = () => {
  const { user } = useAuth();
  const mapElement = useRef();

  // Map state management
  const [map, setMap] = useState(null);
  const [markerSource] = useState(new VectorSource());
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    issueType: "",
    priority: "medium",
    address: "",
    landmark: "",
    description: "",
  });

  // Image state (array)
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]); // array of object URLs
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // percent number or null

  const issueTypes = [
    { value: "pothole", label: "Pothole", icon: "bi-cone-striped" },
    { value: "garbage", label: "Garbage Dump", icon: "bi-trash3" },
    {
      value: "streetlight",
      label: "Broken Streetlight",
      icon: "bi-lightbulb-off",
    },
    { value: "water_leak", label: "Water Leak", icon: "bi-droplet" },
    { value: "other", label: "Other", icon: "bi-exclamation-circle" },
  ];

  const priorityLevels = [
    { value: "low", label: "Low", icon: "bi-arrow-down-circle" },
    { value: "medium", label: "Medium", icon: "bi-dash-circle" },
    { value: "high", label: "High", icon: "bi-arrow-up-circle" },
  ];

  useEffect(() => {
    let mounted = true;
    const markerStyle = new Style({
      image: new Icon({
        anchor: [0.5, 1],
        src: "https://openlayers.org/en/latest/examples/data/icon.png",
      }),
    });

    const initMap = async () => {
      const centerProjected = await getInitialCenterForAddress(user?.location);

      const initialMap = new Map({
        target: mapElement.current,
        layers: [
          new TileLayer({ source: new OSM() }),
          new VectorLayer({ source: markerSource, style: markerStyle }),
        ],
        view: new View({
          center: centerProjected,
          zoom: 13,
        }),
      });

      if (!mounted) {
        initialMap.setTarget(undefined);
        return;
      }

      setMap(initialMap);

      initialMap.on("click", async (evt) => {
        const coords = toLonLat(evt.coordinate);
        setSelectedLocation(coords);

        markerSource.clear();
        const marker = new Feature({
          geometry: new Point(evt.coordinate),
        });
        markerSource.addFeature(marker);

        try {
          const addressString = await reverseGeocode(coords[0], coords[1]);
          setFormData((prev) => ({ ...prev, address: addressString }));
        } catch (e) {
          console.error("Reverse geocode failed:", e);
          setFormData((prev) => ({
            ...prev,
            address: `Lat: ${coords[1].toFixed(6)}, Lon: ${coords[0].toFixed(
              6
            )}`,
          }));
        }
      });
    };

    initMap();

    return () => {
      mounted = false;
      if (map) {
        map.setTarget(undefined);
      }

      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [markerSource, user?.location]);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleImageChange = (e) => {
    const filesSelected = Array.from(e.target.files).slice(0, 3);

    imagePreviews.forEach((url) => URL.revokeObjectURL(url));

    setImageFiles(filesSelected);
    setImagePreviews(filesSelected.map((file) => URL.createObjectURL(file)));

    e.target.value = "";
  };

  const removeImage = (index) => {
    const urlToRevoke = imagePreviews[index];
    if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);

    const newFiles = imageFiles.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);

    setImageFiles(newFiles);
    setImagePreviews(newPreviews);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedLocation) {
      Swal.fire({
        icon: "warning",
        title: "Location Required",
        text: "Please select a location on the map by clicking on it.",
        background: "linear-gradient(to bottom, #D3F1DE, #81B79D)",
        color: "#1B1B1B",
        confirmButtonColor: "#005347",
      });
      return;
    }

    if (!formData.title || !formData.issueType || !formData.description) {
      Swal.fire({
        icon: "error",
        title: "Missing Information",
        text: "Please fill in all required fields.",
        background: "linear-gradient(to bottom, #D3F1DE, #81B79D)",
        color: "#1B1B1B",
        confirmButtonColor: "#005347",
      });
      return;
    }

    setLoading(true);
    setUploadProgress(null);

    const data = new FormData();
    Object.keys(formData).forEach((key) => data.append(key, formData[key]));

    imageFiles.forEach((file) => {
      data.append("images", file);
    });

    data.append("latitude", selectedLocation[1]);
    data.append("longitude", selectedLocation[0]);

    const token = localStorage.getItem("token");
    if (!token) {
      Swal.fire({
        icon: "error",
        title: "Authorization Failed",
        text: "Please log in again to submit an issue.",
        background: "linear-gradient(to bottom, #D3F1DE, #81B79D)",
        color: "#1B1B1B",
        confirmButtonColor: "#005347",
      });
      setLoading(false);
      return;
    }

    try {
      const response = await axios.post(API_URL, data, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
        timeout: 120000,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      });

      Swal.fire({
        icon: "success",
        title: "Issue Reported Successfully!",
        text: "Thank you for making your community better.",
        background: "linear-gradient(to bottom, #D3F1DE, #81B79D)",
        color: "#1B1B1B",
        confirmButtonColor: "#005347",
        timer: 3000,
        timerProgressBar: true,
      });

      setFormData({
        title: "",
        issueType: "",
        priority: "medium",
        address: "",
        landmark: "",
        description: "",
      });
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setImageFiles([]);
      setImagePreviews([]);
      setSelectedLocation(null);
      markerSource.clear();
      setUploadProgress(null);
    } catch (err) {
      console.error("Issue submit error:", err, {
        response: err?.response?.data,
      });
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to connect to server or report issue.";
      Swal.fire({
        icon: "error",
        title: "Submission Failed",
        text: errorMessage,
        background: "linear-gradient(to bottom, #D3F1DE, #81B79D)",
        color: "#1B1B1B",
        confirmButtonColor: "#005347",
      });
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  };

  if (!user) {
    return (
      <div className="report-issue-page">
        <div className="not-authorized">
          <h2>
            <i className="bi bi-lock"></i> You need to be logged in to submit
            civic issues.
          </h2>
          <p>Help make your community cleaner and safer by reporting issues.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-issue-page">
      <div className="containers">
        <div className="report-header">
          <h1>
            <i className="bi bi-megaphone"></i> Report Civic Issue
          </h1>
          <p>Help make your community cleaner and safer</p>
        </div>

        <div className="report-content-grid">
          {/* Form Section */}
          <div className="form-section">
            <h3>
              <i className="bi bi-card-checklist"></i> Issue Details
            </h3>
            <form onSubmit={handleSubmit} className="report-form">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-text-left"></i> Issue Title *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="Brief title for the issue"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-tags"></i> Issue Type *
                  </label>
                  <select
                    className="form-control"
                    name="issueType"
                    value={formData.issueType}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select type...</option>
                    {issueTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-speedometer2"></i> Priority Level *
                  </label>
                  <select
                    className="form-control"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    required
                  >
                    {priorityLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <i className="bi bi-signpost-2"></i> Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    name="landmark"
                    value={formData.landmark}
                    onChange={handleChange}
                    placeholder="Nearby landmark"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="bi bi-geo-alt"></i> Address (Click on map)
                </label>
                <input
                  type="text"
                  className="form-control"
                  name="address"
                  value={formData.address}
                  readOnly
                  placeholder="Select location on map"
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <i className="bi bi-pencil-square"></i> Description *
                </label>
                <textarea
                  className="form-control"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  placeholder="Describe the issue in detail..."
                  required
                ></textarea>
              </div>

              <div className="form-group">
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <label className="form-label">
                    <i className="bi bi-image"></i> Upload Images (Max 3)
                  </label>
                  {imageFiles.length === 0 && (
                    <p className="image-warning">
                      <i class="bi bi-exclamation-triangle"></i> Please upload
                      at least one image.
                    </p>
                  )}
                </div>
                <div className="custom-file-upload">
                  <span className="file-name-display">
                    {imageFiles.length === 0
                      ? "No files chosen"
                      : imageFiles.map((file) => file.name).join(", ")}
                  </span>
                  <button
                    type="button"
                    className="btn-upload"
                    onClick={() => document.getElementById("imageFile").click()}
                    title="Add/Replace images (max 3)"
                  >
                    <i className="bi bi-folder2-open"></i> Browse
                  </button>
                  <input
                    type="file"
                    id="imageFile"
                    className="file-input-hidden"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    required={imageFiles.length === 0}
                  />
                </div>
              </div>

              {/* Image Previews and Submit */}
              <div className="form-bottom-section">
                <div className="image-preview-list" aria-live="polite">
                  {imagePreviews.map((preview, idx) => (
                    <div
                      key={idx}
                      className="image-preview-container has-image"
                    >
                      <img src={preview} alt={`Preview ${idx + 1}`} />
                      <button
                        type="button"
                        className="remove-image-btn"
                        onClick={() => removeImage(idx)}
                        aria-label={`Remove image ${idx + 1}`}
                        title="Remove image"
                      >
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ minWidth: 160 }}>
                  {uploadProgress !== null && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#06332e",
                          marginBottom: 4,
                        }}
                      >
                        Uploading: {uploadProgress}%
                      </div>
                      <div
                        style={{
                          background: "#e6efe9",
                          borderRadius: 6,
                          height: 8,
                        }}
                      >
                        <div
                          style={{
                            width: `${uploadProgress}%`,
                            height: "100%",
                            background: "#16594f",
                            borderRadius: 6,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <i className="bi bi-hourglass-split spinning"></i>{" "}
                          Submitting...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-send"></i> Submit Issue
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Map Section */}
          <div className="form-section map-card">
            <h3>
              <i className="bi bi-map"></i> Select Location on Map
            </h3>
            <div ref={mapElement} className="map-placeholder"></div>
            {selectedLocation && (
              <div className="location-selected-text">
                <i className="bi bi-pin-map-fill"></i> Location selected
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportIssue;
