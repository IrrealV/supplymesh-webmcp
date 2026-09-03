import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, Check, Copy, GlobeHemisphereWest, Question, X } from "@phosphor-icons/react";
import { useState } from "react";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { browserLocaleStorage, saveLocale } from "../../preferences/i18n/localeStorage";

function SupplyMeshMark() {
  return (
    <svg aria-hidden="true" className="supplymesh-mark" viewBox="0 0 48 48">
      <path d="M24 2 42 12v24L24 46 6 36V12L24 2Z" />
      <path d="m24 2 8 17 10-7M24 2l-8 17L6 12m36 24-10-7 10-17M6 36l10-7L6 12m18 34 8-17H16l8 17Zm8-27-8 8-8-8 8-17 8 17Z" />
    </svg>
  );
}

export function Topbar({ locale, onLocaleChange }: { locale: Locale; onLocaleChange(locale: Locale): void }) {
  const copy = catalog(locale);
  const [helpOpen, setHelpOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function selectLocale(nextLocale: Locale): void {
    saveLocale(browserLocaleStorage(), nextLocale);
    onLocaleChange(nextLocale);
  }

  const demoPromptText = locale === "es"
    ? "Evalúa alternativas para el incidente de la Unidad 211, prepara el plan óptimo, solicita revisión humana y ejecuta la recuperación tras ser aprobada."
    : "Evaluate alternatives for Unit 211 clearance incident, stage the optimal recovery plan, request human review, and once approved execute recovery.";
  const vehiclePlacementHelp = locale === "es"
    ? "Pulsa Añadir vehículo y después haz clic en el mapa para colocarlo. Completa sus datos en el panel lateral. El agente puede crear, editar y asignar rutas mediante fleet_vehicle_create, fleet_vehicle_update y fleet_vehicle_assign_route."
    : "Choose Add vehicle and then click the map to place it. Complete its details in the side panel. The agent can create, edit, and assign routes through fleet_vehicle_create, fleet_vehicle_update, and fleet_vehicle_assign_route.";
  const restOpportunityHelp = locale === "es"
    ? "En Unit 212, el agente puede comparar oportunidades para devolver al conductor más tiempo de descanso usando el margen de entrega. El agente no puede reducir descansos ni programar la parada: la decisión final siempre la toma una persona."
    : "For Unit 212, the agent can compare opportunities that return more delivery slack to the driver as extra rest. The agent cannot reduce rest or schedule the stop; a person always makes the final choice.";

  function handleCopyPrompt(): void {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(demoPromptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  return (
    <header className="topbar">
      <div className="brand-lockup"><SupplyMeshMark /><strong className="wordmark">SupplyMesh</strong></div>
      <nav aria-label={copy.consoleControls} className="topbar-controls">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="topbar-control" aria-label={copy.language}>
            <GlobeHemisphereWest aria-hidden="true" size={20} /><span>{locale.toUpperCase()}</span><span aria-hidden="true" className="language-caret-text"> &#9662;</span><CaretDown aria-hidden="true" size={14} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="language-menu" sideOffset={8}>
              <DropdownMenu.Item onSelect={() => selectLocale("en")}>{copy.languageEnglish}</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => selectLocale("es")}>{copy.languageSpanish}</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <span aria-hidden="true" className="topbar-divider" />

        <Dialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
          <Dialog.Trigger asChild>
            <button className="topbar-control" type="button" aria-label={copy.help}>
              <Question aria-hidden="true" size={21} />
              <span>{copy.help}</span>
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="help-dialog-overlay" />
            <Dialog.Content className="help-dialog-content">
              <div className="help-dialog-header">
                <Dialog.Title className="help-dialog-title">{copy.helpTitle}</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="help-dialog-close" type="button" aria-label={copy.cancel}>
                    <X aria-hidden="true" size={20} />
                  </button>
                </Dialog.Close>
              </div>
              <div className="help-dialog-body">
                <section className="help-section">
                  <h3>🎯 {locale === "es" ? "Selección y seguimiento" : "Selection & Following"}</h3>
                  <p>{copy.helpSelectFollow}</p>
                </section>

                <section className="help-section">
                  <h3>⚠️ {locale === "es" ? "Alerta vs movimiento" : "Alert vs Movement Status"}</h3>
                  <p>{copy.helpAlertVsMovement}</p>
                </section>

                <section className="help-section">
                  <h3>🔍 {locale === "es" ? "Modo Close Range (3D)" : "Close Range Mode (3D)"}</h3>
                  <p>{copy.helpCloseRange}</p>
                </section>

                <section className="help-section">
                  <h3>🚛 {locale === "es" ? "Añadir vehículos y rutas" : "Vehicle Placement & Routes"}</h3>
                  <p>{vehiclePlacementHelp}</p>
                </section>

                <section className="help-section">
                  <h3>🛏️ {locale === "es" ? "Más descanso usando el margen" : "More rest from delivery slack"}</h3>
                  <p>{restOpportunityHelp}</p>
                </section>

                <section className="help-section">
                  <h3>🚨 {locale === "es" ? "Demo de Unit 211" : "Unit 211 Demo"}</h3>
                  <p>{copy.helpUnit211Demo}</p>
                </section>

                <section className="help-section help-section-prompt">
                  <h3>🤖 {locale === "es" ? "Prompt recomendado para el agente" : "Recommended Agent Prompt"}</h3>
                  <p className="help-prompt-quote">"{demoPromptText}"</p>
                  <button
                    className="help-copy-prompt-btn"
                    onClick={handleCopyPrompt}
                    type="button"
                  >
                    {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}
                    <span>{copied ? copy.helpPromptCopied : copy.helpCopyPrompt}</span>
                  </button>
                </section>

                <section className="help-section help-section-authority">
                  <h3>🛡️ {locale === "es" ? "Autoridad y aprobación humana" : "Human Authority"}</h3>
                  <p>{copy.helpHumanApproval}</p>
                </section>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </nav>
    </header>
  );
}
