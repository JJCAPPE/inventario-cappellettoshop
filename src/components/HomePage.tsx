import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Space,
  Row,
  Col,
  Image,
  Tag,
  List,
  Modal,
  Divider,
  Badge,
  Typography,
  Radio,
  Switch,
  App,
} from "antd";
import {
  ReloadOutlined,
  ShopOutlined,
  ExclamationCircleOutlined,
  UndoOutlined,
  CloseOutlined,
  SettingOutlined,
  GlobalOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  RightOutlined,
  LeftOutlined,
} from "@ant-design/icons";
import { openUrl } from "@tauri-apps/plugin-opener";
import SearchBar from "./SearchBar";
import { ProductDetails, SecondaryDetails } from "../types/index";
import { useLogs } from "../contexts/LogContext";
import TauriAPI from "../services/tauri";
import ModificationHistoryModal from "./ModificationHistoryModal";
import CheckRequestModal from "./CheckRequestModal";

const { Title, Text } = Typography;

// Centralized location configuration
type LocationName = "Treviso" | "Mogliano";

const AVAILABLE_LOCATIONS: readonly LocationName[] = [
  "Treviso",
  "Mogliano",
] as const;
const DEFAULT_PRIMARY_LOCATION: LocationName = "Treviso";

const LOCATION_CONFIG = {
  availableLocations: AVAILABLE_LOCATIONS,
  defaultPrimary: DEFAULT_PRIMARY_LOCATION,
  getSecondaryLocation: (primary: string): LocationName => {
    return (
      AVAILABLE_LOCATIONS.find((loc: LocationName) => loc !== primary) ||
      AVAILABLE_LOCATIONS[0]
    );
  },
  isValidLocation: (location: string): location is LocationName => {
    return AVAILABLE_LOCATIONS.includes(location as LocationName);
  },
};

interface HomePageProps {
  targetProductId?: string | null;
  onTargetProductProcessed?: () => void;
  triggerSettingsModal?: boolean;
  onSettingsTriggered?: () => void;
  settingsModalVisible?: boolean;
  onSettingsOpen?: () => void;
  onSettingsClose?: () => void;
  transferModeEnabled?: boolean;
  onTransferModeChange?: (enabled: boolean) => void;
}

const HomePage: React.FC<HomePageProps> = ({
  targetProductId,
  onTargetProductProcessed,
  triggerSettingsModal,
  onSettingsTriggered,
  settingsModalVisible,
  onSettingsOpen,
  onSettingsClose,
  transferModeEnabled = false, // Default to normal mode
  onTransferModeChange,
}) => {
  const { fetchLogs } = useLogs();
  const { modal, message: messageApi } = App.useApp();
  const [query, setQuery] = useState("");
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(
    null
  );
  const [secondaryProductDetails, setSecondaryProductDetails] =
    useState<SecondaryDetails | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]); // Multi-variant selection for transfer mode
  const [primaryLocation, setPrimaryLocation] = useState<LocationName>(
    LOCATION_CONFIG.defaultPrimary
  );
  const [secondaryLocation, setSecondaryLocation] = useState<LocationName>(
    LOCATION_CONFIG.getSecondaryLocation(LOCATION_CONFIG.defaultPrimary)
  );
  const [lastSelectedQuery, setLastSelectedQuery] = useState<string>("");
  const [modifyModalVisible, setModifyModalVisible] = useState(false);
  const [undoModalVisible, setUndoModalVisible] = useState(false);
  const [transferSuccessModalVisible, setTransferSuccessModalVisible] =
    useState(false);
  const [undoTransferModalVisible, setUndoTransferModalVisible] =
    useState(false);

  const [modificationHistoryModalVisible, setModificationHistoryModalVisible] =
    useState(false);
  const [checkRequestModalVisible, setCheckRequestModalVisible] =
    useState(false);
  const [searchSortKey, setSearchSortKey] = useState<string>("RELEVANCE");
  const [searchSortReverse, setSearchSortReverse] = useState<boolean>(false);
  const [isModifyLoading, setIsModifyLoading] = useState(false);
  const [isUndoLoading, setIsUndoLoading] = useState(false);
  const [lastModifiedVariant, setLastModifiedVariant] = useState<string | null>(
    null
  );
  const [secondaryPanelExpanded, setSecondaryPanelExpanded] = useState(false);

  // Transfer mode state now comes from App.tsx via props
  const [isTransferLoading, setIsTransferLoading] = useState(false);
  const [lastTransferredVariant, setLastTransferredVariant] = useState<
    string | null
  >(null);
  const [lastTransferredVariants, setLastTransferredVariants] = useState<
    string[]
  >([]); // For batch transfers
  const [transferFailedVariants, setTransferFailedVariants] = useState<
    { variant: string; error: string }[]
  >([]); // For tracking failed transfers
  const [transferProgress, setTransferProgress] = useState<{
    current: number;
    total: number;
    currentVariant: string;
    completed: string[];
    failed: { variant: string; error: string }[];
  } | null>(null);

  // Search history state
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Legacy variables for backward compatibility
  const negozio = primaryLocation;
  const secondario = secondaryLocation;

  useEffect(() => {
    // Load saved location preference from localStorage
    const savedLocation = localStorage.getItem("primaryLocation");
    if (savedLocation && LOCATION_CONFIG.isValidLocation(savedLocation)) {
      setPrimaryLocation(savedLocation);
      setSecondaryLocation(LOCATION_CONFIG.getSecondaryLocation(savedLocation));
    }

    // Load saved search sort preference from localStorage
    const savedSortKey = localStorage.getItem("searchSortKey");
    if (
      savedSortKey &&
      ["RELEVANCE", "UPDATED_AT", "CREATED_AT", "INVENTORY_TOTAL"].includes(
        savedSortKey
      )
    ) {
      setSearchSortKey(savedSortKey);
    }

    // Load saved search sort reverse preference from localStorage
    const savedSortReverse = localStorage.getItem("searchSortReverse");
    if (savedSortReverse !== null) {
      setSearchSortReverse(savedSortReverse === "true");
    }

    // Transfer mode is now handled in App.tsx

    // Load search history from localStorage
    const savedHistory = localStorage.getItem("searchHistory");
    if (savedHistory) {
      try {
        const historyArray = JSON.parse(savedHistory);
        if (Array.isArray(historyArray)) {
          setSearchHistory(historyArray);
        }
      } catch (error) {
        console.warn(
          "Failed to parse search history from localStorage:",
          error
        );
      }
    }

    // Add keyboard shortcut listener for Cmd+, (settings)
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        onSettingsOpen?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Clear selected variants if they have zero or negative inventory
  useEffect(() => {
    if (productDetails) {
      // Clear single variant if it has zero or negative inventory
      if (selectedVariant) {
        const variantObj = productDetails.varaintiArticolo.find(
          (v) => v.title === selectedVariant
        );

        if (!variantObj || variantObj.inventory_quantity <= 0) {
          console.log(
            `🚫 Clearing selected variant '${selectedVariant}' because it has zero or negative inventory`
          );
          setSelectedVariant(null);
        }
      }

      // Clear multi-variants that have zero or negative inventory
      if (selectedVariants.length > 0) {
        const validVariants = selectedVariants.filter((variant) => {
          const variantObj = productDetails.varaintiArticolo.find(
            (v) => v.title === variant
          );
          return variantObj && variantObj.inventory_quantity > 0;
        });

        if (validVariants.length !== selectedVariants.length) {
          const removedVariants = selectedVariants.filter(
            (v) => !validVariants.includes(v)
          );
          console.log(
            `🚫 Clearing selected variants with zero inventory: ${removedVariants.join(
              ", "
            )}`
          );
          setSelectedVariants(validVariants);
        }
      }
    }
  }, [productDetails, selectedVariant, selectedVariants]);

  // Handle external navigation to a specific product
  useEffect(() => {
    if (targetProductId && onTargetProductProcessed) {
      console.log(
        "🎯 HomePage: External navigation to product:",
        targetProductId
      );
      // Trigger the product selection using the existing handleSearchSelect function
      // Use an empty search query since we're navigating directly by ID
      handleSearchSelect(targetProductId, `Product ID: ${targetProductId}`)
        .then(() => {
          console.log("✅ HomePage: Navigation to product completed");
          onTargetProductProcessed(); // Clear the target product ID
        })
        .catch((error) => {
          console.error("❌ HomePage: Error navigating to product:", error);
          onTargetProductProcessed(); // Clear the target product ID even on error
        });
    }
  }, [targetProductId, onTargetProductProcessed]);

  // Handle settings modal trigger from native menu
  useEffect(() => {
    if (triggerSettingsModal) {
      console.log("⚙️ HomePage: Opening settings modal from native menu");
      onSettingsOpen?.();
      onSettingsTriggered?.(); // Reset the trigger
    }
  }, [triggerSettingsModal, onSettingsTriggered, onSettingsOpen]);

  // Immediate settings change handlers (apply changes immediately)
  const handleLocationChange = async (newPrimaryLocation: string) => {
    if (LOCATION_CONFIG.isValidLocation(newPrimaryLocation)) {
      console.log(
        `⚙️ Changing primary location from ${primaryLocation} to ${newPrimaryLocation}`
      );

      // Apply the location change immediately
      setPrimaryLocation(newPrimaryLocation);
      setSecondaryLocation(
        LOCATION_CONFIG.getSecondaryLocation(newPrimaryLocation)
      );

      // Save to localStorage
      localStorage.setItem("primaryLocation", newPrimaryLocation);

      // Show success message
      messageApi.success(
        `Posizione principale cambiata a ${newPrimaryLocation}`
      );

      // Refresh product data if there's a current product
      if (productDetails) {
        console.log("🔄 Refreshing product data for new location...");
        await refreshProductWithNewLocation(newPrimaryLocation);
        // Ensure logs are also refreshed for new location
        await fetchLogs();
      }
      handleReset();
    }
  };

  const handleSearchSortChange = (newSortKey: string) => {
    console.log(`⚙️ Changing search sort key to ${newSortKey}`);
    setSearchSortKey(newSortKey);
    localStorage.setItem("searchSortKey", newSortKey);

    const sortLabels = {
      RELEVANCE: "Rilevanza",
      UPDATED_AT: "Aggiornati Recentemente",
      CREATED_AT: "Creati Recentemente",
      INVENTORY_TOTAL: "Quantità Totale",
    };

    messageApi.success(
      `Ordine Risultati Ricerca: ${
        sortLabels[newSortKey as keyof typeof sortLabels]
      }`
    );
  };

  const handleSearchSortReverseChange = (reverse: boolean) => {
    console.log(`⚙️ Changing search sort reverse to ${reverse}`);
    setSearchSortReverse(reverse);
    localStorage.setItem("searchSortReverse", reverse.toString());

    const orderText = reverse ? "Decrescente" : "Crescente";
    messageApi.success(`Ordine risultati: ${orderText}`);
  };

  const handleTransferModeChange = (enabled: boolean) => {
    console.log(`⚙️ HomePage: Changing transfer mode to ${enabled}`);
    onTransferModeChange?.(enabled);

    const statusText = enabled ? "attivata" : "disattivata";
    messageApi.success(`Modalità Trasferimenti ${statusText}`);
  };

  // Function to refresh current product data with new location
  const refreshProductWithNewLocation = async (
    newPrimaryLocation: LocationName
  ) => {
    if (!productDetails || !lastSelectedQuery) return;

    console.log(
      "🔄 Refreshing product data with new primary location:",
      newPrimaryLocation
    );

    try {
      // Re-fetch the product with the new location
      await handleSearchSelect(productDetails.id, lastSelectedQuery);

      // Validate selected variant for new location
      setTimeout(() => {
        if (selectedVariant && productDetails) {
          const variantObj = productDetails.varaintiArticolo.find(
            (v) => v.title === selectedVariant
          );

          if (!variantObj || variantObj.inventory_quantity <= 0) {
            console.log(
              `🚫 Clearing selected variant '${selectedVariant}' because it's unavailable in new location`
            );
            setSelectedVariant(null);
            messageApi.warning(
              `Variante "${selectedVariant}" non disponibile nella nuova posizione`
            );
          }
        }
      }, 100);
    } catch (error) {
      console.error("❌ Error refreshing product with new location:", error);
      messageApi.error("Errore nell'aggiornamento del prodotto");
    }
  };

  const handleSearchSelect = async (id: string, searchQuery: string) => {
    setLastSelectedQuery(searchQuery);

    try {
      console.log("🚀 HomePage: Starting product fetch for ID:", id);
      console.log("🔍 Search query was:", searchQuery);

      // Fetch the actual product from Shopify using Tauri API
      const product = await TauriAPI.Product.getProductById(id);
      console.log("✅ HomePage: Product fetched successfully:", product.title);

      // Start inventory fetch immediately without waiting - this overlaps with processing
      const inventoryItemIds = product.variants.map((v) => v.inventory_item_id);
      console.log(
        "📊 HomePage: Starting inventory fetch for items:",
        inventoryItemIds
      );

      const inventoryPromise =
        TauriAPI.Inventory.getInventoryLevelsForLocations(
          inventoryItemIds,
          primaryLocation
        );

      // Do synchronous processing while inventory is being fetched in parallel
      console.log(
        "🔄 HomePage: Processing product data while inventory loads..."
      );

      // Check if search was by SKU (synchronous processing)
      let skuMatchingVariant = null;
      if (searchQuery && searchQuery.trim()) {
        console.log("🔍 HomePage: Checking if search was by SKU:", searchQuery);
        skuMatchingVariant = product.variants.find((backendVariant) => {
          return (
            backendVariant.sku &&
            backendVariant.sku.toLowerCase() === searchQuery.toLowerCase()
          );
        });
      }

      // Now await the inventory data when we actually need it
      const inventoryLevels = await inventoryPromise;
      console.log(
        "✅ HomePage: Location-aware inventory levels received:",
        inventoryLevels
      );

      // Update product variants with primary location inventory
      const updatedVariants = product.variants.map((variant) => {
        const inventoryData = inventoryLevels[variant.inventory_item_id] || {
          primary: 0,
          secondary: 0,
        };
        return {
          ...variant,
          inventory_quantity: inventoryData.primary, // Use primary location inventory
        };
      });

      // Convert Tauri Product to our ProductDetails format
      const productDetails: ProductDetails = {
        nomeArticolo: product.title,
        id: product.id,
        prezzo: product.price,
        descrizioneArticolo: product.description || "",
        immaginiArticolo: product.images || [],
        varaintiArticolo: updatedVariants.map((variant) => ({
          variant_id: variant.variant_id,
          inventory_item_id: variant.inventory_item_id,
          title: variant.title,
          inventory_quantity: variant.inventory_quantity,
        })),
        recentlyModified: false, // TODO: Implement recently modified logic
        handle: product.handle,
      };

      console.log("📦 HomePage: Converted product details:", productDetails);

      // Create secondary details (for second location)
      const secondaryDetails: SecondaryDetails = {
        availableVariants: product.variants.map((variant) => {
          const inventoryData = inventoryLevels[variant.inventory_item_id] || {
            primary: 0,
            secondary: 0,
          };
          return {
            variant_id: variant.variant_id,
            inventory_item_id: variant.inventory_item_id,
            title: variant.title,
            inventory_quantity: inventoryData.secondary, // Use secondary location inventory
          };
        }),
      };

      console.log("🏪 HomePage: Secondary location details:", secondaryDetails);

      setProductDetails(productDetails);
      setSecondaryProductDetails(secondaryDetails);
      console.log("✅ HomePage: Product data set successfully");

      // Add successful search to history
      addToSearchHistory(searchQuery);
      // Also add the product title to history for easy access
      if (productDetails.nomeArticolo !== searchQuery.trim()) {
        addToSearchHistory(productDetails.nomeArticolo);
      }

      // Handle SKU auto-selection using pre-computed skuMatchingVariant
      if (skuMatchingVariant) {
        // Find the corresponding frontend variant by inventory_item_id
        const frontendVariant = productDetails.varaintiArticolo.find(
          (v) => v.inventory_item_id === skuMatchingVariant.inventory_item_id
        );

        if (frontendVariant && frontendVariant.inventory_quantity > 0) {
          console.log(
            "✅ HomePage: Auto-selecting variant with matching SKU:",
            frontendVariant.title
          );
          setSelectedVariant(frontendVariant.title);
        } else if (frontendVariant) {
          console.log(
            "⚠️ HomePage: Found SKU variant but it has zero or negative inventory:",
            frontendVariant.title
          );
        }
      } else if (searchQuery && searchQuery.trim()) {
        console.log("ℹ️ HomePage: No exact SKU match found in variants");
      }
    } catch (error) {
      console.error("❌ HomePage: Error fetching product:", error);
      messageApi.error("Prodotto non trovato, prova un altro barcode");
    }
  };

  const handleVariantSelect = (variant: string) => {
    // Check if the variant has negative inventory and prevent selection
    const variantObj = productDetails?.varaintiArticolo.find(
      (v) => v.title === variant
    );

    if (variantObj && variantObj.inventory_quantity < 0) {
      messageApi.warning(
        `La taglia ${variant} ha quantità negativa. Non è possibile selezionarla.`
      );
      return;
    }

    setSelectedVariant(variant);
  };

  const handleMultiVariantToggle = (variant: string) => {
    console.log("🖱️ Multi-variant toggled:", variant);

    // Check if the variant has negative or zero inventory and prevent selection
    const variantObj = productDetails?.varaintiArticolo.find(
      (v) => v.title === variant
    );

    if (variantObj && variantObj.inventory_quantity <= 0) {
      messageApi.warning(
        `La taglia ${variant} non ha inventario disponibile. Non è possibile selezionarla per il trasferimento.`
      );
      return;
    }

    setSelectedVariants((prev) => {
      if (prev.includes(variant)) {
        // Remove variant
        const newSelection = prev.filter((v) => v !== variant);
        console.log("🗑️ Removed variant, new selection:", newSelection);
        return newSelection;
      } else {
        // Add variant
        const newSelection = [...prev, variant];
        console.log("➕ Added variant, new selection:", newSelection);
        return newSelection;
      }
    });
  };

  // Search history functions
  const addToSearchHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setSearchHistory((prev) => {
      // Remove duplicates and add to beginning
      const filtered = prev.filter((item) => item !== searchQuery.trim());
      const newHistory = [searchQuery.trim(), ...filtered].slice(0, 25); // Keep only last 25

      // Save to localStorage
      localStorage.setItem("searchHistory", JSON.stringify(newHistory));

      return newHistory;
    });

    // Reset history index when new search is added
    setHistoryIndex(-1);
  };

  const navigateHistory = (direction: "up" | "down"): string | null => {
    if (searchHistory.length === 0) return null;

    let newIndex;
    if (direction === "up") {
      newIndex =
        historyIndex < searchHistory.length - 1
          ? historyIndex + 1
          : historyIndex;
    } else {
      newIndex = historyIndex > -1 ? historyIndex - 1 : -1;
    }

    setHistoryIndex(newIndex);

    if (newIndex === -1) {
      return ""; // Return empty string when going back to current input
    }

    return searchHistory[newIndex] || null;
  };

  // Batch transfer function for multiple variants with concurrent processing
  const executeBatchTransfer = async (variantNames: string[]) => {
    console.log("🔄 Starting batch transfer execution", {
      variantCount: variantNames.length,
      variants: variantNames,
      productId: productDetails?.id,
      productName: productDetails?.nomeArticolo,
      fromLocation: primaryLocation,
      toLocation: secondaryLocation,
    });

    if (!productDetails) {
      const error = "Dettagli prodotto non disponibili";
      console.error("❌ Batch transfer failed:", error);
      throw new Error(error);
    }

    // Get location configuration once
    console.log("📍 Fetching location configuration...");
    const locationConfig = await TauriAPI.Inventory.getLocationConfig();
    console.log("📍 Location configuration received:", locationConfig);

    const fromLocationId =
      primaryLocation === LOCATION_CONFIG.availableLocations[0]
        ? locationConfig.primary_location.id
        : locationConfig.secondary_location.id;

    const toLocationId =
      secondaryLocation === LOCATION_CONFIG.availableLocations[0]
        ? locationConfig.primary_location.id
        : locationConfig.secondary_location.id;

    console.log("📍 Location mapping:", {
      primaryLocation,
      secondaryLocation,
      fromLocationId,
      toLocationId,
      availableLocations: LOCATION_CONFIG.availableLocations,
    });

    // Pre-validate all variants before starting transfers
    const validatedVariants: Array<{
      name: string;
      variant: {
        variant_id: string;
        inventory_item_id: string;
        title: string;
        inventory_quantity: number;
      };
    }> = [];
    for (const variantName of variantNames) {
      const variant = productDetails.varaintiArticolo.find(
        (v) => v.title === variantName
      );

      if (!variant) {
        console.error(
          `❌ Variant not found in product details: ${variantName}`
        );
        continue;
      }

      if (!variant.inventory_item_id) {
        console.error(
          `❌ Missing inventory_item_id for variant: ${variantName}`
        );
        continue;
      }

      if (variant.inventory_quantity <= 0) {
        console.error(`❌ No inventory available for variant: ${variantName}`);
        continue;
      }

      validatedVariants.push({
        name: variantName,
        variant: variant,
      });
    }

    console.log(
      `✅ Validated ${validatedVariants.length}/${variantNames.length} variants for transfer`
    );

    if (validatedVariants.length === 0) {
      throw new Error("Nessuna variante valida per il trasferimento");
    }

    // Set initial progress
    setTransferProgress({
      current: 0,
      total: validatedVariants.length,
      currentVariant: "Inizializzazione...",
      completed: [],
      failed: [],
    });

    // Execute transfers with concurrent processing
    const transferPromises = validatedVariants.map(
      async ({ name: variantName, variant }, index) => {
        try {
          console.log(
            `🚀 [${index + 1}/${
              validatedVariants.length
            }] Starting concurrent transfer for: ${variantName}`
          );

          // Refresh product data to get latest inventory before transfer
          console.log(
            `🔄 [${index + 1}/${
              validatedVariants.length
            }] Refreshing inventory data for ${variantName}...`
          );
          const freshProduct = await TauriAPI.Product.getProductById(
            productDetails.id
          );
          const freshVariant = freshProduct.variants.find(
            (v) => v.inventory_item_id === variant.inventory_item_id
          );

          if (!freshVariant) {
            throw new Error(
              `Variante "${variantName}" non trovata nei dati aggiornati`
            );
          }

          // Get fresh inventory levels
          const freshInventory =
            await TauriAPI.Inventory.getInventoryLevelsForLocations(
              [freshVariant.inventory_item_id],
              primaryLocation
            );

          const currentInventory =
            freshInventory[freshVariant.inventory_item_id]?.primary || 0;

          if (currentInventory <= 0) {
            throw new Error(
              `Inventario insufficiente per "${variantName}" (corrente: ${currentInventory})`
            );
          }

          console.log(
            `📦 [${index + 1}/${
              validatedVariants.length
            }] Fresh inventory check passed for ${variantName}: ${currentInventory}`
          );

          // Execute the transfer
          const result =
            await TauriAPI.Inventory.transferInventoryBetweenLocations(
              variant.inventory_item_id,
              fromLocationId,
              toLocationId,
              productDetails.id,
              variantName,
              productDetails.nomeArticolo,
              productDetails.prezzo,
              primaryLocation,
              secondaryLocation,
              productDetails.immaginiArticolo
            );

          console.log(
            `✅ [${index + 1}/${
              validatedVariants.length
            }] Concurrent transfer successful for ${variantName}:`,
            result
          );

          // Update progress
          setTransferProgress((prev) =>
            prev
              ? {
                  ...prev,
                  current: prev.current + 1,
                  completed: [...prev.completed, variantName],
                }
              : null
          );

          return { success: true, variant: variantName, result };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Errore sconosciuto";

          console.error(
            `❌ [${index + 1}/${
              validatedVariants.length
            }] Concurrent transfer failed for ${variantName}:`,
            {
              error,
              errorMessage,
              variantName,
              inventory_item_id: variant.inventory_item_id,
            }
          );

          // Create detailed error message
          let detailedError = errorMessage;
          if (errorMessage.includes("Not Found")) {
            detailedError = `Variante "${variantName}" non trovata nel sistema inventario (possibile inconsistenza dati)`;
          } else if (errorMessage.includes("Failed to adjust inventory")) {
            detailedError = `Impossibile aggiornare inventario per "${variantName}" (controllo permessi o rate limit)`;
          } else if (errorMessage.includes("Inventario insufficiente")) {
            detailedError = errorMessage; // Keep the detailed inventory message
          }

          // Update progress
          setTransferProgress((prev) =>
            prev
              ? {
                  ...prev,
                  current: prev.current + 1,
                  failed: [
                    ...prev.failed,
                    { variant: variantName, error: detailedError },
                  ],
                }
              : null
          );

          return { success: false, variant: variantName, error: detailedError };
        }
      }
    );

    // Wait for all transfers to complete
    console.log("⏳ Waiting for all concurrent transfers to complete...");
    const results = await Promise.allSettled(transferPromises);

    // Process results
    const completed: string[] = [];
    const failed: { variant: string; error: string }[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        if (result.value.success) {
          completed.push(result.value.variant);
        } else {
          failed.push({
            variant: result.value.variant,
            error: result.value.error || "Errore sconosciuto",
          });
        }
      } else {
        const variantName = `Unknown-${index}`;
        failed.push({
          variant: variantName,
          error: `Errore di promise: ${result.reason}`,
        });
      }
    });

    // Clear progress state
    setTransferProgress(null);

    // Log final batch results
    console.log("📊 Concurrent batch transfer completed:", {
      totalVariants: validatedVariants.length,
      completed: completed.length,
      failed: failed.length,
      completedVariants: completed,
      failedVariants: failed.map((f) => ({
        variant: f.variant,
        error: f.error,
      })),
    });

    return { completed, failed };
  };

  const handleDecreaseInventory = () => {
    if (!selectedVariant || !productDetails) return;

    // Check if the selected variant has 0 inventory
    const variant = productDetails.varaintiArticolo.find(
      (v) => v.title === selectedVariant
    );

    if (!variant) {
      messageApi.error("Variante non trovata");
      return;
    }

    if (variant.inventory_quantity <= 0) {
      const quantityText = variant.inventory_quantity === 0 ? "0" : "negativa";
      messageApi.warning(
        `La taglia ${selectedVariant} ha già quantità ${quantityText}. Non è possibile ridurla ulteriormente.`
      );
      return;
    }

    modal.confirm({
      title: "Conferma Modifica",
      icon: <ExclamationCircleOutlined />,
      content: `Sei sicuro di voler rimuovere la taglia ${selectedVariant} dell'articolo ${productDetails.nomeArticolo}?`,
      okText: "Conferma",
      cancelText: "Annulla",
      onOk: async () => {
        setIsModifyLoading(true);
        try {
          // Get the variant details
          const variant = productDetails.varaintiArticolo.find(
            (v) => v.title === selectedVariant
          );

          if (!variant) {
            throw new Error("Variante non trovata");
          }

          console.log(
            "🔄 Starting inventory decrease for variant:",
            selectedVariant
          );
          console.log("📦 Inventory item ID:", variant.inventory_item_id);
          console.log("🏪 Primary location:", primaryLocation);

          // Get location configuration to map location name to ID
          const locationConfig = await TauriAPI.Inventory.getLocationConfig();
          console.log("📍 Location config:", locationConfig);

          // Determine the correct location ID based on primary location
          // Note: This assumes the API locationConfig maps to our LOCATION_CONFIG
          const locationId =
            primaryLocation === LOCATION_CONFIG.availableLocations[0]
              ? locationConfig.primary_location.id
              : locationConfig.secondary_location.id;

          console.log(
            "📍 Using location ID:",
            locationId,
            "for",
            primaryLocation
          );

          // Perform the inventory adjustment with Firebase logging
          const result = await TauriAPI.Inventory.decreaseInventoryWithLogging(
            variant.inventory_item_id,
            locationId,
            productDetails.id,
            selectedVariant,
            productDetails.nomeArticolo,
            productDetails.prezzo,
            primaryLocation,
            productDetails.immaginiArticolo
          );
          console.log("✅ Inventory adjustment successful:", result);

          // Always refresh logs and product data after modification
          await fetchLogs();

          // Refresh product data to show updated inventory
          console.log("🔄 Refreshing product data...");
          await handleSearchSelect(
            productDetails.id,
            lastSelectedQuery || productDetails.nomeArticolo
          );

          // Store the modified variant for undo operation
          setLastModifiedVariant(selectedVariant);

          // Show success modal
          setModifyModalVisible(true);

          // Show enhanced success message
          messageApi.success({
            content: result.message,
            duration: 4,
          });
        } catch (error) {
          console.error("❌ Error decreasing inventory:", error);
          messageApi.error(
            `Errore nella modifica del prodotto: ${
              error instanceof Error ? error.message : "Errore sconosciuto"
            }`
          );
        } finally {
          setIsModifyLoading(false);
        }
      },
    });
  };

  const handleUndoChange = async () => {
    console.log("🔄 handleUndoChange called", {
      selectedVariant,
      lastModifiedVariant,
      productDetails: !!productDetails,
    });
    if (!lastModifiedVariant || !productDetails) {
      console.log(
        "❌ Missing lastModifiedVariant or productDetails, returning early"
      );
      return;
    }

    console.log("⏳ Setting undo loading to true");
    setIsUndoLoading(true);
    try {
      // Get the variant details
      const variant = productDetails.varaintiArticolo.find(
        (v) => v.title === lastModifiedVariant
      );

      if (!variant) {
        throw new Error("Variante non trovata");
      }

      console.log(
        "🔄 Starting inventory undo for variant:",
        lastModifiedVariant
      );
      console.log("📦 Inventory item ID:", variant.inventory_item_id);
      console.log("🏪 Primary location:", primaryLocation);

      // Get location configuration to map location name to ID
      const locationConfig = await TauriAPI.Inventory.getLocationConfig();
      console.log("📍 Location config:", locationConfig);

      // Determine the correct location ID based on primary location
      // Note: This assumes the API locationConfig maps to our LOCATION_CONFIG
      const locationId =
        primaryLocation === LOCATION_CONFIG.availableLocations[0]
          ? locationConfig.primary_location.id
          : locationConfig.secondary_location.id;

      console.log("📍 Using location ID:", locationId, "for", primaryLocation);

      // Perform the inventory undo adjustment with Firebase logging
      const result = await TauriAPI.Inventory.undoDecreaseInventoryWithLogging(
        variant.inventory_item_id,
        locationId,
        productDetails.id,
        lastModifiedVariant,
        productDetails.nomeArticolo,
        productDetails.prezzo,
        primaryLocation,
        productDetails.immaginiArticolo
      );
      console.log("✅ Inventory undo successful:", result);

      await fetchLogs();

      // Refresh product data to show updated inventory
      console.log("🔄 Refreshing product data...");
      await handleSearchSelect(
        productDetails.id,
        lastSelectedQuery || productDetails.nomeArticolo
      );

      // Show success modal
      setUndoModalVisible(true);

      // Show enhanced success message
      messageApi.success({
        content: result.message,
        duration: 4,
      });
    } catch (error) {
      console.error("❌ Error undoing change:", error);
      messageApi.error(
        `Errore nell'annullamento: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    } finally {
      console.log("✅ Setting undo loading to false");
      setIsUndoLoading(false);
    }
  };

  const handleViewOnShopify = async () => {
    if (productDetails) {
      const url = `https://admin.shopify.com/store/cappelletto/products/${productDetails.id}`;
      try {
        await openUrl(url);
      } catch (error) {
        console.error("Failed to open Shopify admin:", error);
        messageApi.error("Impossibile aprire il link di Shopify");
      }
    }
  };

  const handleViewOnShop = async () => {
    if (productDetails) {
      // Use the actual Shopify handle from the product data
      const url = `https://www.cappellettoshop.com/products/${productDetails.handle}`;
      try {
        await openUrl(url);
      } catch (error) {
        console.error("Failed to open online shop:", error);
        messageApi.error("Impossibile aprire il link del negozio online");
      }
    }
  };

  const handleViewModificationHistory = () => {
    if (productDetails) {
      setModificationHistoryModalVisible(true);
    } else {
      messageApi.warning(
        "Seleziona prima un prodotto per visualizzare la cronologia modifiche"
      );
    }
  };

  const handleCreateCheckRequest = () => {
    if (productDetails) {
      setCheckRequestModalVisible(true);
    } else {
      messageApi.warning(
        "Seleziona prima un prodotto per creare una richiesta di controllo"
      );
    }
  };

  const handleTransferVariant = () => {
    // Support both single and multi-variant modes
    const variantsToTransfer = transferModeEnabled
      ? selectedVariants
      : selectedVariant
      ? [selectedVariant]
      : [];

    if (variantsToTransfer.length === 0 || !productDetails) {
      console.log("❌ No variants selected or no product details");
      return;
    }

    // Support both single and multiple variant transfers
    const isMultiple = variantsToTransfer.length > 1;

    if (!productDetails) return;

    // Validate all selected variants have inventory
    const variantDetails = variantsToTransfer
      .map((variantName) => {
        const variant = productDetails.varaintiArticolo.find(
          (v) => v.title === variantName
        );

        if (!variant) {
          messageApi.error(`Variante ${variantName} non trovata`);
          return null;
        }

        if (variant.inventory_quantity <= 0) {
          messageApi.warning(
            `La taglia ${variantName} non ha inventario a ${primaryLocation}. Non è possibile trasferire.`
          );
          return null;
        }

        return { title: variantName, inventory: variant.inventory_quantity };
      })
      .filter(Boolean);

    if (variantDetails.length === 0) {
      return;
    }

    if (variantDetails.length !== variantsToTransfer.length) {
      messageApi.error(
        "Alcune varianti selezionate non sono disponibili per il trasferimento"
      );
      return;
    }

    modal.confirm({
      title: isMultiple
        ? "Conferma Trasferimento Multiplo"
        : "Conferma Trasferimento",
      icon: <ExclamationCircleOutlined />,
      width: isMultiple ? 600 : 520,
      content: (
        <div>
          <p>
            Sei sicuro di voler trasferire{" "}
            {isMultiple ? "le seguenti varianti" : "1 unità della taglia"}{" "}
            {!isMultiple && <strong>{variantDetails[0]?.title}</strong>}{" "}
            dell'articolo <strong>{productDetails.nomeArticolo}</strong>?
          </p>

          {isMultiple && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: "#fff7e6",
                borderRadius: 6,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: 8 }}>
                Varianti da trasferire:
              </div>
              <ul style={{ marginTop: 8, marginBottom: 8, paddingLeft: 20 }}>
                {variantDetails.map((variant: any) => (
                  <li key={variant.title}>
                    <span>
                      {variant.title} (Inventario: {variant.inventory})
                    </span>
                  </li>
                ))}
              </ul>
              <div>
                <strong>Totale:</strong> {variantDetails.length} unità
              </div>
            </div>
          )}

          <p style={{ marginTop: 12 }}>
            <strong>Da:</strong> {primaryLocation} → <strong>A:</strong>{" "}
            {secondaryLocation}
          </p>

          <p style={{ color: "#fa8c16", fontSize: "12px", marginTop: 12 }}>
            ⚠️ Questa operazione{" "}
            {isMultiple ? "rimuoverà le unità" : "rimuoverà 1 unità"} da{" "}
            {primaryLocation} e {isMultiple ? "le" : "la"} aggiungerà a{" "}
            {secondaryLocation}
          </p>
        </div>
      ),
      okText: isMultiple ? "Trasferisci Tutto" : "Trasferisci",
      cancelText: "Annulla",
      okButtonProps: {
        style: { backgroundColor: "#fa8c16", borderColor: "#fa8c16" },
      },
      onOk: async () => {
        setIsTransferLoading(true);
        try {
          console.log("🚀 Transfer operation initiated:", {
            type: isMultiple ? "batch" : "single",
            variantCount: variantsToTransfer.length,
            variants: variantsToTransfer,
            fromLocation: primaryLocation,
            toLocation: secondaryLocation,
            productId: productDetails.id,
            productName: productDetails.nomeArticolo,
            timestamp: new Date().toISOString(),
          });

          console.log(
            `🔄 Starting ${
              isMultiple ? "batch" : "single"
            } inventory transfer for:`,
            variantsToTransfer
          );
          console.log("📦 From:", primaryLocation, "To:", secondaryLocation);

          let result;
          if (isMultiple) {
            // Execute batch transfer
            console.log("🔄 Starting batch transfer from main function:", {
              variantsToTransfer,
              count: variantsToTransfer.length,
              productId: productDetails.id,
              productName: productDetails.nomeArticolo,
            });
            const batchResult = await executeBatchTransfer(variantsToTransfer);
            console.log("📋 Batch transfer result received:", batchResult);

            // Store results for modal display
            setLastTransferredVariants(batchResult.completed);

            // Store failed transfers for modal display
            setTransferFailedVariants(batchResult.failed);

            if (
              batchResult.failed.length > 0 &&
              batchResult.completed.length === 0
            ) {
              // All transfers failed - still show modal but with error focus
              result = {
                message: `Nessun trasferimento completato (${batchResult.failed.length} falliti)`,
              };
            } else if (batchResult.failed.length > 0) {
              // Partial success
              result = {
                message: `Trasferiti ${batchResult.completed.length}/${variantsToTransfer.length} varianti da ${primaryLocation} a ${secondaryLocation}`,
              };
            } else {
              // All transfers succeeded
              result = {
                message: `Trasferiti ${batchResult.completed.length} varianti da ${primaryLocation} a ${secondaryLocation}`,
              };
            }
          } else {
            // Execute single transfer (existing logic)
            const variantName = variantsToTransfer[0];
            console.log("🔄 Processing single transfer:", {
              variantName,
              availableVariants: productDetails.varaintiArticolo.map(
                (v) => v.title
              ),
            });

            const variant = productDetails.varaintiArticolo.find(
              (v) => v.title === variantName
            );

            console.log("📦 Single variant lookup result:", {
              variantName,
              found: !!variant,
              variantDetails: variant,
            });

            if (!variant) {
              console.error("❌ Single transfer - variant not found:", {
                searchedVariant: variantName,
                availableVariants: productDetails.varaintiArticolo.map((v) => ({
                  title: v.title,
                  inventory_item_id: v.inventory_item_id,
                })),
              });
              throw new Error("Variante non trovata");
            }

            // Get location configuration to map location names to IDs
            const locationConfig = await TauriAPI.Inventory.getLocationConfig();
            console.log("📍 Location config:", locationConfig);

            // Determine the correct location IDs
            const fromLocationId =
              primaryLocation === LOCATION_CONFIG.availableLocations[0]
                ? locationConfig.primary_location.id
                : locationConfig.secondary_location.id;

            const toLocationId =
              secondaryLocation === LOCATION_CONFIG.availableLocations[0]
                ? locationConfig.primary_location.id
                : locationConfig.secondary_location.id;

            console.log(
              "📍 Transfer from location ID:",
              fromLocationId,
              "to:",
              toLocationId
            );

            console.log("📡 Making single transfer API call:", {
              inventory_item_id: variant.inventory_item_id,
              fromLocationId,
              toLocationId,
              productId: productDetails.id,
              variantName,
              productName: productDetails.nomeArticolo,
              price: productDetails.prezzo,
              primaryLocation,
              secondaryLocation,
            });

            // Execute the transfer via the backend API
            result = await TauriAPI.Inventory.transferInventoryBetweenLocations(
              variant.inventory_item_id,
              fromLocationId,
              toLocationId,
              productDetails.id,
              variantName,
              productDetails.nomeArticolo,
              productDetails.prezzo,
              primaryLocation,
              secondaryLocation,
              productDetails.immaginiArticolo
            );

            // Store the transferred variant for potential undo operation
            setLastTransferredVariant(variantName);

            console.log("✅ Single transfer API call successful:", {
              variantName,
              result,
            });
          }

          console.log("✅ Inventory transfer successful:", result);

          // Always refresh logs and product data after any transfer operation
          await fetchLogs();

          // Refresh product data to show updated inventory
          console.log("🔄 Refreshing product data...");
          await handleSearchSelect(
            productDetails.id,
            lastSelectedQuery || productDetails.nomeArticolo
          );

          // Show transfer success modal
          setTransferSuccessModalVisible(true);

          // Remove redundant success message - details shown in modal
        } catch (error) {
          console.error("❌ Error transferring inventory:", error);

          // If any transfers succeeded (in case of unexpected errors after partial completion),
          // still refresh the data
          if (lastTransferredVariants.length > 0) {
            console.log(
              "🔄 Refreshing data due to partial transfers before error..."
            );
            try {
              await fetchLogs();
              await handleSearchSelect(
                productDetails.id,
                lastSelectedQuery || productDetails.nomeArticolo
              );
            } catch (refreshError) {
              console.error(
                "❌ Error refreshing after partial transfer:",
                refreshError
              );
            }
          }

          // Remove redundant error message - errors shown in modal
          console.error("Transfer operation failed:", error);
        } finally {
          setIsTransferLoading(false);
        }
      },
    });
  };

  const handleUndoTransfer = async () => {
    console.log("🔄 handleUndoTransfer called", {
      lastTransferredVariant,
      lastTransferredVariants: lastTransferredVariants.length,
      productDetails: !!productDetails,
    });

    // Determine if we're undoing a batch or single transfer
    const variantsToUndo =
      lastTransferredVariants.length > 0
        ? lastTransferredVariants
        : lastTransferredVariant
        ? [lastTransferredVariant]
        : [];

    // Type guard to ensure we have valid variant names
    const validVariantsToUndo = variantsToUndo.filter(
      (v): v is string => v !== null
    );

    if (validVariantsToUndo.length === 0 || !productDetails) {
      console.log(
        "❌ No transferred variants to undo or productDetails missing, returning early"
      );
      return;
    }

    const variantToUndo = validVariantsToUndo[0]; // Use first validated variant

    console.log("⏳ Setting transfer loading to true");
    setIsTransferLoading(true);
    try {
      // Get the variant details
      const variant = productDetails.varaintiArticolo.find(
        (v) => v.title === variantToUndo
      );

      if (!variant) {
        throw new Error("Variante non trovata");
      }

      console.log("🔄 Starting transfer undo for variant:", variantToUndo);
      console.log("📦 From:", secondaryLocation, "To:", primaryLocation);

      // Get location configuration to map location names to IDs
      const locationConfig = await TauriAPI.Inventory.getLocationConfig();
      console.log("📍 Location config:", locationConfig);

      // Determine the correct location IDs (reverse of original transfer)
      const fromLocationId =
        secondaryLocation === LOCATION_CONFIG.availableLocations[0]
          ? locationConfig.primary_location.id
          : locationConfig.secondary_location.id;

      const toLocationId =
        primaryLocation === LOCATION_CONFIG.availableLocations[0]
          ? locationConfig.primary_location.id
          : locationConfig.secondary_location.id;

      console.log(
        "📍 Undo transfer from location ID:",
        fromLocationId,
        "to:",
        toLocationId
      );

      // Execute the reverse transfer
      const result = await TauriAPI.Inventory.transferInventoryBetweenLocations(
        variant.inventory_item_id,
        fromLocationId,
        toLocationId,
        productDetails.id,
        variantToUndo,
        productDetails.nomeArticolo,
        productDetails.prezzo,
        secondaryLocation,
        primaryLocation,
        productDetails.immaginiArticolo
      );

      console.log("✅ Transfer undo successful:", result);

      await fetchLogs();

      // Refresh product data to show updated inventory
      console.log("🔄 Refreshing product data...");
      await handleSearchSelect(
        productDetails.id,
        lastSelectedQuery || productDetails.nomeArticolo
      );

      // Show undo transfer success modal
      setUndoTransferModalVisible(true);

      // Show enhanced success message
      messageApi.success({
        content: result.message,
        duration: 4,
      });
    } catch (error) {
      console.error("❌ Error undoing transfer:", error);
      messageApi.error(
        `Errore nell'annullamento del trasferimento: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    } finally {
      console.log("✅ Setting transfer loading to false");
      setIsTransferLoading(false);
    }
  };

  // Handler for closing product-related modals while keeping product displayed and refreshed
  const handleProductModalClose = async (
    modalType: "transfer" | "modify" | "undo" | "undoTransfer"
  ) => {
    console.log(`🔄 Closing ${modalType} modal and refreshing product data...`);

    // Close the appropriate modal
    switch (modalType) {
      case "transfer":
        setTransferSuccessModalVisible(false);
        setLastTransferredVariant(null);
        setLastTransferredVariants([]);
        setTransferFailedVariants([]);
        break;
      case "modify":
        setModifyModalVisible(false);
        setLastModifiedVariant(null);
        break;
      case "undo":
        setUndoModalVisible(false);
        setLastModifiedVariant(null);
        break;
      case "undoTransfer":
        setUndoTransferModalVisible(false);
        setLastTransferredVariant(null);
        setLastTransferredVariants([]);
        break;
    }

    // Clear selections and loading states
    setSelectedVariant(null);
    setSelectedVariants([]);
    setIsTransferLoading(false);
    setIsModifyLoading(false);
    setIsUndoLoading(false);

    // Refresh the current product data if we have one
    if (productDetails && lastSelectedQuery) {
      try {
        console.log("🔄 Refreshing current product data...");
        await handleSearchSelect(productDetails.id, lastSelectedQuery);
        console.log("✅ Product data refreshed successfully");
      } catch (error) {
        console.error("❌ Error refreshing product data:", error);
        messageApi.error("Errore nel refresh del prodotto");
      }
    }
  };

  const handleReset = () => {
    setQuery("");
    setProductDetails(null);
    setSecondaryProductDetails(null);
    setSelectedVariant(null);
    setSelectedVariants([]); // Clear multi-variant selection
    setLastSelectedQuery("");
    setModifyModalVisible(false);
    setUndoModalVisible(false);
    setTransferSuccessModalVisible(false);
    setUndoTransferModalVisible(false);
    // Reset loading states
    setIsModifyLoading(false);
    setIsUndoLoading(false);
    setIsTransferLoading(false);
    // Clear last modified and transferred variants
    setLastModifiedVariant(null);
    setLastTransferredVariant(null);
    setLastTransferredVariants([]);
    setTransferFailedVariants([]); // Clear failed transfer variants
    setTransferProgress(null);
    // Reset search history navigation
    setHistoryIndex(-1);
  };

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={24} style={{ marginBottom: 24 }} align="middle">
        <Col span={4}></Col>
        <Col span={16}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1 }}>
                <SearchBar
                  query={query}
                  setQuery={setQuery}
                  onSelect={handleSearchSelect}
                  onAutoSelect={handleSearchSelect}
                  sortKey={searchSortKey}
                  sortReverse={searchSortReverse}
                  onNavigateHistory={navigateHistory}
                />
              </div>

              <Button
                type="text"
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleReset}
                style={{
                  color: "#999",
                  border: "none",
                  boxShadow: "none",
                  minWidth: "37px",
                  height: "37px",
                  padding: 0,
                }}
                title="Reset ricerca"
              />
            </div>
          </Space>
        </Col>
        <Col span={4}></Col>
      </Row>

      <Divider />

      {productDetails && (
        <Row gutter={24}>
          <Col span={12}>
            <Card>
              <Title level={3}>{productDetails.nomeArticolo}</Title>

              <Row gutter={16} style={{ marginBottom: 16 }}>
                {productDetails.immaginiArticolo
                  .slice(0, 2)
                  .map((image, index) => (
                    <Col span={12} key={index}>
                      <Image
                        width="100%"
                        src={image}
                        alt={`Product image ${index + 1}`}
                      />
                    </Col>
                  ))}
              </Row>

              {/* Price and Status Row */}
              <Row
                justify="center"
                align="middle"
                gutter={16}
                style={{ marginBottom: 16 }}
              >
                <Col>
                  <Tag
                    color="blue"
                    className="price-tag"
                    style={{ fontSize: 16, padding: "4px 12px" }}
                  >
                    € {productDetails.prezzo}
                  </Tag>
                </Col>
                <Col>
                  <Tag
                    color={
                      productDetails.recentlyModified ? "warning" : "success"
                    }
                    style={{ fontSize: 16, padding: "4px 12px" }}
                  >
                    {productDetails.recentlyModified
                      ? "Recentemente Modificato"
                      : "Non Recentemente Modificato"}
                  </Tag>
                </Col>
              </Row>

              {/* Description */}
              <Text>{productDetails.descrizioneArticolo}</Text>
            </Card>
          </Col>

          <Col span={12}>
            {/* Variants Layout - Side by Side */}
            <Row
              gutter={8}
              style={{
                marginBottom: 16,
                display: "flex",
                alignItems: "stretch",
              }}
            >
              {/* Primary Location Variants */}
              <Col span={secondaryPanelExpanded ? 12 : 18}>
                <Card
                  title={
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span>{negozio}</span>
                      <Badge
                        count={productDetails.varaintiArticolo.reduce(
                          (total, variant) =>
                            total + variant.inventory_quantity,
                          0
                        )}
                        showZero={true}
                        style={{
                          backgroundColor:
                            productDetails.varaintiArticolo.reduce(
                              (total, variant) =>
                                total + variant.inventory_quantity,
                              0
                            ) > 0
                              ? "#1890ff"
                              : "#f5222d",
                        }}
                        size="default"
                      />
                    </div>
                  }
                  style={{ height: "100%" }}
                >
                  <List
                    size="small"
                    split={false}
                    dataSource={productDetails.varaintiArticolo}
                    renderItem={(variant) => {
                      const isOutOfStock = variant.inventory_quantity <= 0;
                      const isSelected = transferModeEnabled
                        ? selectedVariants.includes(variant.title)
                        : selectedVariant === variant.title;

                      return (
                        <List.Item
                          style={{
                            cursor: "pointer",
                            backgroundColor: isSelected
                              ? "#e6f7ff"
                              : isOutOfStock
                              ? "#f5f5f5"
                              : "transparent",
                            padding: secondaryPanelExpanded
                              ? "6px 4px"
                              : "6px 8px",
                            border: isSelected
                              ? "1px solid #1890ff"
                              : "1px solid transparent",
                            borderRadius: "8px",
                            marginBottom: "3px",
                            opacity: isOutOfStock ? 0.6 : 1,
                            height: "36px",
                            display: "flex",
                            alignItems: "center",
                          }}
                          onClick={() =>
                            transferModeEnabled
                              ? handleMultiVariantToggle(variant.title)
                              : handleVariantSelect(variant.title)
                          }
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              width: "100%",
                              height: "100%",
                            }}
                          >
                            <div
                              style={{ display: "flex", alignItems: "center" }}
                            >
                              {transferModeEnabled && !isOutOfStock && (
                                <input
                                  type="checkbox"
                                  checked={selectedVariants.includes(
                                    variant.title
                                  )}
                                  readOnly
                                  style={{
                                    marginRight: "8px",
                                    pointerEvents: "none",
                                  }}
                                />
                              )}
                              <Text
                                style={{
                                  color: isOutOfStock ? "#999" : "inherit",
                                  textDecoration: isOutOfStock
                                    ? "line-through"
                                    : "none",
                                  fontSize: "14px",
                                  marginLeft:
                                    transferModeEnabled && isOutOfStock
                                      ? "24px"
                                      : "0", // Align with checkbox spacing
                                }}
                              >
                                {variant.title}
                              </Text>
                              {isOutOfStock && (
                                <Text
                                  style={{
                                    color: "#f5222d",
                                    fontSize: "10px",
                                    marginLeft: 4,
                                  }}
                                >
                                  (Esaurito)
                                </Text>
                              )}
                            </div>
                            <Badge
                              count={variant.inventory_quantity}
                              showZero={true}
                              style={{
                                backgroundColor:
                                  variant.inventory_quantity > 0
                                    ? "#52c41a"
                                    : "#f5222d",
                                marginRight: "46px",
                              }}
                              size="small"
                            />
                          </div>
                        </List.Item>
                      );
                    }}
                  />

                  {((transferModeEnabled && selectedVariants.length > 0) ||
                    (!transferModeEnabled && selectedVariant)) && (
                    <div style={{ marginTop: 12 }}>
                      {transferModeEnabled ? (
                        <Button
                          type="primary"
                          size="large"
                          onClick={handleTransferVariant}
                          loading={isTransferLoading}
                          disabled={selectedVariants.length === 0}
                          block
                          style={{
                            backgroundColor: "#fa8c16",
                            borderColor: "#fa8c16",
                          }}
                        >
                          Trasferisci{" "}
                          {selectedVariants.length > 1
                            ? `${selectedVariants.length} Varianti`
                            : "Variante"}
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          danger
                          size="large"
                          onClick={handleDecreaseInventory}
                          loading={isModifyLoading}
                          block
                        >
                          Modifica Variante
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              </Col>

              {/* Secondary Location Variants */}
              <Col span={secondaryPanelExpanded ? 12 : 6}>
                <Card
                  style={{ height: "100%" }}
                  title={
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setSecondaryPanelExpanded(!secondaryPanelExpanded)
                      }
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <span>{secondario}</span>
                        <Badge
                          count={
                            secondaryProductDetails?.availableVariants?.reduce(
                              (total, variant) =>
                                total + variant.inventory_quantity,
                              0
                            ) || 0
                          }
                          showZero={true}
                          style={{
                            backgroundColor:
                              (secondaryProductDetails?.availableVariants?.reduce(
                                (total, variant) =>
                                  total + variant.inventory_quantity,
                                0
                              ) || 0) > 0
                                ? "#1890ff"
                                : "#f5222d",
                          }}
                          size="default"
                        />
                      </div>
                      <Button
                        type="text"
                        icon={
                          secondaryPanelExpanded ? (
                            <LeftOutlined />
                          ) : (
                            <RightOutlined />
                          )
                        }
                      />
                    </div>
                  }
                >
                  {secondaryPanelExpanded ? (
                    // Expanded view - full list
                    secondaryProductDetails &&
                    secondaryProductDetails.availableVariants.length > 0 ? (
                      <List
                        size="small"
                        dataSource={secondaryProductDetails.availableVariants}
                        renderItem={(variant) => {
                          const isOutOfStock = variant.inventory_quantity <= 0;

                          return (
                            <List.Item
                              style={{
                                backgroundColor: isOutOfStock
                                  ? "#f5f5f5"
                                  : "transparent",
                                padding: "6px 8px",
                                border: "1px solid transparent",
                                borderRadius: "8px",
                                marginBottom: "3px",
                                opacity: isOutOfStock ? 0.6 : 1,
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  width: "100%",
                                  height: "100%",
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: isOutOfStock ? "#999" : "inherit",
                                      textDecoration: isOutOfStock
                                        ? "line-through"
                                        : "none",
                                      fontSize: "12px",
                                    }}
                                  >
                                    {variant.title}
                                  </Text>
                                  {isOutOfStock && (
                                    <Text
                                      style={{
                                        color: "#f5222d",
                                        fontSize: "10px",
                                        marginLeft: 4,
                                      }}
                                    >
                                      (Esaurito)
                                    </Text>
                                  )}
                                </div>
                                <Badge
                                  count={variant.inventory_quantity}
                                  showZero={true}
                                  style={{
                                    backgroundColor:
                                      variant.inventory_quantity > 0
                                        ? "#52c41a"
                                        : "#f5222d",
                                    marginRight: "46px",
                                  }}
                                  size="small"
                                />
                              </div>
                            </List.Item>
                          );
                        }}
                      />
                    ) : (
                      <Text style={{ fontSize: "12px" }}>
                        Nessuna variante a {secondario.toLowerCase()}
                      </Text>
                    )
                  ) : (
                    // Collapsed view - quantities aligned with primary variants using plain divs
                    <div style={{ padding: "0" }}>
                      {secondaryProductDetails &&
                      secondaryProductDetails.availableVariants.length > 0 ? (
                        <div>
                          {productDetails.varaintiArticolo.map(
                            (primaryVariant, index) => {
                              // Find matching variant in secondary location
                              const secondaryVariant =
                                secondaryProductDetails.availableVariants.find(
                                  (sv) => sv.title === primaryVariant.title
                                );

                              // Check if out of stock (either missing or 0/negative quantity)
                              const isOutOfStock =
                                !secondaryVariant ||
                                secondaryVariant.inventory_quantity <= 0;

                              return (
                                <div
                                  key={index}
                                  style={{
                                    padding: "6px 8px",
                                    border: "1px solid transparent",
                                    borderRadius: "8px",
                                    marginBottom: "3px",
                                    backgroundColor: isOutOfStock
                                      ? "#f5f5f5"
                                      : "transparent",
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    opacity: isOutOfStock ? 0.6 : 1,
                                    minHeight: "36px", // Match exact List.Item height
                                  }}
                                >
                                  <Badge
                                    count={
                                      secondaryVariant
                                        ? secondaryVariant.inventory_quantity
                                        : 0
                                    }
                                    showZero={true}
                                    style={{
                                      backgroundColor:
                                        secondaryVariant &&
                                        secondaryVariant.inventory_quantity > 0
                                          ? "#52c41a"
                                          : "#f5222d",
                                    }}
                                    size="small"
                                  />
                                </div>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            height: "100%",
                            padding: "16px 0",
                          }}
                        >
                          <Text
                            style={{ fontSize: "12px", textAlign: "center" }}
                          >
                            Nessuna
                            <br />
                            variante
                          </Text>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </Col>
            </Row>

            <Row gutter={16} justify="center">
              <Col span={6}>
                <Button
                  type="primary"
                  icon={<ShopOutlined />}
                  onClick={handleViewOnShopify}
                  size="large"
                  block
                >
                  Shopify
                </Button>
              </Col>
              <Col span={6}>
                <Button
                  type="primary"
                  icon={<GlobalOutlined />}
                  onClick={handleViewOnShop}
                  size="large"
                  block
                >
                  Sito
                </Button>
              </Col>
              <Col span={6}>
                <Button
                  type="default"
                  icon={<HistoryOutlined />}
                  onClick={handleViewModificationHistory}
                  size="large"
                  disabled={!productDetails}
                  block
                >
                  Cronologia
                </Button>
              </Col>
              <Col span={6}>
                <Button
                  type="default"
                  icon={<CheckCircleOutlined />}
                  onClick={handleCreateCheckRequest}
                  size="large"
                  disabled={!productDetails}
                  block
                >
                  Controlli
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      )}

      {/* Modify Success Modal */}
      <Modal
        title="Modifica Effettuata"
        open={modifyModalVisible}
        footer={null}
        closable={false}
      >
        <div style={{ textAlign: "center" }}>
          <p>
            Taglia <Text strong>{lastModifiedVariant}</Text> dell'articolo{" "}
            <Text strong>{productDetails?.nomeArticolo}</Text> è stata rimossa
          </p>
          <Space>
            <Button
              type="primary"
              danger
              icon={<UndoOutlined />}
              onClick={() => {
                console.log("🖱️ Annulla Operazione button clicked!");
                handleUndoChange();
              }}
              loading={isUndoLoading}
            >
              Annulla Operazione
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={() => handleProductModalClose("modify")}
            >
              Chiudi
            </Button>
          </Space>
        </div>
      </Modal>

      {/* Undo Success Modal */}
      <Modal
        title="Annullamento Effettuato"
        open={undoModalVisible}
        footer={null}
        closable={false}
      >
        <div style={{ textAlign: "center" }}>
          <p>
            Taglia <Text strong>{lastModifiedVariant}</Text> dell'articolo{" "}
            <Text strong>{productDetails?.nomeArticolo}</Text> è stata
            re-inserita
          </p>
          <Button
            type="primary"
            icon={<CloseOutlined />}
            onClick={() => handleProductModalClose("undo")}
          >
            Chiudi
          </Button>
        </div>
      </Modal>

      {/* Transfer Success Modal */}
      <Modal
        title={
          transferFailedVariants.length > 0
            ? `Trasferimenti ${
                lastTransferredVariants.length > 0 ? "Parzialmente " : ""
              }Completati`
            : lastTransferredVariants.length > 1
            ? "Trasferimenti Effettuati"
            : "Trasferimento Effettuato"
        }
        open={transferSuccessModalVisible}
        footer={null}
        closable={false}
        width={transferFailedVariants.length > 0 ? 650 : 520}
      >
        <div style={{ textAlign: "center" }}>
          {/* Success Section */}
          {lastTransferredVariants.length > 0 && (
            <div
              style={{
                marginBottom: transferFailedVariants.length > 0 ? 20 : 0,
              }}
            >
              <p
                style={{
                  color: "#52c41a",
                  fontWeight: "bold",
                  marginBottom: 12,
                }}
              >
                ✅{" "}
                {lastTransferredVariants.length > 1
                  ? "Trasferimenti Riusciti"
                  : "Trasferimento Riuscito"}
              </p>
              <p>
                <Text strong>
                  {lastTransferredVariants.length} variante
                  {lastTransferredVariants.length > 1 ? "i" : ""}
                </Text>{" "}
                dell'articolo <Text strong>{productDetails?.nomeArticolo}</Text>{" "}
                {lastTransferredVariants.length > 1
                  ? "sono state trasferite"
                  : "è stata trasferita"}{" "}
                da <Text strong>{primaryLocation}</Text> a{" "}
                <Text strong>{secondaryLocation}</Text>
              </p>
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  backgroundColor: "#f6ffed",
                  borderRadius: 6,
                  border: "1px solid #b7eb8f",
                }}
              >
                <Text strong>Varianti trasferite:</Text>
                <div style={{ marginTop: 8 }}>
                  {lastTransferredVariants.map((variant) => (
                    <Tag key={variant} color="green" style={{ margin: "2px" }}>
                      {variant}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Failure Section */}
          {transferFailedVariants.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <p
                style={{
                  color: "#ff4d4f",
                  fontWeight: "bold",
                  marginBottom: 12,
                }}
              >
                ❌ Trasferimenti Falliti
              </p>
              <div
                style={{
                  padding: 12,
                  backgroundColor: "#fff2f0",
                  borderRadius: 6,
                  border: "1px solid #ffccc7",
                  textAlign: "left",
                }}
              >
                <Text strong>Varianti non trasferite:</Text>
                <div style={{ marginTop: 8 }}>
                  {transferFailedVariants.map((failure) => (
                    <div key={failure.variant} style={{ marginBottom: 8 }}>
                      <Tag color="red" style={{ marginBottom: 4 }}>
                        {failure.variant}
                      </Tag>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          marginLeft: 4,
                        }}
                      >
                        {failure.error}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {transferFailedVariants.length > 0 &&
            lastTransferredVariants.length > 0 && (
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#fff7e6",
                  borderRadius: "6px",
                  border: "1px solid #ffd591",
                  marginBottom: 16,
                }}
              >
                <Text strong>
                  Riepilogo: {lastTransferredVariants.length} riusciti,{" "}
                  {transferFailedVariants.length} falliti
                </Text>
              </div>
            )}

          <Space style={{ marginTop: 16 }}>
            {lastTransferredVariants.length > 0 && (
              <Button
                type="primary"
                icon={<UndoOutlined />}
                onClick={() => {
                  console.log("🖱️ Annulla Trasferimento button clicked!");
                  handleUndoTransfer();
                }}
                loading={isTransferLoading}
                style={{
                  backgroundColor: "#fa8c16",
                  borderColor: "#fa8c16",
                }}
              >
                Annulla{" "}
                {lastTransferredVariants.length > 1
                  ? "Trasferimenti"
                  : "Trasferimento"}
              </Button>
            )}
            <Button
              type={lastTransferredVariants.length > 0 ? "default" : "primary"}
              icon={<CloseOutlined />}
              onClick={() => handleProductModalClose("transfer")}
            >
              Chiudi
            </Button>
          </Space>
        </div>
      </Modal>

      {/* Undo Transfer Success Modal */}
      <Modal
        title="Trasferimento Annullato"
        open={undoTransferModalVisible}
        footer={null}
        closable={false}
      >
        <div style={{ textAlign: "center" }}>
          <p>
            Taglia <Text strong>{lastTransferredVariant}</Text> dell'articolo{" "}
            <Text strong>{productDetails?.nomeArticolo}</Text> è stata
            ri-trasferita da <Text strong>{secondaryLocation}</Text> a{" "}
            <Text strong>{primaryLocation}</Text>
          </p>
          <Button
            type="primary"
            icon={<CloseOutlined />}
            onClick={() => handleProductModalClose("undoTransfer")}
          >
            Chiudi
          </Button>
        </div>
      </Modal>

      {/* Transfer Progress Modal */}
      <Modal
        title="Trasferimento in Corso"
        open={transferProgress !== null}
        footer={null}
        closable={false}
        maskClosable={false}
        width={500}
        zIndex={9999}
        style={{ zIndex: 9999 }}
      >
        {transferProgress && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>
                Trasferimento {transferProgress.current} di{" "}
                {transferProgress.total}
              </Text>
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  backgroundColor: "#f0f0f0",
                  borderRadius: "4px",
                  marginTop: "8px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    backgroundColor: "#fa8c16",
                    borderRadius: "4px",
                    width: `${
                      (transferProgress.current / transferProgress.total) * 100
                    }%`,
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text>
                Trasferendo:{" "}
                <Text strong>{transferProgress.currentVariant}</Text>
              </Text>
            </div>

            {transferProgress.completed.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">
                  Completati ({transferProgress.completed.length}):
                </Text>
                <div style={{ marginLeft: 16, marginTop: 4 }}>
                  {transferProgress.completed.map((variant) => (
                    <div
                      key={variant}
                      style={{ fontSize: "12px", color: "#52c41a" }}
                    >
                      ✓ {variant}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {transferProgress.failed.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">
                  Falliti ({transferProgress.failed.length}):
                </Text>
                <div style={{ marginLeft: 16, marginTop: 4 }}>
                  {transferProgress.failed.map((failure) => (
                    <div
                      key={failure.variant}
                      style={{ fontSize: "12px", color: "#f5222d" }}
                    >
                      ✗ {failure.variant}: {failure.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modification History Modal */}
      {productDetails && (
        <ModificationHistoryModal
          open={modificationHistoryModalVisible}
          onClose={() => setModificationHistoryModalVisible(false)}
          productId={productDetails.id}
          productName={productDetails.nomeArticolo}
          primaryLocation={primaryLocation}
        />
      )}

      {/* Check Request Modal */}
      {productDetails && (
        <CheckRequestModal
          open={checkRequestModalVisible}
          onClose={() => setCheckRequestModalVisible(false)}
          productDetails={productDetails}
          selectedVariant={selectedVariant}
          primaryLocation={primaryLocation}
        />
      )}

      {/* Settings Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            Impostazioni
          </Space>
        }
        open={settingsModalVisible}
        onCancel={onSettingsClose}
        footer={null}
        width={700}
      >
        <div style={{ padding: "16px 0" }}>
          <Row gutter={32}>
            {/* Left Column - General Settings */}
            <Col span={12}>
              <Title level={5}>Posizione Principale</Title>
              <Text
                type="secondary"
                style={{ marginBottom: 16, display: "block" }}
              >
                Seleziona la tua posizione principale. Questa sarà usata come
                negozio primario per la gestione dell'inventario.
              </Text>

              <Radio.Group
                value={primaryLocation}
                onChange={(e) => handleLocationChange(e.target.value)}
                style={{ width: "100%", marginBottom: 24 }}
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  {LOCATION_CONFIG.availableLocations.map((location) => (
                    <Radio
                      key={location}
                      value={location}
                      style={{ fontSize: 16, padding: "8px 0" }}
                    >
                      <Space>
                        <span>{location}</span>
                        {primaryLocation === location && (
                          <Tag color="blue">Principale</Tag>
                        )}
                        {LOCATION_CONFIG.getSecondaryLocation(
                          primaryLocation
                        ) === location && <Tag color="default">Secondario</Tag>}
                      </Space>
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>

              <Title level={5}>Modalità Trasferimenti</Title>
              <Text
                type="secondary"
                style={{ marginBottom: 16, display: "block" }}
              >
                Attiva la modalità trasferimenti per spostare inventario tra le
                posizioni. Quando attiva, apparirà un pulsante "Trasferisci"
                accanto a "Modifica Variante".
              </Text>

              <div style={{ marginBottom: 18 }}>
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <div>
                    <Text strong>Abilita Trasferimenti</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {transferModeEnabled
                        ? "Modalità trasferimenti attiva"
                        : "Modalità trasferimenti disattiva"}
                    </Text>
                  </div>
                  <Switch
                    checked={transferModeEnabled}
                    onChange={handleTransferModeChange}
                    checkedChildren="✓"
                    unCheckedChildren="✗"
                  />
                </Space>
              </div>
            </Col>

            {/* Right Column - Search Sorting */}
            <Col span={12}>
              <Title level={5}>Ordinamento Risultati Ricerca</Title>
              <Text
                type="secondary"
                style={{ marginBottom: 16, display: "block" }}
              >
                Scegli come ordinare i risultati quando cerchi prodotti per
                nome.
              </Text>

              <Radio.Group
                value={searchSortKey}
                onChange={(e) => handleSearchSortChange(e.target.value)}
                style={{ width: "100%" }}
              >
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Radio
                    value="RELEVANCE"
                    style={{ fontSize: 16, padding: "8px 0" }}
                  >
                    <Space>
                      <span>Rilevanza</span>
                      <Tag color="default">Predefinito</Tag>
                    </Space>
                  </Radio>
                  <Radio
                    value="UPDATED_AT"
                    style={{ fontSize: 16, padding: "8px 0" }}
                  >
                    <span>Aggiornati di recente</span>
                  </Radio>
                  <Radio
                    value="CREATED_AT"
                    style={{ fontSize: 16, padding: "8px 0" }}
                  >
                    <span>Più recenti</span>
                  </Radio>
                  <Radio
                    value="INVENTORY_TOTAL"
                    style={{ fontSize: 16, padding: "8px 0" }}
                  >
                    <span>Inventario totale</span>
                  </Radio>
                </Space>
              </Radio.Group>

              <div style={{ marginTop: 18 }}>
                <Space
                  style={{ width: "100%", justifyContent: "space-between" }}
                >
                  <div>
                    <Text strong>Ordine Invertito</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {searchSortReverse
                        ? "Dal più alto al più basso"
                        : "Dal più basso al più alto"}
                    </Text>
                  </div>
                  <Switch
                    checked={searchSortReverse}
                    onChange={handleSearchSortReverseChange}
                    checkedChildren="↓"
                    unCheckedChildren="↑"
                  />
                </Space>
              </div>
            </Col>
          </Row>

          <Divider style={{ marginTop: 24 }} />

          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 Suggerimento: Usa Cmd+, (Mac) o Ctrl+, (Windows) per aprire
            rapidamente le impostazioni
          </Text>
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;
