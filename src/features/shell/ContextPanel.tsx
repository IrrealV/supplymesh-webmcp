import type { ReactNode } from "react";

type ContextPanelProps = {
  children: ReactNode;
  label: string;
  mode: "overview" | "results";
};

export function ContextPanel({ children, label, mode }: ContextPanelProps) {
  return <aside aria-label={label} className="context-panel" data-context-mode={mode}>{children}</aside>;
}
