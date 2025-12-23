import React from "react";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  vacationDaysPerYear?: number;
  workCenter?: string;
  companyCif?: string;
  companyCcc?: string;
  workerLastName?: string;
  workerFirstName?: string;
  workerNif?: string;
  workerSsNumber?: string;
}

type Theme = {
  darkMode: boolean;
  border: string;
  text: string;
  muted: string;
  cardBg: string;
  primary: string;
  dangerBg: string;
  dangerText: string;
};

interface UserListProps {
  users: AdminUser[];
  selectedUser: AdminUser | null;
  onSelect: (user: AdminUser) => void;
  onToggleActive: (user: AdminUser) => void;
  onDeleteUser: (user: AdminUser) => void;
  theme: Theme;
}

const UserList: React.FC<UserListProps> = ({
  users,
  selectedUser,
  onSelect,
  onToggleActive,
  onDeleteUser,
  theme,
}) => {
  if (!users.length) {
    return <p style={{ color: theme.muted }}>No hay usuarios.</p>;
  }

  const itemStyle = (selected: boolean): React.CSSProperties => ({
    padding: "0.6rem 0.65rem",
    borderRadius: "0.5rem",
    border: selected
      ? `1px solid ${theme.primary}`
      : `1px solid ${theme.border}`,
    backgroundColor: selected
      ? theme.darkMode
        ? "#0b3a6f" // azul oscuro elegante
        : "#dbeafe"
      : theme.cardBg,
    color: theme.text,
    transition: "background-color 0.15s ease, border-color 0.15s ease",
  });

  const actionBtn = (
    bg: string,
    border: string,
    color: string
  ): React.CSSProperties => ({
    fontSize: "0.75rem",
    padding: "0.2rem 0.45rem",
    borderRadius: "0.3rem",
    border: `1px solid ${border}`,
    backgroundColor: bg,
    color,
    cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {users.map((u) => {
        const selected = selectedUser?.id === u.id;

        return (
          <div key={u.id} style={itemStyle(selected)}>
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

              <div style={{ fontSize: "0.75rem", color: theme.muted }}>
                {u.email} · {u.role}
              </div>

              <div
                style={{
                  fontSize: "0.75rem",
                  color: u.isActive ? "#22c55e" : "#ef4444",
                }}
              >
                {u.isActive ? "Activo" : "Baja"}
              </div>
            </button>

            <div
              style={{
                marginTop: "0.35rem",
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.35rem",
              }}
            >
              <button
                type="button"
                onClick={() => onToggleActive(u)}
                style={
                  u.isActive
                    ? actionBtn(
                        theme.darkMode ? "#3b0f18" : "#fee2e2",
                        theme.dangerText,
                        theme.dangerText
                      )
                    : actionBtn(
                        theme.darkMode ? "#0f2a1a" : "#dcfce7",
                        "#22c55e",
                        "#22c55e"
                      )
                }
              >
                {u.isActive ? "Desactivar" : "Activar"}
              </button>

              <button
                type="button"
                onClick={() => onDeleteUser(u)}
                style={actionBtn(
                  theme.darkMode ? "#3b0f18" : "#fee2e2",
                  theme.dangerText,
                  theme.dangerText
                )}
              >
                Eliminar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UserList;
