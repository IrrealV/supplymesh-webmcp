export class MapEventCoordinator {
  private isProgrammaticFocus = false;

  beginProgrammaticFocus(): void {
    this.isProgrammaticFocus = true;
  }

  settleProgrammaticFocus(): void {
    this.isProgrammaticFocus = false;
  }

  shouldCancelFollowForViewportMove(): boolean {
    return !this.isProgrammaticFocus;
  }

  shouldCancelFollowForManualInteraction(): boolean {
    this.isProgrammaticFocus = false;
    return true;
  }
}
