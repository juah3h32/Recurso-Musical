"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface ChatMessage {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  chatId: string;
  senderName?: string;
}

interface Alert {
  id: string;
  chatId: string;
  chatName: string;
  message: string;
  timestamp: number;
  connectionName: string;
}

export default function MessageAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch connections
  useEffect(() => {
    apiFetch("/api/connections")
      .then((data: any) => {
        const working = (data || []).filter(
          (c: any) => c.status === "working" || c.status === "connected"
        );
        setConnections(working);
      })
      .catch(() => {});
  }, []);

  // Poll for new messages
  useEffect(() => {
    if (connections.length === 0) return;

    const poll = async () => {
      for (const conn of connections) {
        try {
          const chats: any[] = await apiFetch(`/api/connections/${conn.id}/chats`).catch(() => []);
          if (!Array.isArray(chats)) continue;

          for (const chat of chats) {
            if (!chat.lastMessage || chat.lastMessage.fromMe) continue;

            const msgId = `${chat.id}-${chat.lastMessage.timestamp}`;
            if (seenRef.current.has(msgId)) continue;
            seenRef.current.add(msgId);

            const newAlert: Alert = {
              id: msgId,
              chatId: chat.id,
              chatName: chat.name || chat.id.replace("@c.us", ""),
              message: chat.lastMessage.body?.slice(0, 120) || "",
              timestamp: chat.lastMessage.timestamp,
              connectionName: conn.name || "WhatsApp",
            };

            setAlerts((prev) => [newAlert, ...prev].slice(0, 50));
            setUnreadCount((c) => c + 1);
          }
        } catch {
          // skip unreachable connections
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [connections]);

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const openPanel = () => {
    setShowPanel(true);
    setUnreadCount(0);
  };

  return (
    <>
      {/* Floating bell button */}
      <button
        onClick={openPanel}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-wa-green px-4 py-3 text-sm font-semibold text-text-inverse shadow-lg transition-all hover:bg-wa-green-dark hover:shadow-xl"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        Mensajes
        {unreadCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-wa-green">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Slide panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-80 shrink-0 border-r border-border-primary bg-bg-secondary shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-border-primary px-4 py-3">
              <h3 className="text-sm font-semibold text-text-primary">Mensajes</h3>
              <button
                onClick={() => setShowPanel(false)}
                className="rounded-md p-1 text-text-tertiary hover:text-text-primary transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {alerts.length === 0 ? (
                <p className="p-4 text-sm text-text-tertiary text-center">No hay mensajes nuevos</p>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="border-b border-border-primary/50 px-4 py-3 hover:bg-bg-elevated transition-colors cursor-pointer"
                    onClick={() => dismiss(alert.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-medium text-text-primary truncate">
                        {alert.chatName}
                      </p>
                      <span className="shrink-0 text-[10px] text-text-tertiary">
                        {new Date(alert.timestamp * 1000).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary line-clamp-2">
                      {alert.message}
                    </p>
                    <p className="mt-0.5 text-[10px] text-text-tertiary">
                      {alert.connectionName}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="flex-1" onClick={() => setShowPanel(false)} />
        </div>
      )}
    </>
  );
}
