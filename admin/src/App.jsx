import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user has valid token
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return isAuthenticated ? (
    <Dashboard onLogout={() => setIsAuthenticated(false)} />
  ) : (
    <Login onLoginSuccess={() => setIsAuthenticated(true)} />
  );
}
