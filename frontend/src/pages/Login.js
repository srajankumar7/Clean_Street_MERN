import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import Swal from "sweetalert2";
import { reverseGeocode } from "../utils/MapUtils";
import "./Auth.css";

const API_URL = "http://localhost:5000/api/auth";

const Login = () => {
  // Use loginWithToken to update context correctly
  const { login, register, loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isRegister, setIsRegister] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
    otp: "",
  });

  const [regData, setRegData] = useState({
    fullName: "",
    username: "",
    email: "",
    phone: "",
    location: "",
    password: "",
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("mode") === "register") setIsRegister(true);
  }, [location.search]);

  const handleLoginChange = (e) =>
    setLoginData((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleRegChange = (e) =>
    setRegData((p) => ({ ...p, [e.target.name]: e.target.value }));

  // SweetAlert2 helpers
  const swalError = (title = "Error", text = "") =>
    Swal.fire({
      icon: "error",
      title,
      text,
      background: "linear-gradient(to bottom, #D3F1DE, #81B79D)",
      color: "#1B1B1B",
      confirmButtonColor: "#005347",
      timer: 3000,
      timerProgressBar: true,
    });

  const swalSuccess = (title = "Success", text = "") =>
    Swal.fire({
      icon: "success",
      title,
      text,
      background: "linear-gradient(to bottom, #D3F1DE, #81B79D)",
      color: "#1B1B1B",
      confirmButtonColor: "#005347",
      timer: 3000,
      timerProgressBar: true,
    });

  const swalInfo = (title = "Info", text = "") =>
    Swal.fire({
      icon: "info",
      title,
      text,
      background: "linear-gradient(to bottom, #D3F1DE, #81B79D)",
      color: "#1B1B1B",
      confirmButtonColor: "#005347",
      timer: 3000,
      timerProgressBar: true,
    });

  // --- LOGIN SUBMISSION ---
  const submitLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (forgotMode) {
        // --- OTP VERIFICATION SUBMISSION ---
        const response = await axios.post(`${API_URL}/verify-otp`, {
          email: loginData.email,
          otp: loginData.otp,
        });

        if (response.data?.success) {
          const { user, token } = response.data;

          // Use loginWithToken from AuthContext to properly set state, axios header and localStorage
          if (loginWithToken) {
            loginWithToken(token, user);
          } else {
            // Fallback: set localStorage and axios header if loginWithToken missing
            localStorage.setItem("token", token);
            localStorage.setItem("user", JSON.stringify(user));
            axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          }

          await swalSuccess("OTP verified", "Access granted. Redirecting...");

          // Redirect now that the global user state is updated
          if (user?.role === "admin") navigate("/admin");
          else navigate("/dashboard");
        } else {
          const msg = response.data?.message || "Invalid or expired OTP.";
          swalError("OTP Error", msg);
        }
      } else {
        // --- STANDARD PASSWORD LOGIN SUBMISSION (Existing stable logic) ---
        const res = await login(loginData.email, loginData.password);

        if (res?.success) {
          await swalSuccess("Login successful", "Redirecting...");
          if (res.user?.role === "admin") navigate("/admin");
          else navigate("/dashboard");
        } else {
          const msg = res?.message || "Invalid credentials.";
          swalError("Login failed", msg);
        }
      }
    } catch (err) {
      console.error("Login Submission Error:", err);
      const msg = err.response?.data?.message || "Network or server error.";
      swalError("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // --- REGISTRATION SUBMISSION ---
  const submitRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: regData.fullName,
        username: regData.username,
        email: regData.email,
        phone: regData.phone || undefined,
        location: regData.location,
        password: regData.password,
      };
      const res = await register(payload);
      if (res?.success) {
        await swalSuccess(
          "Account created",
          "Welcome — redirecting to dashboard..."
        );
        navigate("/dashboard");
      } else {
        const msg = res?.message || "Registration failed.";
        swalError("Registration failed", msg);
      }
    } catch (err) {
      console.error("Registration error:", err);
      const msg =
        err.response?.data?.message || "Server error during registration.";
      swalError("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // --- FORGOT PASSWORD: TRIGGER OTP SENDING ---
  const requestOtp = async () => {
    if (!loginData.email) {
      const msg = "Please enter your email to request a reset code.";
      swalError("Missing email", msg);
      return;
    }
    setLoading(true);

    try {
      const response = await axios.post(`${API_URL}/send-otp`, {
        email: loginData.email,
      });

      if (response.data.success) {
        swalInfo(
          "OTP sent",
          response.data.message || "If an account exists, an OTP has been sent."
        );
        setForgotMode(true);
      } else {
        const msg = response.data.message || "Failed to request reset code.";
        swalError("Request failed", msg);
      }
    } catch (err) {
      console.error("requestOtp error:", err);
      const msg = "Could not connect to server to request reset code.";
      swalError("Network error", msg);
    } finally {
      setLoading(false);
    }
  };

  // --- GEOLOCATION: GET CURRENT LOCATION (FIXED TO RETURN FULL ADDRESS) ---
  const fillCurrentLocation = () => {
    if (!navigator.geolocation) {
      const msg = "Geolocation is not supported by your browser.";
      swalError("Geolocation", msg);
      return;
    }
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let locationString = `Lat: ${lat.toFixed(6)}, Lng: ${lon.toFixed(6)}`;

        try {
          // --- CALL REVERSE GEOCODING (Nominatim) ---
          locationString = await reverseGeocode(lon, lat);
        } catch (apiError) {
          console.error("Reverse Geocoding Failed:", apiError);
          const msg =
            "Location found, but failed to get street address. Coordinates used.";
          swalInfo("Location", msg);
        }

        // Update form state with the full address (or coordinates as fallback)
        setRegData((p) => ({ ...p, location: locationString }));
        setLoading(false);
        swalSuccess("Location Updated", "Address fetched and updated.");
      },
      (err) => {
        const msg = "Unable to get location: " + err.message;
        swalError("Location error", msg);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleForgotMode = () => {
    if (forgotMode) setForgotMode(false);
    else requestOtp();
  };

  const flipToRegister = () => {
    setIsRegister(true);
    setForgotMode(false);
  };
  const flipToLogin = () => {
    setIsRegister(false);
    setForgotMode(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className={`auth-card-3d ${isRegister ? "flipped" : ""}`}>
          {/* FRONT - LOGIN */}
          <div className="auth-face auth-face-front">
            <div className="auth-header">
              <h1>Login to CleanStreet</h1>
              <h2>Join us and start cleaning up the streets!</h2>
            </div>
            <div className="cleanicon" />

            <form className="auth-form face-font" onSubmit={submitLogin}>
              <div className="forms-group">
                <label className="forms-label">Email</label>
                <div className="input-group">
                  <i className="bi bi-envelope" />
                  <input
                    name="email"
                    type="email"
                    className="forms-control"
                    placeholder="your.email@example.com"
                    value={loginData.email}
                    onChange={handleLoginChange}
                    required
                  />
                </div>
              </div>

              {!forgotMode && (
                <div className="forms-group">
                  <label className="forms-label">Password</label>
                  <div className="input-group">
                    <i className="bi bi-lock" />
                    <input
                      name="password"
                      type="password"
                      className="forms-control"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={handleLoginChange}
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              )}

              {forgotMode && (
                <div className="forms-group">
                  <label className="forms-label">OTP</label>
                  <div className="input-group">
                    <i className="bi bi-key" />
                    <input
                      name="otp"
                      type="text"
                      className="forms-control"
                      placeholder="Enter the OTP sent to your email"
                      value={loginData.otp}
                      onChange={handleLoginChange}
                      required
                    />
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  type="button"
                  className="link-btn small"
                  onClick={toggleForgotMode}
                  disabled={loading}
                >
                  {forgotMode ? "Back to password" : "Forgot password?"}
                </button>

                <button
                  type="button"
                  className="link-btn small"
                  onClick={flipToRegister}
                  disabled={loading}
                >
                  New here? Register
                </button>
              </div>

              <div className="forms-actions">
                <button
                  type="submit"
                  className="btn auth-btn-primary"
                  disabled={loading}
                >
                  {loading
                    ? forgotMode
                      ? "Verifying..."
                      : "Logging in..."
                    : forgotMode
                    ? "Verify OTP"
                    : "Login"}
                </button>
              </div>
            </form>
          </div>

          {/* BACK - REGISTER */}
          <div className="auth-face auth-face-back">
            <div className="auth-header">
              <h1>Create Account</h1>
              <h2>Join us and start cleaning up the streets!</h2>
            </div>

            <form className="auth-form" onSubmit={submitRegister}>
              <div className="forms-row two-columns">
                <div className="forms-col">
                  <label className="forms-label">Full Name</label>
                  <div className="input-group">
                    <i className="bi bi-person" />
                    <input
                      name="fullName"
                      type="text"
                      className="forms-control"
                      placeholder="your name"
                      value={regData.fullName}
                      onChange={handleRegChange}
                      required
                    />
                  </div>
                </div>

                <div className="forms-col">
                  <label className="forms-label">Username</label>
                  <div className="input-group">
                    <i className="bi bi-at" />
                    <input
                      name="username"
                      type="text"
                      className="forms-control"
                      placeholder="your username"
                      value={regData.username}
                      onChange={handleRegChange}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="forms-group">
                <label className="forms-label">Email</label>
                <div className="input-group">
                  <i className="bi bi-envelope" />
                  <input
                    name="email"
                    type="email"
                    className="forms-control"
                    placeholder="your.email@example.com"
                    value={regData.email}
                    onChange={handleRegChange}
                    required
                  />
                </div>
              </div>

              <div className="forms-row two-columns">
                <div className="forms-col">
                  <label className="forms-label">Phone (Optional)</label>
                  <div className="input-group">
                    <i className="bi bi-telephone" />
                    <input
                      name="phone"
                      type="tel"
                      className="forms-control"
                      placeholder="e.g., +91 999 123 4567"
                      value={regData.phone}
                      onChange={handleRegChange}
                    />
                  </div>
                </div>

                <div className="forms-col">
                  <label className="forms-label">Location</label>
                  <div className="location-row">
                    <i className="bi bi-geo-alt" />
                    <input
                      name="location"
                      type="text"
                      className="forms-control location-input"
                      placeholder="Enter your city or click to locate"
                      value={regData.location}
                      onChange={handleRegChange}
                      required
                    />
                    <button
                      type="button"
                      className="location-btn"
                      onClick={fillCurrentLocation}
                      disabled={loading}
                      title="Use my location"
                    >
                      <i className="bi bi-geo-fill" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="forms-group">
                <label className="forms-label">Password</label>
                <div className="input-group">
                  <i className="bi bi-lock" />
                  <input
                    name="password"
                    type="password"
                    className="forms-control"
                    placeholder="Create a strong password"
                    value={regData.password}
                    onChange={handleRegChange}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <button
                  type="button"
                  className="link-btn small"
                  onClick={flipToLogin}
                >
                  Already have an account? Login
                </button>
              </div>

              <div className="forms-actions">
                <button
                  type="submit"
                  className="btn auth-btn-primary"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Register"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
