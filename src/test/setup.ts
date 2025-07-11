import "@testing-library/jest-dom";

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
