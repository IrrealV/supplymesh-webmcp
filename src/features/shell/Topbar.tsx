import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown } from "@phosphor-icons/react";
import { catalog } from "../../preferences/i18n/catalog";

export function Topbar() {
  const copy = catalog();

  return (
    <header className="topbar">
      <strong className="wordmark">SupplyMesh</strong>
      <nav aria-label="Console controls" className="topbar-controls">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="topbar-control" aria-label={copy.language}>
            EN <CaretDown aria-hidden="true" size={14} weight="bold" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="language-menu" sideOffset={8}>
              <DropdownMenu.Item>English</DropdownMenu.Item>
              <DropdownMenu.Item>Español</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button className="topbar-control" type="button">{copy.help}</button>
        <button className="topbar-control" type="button">{copy.account}</button>
      </nav>
    </header>
  );
}
