"use client";

import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-bg-primary">
      {/* Grid background */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* Gradient glow */}
      <div className="pointer-events-none fixed inset-0 z-0 flex items-start justify-center">
        <div className="mt-32 h-[600px] w-[800px] rounded-full bg-wa-green/[0.04] blur-[120px]" />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border-primary bg-bg-primary/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="" className="h-7 w-7" />
            <span className="text-xl font-bold">
              <span className="text-wa-green">WA</span>
              <span className="text-white">GO</span>
            </span>
          </Link>

          <div className="hidden items-center gap-5 sm:flex">
            <Link
              href="/login"
              className="rounded-lg bg-wa-green px-4 py-2 text-sm font-semibold text-text-inverse hover:bg-wa-green-dark transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden rounded-lg p-2 text-text-tertiary hover:text-text-primary transition-colors"
            aria-label="Menú"
          >
            {mobileMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            )}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-border-primary bg-bg-secondary/95 backdrop-blur-xl px-6 py-5 space-y-1 sm:hidden">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block rounded-lg bg-wa-green px-4 py-2.5 text-center text-sm font-semibold text-text-inverse hover:bg-wa-green-dark transition-colors">
              Iniciar sesión
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative z-10 px-6 py-36">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-bold leading-[1.1] tracking-tight sm:text-7xl">
            WhatsApp,{" "}
            <br className="hidden sm:block" />
            <span className="text-wa-green">Configuración Instantánea</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-text-secondary">
            Conectá números de WhatsApp, recibí webhooks en tiempo real y enviá
            mensajes — todo a través de una API simple. Sin infraestructura que gestionar.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-lg bg-wa-green px-7 py-3 text-sm font-semibold text-text-inverse transition-all hover:bg-wa-green-dark hover:shadow-lg hover:shadow-wa-green/20"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </section>

      {/* Demo screenshot / video */}
      <section className="relative z-10 px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-xl border border-border-primary shadow-2xl shadow-black/20">
            <video autoPlay loop muted playsInline className="w-full">
              <source src="/demo.webm" type="video/webm" />
              <source src="/demo.mp4" type="video/mp4" />
            </video>
          </div>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="relative z-10 border-t border-border-primary px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-wa-green">
            Cómo funciona
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold">
            Tres pasos para conectar WhatsApp
          </h2>
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Conectá tu número",
                description:
                  "Creá una conexión y escaneá el código QR con WhatsApp para vincular tu número.",
              },
              {
                step: "02",
                title: "Configurá los webhooks",
                description:
                  "Definí la URL de tu endpoint y elegí qué eventos recibir — mensajes, cambios de estado y más.",
              },
              {
                step: "03",
                title: "Empezá a usarlo",
                description:
                  "Usá la API REST para enviar mensajes y procesar eventos entrantes en tiempo real.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-xl border border-border-primary bg-bg-secondary/50 p-6 backdrop-blur-sm transition-all duration-200 hover:border-border-secondary hover:bg-bg-secondary"
              >
                <span className="font-mono text-xs text-wa-green/60">{item.step}</span>
                <h3 className="mt-3 text-lg font-semibold text-text-primary">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section className="relative z-10 border-t border-border-primary px-6 py-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-wa-green">
            Plataforma
          </p>
          <h2 className="mt-3 text-center text-3xl font-bold">
            Todo lo que necesitás
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-text-secondary">
            Una plataforma completa para integrar WhatsApp en tu empresa.
          </p>
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Infraestructura gestionada",
                description:
                  "Contenedores WAHA en la nube con escalado automático y monitoreo de salud. Sin DevOps.",
              },
              {
                title: "Sesiones persistentes",
                description:
                  "El estado de autenticación de WhatsApp se guarda en la base de datos. Las sesiones sobreviven reinicios y actualizaciones.",
              },
              {
                title: "Entrega de webhooks",
                description:
                  "Payloads firmados con HMAC-SHA256, reintentos con backoff exponencial (5 intentos) y cola de mensajes fallidos.",
              },
              {
                title: "API REST completa",
                description:
                  "Endpoints para enviar mensajes, obtener chats, gestionar conexiones y consultar logs de entrega.",
              },
              {
                title: "Tokens de API",
                description:
                  "Acceso programático seguro con tokens de API personales para integrar con cualquier sistema.",
              },
              {
                title: "Seguro por defecto",
                description:
                  "Claves de API cifradas, aislamiento de red privada y webhooks firmados.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border-primary bg-bg-secondary/50 p-6 backdrop-blur-sm transition-all duration-200 hover:border-border-secondary hover:bg-bg-secondary"
              >
                <h3 className="text-sm font-semibold text-text-primary">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative z-10 border-t border-border-primary px-6 py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold">¿Listo para empezar?</h2>
          <p className="mx-auto mt-4 text-text-secondary">
            Conectá tu número de WhatsApp y empezá a recibir eventos en minutos.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block rounded-lg bg-wa-green px-8 py-3 text-sm font-semibold text-text-inverse transition-all hover:bg-wa-green-dark hover:shadow-lg hover:shadow-wa-green/20"
          >
            Iniciar sesión
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-primary px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <span className="flex items-center gap-1.5 text-sm font-bold">
            <img src="/logo.svg" alt="" className="h-5 w-5" />
            <span className="text-wa-green">WA</span><span className="text-white">GO</span>
          </span>
          <p className="text-xs text-text-tertiary">
            &copy; {new Date().getFullYear()} WAGO — Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
