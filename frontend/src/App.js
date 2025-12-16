import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Layout/Navbar";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ReportIssue from "./pages/ReportIssue";
import ViewComplaints from "./pages/ViewComplaints";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import AdminReports from "./pages/AdminReports";
import AdminManageComplaints from "./pages/AdminManageComplaints";
import AdminUsers from "./pages/AdminUsers";
import "./App.css";

// Protected Route Component
const ProtectedRoute = ({ element: Component, ...rest }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Checking Authentication...</div>;
  }

  return user ? <Component {...rest} /> : <Navigate to="/login" replace />;
};

//  Admin Route Component
const AdminRoute = ({ element: Component, ...rest }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Checking Authorization...</div>;
  }
  if (!user || !["admin", "globaladmin"].includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Component {...rest} />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Navbar />
          <main className="main-content">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Routes (Requires Login) */}
              <Route
                path="/dashboard"
                element={<ProtectedRoute element={Dashboard} />}
              />
              <Route
                path="/report-issue"
                element={<ProtectedRoute element={ReportIssue} />}
              />
              <Route
                path="/complaints"
                element={<ProtectedRoute element={ViewComplaints} />}
              />
              <Route
                path="/profile"
                element={<ProtectedRoute element={Profile} />}
              />

              {/* Admin Protected Routes */}
              <Route
                path="/admin"
                element={<AdminRoute element={AdminDashboard} />}
              />
              <Route
                path="/admin/reports"
                element={<AdminRoute element={AdminReports} />}
              />
              <Route
                path="/admin/complaints"
                element={<AdminRoute element={AdminManageComplaints} />}
              />
              <Route
                path="/admin/users"
                element={<AdminRoute element={AdminUsers} />}
              />

              {/* Fallback to main admin dashboard for any admin route */}
              <Route
                path="/admin/*"
                element={<AdminRoute element={AdminDashboard} />}
              />

              {/* Fallback 404 Route */}
              <Route
                path="*"
                element={
                  <div className="container">
                    <h1>404 Not Found</h1>
                  </div>
                }
              />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
