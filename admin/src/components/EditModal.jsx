import { useState } from "react";

export default function EditModal({ user, onClose, onSave }) {
  const [dailyLimit, setDailyLimit] = useState(user.dailyLimit);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSave(user._id, parseInt(dailyLimit));
      onClose();
    } catch (error) {
      alert("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Edit User Limit</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>User</label>
            <input
              type="text"
              value={`${user.firstName || user.username || "User"} (${
                user.phone
              })`}
              disabled
            />
          </div>

          <div className="form-group">
            <label>Daily Limit</label>
            <input
              type="number"
              min="0"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-save" disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
