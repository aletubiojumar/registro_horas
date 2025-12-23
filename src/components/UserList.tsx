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

  const [query, setQuery] = React.useState("");

  const normalizedQuery = query.trim().toLowerCase();

  const filteredUsers = React.useMemo(() => {
    if (!normalizedQuery) return users;

    return users.filter((u) => {
      const haystack = [
        u.fullName,
        u.email,
        u.role,
        u.workerFirstName,
        u.workerLastName,
        u.workerNif,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [users, normalizedQuery]);


  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {filteredUsers.map((u) => {
        const selected = selectedUser?.id === u.id;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {/* Buscador */}
            <div style={{ display: "flex", gap: "0.35rem" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre, email, rol, NIF…"
                style={{
                  width: "100%",
                  padding: "0.45rem 0.6rem",
                  borderRadius: "0.45rem",
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.cardBg,
                  color: theme.text,
                  outline: "none",
                  fontSize: "0.85rem",
                }}
              />
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  style={{
                    padding: "0.45rem 0.6rem",
                    borderRadius: "0.45rem",
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.cardBg,
                    color: theme.muted,
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    whiteSpace: "nowrap",
                  }}
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Resultado vacío */}
            {!filteredUsers.length ? (
              <p style={{ color: theme.muted, fontSize: "0.85rem", marginTop: "0.25rem" }}>
                No hay usuarios que coincidan.
              </p>
            ) : (
              filteredUsers.map((u) => {
                const selected = selectedUser?.id === u.id;

                return (
                  <div key={u.id} style={itemStyle(selected)}>
                    {/* ... el resto igual ... */}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </div>
  );
};

export default UserList;