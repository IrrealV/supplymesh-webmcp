import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, GlobeHemisphereWest, Question, UserCircle } from "@phosphor-icons/react";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { browserLocaleStorage, saveLocale } from "../../preferences/i18n/localeStorage";

function SupplyMeshMark() {
  return <svg aria-hidden="true" className="supplymesh-mark" viewBox="0 0 48 48">
    <path d="M24 2 42 12v24L24 46 6 36V12L24 2Z" />
    <path d="m24 2 8 17 10-7M24 2l-8 17L6 12m36 24-10-7 10-17M6 36l10-7L6 12m18 34 8-17H16l8 17Zm8-27-8 8-8-8 8-17 8 17Z" />
  </svg>;
}

export function Topbar({ locale, onLocaleChange }: { locale: Locale; onLocaleChange(locale: Locale): void }) {
  const copy = catalog(locale);
  function selectLocale(nextLocale: Locale): void {
    saveLocale(browserLocaleStorage(), nextLocale);
    onLocaleChange(nextLocale);
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
        <button className="topbar-control" type="button"><Question aria-hidden="true" size={21} /><span>{copy.help}</span></button>
        <span aria-hidden="true" className="topbar-divider" />
        <button className="topbar-control account-control" type="button"><UserCircle aria-hidden="true" size={29} weight="fill" /><span>{copy.account}</span><CaretDown aria-hidden="true" size={14} /></button>
      </nav>
    </header>
  );
}
