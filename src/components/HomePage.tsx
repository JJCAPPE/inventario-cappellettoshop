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
  Collapse,
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
} from "@ant-design/icons";
import { openUrl } from "@tauri-apps/plugin-opener";
import SearchBar from "./SearchBar";
import { ProductDetails, SecondaryDetails } from "../types";
import { useLogs } from "../contexts/LogContext";
import TauriAPI from "../services/tauri";

const { Title, Text } = Typography;
const { Panel } = Collapse;

const version = import.meta.env.VITE_VERSION || "3.0.0";

const HomePage: React.FC = () => {
  const { fetchLogs, addLog } = useLogs();
  const [query, setQuery] = useState("");
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(
    null
  );
  const [secondaryProductDetails, setSecondaryProductDetails] =
    useState<SecondaryDetails | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [primaryLocation, setPrimaryLocation] = useState<string>("Treviso");
  const [secondaryLocation, setSecondaryLocation] =
    useState<string>("Mogliano");
  const [lastSelectedQuery, setLastSelectedQuery] = useState<string>("");
  const [modifyModalVisible, setModifyModalVisible] = useState(false);
  const [undoModalVisible, setUndoModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [searchSortKey, setSearchSortKey] = useState<string>("RELEVANCE");
  const [searchSortReverse, setSearchSortReverse] = useState<boolean>(false);

  // Legacy variables for backward compatibility
  const negozio = primaryLocation;
  const secondario = secondaryLocation;

  useEffect(() => {
    // Load saved location preference from localStorage
    const savedLocation = localStorage.getItem("primaryLocation");
    if (
      savedLocation &&
      (savedLocation === "Treviso" || savedLocation === "Mogliano")
    ) {
      setPrimaryLocation(savedLocation);
      setSecondaryLocation(
        savedLocation === "Treviso" ? "Mogliano" : "Treviso"
      );
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

    // Add keyboard shortcut listener for Cmd+, (settings)
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        setSettingsModalVisible(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Clear selected variant if it has zero inventory
  useEffect(() => {
    if (selectedVariant && productDetails) {
      const variantObj = productDetails.varaintiArticolo.find(
        (v) => v.title === selectedVariant
      );

      if (!variantObj || variantObj.inventory_quantity === 0) {
        console.log(
          `🚫 Clearing selected variant '${selectedVariant}' because it has zero inventory`
        );
        setSelectedVariant(null);
      }
    }
  }, [productDetails, selectedVariant]);

  const handleLocationChange = (newPrimaryLocation: string) => {
    setPrimaryLocation(newPrimaryLocation);
    setSecondaryLocation(
      newPrimaryLocation === "Treviso" ? "Mogliano" : "Treviso"
    );

    // Save to localStorage
    localStorage.setItem("primaryLocation", newPrimaryLocation);

    message.success(`Posizione principale cambiata a ${newPrimaryLocation}`);
  };

  const handleSearchSortChange = (newSortKey: string) => {
    setSearchSortKey(newSortKey);

    // Save to localStorage
    localStorage.setItem("searchSortKey", newSortKey);

    const sortLabels = {
      RELEVANCE: "Rilevanza",
      UPDATED_AT: "Aggiornati Recentemente",
      CREATED_AT: "Creati Recentemente",
      INVENTORY_TOTAL: "Quantità Totale",
    };

    message.success(
      `Ordine Risultati Ricerca: ${
        sortLabels[newSortKey as keyof typeof sortLabels]
      }`
    );
  };

  const handleSearchSortReverseChange = (reverse: boolean) => {
    setSearchSortReverse(reverse);

    // Save to localStorage
    localStorage.setItem("searchSortReverse", reverse.toString());

    const orderText = reverse ? "Decrescente" : "Crescente";
    message.success(`Ordine risultati: ${orderText}`);
  };

  const handleSettingsOk = () => {
    setSettingsModalVisible(false);
  };

  const handleSearchSelect = async (id: string, searchQuery: string) => {
    setLastSelectedQuery(searchQuery);

    try {
      console.log("🚀 HomePage: Starting product fetch for ID:", id);
      console.log("🔍 Search query was:", searchQuery);

      // Fetch the actual product from Shopify using Tauri API
      const product = await TauriAPI.Product.getProductById(id);
      console.log("✅ HomePage: Product fetched successfully:", product.title);

      // Get inventory levels for all variants to show location-specific data
      const inventoryItemIds = product.variants.map((v) => v.inventory_item_id);
      console.log(
        "📊 HomePage: Fetching inventory for items:",
        inventoryItemIds
      );

      const inventoryLevels =
        await TauriAPI.Inventory.getInventoryLevelsForLocations(
          inventoryItemIds,
          primaryLocation
        );
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
          inventory_item_id: variant.inventory_item_id,
          title: variant.title,
          inventory_quantity: variant.inventory_quantity,
        })),
        recentlyModified: false, // TODO: Implement recently modified logic
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

      // Auto-select variant if search was by SKU
      if (searchQuery && searchQuery.trim()) {
        console.log("🔍 HomePage: Checking if search was by SKU:", searchQuery);

        // Check if the search query matches any variant's actual SKU from the backend
        const skuMatchingVariant = product.variants.find((backendVariant) => {
          return (
            backendVariant.sku &&
            backendVariant.sku.toLowerCase() === searchQuery.toLowerCase()
          );
        });

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
              "⚠️ HomePage: Found SKU variant but it has zero inventory:",
              frontendVariant.title
            );
          }
        } else {
          console.log("ℹ️ HomePage: No exact SKU match found in variants");
        }
      }
    } catch (error) {
      console.error("❌ HomePage: Error fetching product:", error);
      message.error("Prodotto non trovato, prova un altro barcode");
    }
  };

  const handleVariantSelect = (variant: string) => {
    // Find the variant object to check inventory
    const variantObj = productDetails?.varaintiArticolo.find(
      (v) => v.title === variant
    );

    // Don't allow selection if variant has zero inventory
    if (!variantObj || variantObj.inventory_quantity === 0) {
      message.warning(`La taglia ${variant} non è disponibile (quantità: 0)`);
      return;
    }

    setSelectedVariant(variant);
  };

  const handleDecreaseInventory = () => {
    if (!selectedVariant || !productDetails) return;

    Modal.confirm({
      title: "Conferma Modifica",
      icon: <ExclamationCircleOutlined />,
      content: `Sei sicuro di voler rimuovere la taglia ${selectedVariant} dell'articolo ${productDetails.nomeArticolo}?`,
      okText: "Conferma",
      cancelText: "Annulla",
      onOk: async () => {
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
          const locationId =
            primaryLocation === "Treviso"
              ? locationConfig.primary_location.id
              : locationConfig.secondary_location.id;

          console.log(
            "📍 Using location ID:",
            locationId,
            "for",
            primaryLocation
          );

          // Prepare inventory update (decrease by 1)
          const inventoryUpdate = {
            variant_id: variant.inventory_item_id,
            location_id: locationId,
            adjustment: -1,
          };

          console.log("📝 Inventory update:", inventoryUpdate);

          // Perform the inventory adjustment
          const result = await TauriAPI.Inventory.adjustInventory([
            inventoryUpdate,
          ]);
          console.log("✅ Inventory adjustment successful:", result);

          // Add log entry for successful operation
          const logEntry = {
            requestType: "Rettifica",
            timestamp: new Date().toISOString(),
            data: {
              id: productDetails.id,
              variant: selectedVariant,
              negozio: primaryLocation,
              inventory_item_id: variant.inventory_item_id,
              nome: productDetails.nomeArticolo,
              prezzo: productDetails.prezzo,
              rettifica: -1,
              images: productDetails.immaginiArticolo,
            },
          };

          addLog(logEntry);
          await fetchLogs();

          // Refresh product data to show updated inventory
          console.log("🔄 Refreshing product data...");
          await handleSearchSelect(
            productDetails.id,
            lastSelectedQuery || productDetails.nomeArticolo
          );

          // Show success modal
          setModifyModalVisible(true);
          message.success(
            `Inventario diminuito con successo per ${selectedVariant}`
          );
        } catch (error) {
          console.error("❌ Error decreasing inventory:", error);
          message.error(
            `Errore nella modifica del prodotto: ${
              error instanceof Error ? error.message : "Errore sconosciuto"
            }`
          );
        }
      },
    });
  };

  const handleUndoChange = async () => {
    if (!selectedVariant || !productDetails) return;

    try {
      // Get the variant details
      const variant = productDetails.varaintiArticolo.find(
        (v) => v.title === selectedVariant
      );

      if (!variant) {
        throw new Error("Variante non trovata");
      }

      console.log("🔄 Starting inventory undo for variant:", selectedVariant);
      console.log("📦 Inventory item ID:", variant.inventory_item_id);
      console.log("🏪 Primary location:", primaryLocation);

      // Get location configuration to map location name to ID
      const locationConfig = await TauriAPI.Inventory.getLocationConfig();
      console.log("📍 Location config:", locationConfig);

      // Determine the correct location ID based on primary location
      const locationId =
        primaryLocation === "Treviso"
          ? locationConfig.primary_location.id
          : locationConfig.secondary_location.id;

      console.log("📍 Using location ID:", locationId, "for", primaryLocation);

      // Prepare inventory update (increase by 1 to undo)
      const inventoryUpdate = {
        variant_id: variant.inventory_item_id,
        location_id: locationId,
        adjustment: +1,
      };

      console.log("📝 Inventory undo update:", inventoryUpdate);

      // Perform the inventory adjustment
      const result = await TauriAPI.Inventory.adjustInventory([
        inventoryUpdate,
      ]);
      console.log("✅ Inventory undo successful:", result);

      // Add undo log entry
      const logEntry = {
        requestType: "Annullamento",
        timestamp: new Date().toISOString(),
        data: {
          id: productDetails.id,
          variant: selectedVariant,
          negozio: primaryLocation,
          inventory_item_id: variant.inventory_item_id,
          nome: productDetails.nomeArticolo,
          prezzo: productDetails.prezzo,
          rettifica: +1,
          images: productDetails.immaginiArticolo,
        },
      };

      addLog(logEntry);
      await fetchLogs();

      // Refresh product data to show updated inventory
      console.log("🔄 Refreshing product data...");
      await handleSearchSelect(
        productDetails.id,
        lastSelectedQuery || productDetails.nomeArticolo
      );

      // Show success modal
      setUndoModalVisible(true);
      message.success(
        `Annullamento completato con successo per ${selectedVariant}`
      );
    } catch (error) {
      console.error("❌ Error undoing change:", error);
      message.error(
        `Errore nell'annullamento: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
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
      // Convert product title to handle format (lowercase, spaces to dashes, remove special chars)
      const productHandle = productDetails.nomeArticolo
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");

      const url = `https://cappelletto.myshopify.com/products/${productHandle}`;
      try {
        await openUrl(url);
      } catch (error) {
        console.error("Failed to open online shop:", error);
        message.error("Impossibile aprire il link del negozio online");
      }
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
  };

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Badge count={version} color="#1890ff" />
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={18} offset={3}>
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
            <Card title={`Varianti ${negozio}`} style={{ marginBottom: 16 }}>
              <List
                dataSource={productDetails.varaintiArticolo}
                renderItem={(variant) => {
                  const isOutOfStock = variant.inventory_quantity === 0;
                  const isSelected = selectedVariant === variant.title;

                  return (
                    <List.Item
                      style={{
                        cursor: isOutOfStock ? "not-allowed" : "pointer",
                        backgroundColor: isSelected
                          ? "#e6f7ff"
                          : isOutOfStock
                          ? "#f5f5f5"
                          : "transparent",
                        padding: "8px 12px",
                        border: isSelected
                          ? "1px solid #1890ff"
                          : "1px solid transparent",
                        borderRadius: "8px",
                        marginBottom: "2px",
                        opacity: isOutOfStock ? 0.6 : 1,
                      }}
                      onClick={() => handleVariantSelect(variant.title)}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <Text
                            style={{
                              color: isOutOfStock ? "#999" : "inherit",
                              textDecoration: isOutOfStock
                                ? "line-through"
                                : "none",
                            }}
                          >
                            {variant.title}
                          </Text>
                          {isOutOfStock && (
                            <Text
                              style={{
                                color: "#f5222d",
                                fontSize: "12px",
                                marginLeft: 8,
                              }}
                            >
                              (Esaurito)
                            </Text>
                          )}
                        </div>
                        <Badge
                          count={variant.inventory_quantity}
                          style={{
                            backgroundColor:
                              variant.inventory_quantity > 0
                                ? "#52c41a"
                                : "#f5222d",
                          }}
                        />
                      </div>
                    </List.Item>
                  );
                }}
              />

              {selectedVariant && (
                <div style={{ marginTop: 16 }}>
                  <Button
                    type="primary"
                    danger
                    size="large"
                    onClick={handleDecreaseInventory}
                    block
                  >
                    Modifica Variante
                  </Button>
                </div>
              )}
            </Card>

            <Collapse style={{ marginBottom: 16 }}>
              <Panel header={`Varianti ${secondario}`} key="1">
                {secondaryProductDetails &&
                secondaryProductDetails.availableVariants.length > 0 ? (
                  <List
                    dataSource={secondaryProductDetails.availableVariants}
                    renderItem={(variant) => {
                      const isOutOfStock = variant.inventory_quantity === 0;

                      return (
                        <List.Item
                          style={{
                            backgroundColor: isOutOfStock
                              ? "#f5f5f5"
                              : "transparent",
                            padding: "8px 12px",
                            border: "1px solid transparent",
                            borderRadius: "8px",
                            marginBottom: "2px",
                            opacity: isOutOfStock ? 0.6 : 1,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              width: "100%",
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
                                }}
                              >
                                {variant.title}
                              </Text>
                              {isOutOfStock && (
                                <Text
                                  style={{
                                    color: "#f5222d",
                                    fontSize: "12px",
                                    marginLeft: 8,
                                  }}
                                >
                                  (Esaurito)
                                </Text>
                              )}
                            </div>
                            <Badge
                              count={variant.inventory_quantity}
                              style={{
                                backgroundColor:
                                  variant.inventory_quantity > 0
                                    ? "#52c41a"
                                    : "#f5222d",
                              }}
                            />
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                ) : (
                  <Text strong>
                    Nessuna variante disponibile a {secondario.toLowerCase()}
                  </Text>
                )}
              </Panel>
            </Collapse>

            <Space direction="vertical" style={{ width: "100%" }}>
              <Button
                type="default"
                icon={<ShopOutlined />}
                onClick={handleViewOnShopify}
                block
                size="large"
              >
                Visualizza su Shopify
              </Button>
              <Button
                type="primary"
                icon={<GlobalOutlined />}
                onClick={handleViewOnShop}
                block
                size="large"
              >
                Visualizza su Shop
              </Button>
            </Space>
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
            Taglia <Text strong>{selectedVariant}</Text> dell'articolo{" "}
            <Text strong>{productDetails?.nomeArticolo}</Text> è stata rimossa
          </p>
          <Space>
            <Button
              type="primary"
              danger
              icon={<UndoOutlined />}
              onClick={handleUndoChange}
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
            Taglia <Text strong>{selectedVariant}</Text> dell'articolo{" "}
            <Text strong>{productDetails?.nomeArticolo}</Text> è stata
            re-inserita
          </p>
          <Button type="primary" icon={<CloseOutlined />} onClick={handleReset}>
            Chiudi
          </Button>
        </div>
      </Modal>

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
        onCancel={() => setSettingsModalVisible(false)}
        okText="Salva"
        cancelText="Annulla"
        width={500}
      >
        <div style={{ padding: "16px 0" }}>
          <Title level={5}>Posizione Principale</Title>
          <Text type="secondary" style={{ marginBottom: 16, display: "block" }}>
            Seleziona la tua posizione principale. Questa sarà usata come
            negozio primario per la gestione dell'inventario.
          </Text>

          <Radio.Group
            value={primaryLocation}
            onChange={(e) => handleLocationChange(e.target.value)}
            style={{ width: "100%" }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Radio value="Treviso" style={{ fontSize: 16, padding: "8px 0" }}>
                <Space>
                  <span>Treviso</span>
                  {primaryLocation === "Treviso" && (
                    <Tag color="blue">Principale</Tag>
                  )}
                  {secondaryLocation === "Treviso" && (
                    <Tag color="default">Secondario</Tag>
                  )}
                </Space>
              </Radio>
              <Radio
                value="Mogliano"
                style={{ fontSize: 16, padding: "8px 0" }}
              >
                <Space>
                  <span>Mogliano</span>
                  {primaryLocation === "Mogliano" && (
                    <Tag color="blue">Principale</Tag>
                  )}
                  {secondaryLocation === "Mogliano" && (
                    <Tag color="default">Secondario</Tag>
                  )}
                </Space>
              </Radio>
            </Space>
          </Radio.Group>

          <Divider />

          <Title level={5}>Ordinamento Risultati Ricerca</Title>
          <Text type="secondary" style={{ marginBottom: 16, display: "block" }}>
            Scegli come ordinare i risultati quando cerchi prodotti per nome.
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
                checked={searchSortReverse}
                onChange={handleSearchSortReverseChange}
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
