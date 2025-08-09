export class MessageHistory {
  private history: string[] = [];
  private currentIndex: number = -1;

  add(message: string): void {
    // Add to beginning and limit to 50 messages
    this.history = [message, ...this.history.slice(0, 49)];
    this.currentIndex = -1; // Reset index
  }

  getPrevious(): string | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      return this.history[this.currentIndex];
    }
    return null;
  }

  getNext(): string | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.history[this.currentIndex];
    } else if (this.currentIndex === 0) {
      this.currentIndex = -1;
      return "";
    }
    return null;
  }

  getCount(): number {
    return this.history.length;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
  }
}
