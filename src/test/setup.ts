import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.assign(globalThis, {
  CustomEvent: dom.window.CustomEvent,
  Element: dom.window.Element,
  Event: dom.window.Event,
  FocusEvent: dom.window.FocusEvent,
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLElement: dom.window.HTMLElement,
  KeyboardEvent: dom.window.KeyboardEvent,
  MouseEvent: dom.window.MouseEvent,
  MutationObserver: dom.window.MutationObserver,
  Node: dom.window.Node,
  NodeFilter: dom.window.NodeFilter,
  SVGElement: dom.window.SVGElement,
  ResizeObserver: TestResizeObserver,
  getComputedStyle: dom.window.getComputedStyle,
  requestAnimationFrame: (callback: FrameRequestCallback) => setTimeout(() => callback(Date.now()), 0),
  cancelAnimationFrame: (handle: number) => clearTimeout(handle),
  document: dom.window.document,
  navigator: dom.window.navigator,
  window: dom.window as unknown as typeof globalThis,
});
