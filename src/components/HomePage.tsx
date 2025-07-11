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
  message,
  Divider,
  Badge,
  Typography,
  Radio,
  Switch,
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
}

const HomePage: React.FC<HomePageProps> = ({
  targetProductId,
  onTargetProductProcessed,
  triggerSettingsModal,
  onSettingsTriggered,
  settingsModalVisible,
  onSettingsOpen,
  onSettingsClose,
}) => {
  const { fetchLogs } = useLogs();
  const [query, setQuery] = useState("");
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(
    null
  );
  const [secondaryProductDetails, setSecondaryProductDetails] =
    useState<SecondaryDetails | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [primaryLocation, setPrimaryLocation] = useState<LocationName>(
    LOCATION_CONFIG.defaultPrimary
  );
  const [secondaryLocation, setSecondaryLocation] = useState<LocationName>(
    LOCATION_CONFIG.getSecondaryLocation(LOCATION_CONFIG.defaultPrimary)
  );
  const [lastSelectedQuery, setLastSelectedQuery] = useState<string>("");
  const [modifyModalVisible, setModifyModalVisible] = useState(false);
  const [undoModalVisible, setUndoModalVisible] = useState(false);
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

  // Add state for pending settings changes
  const [pendingPrimaryLocation, setPendingPrimaryLocation] =
    useState<LocationName>(LOCATION_CONFIG.defaultPrimary);
  const [pendingSearchSortKey, setPendingSearchSortKey] =
    useState<string>("RELEVANCE");
  const [pendingSearchSortReverse, setPendingSearchSortReverse] =
    useState<boolean>(false);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);

  // Legacy variables for backward compatibility
  const negozio = primaryLocation;
  const secondario = secondaryLocation;

  useEffect(() => {
    // Load saved location preference from localStorage
    const savedLocation = localStorage.getItem("primaryLocation");
    if (savedLocation && LOCATION_CONFIG.isValidLocation(savedLocation)) {
      setPrimaryLocation(savedLocation);
      setSecondaryLocation(LOCATION_CONFIG.getSecondaryLocation(savedLocation));
      setPendingPrimaryLocation(savedLocation); // Initialize pending state
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
      setPendingSearchSortKey(savedSortKey); // Initialize pending state
    }

    // Load saved search sort reverse preference from localStorage
    const savedSortReverse = localStorage.getItem("searchSortReverse");
    if (savedSortReverse !== null) {
      setSearchSortReverse(savedSortReverse === "true");
      setPendingSearchSortReverse(savedSortReverse === "true"); // Initialize pending state
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

  // Clear selected variant if it has zero or negative inventory
  useEffect(() => {
    if (selectedVariant && productDetails) {
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
  }, [productDetails, selectedVariant]);

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

  // Reset pending settings when modal opens
  useEffect(() => {
    if (settingsModalVisible) {
      console.log(
        "⚙️ Settings modal opened - resetting pending values to current values"
      );
      setPendingPrimaryLocation(primaryLocation);
      setPendingSearchSortKey(searchSortKey);
      setPendingSearchSortReverse(searchSortReverse);
    }
  }, [settingsModalVisible, primaryLocation, searchSortKey, searchSortReverse]);

  // Update pending settings functions (don't apply immediately)
  const handlePendingLocationChange = (newPrimaryLocation: string) => {
    if (LOCATION_CONFIG.isValidLocation(newPrimaryLocation)) {
      setPendingPrimaryLocation(newPrimaryLocation);
    }
  };

  const handlePendingSearchSortChange = (newSortKey: string) => {
    setPendingSearchSortKey(newSortKey);
  };

  const handlePendingSearchSortReverseChange = (reverse: boolean) => {
    setPendingSearchSortReverse(reverse);
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
            message.warning(
              `Variante "${selectedVariant}" non disponibile nella nuova posizione`
            );
          }
        }
      }, 100);
    } catch (error) {
      console.error("❌ Error refreshing product with new location:", error);
      message.error("Errore nell'aggiornamento del prodotto");
    }
  };

  const handleSettingsOk = async () => {
    setIsSettingsSaving(true);

    try {
      // Check if location changed
      const locationChanged = pendingPrimaryLocation !== primaryLocation;

      // Apply all pending changes
      setPrimaryLocation(pendingPrimaryLocation);
      setSecondaryLocation(
        LOCATION_CONFIG.getSecondaryLocation(pendingPrimaryLocation)
      );
      setSearchSortKey(pendingSearchSortKey);
      setSearchSortReverse(pendingSearchSortReverse);

      // Save to localStorage
      localStorage.setItem("primaryLocation", pendingPrimaryLocation);
      localStorage.setItem("searchSortKey", pendingSearchSortKey);
      localStorage.setItem(
        "searchSortReverse",
        pendingSearchSortReverse.toString()
      );

      // Show success messages for what changed
      if (locationChanged) {
        message.success(
          `Posizione principale cambiata a ${pendingPrimaryLocation}`
        );

        // Refresh product data if location changed and there's a current product
        if (productDetails) {
          await refreshProductWithNewLocation(pendingPrimaryLocation);
        }
      }

      if (pendingSearchSortKey !== searchSortKey) {
        const sortLabels = {
          RELEVANCE: "Rilevanza",
          UPDATED_AT: "Aggiornati Recentemente",
          CREATED_AT: "Creati Recentemente",
          INVENTORY_TOTAL: "Quantità Totale",
        };

        message.success(
          `Ordine Risultati Ricerca: ${
            sortLabels[pendingSearchSortKey as keyof typeof sortLabels]
          }`
        );
      }

      if (pendingSearchSortReverse !== searchSortReverse) {
        const orderText = pendingSearchSortReverse
          ? "Decrescente"
          : "Crescente";
        message.success(`Ordine risultati: ${orderText}`);
      }
    } catch (error) {
      console.error("❌ Error applying settings:", error);
      message.error("Errore nell'applicazione delle impostazioni");
    } finally {
      setIsSettingsSaving(false);
      onSettingsClose?.();
    }
  };

  const handleSettingsCancel = () => {
    // Reset pending values to current values
    setPendingPrimaryLocation(primaryLocation);
    setPendingSearchSortKey(searchSortKey);
    setPendingSearchSortReverse(searchSortReverse);
    onSettingsClose?.();
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
      message.error("Prodotto non trovato, prova un altro barcode");
    }
  };

  const handleVariantSelect = (variant: string) => {
    // Check if the variant has negative inventory and prevent selection
    const variantObj = productDetails?.varaintiArticolo.find(
      (v) => v.title === variant
    );

    if (variantObj && variantObj.inventory_quantity < 0) {
      message.warning(
        `La taglia ${variant} ha quantità negativa. Non è possibile selezionarla.`
      );
      return;
    }

    setSelectedVariant(variant);
  };

  const handleDecreaseInventory = () => {
    if (!selectedVariant || !productDetails) return;

    // Check if the selected variant has 0 inventory
    const variant = productDetails.varaintiArticolo.find(
      (v) => v.title === selectedVariant
    );

    if (!variant) {
      message.error("Variante non trovata");
      return;
    }

    if (variant.inventory_quantity <= 0) {
      const quantityText = variant.inventory_quantity === 0 ? "0" : "negativa";
      message.warning(
        `La taglia ${selectedVariant} ha già quantità ${quantityText}. Non è possibile ridurla ulteriormente.`
      );
      return;
    }

    Modal.confirm({
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
          message.success({
            content: result.message,
            duration: 4,
          });
        } catch (error) {
          console.error("❌ Error decreasing inventory:", error);
          message.error(
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
      message.success({
        content: result.message,
        duration: 4,
      });
    } catch (error) {
      console.error("❌ Error undoing change:", error);
      message.error(
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
        message.error("Impossibile aprire il link di Shopify");
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
        message.error("Impossibile aprire il link del negozio online");
      }
    }
  };

  const handleViewModificationHistory = () => {
    if (productDetails) {
      setModificationHistoryModalVisible(true);
    } else {
      message.warning(
        "Seleziona prima un prodotto per visualizzare la cronologia modifiche"
      );
    }
  };

  const handleCreateCheckRequest = () => {
    if (productDetails) {
      setCheckRequestModalVisible(true);
    } else {
      message.warning(
        "Seleziona prima un prodotto per creare una richiesta di controllo"
      );
    }
  };

  const handleReset = () => {
    setQuery("");
    setProductDetails(null);
    setSecondaryProductDetails(null);
    setSelectedVariant(null);
    setLastSelectedQuery("");
    setModifyModalVisible(false);
    setUndoModalVisible(false);
    // Reset loading states
    setIsModifyLoading(false);
    setIsUndoLoading(false);
    // Clear last modified variant
    setLastModifiedVariant(null);
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
                      const isSelected = selectedVariant === variant.title;

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
                          onClick={() => handleVariantSelect(variant.title)}
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
                              <Text
                                style={{
                                  color: isOutOfStock ? "#999" : "inherit",
                                  textDecoration: isOutOfStock
                                    ? "line-through"
                                    : "none",
                                  fontSize: "14px",
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

                  {selectedVariant && (
                    <div style={{ marginTop: 12 }}>
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
            <Button icon={<CloseOutlined />} onClick={handleReset}>
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
          <Button type="primary" icon={<CloseOutlined />} onClick={handleReset}>
            Chiudi
          </Button>
        </div>
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
        onOk={handleSettingsOk}
        onCancel={handleSettingsCancel}
        okText="Salva"
        cancelText="Annulla"
        confirmLoading={isSettingsSaving}
        width={500}
      >
        <div style={{ padding: "16px 0" }}>
          <Title level={5}>Posizione Principale</Title>
          <Text type="secondary" style={{ marginBottom: 16, display: "block" }}>
            Seleziona la tua posizione principale. Questa sarà usata come
            negozio primario per la gestione dell'inventario.
          </Text>

          <Radio.Group
            value={pendingPrimaryLocation}
            onChange={(e) => handlePendingLocationChange(e.target.value)}
            style={{ width: "100%" }}
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
                    {pendingPrimaryLocation === location && (
                      <Tag color="blue">Principale</Tag>
                    )}
                    {LOCATION_CONFIG.getSecondaryLocation(
                      pendingPrimaryLocation
                    ) === location && <Tag color="default">Secondario</Tag>}
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>

          <Divider />

          <Title level={5}>Ordinamento Risultati Ricerca</Title>
          <Text type="secondary" style={{ marginBottom: 16, display: "block" }}>
            Scegli come ordinare i risultati quando cerchi prodotti per nome.
          </Text>

          <Radio.Group
            value={pendingSearchSortKey}
            onChange={(e) => handlePendingSearchSortChange(e.target.value)}
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
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
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
                checked={pendingSearchSortReverse}
                onChange={handlePendingSearchSortReverseChange}
                checkedChildren="↓"
                unCheckedChildren="↑"
              />
            </Space>
          </div>

          <Divider />

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
