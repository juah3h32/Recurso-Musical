"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useApiData } from "@/lib/cache";
import { useToast } from "@/components/toast";
import { StatusBadge } from "@/components/status-badge";
import { ConnectionListSkeleton } from "@/components/skeletons";

interface Connection {
  id: string;
  name: string | null;
  phoneNumber: string | null;
  status: string;
}

interface QrData {
  value: string;
  mimetype: string;
}

export default function ConnectionsPage() {
  const {
    data: connections,
    loading,
    error,
    mutate,
  } = useApiData<Connection[]>("connections", () =>
    apiFetch("/api/connections")
  );

  const list = connections ?? [];

  const [phoneNumbers, setPhoneNumbers] = useState<Record<string, string>>({});
  useEffect(() => {
    if (list.length === 0) return;
    const working = list.filter((c) => c.status === "connected" && !c.phoneNumber);
    if (working.length === 0) return;
    Promise.all(
      working.map((c) =>
        apiFetch(`/api/connections/${c.id}/me`)
          .then((me: any) => ({ id: c.id, phone: me?.id?.replace("@c.us", "") || null }))
          .catch(() => ({ id: c.id, phone: null }))
      )
    ).then((results) => {
      const phones: Record<string, string> = {};
      for (const r of results) {
        if (r.phone) phones[r.id] = r.phone;
      }
      setPhoneNumbers(phones);
    });
  }, [list]);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [newConnId, setNewConnId] = useState<string | null>(null);
  const [qr, setQr] = useState<QrData | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const { toast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Connection | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Optimistic: remove immediately
    const prevList = list;
    mutate((prev) => (prev ? prev.filter((c) => c.id !== deleteTarget.id) : prev));
    setDeleteTarget(null);
    try {
      await apiFetch(`/api/connections/${deleteTarget.id}`, { method: "DELETE" });
      toast("Conexión eliminada", "success");
    } catch {
      mutate(prevList);
      toast("Error al eliminar", "error");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, list, mutate, toast]);

  // Poll QR code when connection is created
  useEffect(() => {
    if (!newConnId) return;
    let cancelled = false;

    async function pollQr() {
      setQrLoading(true);
      try {
        const data = await apiFetch(`/api/connections/${newConnId}/qr`);
        if (cancelled) return;
        if (data.connected) {
          setQr(null);
          setShowModal(false);
          setNewConnId(null);
          setNewName("");
          mutate();
        } else if (data.value) {
          setQr(data);
          setModalError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          const msg = err?.message || "Error loading QR";
          if (msg.includes("starting up") || msg.includes("being provisioned")) {
            // Worker is booting, keep polling
          } else {
            setModalError(msg);
          }
        }
      } finally {
        if (!cancelled) setQrLoading(false);
      }
    }

    pollQr();
    const interval = setInterval(pollQr, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [newConnId, mutate]);

  // Poll connection status when we have a QR
  useEffect(() => {
    if (!newConnId || !qr) return;
    const interval = setInterval(async () => {
      try {
        const conn = await apiFetch(`/api/connections/${newConnId}`);
        if (conn.status === "connected" || conn.status === "working") {
          setQr(null);
          setShowModal(false);
          setNewConnId(null);
          setNewName("");
          mutate();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [newConnId, qr, mutate]);

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setModalError(null);
    try {
      const connection = await apiFetch("/api/connections", {
        method: "POST",
        body: JSON.stringify({ name: newName || undefined }),
      });
      setNewConnId(connection.id);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to create connection");
    } finally {
      setCreating(false);
    }
  }, [newName]);

  function closeModal() {
    setShowModal(false);
    setNewConnId(null);
    setNewName("");
    setQr(null);
    setModalError(null);
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Connections</h1>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-lg bg-wa-green px-4 py-2 text-sm font-semibold text-text-inverse transition-colors duration-150 hover:bg-wa-green-dark"
        >
          Nueva Conexión
        </button>
      </div>

      {loading && <ConnectionListSkeleton />}

      {error && (
        <div className="mt-6 rounded-lg border border-status-error-border bg-status-error-bg p-4 text-sm text-status-error-text">
          Error al cargar conexiones: {error}
        </div>
      )}

      {!loading && !error && list.length === 0 && !showModal && (
        <div className="mt-16 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border-primary bg-bg-secondary">
            <span className="text-3xl">📱</span>
          </div>
          <p className="mt-4 text-base font-medium text-text-primary">
            Sin conexiones
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Creá tu primera conexión de WhatsApp para comenzar.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 rounded-lg bg-wa-green px-5 py-2.5 text-sm font-semibold text-text-inverse transition-colors duration-150 hover:bg-wa-green-dark"
          >
            Crear conexión
          </button>
        </div>
      )}

      {!loading && !error && list.length > 0 && (
        <div className="mt-6 space-y-2">
          {list.map((conn) => (
            <div key={conn.id} className="group relative flex items-center justify-between rounded-xl border border-border-primary bg-bg-secondary px-5 py-4 transition-all duration-150 hover:border-border-secondary hover:bg-bg-elevated">
              <a href={`/dashboard/connections/${conn.id}`} className="min-w-0 flex-1 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text-primary">
                    {conn.name || "Conexión sin nombre"}
                  </p>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    {conn.phoneNumber
                      ? `+${conn.phoneNumber}`
                      : phoneNumbers[conn.id]
                        ? `+${phoneNumbers[conn.id]}`
                        : conn.status === "connected"
                          ? "Cargando..."
                          : "Sin número vinculado"}
                  </p>
                </div>
                <StatusBadge status={conn.status} />
                <svg className="h-4 w-4 text-text-tertiary transition-colors duration-150 group-hover:text-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
              <button
                onClick={(e) => { e.preventDefault(); setDeleteTarget(conn); }}
                className="ml-3 shrink-0 rounded-lg p-2 text-text-tertiary opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
                title="Eliminar conexión"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border-secondary bg-bg-secondary p-8 shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
              <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </div>
            <h3 className="mt-4 text-lg font-bold text-text-primary">Eliminar conexión</h3>
            <p className="mt-2 text-sm text-text-secondary">¿Estás seguro? Esta acción no se puede deshacer.</p>
            <p className="mt-1 text-xs text-text-tertiary truncate">{deleteTarget.name || "Conexión sin nombre"}</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 rounded-xl border border-border-secondary px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover transition-all disabled:opacity-50">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-all disabled:opacity-50">
                {deleting ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for new connection + QR */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={closeModal}>
          <div
            className="mx-4 w-full max-w-md rounded-2xl border border-border-secondary bg-bg-secondary p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                {qr ? "Escaneá el QR" : newConnId ? "Creando conexión..." : "Nueva Conexión"}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary transition-colors">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {!newConnId && (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label htmlFor="conn-name" className="mb-1.5 block text-sm font-medium text-text-secondary">
                    Nombre <span className="font-normal text-text-tertiary">(opcional)</span>
                  </label>
                  <input
                    id="conn-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="ej. Mi WhatsApp Business"
                    disabled={creating}
                    autoFocus
                    className="block w-full rounded-lg border border-border-secondary bg-bg-elevated px-3.5 py-2.5 text-text-primary transition-colors placeholder:text-text-tertiary focus:border-wa-green focus:outline-none focus:ring-1 focus:ring-wa-green disabled:opacity-50"
                  />
                </div>
                {modalError && (
                  <div className="rounded-lg border border-status-error-border bg-status-error-bg p-3 text-sm text-status-error-text">
                    {modalError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full rounded-lg bg-wa-green px-4 py-2.5 text-sm font-semibold text-text-inverse transition-colors hover:bg-wa-green-dark disabled:opacity-50"
                >
                  {creating ? "Creando..." : "Crear Conexión"}
                </button>
              </form>
            )}

            {newConnId && !qr && (
              <div className="flex flex-col items-center py-8">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-wa-green border-t-transparent" />
                <p className="mt-4 text-sm text-text-secondary">
                  {qrLoading ? "Cargando QR..." : "Esperando worker..."}
                </p>
              </div>
            )}

            {qr && (
              <div className="flex flex-col items-center">
                <img
                  src={`data:${qr.mimetype};base64,${qr.value}`}
                  alt="WhatsApp QR Code"
                  className="h-64 w-64 rounded-lg"
                />
                <p className="mt-3 text-sm text-text-secondary">
                  Abrí WhatsApp en tu teléfono y escaneá este código
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
