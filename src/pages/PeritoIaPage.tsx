import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

const API_BASE_URL: string = (import.meta as any).env?.VITE_API_BASE_URL ?? "/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface ChatListItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const PeritoIAPage: React.FC = () => {
  const { user } = useAuth();
  const token = (user as any)?.token as string | undefined;
  const userId = (user as any)?.id ?? (user as any)?.userId ?? "me";

  const lastChatKey = useMemo(() => `peritoia:lastChat:${userId}`, [userId]);

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    void loadChats(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChats = async (autoRestoreLast: boolean) => {
    try {
      const res = await fetch(`${API_BASE_URL}/perito-ia/chats`, {
        method: "GET",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`Error listando chats (${res.status})`);

      const data = await res.json();
      const list: ChatListItem[] = data.chats ?? [];
      setChats(list);

      if (!autoRestoreLast) return;

      const last = localStorage.getItem(lastChatKey);
      const candidate = last && list.some((c) => c.id === last) ? last : list[0]?.id;

      if (candidate) {
        await loadChatMessages(candidate);
      } else {
        setSelectedChatId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Error cargando chats:", err);
    }
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      setSelectedChatId(chatId);
      localStorage.setItem(lastChatKey, chatId);

      const res = await fetch(`${API_BASE_URL}/perito-ia/chats/${chatId}`, {
        method: "GET",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`Error cargando mensajes (${res.status})`);

      const data = await res.json();
      const rows = data.messages ?? [];

      const parsed: Message[] = rows.map((m: any) => ({
        id: String(m.id),
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp),
      }));

      setMessages(parsed);
    } catch (err) {
      console.error("Error cargando mensajes:", err);
    }
  };

  const createNewChat = () => {
    setSelectedChatId(null);
    setMessages([]);
    setInputMessage("");
    localStorage.removeItem(lastChatKey);
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Eliminar este chat?")) return;

    try {
      const res = await fetch(`${API_BASE_URL}/perito-ia/chats/${chatId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error(`Error eliminando chat (${res.status})`);

      setChats((prev) => prev.filter((c) => c.id !== chatId));

      if (selectedChatId === chatId) {
        createNewChat();
        const remaining = chats.filter((c) => c.id !== chatId);
        if (remaining[0]?.id) void loadChatMessages(remaining[0].id);
      }
    } catch (err) {
      console.error("Error eliminando chat:", err);
      alert("No se pudo eliminar el chat.");
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const text = inputMessage.trim();

    const userMessage: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/perito-ia/chat`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          chatId: selectedChatId,
          message: text,
        }),
      });
      if (!res.ok) throw new Error(`Error enviando mensaje (${res.status})`);

      const data = await res.json();
      const newChatId: string = data.chatId;
      const assistantText: string = data.response ?? "No pude generar una respuesta";

      if (!selectedChatId) {
        setSelectedChatId(newChatId);
        localStorage.setItem(lastChatKey, newChatId);
        await loadChats(false);
      }

      const assistantMessage: Message = {
        id: `local-${Date.now()}-a`,
        role: "assistant",
        content: assistantText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      alert("No se pudo enviar el mensaje.");
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------
  // Estilos (inline) tipo captura
  // -------------------------

  const colors = {
    border: "#e9edf3",
    muted: "#6b7280",
    blue: "#2563eb",
    blueDark: "#1d4ed8",
    bubbleUser: "#2563eb",
    bubbleAssistant: "#f3f4f6",
    sidebarBg: "#ffffff",
    pageBg: "#ffffff",
    dangerBg: "#fde8e8",
    dangerBorder: "#f9caca",
    dangerText: "#b91c1c",
  };

  const formatDate = (iso: string) => {
    // en la captura se ve dd/mm/yyyy (sin horas). Lo dejamos simple.
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es-ES");
    } catch {
      return "";
    }
  };

  return (
    <div style={{ height: "100vh", background: colors.pageBg, display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          borderBottom: `1px solid ${colors.border}`,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontWeight: 700, fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden>🤖</span>
            <span>PeritoIA - Asistente Virtual</span>
          </div>
          <div style={{ fontSize: 12, color: colors.muted }}>Tu asistente inteligente</div>
        </div>

        <a
          href="/"
          style={{
            fontSize: 12,
            color: colors.blue,
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Volver al área personal
        </a>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 300,
            background: colors.sidebarBg,
            borderRight: `1px solid ${colors.border}`,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <button
            onClick={createNewChat}
            style={{
              width: "100%",
              height: 44,
              border: "none",
              background: colors.blue,
              color: "#fff",
              borderRadius: 10,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 0 }}>+</span>
            <span>Nuevo Chat</span>
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {chats.map((c) => {
              const selected = selectedChatId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => void loadChatMessages(c.id)}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 10,
                    padding: 12,
                    cursor: "pointer",
                    background: selected ? "#f5f7ff" : "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: 12.5,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {c.title || "Chat sin título"}
                    </div>
                    <div style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>
                      {formatDate(c.updated_at || c.created_at)}
                    </div>
                  </div>

                  <button
                    onClick={(e) => void deleteChat(c.id, e)}
                    title="Eliminar chat"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      border: `1px solid ${colors.dangerBorder}`,
                      background: colors.dangerBg,
                      color: colors.dangerText,
                      cursor: "pointer",
                      display: "grid",
                      placeItems: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* Chat */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflow: "auto", padding: "18px 18px 0 18px" }}>
            <div style={{ maxWidth: 980, margin: "0 auto", paddingBottom: 18 }}>
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      justifyContent: isUser ? "flex-end" : "flex-start",
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        maxWidth: 520,
                        padding: "12px 14px",
                        borderRadius: 14,
                        background: isUser ? colors.bubbleUser : colors.bubbleAssistant,
                        color: isUser ? "#fff" : "#111827",
                        fontSize: 13,
                        lineHeight: 1.35,
                        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <div
            style={{
              borderTop: `1px solid ${colors.border}`,
              background: "#fff",
              padding: 14,
            }}
          >
            <form
              onSubmit={sendMessage}
              style={{
                maxWidth: 980,
                margin: "0 auto",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Escribe tu pregunta aquí..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  padding: "0 12px",
                  outline: "none",
                  fontSize: 13,
                  background: "#fff",
                }}
              />
              <button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                style={{
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: "none",
                  cursor: isLoading || !inputMessage.trim() ? "not-allowed" : "pointer",
                  background: isLoading || !inputMessage.trim() ? "#e5e7eb" : colors.blueDark,
                  color: isLoading || !inputMessage.trim() ? "#9ca3af" : "#fff",
                  fontWeight: 700,
                }}
              >
                {isLoading ? "Enviando..." : "Enviar"}
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};

export default PeritoIAPage;
