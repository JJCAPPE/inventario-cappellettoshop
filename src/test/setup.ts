import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock browser APIs that Antd components depend on
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
});

// Mock getComputedStyle
Object.defineProperty(window, "getComputedStyle", {
  value: () => ({
    getPropertyValue: () => "",
  }),
});

// Mock Tauri API
const mockTauriAPI = {
  Product: {
    getProductById: vi.fn(),
    enhancedSearchProducts: vi.fn(),
    searchProductsByNameGraphQL: vi.fn(),
    findProductByExactSkuGraphQL: vi.fn(),
  },
  Inventory: {
    getLocationConfig: vi.fn(),
    getInventoryLevelsForLocations: vi.fn(),
    transferInventoryBetweenLocations: vi.fn(),
    decreaseInventoryWithLogging: vi.fn(),
    undoDecreaseInventoryWithLogging: vi.fn(),
  },
  Firebase: {
    getLogs: vi.fn(),
    getCheckRequests: vi.fn(),
  },
};

// Mock TauriAPI module
vi.mock("../services/tauri", () => ({
  default: mockTauriAPI,
  TauriAPI: mockTauriAPI,
}));

// Mock @tauri-apps/plugin-opener
vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

// Make mockTauriAPI available globally for tests
(globalThis as any).mockTauriAPI = mockTauriAPI;
