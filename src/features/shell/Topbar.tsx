import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown } from "@phosphor-icons/react";
import { catalog, type Locale } from "../../preferences/i18n/catalog";
import { browserLocaleStorage, saveLocale } from "../../preferences/i18n/localeStorage";

export function Topbar({ locale, onLocaleChange }: { locale: Locale; onLocaleChange(locale: Locale): void }) {
  const copy = catalog(locale);
  function selectLocale(nextLocale: Locale): void {
    saveLocale(browserLocaleStorage(), nextLocale);
    onLocaleChange(nextLocale);
  }

  return (
    <header className="topbar">
      <strong className="wordmark">SupplyMesh</strong>
      <nav aria-label={copy.consoleControls} className="topbar-controls">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="topbar-control" aria-label={copy.language}>
            {locale.toUpperCase()} <CaretDown aria-hidden="true" size={14} weight="bold" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="language-menu" sideOffset={8}>
              <DropdownMenu.Item onSelect={() => selectLocale("en")}>{copy.languageEnglish}</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => selectLocale("es")}>{copy.languageSpanish}</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button className="topbar-control" type="button">{copy.help}</button>
        <button className="topbar-control" type="button">{copy.account}</button>
      </nav>
    </header>
  );
}
