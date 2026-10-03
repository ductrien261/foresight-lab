import '@testing-library/jest-dom/vitest';

// jsdom lacks ResizeObserver, which Radix Slider uses.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
