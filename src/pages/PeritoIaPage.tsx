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

  // Carga chats al entrar
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
        // Si no hay chats, empezamos “nuevo”
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
    // No “borra” nada del lateral: solo abre un chat nuevo (sin id todavía)
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
        // si quedan chats, abre el primero
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
          chatId: selectedChatId, // si es null, el backend crea chat nuevo
          message: text,
        }),
      });

      if (!res.ok) throw new Error(`Error enviando mensaje (${res.status})`);

      const data = await res.json();
      const newChatId: string = data.chatId;
      const assistantText: string = data.response ?? "No pude generar una respuesta";

      // Si era chat nuevo, fijamos el id y refrescamos el listado lateral
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

  // ---------- UI (tu maquetación actual) ----------
  // Aquí conserva tu HTML/CSS tal cual; solo he dejado lo mínimo
  // para que puedas encajar tu layout sin romperlo.

  return (
    <div style={{ display: "flex", height: "calc(100vh - 40px)" }}>
      {/* Sidebar */}
      <div style={{ width: 320, borderRight: "1px solid #eee", padding: 16 }}>
        <button onClick={createNewChat} style={{ width: "100%", padding: 10 }}>
          + Nuevo Chat
        </button>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {chats.map((c) => (
            <div
              key={c.id}
              onClick={() => void loadChatMessages(c.id)}
              style={{
                padding: 10,
                border: "1px solid #ddd",
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                background: selectedChatId === c.id ? "#f5f5ff" : "#fff",
              }}
            >
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {c.title}
                </div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  {new Date(c.updated_at).toLocaleString()}
                </div>
              </div>
              <button onClick={(e) => void deleteChat(c.id, e)} style={{ opacity: 0.8 }}>
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, padding: 16, overflow: "auto" }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                maxWidth: 900,
                marginBottom: 12,
                padding: 12,
                borderRadius: 10,
                background: m.role === "user" ? "#eef2ff" : "#f3f4f6",
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, padding: 16, borderTop: "1px solid #eee" }}>
          <input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Escribe tu pregunta aquí..."
            style={{ flex: 1, padding: 12, borderRadius: 8, border: "1px solid #ddd" }}
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading} style={{ padding: "12px 16px" }}>
            {isLoading ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PeritoIAPage;
