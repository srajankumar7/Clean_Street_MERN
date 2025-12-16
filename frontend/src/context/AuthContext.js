import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

export const AuthContext = createContext();
const API_URL = "http://localhost:5000/api/auth";

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // initialize auth state from localStorage and set axios header if token exists
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken) {
      setToken(savedToken);
      axios.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
    }
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  // helper: set token + user in state, localStorage and axios header
  const loginWithToken = (newToken, newUser) => {
    if (!newToken) return;
    localStorage.setItem("token", newToken);
    if (newUser) {
      localStorage.setItem("user", JSON.stringify(newUser));
    }
    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(newUser || null);
  };

  const login = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/login`, {
        email,
        password,
      });
      const { user: respUser, token: respToken } = response.data;

      if (respUser && respUser.location && !respUser.postalCode) {
        const extracted = respUser.location.match(/\b\d{6}\b/);
        if (extracted) respUser.postalCode = extracted[0];
      }
      loginWithToken(respToken, respUser);

      return { success: true, user: respUser };
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        "Login failed. Please check your network.";
      return { success: false, message: errorMessage };
    }
  };

  const register = async (userData) => {
    try {
      const response = await axios.post(`${API_URL}/register`, userData);

      const { user: respUser, token: respToken } = response.data;

      loginWithToken(respToken, respUser);

      return { success: true, user: respUser };
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        "Registration failed. Please check your network.";
      return { success: false, message: errorMessage };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
  };

  const updateProfile = async (userData) => {
    const storedToken = localStorage.getItem("token");
    try {
      const response = await axios.put(`${API_URL}/profile`, userData, {
        headers: {
          Authorization: `Bearer ${storedToken}`,
        },
      });

      if (response.data.success) {
        const updatedUser = response.data.user;

        // Update local state and localStorage with the new data
        localStorage.setItem("user", JSON.stringify(updatedUser));
        setUser(updatedUser);

        return {
          success: true,
          user: updatedUser,
          message: response.data.message,
        };
      }
      return {
        success: false,
        message: response.data.message || "Update failed.",
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Server error during profile update.";
      return { success: false, message: errorMessage };
    }
  };
  const updatePassword = async (passwords) => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.put(
        `${API_URL}/change-password`,
        passwords,
        {
          // Use PUT /change-password
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.data.success) {
        return { success: true, message: response.data.message };
      }
      return {
        success: false,
        message: response.data.message || "Password change failed.",
      };
    } catch (error) {
      const errorMessage =
        error.response?.data?.message || "Server error during password update.";
      return { success: false, message: errorMessage };
    }
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    loading,
    updateProfile,
    updatePassword,
    loginWithToken,
    // setUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
