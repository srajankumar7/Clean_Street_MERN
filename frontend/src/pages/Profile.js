import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";
import axios from "axios";
import { reverseGeocode } from "../utils/MapUtils";
import "./Profile.css";

const swalOptions = (icon, title, text) => ({
  icon,
  title,
  text,
  background: "linear-gradient(to bottom, #F0FFF4, #E6F4EA)",
  color: "#05302f",
  confirmButtonColor: "#16594f",
});

const placeCaretAtEnd = (element) => {
  try {
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch (e) {}
};

const Profile = () => {
  const { user, updateProfile } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");
  const [editMode, setEditMode] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.name || "",
    username: user?.username || "",
    phone: user?.phone || "",
    location: user?.location || "",
    bio: user?.bio || "",
  });

  // Security tab states
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    if (editMode) {
      setTimeout(() => {
        const fields = document.querySelectorAll(".editable-field");
        fields.forEach((el) => placeCaretAtEnd(el));
      }, 0);
    }
  }, [editMode]);

  const inlineEdit = (field, text) => {
    setFormData((prev) => ({ ...prev, [field]: text }));
  };

  const saveChanges = async () => {
    try {
      const result = await updateProfile({
        name: formData.name,
        username: formData.username,
        phone: formData.phone,
        location: formData.location,
        bio: formData.bio,
      });

      if (result?.success) {
        Swal.fire(
          swalOptions("success", "Saved", result.message || "Profile updated")
        );
        setEditMode(false);
      } else {
        Swal.fire(
          swalOptions("error", "Error", result?.message || "Update failed")
        );
      }
    } catch (err) {
      Swal.fire(
        swalOptions("error", "Error", "Unexpected error saving profile")
      );
    }
  };

  const cancelEdit = () => {
    setEditMode(false);
    setFormData({
      name: user?.name || "",
      username: user?.username || "",
      phone: user?.phone || "",
      location: user?.location || "",
      bio: user?.bio || "",
    });
  };

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      Swal.fire(
        swalOptions(
          "warning",
          "Not supported",
          "Geolocation is not supported by this browser."
        )
      );
      return;
    }

    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let address = `Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`;

        try {
          const resolved = await reverseGeocode(lon, lat);
          if (resolved) address = resolved;
        } catch (err) {}

        inlineEdit("location", address);
        setLocationLoading(false);

        setTimeout(() => {
          const el = document.querySelector(".editable-field.location-text");
          if (el) placeCaretAtEnd(el);
        }, 0);
      },
      (err) => {
        setLocationLoading(false);
        Swal.fire(
          swalOptions(
            "error",
            "Location error",
            err?.message || "Unable to fetch location."
          )
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const sendOtp = async () => {
    if (!user?.email) {
      Swal.fire(
        swalOptions(
          "warning",
          "No email",
          "Your account doesn't have an email."
        )
      );
      return;
    }
    try {
      setSendingOtp(true);
      const resp = await axios.post("http://localhost:5000/api/auth/send-otp", {
        email: user.email,
      });
      if (resp?.data?.success) {
        setOtpSent(true);
        Swal.fire(swalOptions("success", "OTP Sent", "Check your email."));
      } else {
        Swal.fire(
          swalOptions("error", "Error", resp.data?.message || "Failed.")
        );
      }
    } catch (err) {
      Swal.fire(swalOptions("error", "Error", "Server error sending OTP."));
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) return;
    try {
      setVerifyingOtp(true);
      const resp = await axios.post(
        "http://localhost:5000/api/auth/verify-otp-only",
        { email: user.email, otp }
      );
      if (resp?.data?.success) {
        setOtpVerified(true);
        Swal.fire(swalOptions("success", "Verified", "OTP verified."));
      } else {
        Swal.fire(swalOptions("error", "Invalid", "Invalid OTP."));
      }
    } catch (err) {
      Swal.fire(swalOptions("error", "Error", "Server error verifying OTP."));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const updatePassword = async () => {
    if (!otpVerified) {
      Swal.fire(
        swalOptions("warning", "OTP required", "Please verify OTP first.")
      );
      return;
    }
    if (newPassword !== confirmNewPassword) {
      Swal.fire(swalOptions("error", "Mismatch", "Passwords don't match."));
      return;
    }

    try {
      setUpdatingPassword(true);
      const resp = await axios.post(
        "http://localhost:5000/api/auth/reset-password",
        {
          email: user.email,
          otp,
          newPassword,
        }
      );
      if (resp?.data?.success) {
        Swal.fire(swalOptions("success", "Updated", "Password updated."));
        setOtp("");
        setOtpSent(false);
        setOtpVerified(false);
        setNewPassword("");
        setConfirmNewPassword("");
      } else {
        Swal.fire(swalOptions("error", "Error", "Failed to update password."));
      }
    } catch (err) {
      Swal.fire(swalOptions("error", "Error", "Server error."));
    } finally {
      setUpdatingPassword(false);
    }
  };

  const avatarInitial = user?.name ? user.name.charAt(0).toUpperCase() : "?";

  return (
    <div className="profile-page">
      <div className="container">
        <div className="profile-header">
          <h1>My Profile</h1>
        </div>

        <div className="profile-layout">
          {/* Sidebar */}
          <div className="profile-sidebar">
            <div className="users-card">
              <div className="user-avatar">{avatarInitial}</div>
              <div className="user-info-block">
                <h3>{user?.name}</h3>
                <p>@{user?.username}</p>
                <p className="user-role">{user?.role}</p>
              </div>
            </div>

            <div className="profile-nav">
              <button
                className={`nav-item ${
                  activeTab === "profile" ? "active" : ""
                }`}
                onClick={() => setActiveTab("profile")}
              >
                <i className="bi bi-person-fill" />{" "}
                <span>Personal Details</span>
              </button>

              <button
                className={`nav-item ${
                  activeTab === "security" ? "active" : ""
                }`}
                onClick={() => setActiveTab("security")}
              >
                <i className="bi bi-lock-fill" />{" "}
                <span>Security & Privacy</span>
              </button>
            </div>
          </div>

          {/* Main Panel */}
          <div className={`profile-content ${editMode ? "editing" : ""}`}>
            {activeTab === "profile" && (
              <>
                <div className="tab-header">
                  <h2>{editMode ? "Edit Profile" : "Personal Details"}</h2>
                  {!editMode && (
                    <button
                      className="btn btn-secondarys"
                      onClick={() => setEditMode(true)}
                    >
                      <i className="bi bi-pencil-square" /> Edit
                    </button>
                  )}
                </div>

                <div className="profile-grid">
                  {/* Name & Username */}
                  <div className="inline-two">
                    <div className="inline-group">
                      <label>Name</label>
                      <div
                        className="editable-field"
                        contentEditable={editMode}
                        suppressContentEditableWarning={true}
                        onBlur={(e) =>
                          inlineEdit("name", e.currentTarget.innerText)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                      >
                        {formData.name}
                      </div>
                    </div>

                    <div className="inline-group">
                      <label>Username</label>
                      <div
                        className="editable-field"
                        contentEditable={editMode}
                        suppressContentEditableWarning={true}
                        onBlur={(e) =>
                          inlineEdit("username", e.currentTarget.innerText)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                      >
                        {formData.username}
                      </div>
                    </div>
                  </div>

                  {/* Location */}
                  <div className="inline-group">
                    <label>Location</label>
                    <div className="location-row">
                      <div
                        className="editable-field location-text"
                        contentEditable={editMode}
                        suppressContentEditableWarning={true}
                        onBlur={(e) =>
                          inlineEdit("location", e.currentTarget.innerText)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                      >
                        {formData.location}
                      </div>

                      {editMode && (
                        <button
                          className="location-btn"
                          onClick={fetchLocation}
                          disabled={locationLoading}
                        >
                          {locationLoading ? (
                            "..."
                          ) : (
                            <i className="bi bi-geo-alt-fill" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  <div className="inline-group">
                    <label>Bio</label>
                    <div
                      className="editable-field bio-field"
                      contentEditable={editMode}
                      suppressContentEditableWarning={true}
                      onBlur={(e) =>
                        inlineEdit("bio", e.currentTarget.innerText)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.ctrlKey) {
                          e.preventDefault();
                          e.currentTarget.blur();
                        }
                      }}
                    >
                      {formData.bio}
                    </div>
                  </div>

                  {/* Phone + Action */}
                  <div className="inline-row-action">
                    <div className="inline-group phone-field">
                      <label>Phone</label>
                      <div
                        className="editable-field"
                        contentEditable={editMode}
                        suppressContentEditableWarning={true}
                        onBlur={(e) =>
                          inlineEdit("phone", e.currentTarget.innerText)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && e.ctrlKey) {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                      >
                        {formData.phone}
                      </div>
                    </div>

                    {editMode && (
                      <div className="action-buttons-inline">
                        <button
                          className="btn btn-outline"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={saveChanges}
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === "security" && (
              <div className="security-fields">
                <h2>Password Reset</h2>
                <label>Email</label>
                <p>{user?.email || "No email set"}</p>

                <div className="security-line">
                  <input
                    type="text"
                    className="security-input"
                    placeholder="OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />

                  {!otpSent ? (
                    <button
                      className="btn btn-primary"
                      onClick={sendOtp}
                      disabled={sendingOtp}
                    >
                      {sendingOtp ? "Sending..." : "Send OTP"}
                    </button>
                  ) : !otpVerified ? (
                    <button
                      className="btn btn-primary"
                      onClick={verifyOtp}
                      disabled={verifyingOtp}
                    >
                      {verifyingOtp ? "Verifying..." : "Verify OTP"}
                    </button>
                  ) : (
                    <span className="verified">✓ Verified</span>
                  )}
                </div>

                {otpVerified && (
                  <>
                    <input
                      type="password"
                      className="security-input"
                      placeholder="New Password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <input
                      type="password"
                      className="security-input"
                      placeholder="Confirm Password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={updatePassword}
                      disabled={updatingPassword}
                    >
                      {updatingPassword ? "Updating..." : "Update Password"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
