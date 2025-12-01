import React from "react";

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  email?: string;
  vacationDaysPerYear?: number;
}

interface UserListProps {
  users: AdminUser[];
  selectedUser: AdminUser | null;
  onSelect: (user: AdminUser) => void;
  onToggleActive: (user: AdminUser) => void;
  onDeleteUser: (user: AdminUser) => void;
}

const UserList: React.FC<UserListProps> = ({
  users,
  selectedUser,
  onSelect,
  onToggleActive,
  onDeleteUser,
}) => {
  if (!users.length) {
    return <p>No hay usuarios.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      {users.map((u) => (
        <div
          key={u.id}
          style={{
            padding: "0.4rem 0.5rem",
            borderRadius: "0.375rem",
            border:
              selectedUser?.id === u.id
                ? "1px solid #2563eb"
                : "1px solid #e5e7eb",
            backgroundColor:
              selectedUser?.id === u.id ? "#dbeafe" : "#f9fafb",
          }}
        >
          <button
            type="button"
            onClick={() => onSelect(u)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "block",
              width: "100%",
            }}
          >
            <div style={{ fontWeight: 600 }}>{u.fullName}</div>
            <div style={{ fontSize: "0.75rem", color: "#4b5563" }}>
              {u.username} · {u.role}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: u.isActive ? "#16a34a" : "#dc2626",
              }}
            >
              {u.isActive ? "Activo" : "Baja"}
            </div>
          </button>

          <div
            style={{
              marginTop: "0.25rem",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.25rem",
            }}
          >
            <button
              type="button"
              onClick={() => onToggleActive(u)}
              style={{
                fontSize: "0.75rem",
                padding: "0.15rem 0.4rem",
                borderRadius: "0.25rem",
                border: "1px solid #d1d5db",
                backgroundColor: u.isActive ? "#fee2e2" : "#dcfce7",
                color: u.isActive ? "#b91c1c" : "#166534",
                cursor: "pointer",
              }}
            >
              {u.isActive ? "Desactivar" : "Activar"}
            </button>

            <button
              type="button"
              onClick={() => onDeleteUser(u)}
              style={{
                fontSize: "0.75rem",
                padding: "0.15rem 0.4rem",
                borderRadius: "0.25rem",
                border: "1px solid #fecaca",
                backgroundColor: "#fee2e2",
                color: "#b91c1c",
                cursor: "pointer",
              }}
            >
              Eliminar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default UserList;
