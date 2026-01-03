import { useState, useEffect } from "react";
import { usersAPI, aiProvidersAPI } from "../services/api";
import UserTable from "../components/UserTable";
import EditModal from "../components/EditModal";
import AIConfig from "../components/AIConfig";
import { Users, Bot, LogOut, TrendingUp, Shield, Activity } from "lucide-react";

export default function Dashboard({ onLogout }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [globalLimit, setGlobalLimit] = useState("");
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState("users"); // "users" or "ai"

  // Load users
  const loadUsers = async () => {
    try {
      const data = await usersAPI.getAll();
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Calculate stats
  const stats = {
    totalUsers: users.length,
    activeUsers: users.filter((u) => !u.isBlocked).length,
    blockedUsers: users.filter((u) => u.isBlocked).length,
    todayUsage: users.reduce((sum, u) => sum + u.usedToday, 0),
  };

  // Handle edit user limit
  const handleEditUser = async (userId, dailyLimit) => {
    try {
      await usersAPI.updateLimit(userId, dailyLimit);
      await loadUsers();
    } catch (error) {
      throw error;
    }
  };

  // Handle block/unblock user
  const handleToggleBlock = async (user) => {
    const confirmed = window.confirm(
      `Bu foydalanuvchini ${
        user.isBlocked ? "blokdan chiqarish" : "bloklash"
      }ni xohlaysizmi?`
    );

    if (!confirmed) return;

    try {
      await usersAPI.toggleBlock(user._id, !user.isBlocked);
      await loadUsers();
    } catch (error) {
      alert("Foydalanuvchi statusini yangilab bo'lmadi");
    }
  };

  // Handle global limit update
  const handleGlobalLimitUpdate = async () => {
    const limit = parseInt(globalLimit);

    if (isNaN(limit) || limit < 0) {
      alert("Iltimos to'g'ri limit kiriting (0 yoki undan katta son)");
      return;
    }

    const confirmed = window.confirm(
      `Barcha foydalanuvchilarning kunlik limitini ${limit} ga o'zgartirmoqchimisiz?`
    );

    if (!confirmed) return;

    try {
      setUpdating(true);
      await usersAPI.updateGlobalLimit(limit);
      await loadUsers();
      setGlobalLimit("");
      alert(`Barcha foydalanuvchilar limiti ${limit} ga o'zgartirildi`);
    } catch (error) {
      alert("Xatolik yuz berdi");
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    onLogout();
  };

  if (loading) {
    return <div className="loading">Yuklanmoqda...</div>;
  }

  return (
    <div className="dashboard">
      <nav className="navbar">
        <div className="navbar-brand">
          <div className="brand-icon">
            <Bot size={28} />
          </div>
          <div className="brand-text">
            <h1>MathlyAi</h1>
            <span>Admin Paneli</span>
          </div>
        </div>
        <button className="btn-logout" onClick={handleLogout}>
          <LogOut size={18} />
          <span>Chiqish</span>
        </button>
      </nav>

      <div className="content">
        {/* Tabs */}
        <div className="tabs">
          <button
            className={`tab ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <Users size={18} />
            <span>Foydalanuvchilar</span>
          </button>
          <button
            className={`tab ${activeTab === "ai" ? "active" : ""}`}
            onClick={() => setActiveTab("ai")}
          >
            <Bot size={18} />
            <span>AI Sozlamalari</span>
          </button>
        </div>

        {activeTab === "users" ? (
          <>
            {/* Stats Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon users">
                  <Users size={24} />
                </div>
                <div className="stat-content">
                  <h3>Jami foydalanuvchilar</h3>
                  <div className="value">{stats.totalUsers}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon active">
                  <TrendingUp size={24} />
                </div>
                <div className="stat-content">
                  <h3>Faol foydalanuvchilar</h3>
                  <div className="value">{stats.activeUsers}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon blocked">
                  <Shield size={24} />
                </div>
                <div className="stat-content">
                  <h3>Bloklangan</h3>
                  <div className="value">{stats.blockedUsers}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon usage">
                  <Activity size={24} />
                </div>
                <div className="stat-content">
                  <h3>Bugungi foydalanish</h3>
                  <div className="value">{stats.todayUsage}</div>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="users-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <h2>Foydalanuvchilar boshqaruvi</h2>
                <div
                  style={{ display: "flex", gap: "10px", alignItems: "center" }}
                >
                  <input
                    type="number"
                    placeholder="Umumiy limit"
                    value={globalLimit}
                    onChange={(e) => setGlobalLimit(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      width: "120px",
                    }}
                    min="0"
                  />
                  <button
                    className="btn btn-primary"
                    onClick={handleGlobalLimitUpdate}
                    disabled={updating || !globalLimit}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {updating
                      ? "Yangilanmoqda..."
                      : "Barcha limitlarni yangilash"}
                  </button>
                </div>
              </div>
              {users.length === 0 ? (
                <p>Foydalanuvchilar yo'q</p>
              ) : (
                <UserTable
                  users={users}
                  onEdit={setEditingUser}
                  onToggleBlock={handleToggleBlock}
                />
              )}
            </div>
          </>
        ) : (
          <AIConfig aiProvidersAPI={aiProvidersAPI} />
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <EditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSave={handleEditUser}
        />
      )}
    </div>
  );
}
