import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { CaretDown, GlobeHemisphereWest, Question, UserCircle } from "@phosphor-icons/react";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { browserLocaleStorage, saveLocale } from "../../preferences/i18n/localeStorage";

function SupplyMeshMark() {
  return <svg aria-hidden="true" className="supplymesh-mark" viewBox="0 0 48 48">
    <path d="M24 2 42 12v24L24 46 6 36V12L24 2Z" />
    <path d="m24 2 8 17 10-7M24 2l-8 17L6 12m36 24-10-7 10-17M6 36l10-7L6 12m18 34 8-17H16l8 17Zm8-27-8 8-8-8 8-17 8 17Z" />
  </svg>;
}

import { MapPin } from "@phosphor-icons/react";
import type { OperatingRegion } from "../../domain/entities";
import type { OperationsApi } from "../../domain/operations/createOperationsApi";
import { regionalCatalog } from "../../scenario/fixtures/regionalScenarios";

export function Topbar({ locale, onLocaleChange, scenario, operations, onScenarioChange }: { locale: Locale; onLocaleChange(locale: Locale): void; scenario: OperatingRegion; operations: OperationsApi; onScenarioChange(scenario: OperatingRegion): void }) {
  const copy = catalog(locale);
  function selectLocale(nextLocale: Locale): void {
    saveLocale(browserLocaleStorage(), nextLocale);
    onLocaleChange(nextLocale);
  }

  function selectRegion(regionId: string): void {
    const result = operations.scenarioRegionSelect(regionId);
    if (result.ok) {
      onScenarioChange(result.data);
    }
  }

  return (
    <header className="topbar">
      <div className="brand-lockup"><SupplyMeshMark /><strong className="wordmark">SupplyMesh</strong></div>
      <nav aria-label={copy.consoleControls} className="topbar-controls">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="topbar-control" aria-label="Region Selector">
            <MapPin aria-hidden="true" size={20} /><span>{regionalCatalog.find(r => r.id === scenario.id)?.name || scenario.name}</span><CaretDown aria-hidden="true" size={14} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="language-menu" sideOffset={8}>
              {regionalCatalog.map(region => (
                <DropdownMenu.Item key={region.id} onSelect={() => selectRegion(region.id)}>{region.name}</DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <span aria-hidden="true" className="topbar-divider" />
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
        <button className="topbar-control" type="button"><Question aria-hidden="true" size={21} /><span>{copy.help}</span></button>
        <span aria-hidden="true" className="topbar-divider" />
        
        <Dialog.Root>
          <Dialog.Trigger asChild>
            <button className="topbar-control" type="button"><Question aria-hidden="true" size={21} /><span>WebMCP vs REST</span></button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="dialog-overlay" style={{ background: 'rgba(0,0,0,0.5)', position: 'fixed', inset: 0, zIndex: 999 }} />
            <Dialog.Content className="dialog-content" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'white', padding: '2rem', borderRadius: '8px', zIndex: 1000, maxWidth: '600px' }}>
              <Dialog.Title style={{ marginTop: 0 }}>WebMCP vs Conventional Chat</Dialog.Title>
              <div style={{ lineHeight: 1.5 }}>
                <p><strong>WebMCP Architecture:</strong> Deterministic client-side tool verification, schema validation, and explicit human authorization gates. The LLM only proposes structured actions which are validated securely on the client.</p>
                <p><strong>Conventional Chat/REST:</strong> Fragile LLM JSON parsing, unverifiable remote side effects, and lack of deterministic pre-flight checks before execution.</p>
              </div>
              <Dialog.Close asChild>
                <button style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Close</button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <span aria-hidden="true" className="topbar-divider" />
        <button className="topbar-control account-control" type="button"><UserCircle aria-hidden="true" size={29} weight="fill" /><span>{copy.account}</span><CaretDown aria-hidden="true" size={14} /></button>
      </nav>
    </header>
  );
}
