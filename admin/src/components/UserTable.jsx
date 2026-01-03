export default function UserTable({ users, onEdit, onToggleBlock }) {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Telegram ID</th>
            <th>Name</th>
            <th>Phone</th>
            <th>Daily Limit</th>
            <th>Used Today</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id}>
              <td>{user.telegramId}</td>
              <td>{user.firstName || user.username || "-"}</td>
              <td>{user.phone}</td>
              <td>{user.dailyLimit}</td>
              <td>{user.usedToday}</td>
              <td>
                <span
                  className={`badge ${
                    user.isBlocked ? "badge-blocked" : "badge-active"
                  }`}
                >
                  {user.isBlocked ? "Blocked" : "Active"}
                </span>
              </td>
              <td>{formatDate(user.createdAt)}</td>
              <td>
                <button
                  className="btn-small btn-edit"
                  onClick={() => onEdit(user)}
                >
                  Edit
                </button>
                <button
                  className={`btn-small ${
                    user.isBlocked ? "btn-unblock" : "btn-block"
                  }`}
                  onClick={() => onToggleBlock(user)}
                >
                  {user.isBlocked ? "Unblock" : "Block"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
