import { useEffect, useState, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

const PeritoIAPage = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const mockChats: Chat[] = [
        {
          id: "1",
          title: "Consulta sobre vacaciones",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "2",
          title: "Duda sobre nóminas",
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      setChats(mockChats);
    } catch (err) {
      console.error("Error cargando chats:", err);
    }
  };

  const loadChatMessages = async (chatId: string) => {
    try {
      setSelectedChatId(chatId);
      const mockMessages: Message[] = [
        {
          id: "1",
          role: "user",
          content: "¿Cuántos días de vacaciones me quedan?",
          timestamp: new Date(),
        },
        {
          id: "2",
          role: "assistant",
          content: "Basándome en los registros, tienes 15 días de vacaciones disponibles para este año.",
          timestamp: new Date(),
        },
      ];
      setMessages(mockMessages);
    } catch (err) {
      console.error("Error cargando mensajes:", err);
    }
  };

  const createNewChat = () => {
    setSelectedChatId(null);
    setMessages([]);
    setInputMessage("");
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("¿Eliminar este chat?")) return;
    setChats(chats.filter((c) => c.id !== chatId));
    if (selectedChatId === chatId) {
      createNewChat();
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Esta es una respuesta de ejemplo. Conecta con la API de OpenAI para obtener respuestas reales.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f3f4f6", display: "flex", flexDirection: "column" }}>
      <header style={{
        backgroundColor: "#ffffff",
        padding: "0.75rem 1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}>
        <div>
          <div style={{ fontSize: "1rem", fontWeight: 600 }}>🤖 PeritoIA - Asistente Virtual</div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            Tu asistente inteligente
          </div>
        </div>
        <button
          onClick={() => window.location.href = "/perfil"}
          style={{
            fontSize: "0.8rem",
            color: "#2563eb",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Volver al área personal
        </button>
      </header>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{
          width: "280px",
          backgroundColor: "#ffffff",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <div style={{ padding: "1rem" }}>
            <button
              onClick={createNewChat}
              style={{
                width: "100%",
                padding: "0.6rem",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.85rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              <span style={{ fontSize: "1.2rem" }}>+</span>
              Nuevo Chat
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "0 0.5rem" }}>
            {chats.length === 0 ? (
              <div style={{
                padding: "2rem 1rem",
                textAlign: "center",
                color: "#6b7280",
                fontSize: "0.85rem",
              }}>
                No hay chats anteriores
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => loadChatMessages(chat.id)}
                  style={{
                    padding: "0.75rem",
                    margin: "0.25rem 0",
                    backgroundColor: selectedChatId === chat.id ? "#dbeafe" : "#f9fafb",
                    border: `1px solid ${selectedChatId === chat.id ? "#2563eb" : "#e5e7eb"}`,
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{
                      fontSize: "0.85rem",
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {chat.title}
                    </div>
                    <div style={{ fontSize: "0.7rem", color: "#6b7280", marginTop: "0.25rem" }}>
                      {new Date(chat.updatedAt).toLocaleDateString("es-ES")}
                    </div>
                  </div>
                  <button
                    onClick={(e) => deleteChat(chat.id, e)}
                    style={{
                      padding: "0.25rem 0.5rem",
                      backgroundColor: "#fee2e2",
                      color: "#b91c1c",
                      border: "1px solid #fca5a5",
                      borderRadius: "0.25rem",
                      fontSize: "0.7rem",
                      cursor: "pointer",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", backgroundColor: "#ffffff" }}>
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}>
            {messages.length === 0 ? (
              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "#6b7280",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🤖</div>
                <div style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  PeritoIA - Tu Asistente Virtual
                </div>
                <div style={{ fontSize: "0.9rem" }}>
                  Pregúntame lo que necesites sobre tu trabajo
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "0.75rem 1rem",
                      backgroundColor: msg.role === "user" ? "#2563eb" : "#f3f4f6",
                      color: msg.role === "user" ? "#ffffff" : "#1f2937",
                      borderRadius: "1rem",
                      fontSize: "0.9rem",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <div style={{
                  padding: "0.75rem 1rem",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "1rem",
                  fontSize: "0.9rem",
                }}>
                  Pensando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div style={{
            padding: "1rem",
            borderTop: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb",
          }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e as any);
                  }
                }}
                placeholder="Escribe tu pregunta aquí..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "0.75rem 1rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #d1d5db",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: isLoading || !inputMessage.trim() ? "#d1d5db" : "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                  fontWeight: 500,
                  cursor: isLoading || !inputMessage.trim() ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? "..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeritoIAPage;