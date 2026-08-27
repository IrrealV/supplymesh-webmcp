import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("The application root is unavailable.");
}

createRoot(rootElement).render(
  <StrictMode>
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-100">
      <section className="max-w-xl border border-slate-700 bg-slate-900 p-8">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">Foundation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Operational Console</h1>
        <p className="mt-3 text-slate-300">
          The application foundation is ready. Fleet operations and map capabilities are delivered in subsequent work units.
        </p>
      </section>
    </main>
  </StrictMode>,
);
