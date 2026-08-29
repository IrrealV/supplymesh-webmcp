import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

type ContextPanelProps = {
  children: ReactNode;
  label: string;
  mode: "overview" | "results";
  closeLabel?: string;
  onClose?(): void;
};

function tabletQuery(): boolean { return typeof window !== "undefined" && window.matchMedia?.("(min-width: 768px) and (max-width: 1023px)").matches === true; }

export function ContextPanel({ children, closeLabel = "", label, mode, onClose }: ContextPanelProps) {
  const [usesTabletDialog, setUsesTabletDialog] = useState(tabletQuery);
  useEffect(() => {
    if (window.matchMedia === undefined) return;
    const media = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    const update = (): void => setUsesTabletDialog(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  if (usesTabletDialog && mode === "results" && onClose !== undefined) return <Dialog.Root onOpenChange={(open) => { if (!open) onClose(); }} open><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content aria-describedby={undefined} className="context-panel tablet-results-dialog"><Dialog.Title className="visually-hidden">{label}</Dialog.Title><Dialog.Close asChild><button aria-label={closeLabel} className="results-dialog-close" type="button"><X aria-hidden="true" size={18} /></button></Dialog.Close>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
  return <aside aria-label={label} className="context-panel" data-context-mode={mode} id="context-panel" tabIndex={-1}>{children}</aside>;
}
