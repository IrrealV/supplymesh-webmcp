import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useTabletViewport } from "../../app/presentation/useTabletViewport";

type ContextPanelProps = {
  children: ReactNode;
  closeLabel?: string;
  label: string;
  mode: "overview" | "results";
  onClose?(): void;
  tabletOpen?: boolean;
};

export function ContextPanel({ children, closeLabel = "", label, mode, onClose, tabletOpen = mode === "results" }: ContextPanelProps) {
  const usesTabletDrawer = useTabletViewport();

  if (usesTabletDrawer) {
    return (
      <Dialog.Root modal={false} onOpenChange={(open) => { if (!open) onClose?.(); }} open={tabletOpen}>
        <Dialog.Portal>
          <Dialog.Content aria-describedby={undefined} className="context-panel tablet-context-drawer" data-context-mode={mode} id="context-panel">
            <Dialog.Title className="visually-hidden">{label}</Dialog.Title>
            <button aria-label={closeLabel} className="results-dialog-close" onClick={onClose} type="button"><X aria-hidden="true" size={18} /></button>
            {children}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return <aside aria-label={label} className="context-panel" data-context-mode={mode} id="context-panel" tabIndex={-1}>{children}</aside>;
}
