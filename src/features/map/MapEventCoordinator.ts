export class MapEventCoordinator {
  private programmaticChanges = 0;

  beginProgrammaticChange(): void {
    this.programmaticChanges += 1;
  }

  settleProgrammaticChange(): void {
    this.programmaticChanges = Math.max(0, this.programmaticChanges - 1);
  }

  isProgrammaticChangeActive(): boolean {
    return this.programmaticChanges > 0;
  }

  shouldCancelFollowForViewportMove(): boolean {
    return this.programmaticChanges === 0;
  }

  recordManualInteraction(): boolean {
    this.programmaticChanges = 0;
    return true;
  }
}
