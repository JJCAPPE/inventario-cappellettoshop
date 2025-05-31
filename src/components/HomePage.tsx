import React, { useState, useEffect } from "react";
import {
  Card,
  Input,
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
} from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  ShopOutlined,
  ExclamationCircleOutlined,
  UndoOutlined,
  CloseOutlined,
} from "@ant-design/icons";
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
  const [skuInput, setSkuInput] = useState("");
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(
    null
  );
  const [secondaryProductDetails, setSecondaryProductDetails] =
    useState<SecondaryDetails | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [negozio, setNegozio] = useState<string>("Treviso");
  const [secondario, setSecondario] = useState<string>("Mogliano");
  const [lastSelectedQuery, setLastSelectedQuery] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [modifyModalVisible, setModifyModalVisible] = useState(false);
  const [undoModalVisible, setUndoModalVisible] = useState(false);

  useEffect(() => {
    // TODO: Fetch location from backend when available
    // Mock location setup for now
    setNegozio("Treviso");
    setSecondario("Mogliano");
  }, []);

  const handleSearchSelect = async (id: string, searchQuery: string) => {
    setLastSelectedQuery(searchQuery);
    setLoading(true);

    try {
      console.log("Fetching product with ID:", id);

      // Fetch the actual product from Shopify using Tauri API
      const product = await TauriAPI.Product.getProductById(id);

      // Convert Tauri Product to our ProductDetails format
      const productDetails: ProductDetails = {
        nomeArticolo: product.title,
        id: product.id,
        prezzo: product.price,
        descrizioneArticolo: product.description || "",
        immaginiArticolo: product.images || [],
        varaintiArticolo: product.variants.map((variant) => ({
          inventory_item_id: variant.inventory_item_id,
          title: variant.title,
          inventory_quantity: variant.inventory_quantity,
        })),
        recentlyModified: false, // TODO: Implement recently modified logic
      };

      // Get inventory levels for all variants to show secondary location data
      const inventoryItemIds = product.variants.map((v) => v.inventory_item_id);
      const inventoryLevels = await TauriAPI.Inventory.getInventoryLevels(
        inventoryItemIds
      );

      // Create secondary details (for second location)
      const secondaryDetails: SecondaryDetails = {
        availableVariants: product.variants.map((variant) => {
          // Get inventory for secondary location (assume different location ID)
          const variantInventory =
            inventoryLevels[variant.inventory_item_id] || {};
          const secondaryLocationInventory =
            Object.values(variantInventory)[1] || 0; // Second location

          return {
            inventory_item_id: variant.inventory_item_id,
            title: variant.title,
            inventory_quantity: secondaryLocationInventory,
          };
        }),
      };

      setProductDetails(productDetails);
      setSecondaryProductDetails(secondaryDetails);
    } catch (error) {
      console.error("Error fetching product:", error);
      message.error("Prodotto non trovato, prova un altro barcode");
    } finally {
      setLoading(false);
    }
  };

  const handleSkuSubmit = async () => {
    if (!skuInput) return;

    setLoading(true);
    try {
      console.log("Searching by SKU:", skuInput);

      // Use exact SKU search first
      const exactProduct = await TauriAPI.Product.findProductByExactSku(
        skuInput
      );

      if (exactProduct) {
        // Found exact match, use it directly
        await handleSearchSelect(exactProduct.id, skuInput);
      } else {
        // Try partial SKU search
        const products = await TauriAPI.Product.searchProductsBySku(skuInput);

        if (products.length > 0) {
          // Use first result from partial search
          await handleSearchSelect(products[0].id, skuInput);
        } else {
          throw new Error("No products found with this SKU");
        }
      }
    } catch (error) {
      console.error("Error searching by SKU:", error);
      message.error("SKU non trovato");
    } finally {
      setLoading(false);
    }
  };

  const handleVariantSelect = (variant: string) => {
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
          // TODO: Implement actual inventory decrease when backend is ready
          console.log("Decreasing inventory for variant:", selectedVariant);

          // Mock success
          setModifyModalVisible(true);

          // Add log entry
          const logEntry = {
            requestType: "Rettifica",
            timestamp: new Date().toISOString(),
            data: {
              id: productDetails.id,
              variant: selectedVariant,
              negozio: negozio,
              inventory_item_id:
                productDetails.varaintiArticolo.find(
                  (v) => v.title === selectedVariant
                )?.inventory_item_id || "",
              nome: productDetails.nomeArticolo,
              prezzo: productDetails.prezzo,
              rettifica: -1,
              images: productDetails.immaginiArticolo,
            },
          };

          addLog(logEntry);
          fetchLogs();
        } catch (error) {
          console.error("Error decreasing inventory:", error);
          message.error("Errore nella modifica del prodotto");
        }
      },
    });
  };

  const handleUndoChange = async () => {
    if (!selectedVariant || !productDetails) return;

    try {
      // TODO: Implement actual undo when backend is ready
      console.log("Undoing change for variant:", selectedVariant);

      setUndoModalVisible(true);

      // Add undo log entry
      const logEntry = {
        requestType: "Annullamento",
        timestamp: new Date().toISOString(),
        data: {
          id: productDetails.id,
          variant: selectedVariant,
          negozio: negozio,
          inventory_item_id:
            productDetails.varaintiArticolo.find(
              (v) => v.title === selectedVariant
            )?.inventory_item_id || "",
          nome: productDetails.nomeArticolo,
          prezzo: productDetails.prezzo,
          rettifica: 1,
          images: productDetails.immaginiArticolo,
        },
      };

      addLog(logEntry);
      fetchLogs();
    } catch (error) {
      console.error("Error undoing change:", error);
      message.error("Errore nell'annullamento");
    }
  };

  const handleViewOnShopify = () => {
    if (productDetails) {
      const url = `https://admin.shopify.com/store/cappelletto/products/${productDetails.id}`;
      window.open(url, "_blank");
    }
  };

  const handleReset = () => {
    setSkuInput("");
    setProductDetails(null);
    setSecondaryProductDetails(null);
    setSelectedVariant(null);
    setLastSelectedQuery("");
    setModifyModalVisible(false);
    setUndoModalVisible(false);
  };

  const handleReinsertSearchQuery = () => {
    setQuery(lastSelectedQuery);
  };

  return (
    <div style={{ padding: 24 }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            Rimuovi Prodotti
          </Title>
        </Col>
        <Col>
          <Badge count={version} color="#1890ff" />
        </Col>
      </Row>

      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input
              size="large"
              placeholder="Inserisci SKU..."
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              onPressEnter={handleSkuSubmit}
              prefix={<SearchOutlined />}
              style={{ height: "37px" }}
            />
            <Space>
              <Button
                type="primary"
                size="large"
                onClick={handleSkuSubmit}
                loading={loading}
              >
                Cerca SKU
              </Button>
              <Button
                size="large"
                icon={<ReloadOutlined />}
                onClick={handleReset}
              >
                Reset
              </Button>
            </Space>
          </Space>
        </Col>
        <Col span={16}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <SearchBar
              query={query}
              setQuery={setQuery}
              onSelect={handleSearchSelect}
            />
            {lastSelectedQuery && (
              <Button type="dashed" onClick={handleReinsertSearchQuery}>
                ^ "{lastSelectedQuery}"
              </Button>
            )}
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

              <Tag
                color="blue"
                style={{ fontSize: 16, padding: "4px 12px", marginBottom: 16 }}
              >
                € {productDetails.prezzo}
              </Tag>

              <Text>{productDetails.descrizioneArticolo}</Text>

              <div style={{ marginTop: 16 }}>
                <Tag
                  color={
                    productDetails.recentlyModified ? "warning" : "success"
                  }
                >
                  {productDetails.recentlyModified
                    ? "Recentemente Modificato"
                    : "Non Recentemente Modificato"}
                </Tag>
              </div>
            </Card>
          </Col>

          <Col span={12}>
            <Card title={`Varianti ${negozio}`} style={{ marginBottom: 16 }}>
              <List
                dataSource={productDetails.varaintiArticolo}
                renderItem={(variant) => (
                  <List.Item
                    style={{
                      cursor: "pointer",
                      backgroundColor:
                        selectedVariant === variant.title
                          ? "#e6f7ff"
                          : "transparent",
                      padding: "8px 12px",
                      border:
                        selectedVariant === variant.title
                          ? "1px solid #1890ff"
                          : "1px solid transparent",
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
                      <Text>{variant.title}</Text>
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
                )}
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
                    renderItem={(variant) => (
                      <List.Item>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            width: "100%",
                          }}
                        >
                          <Text>{variant.title}</Text>
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
                    )}
                  />
                ) : (
                  <Text strong>
                    Nessuna variante disponibile a {secondario.toLowerCase()}
                  </Text>
                )}
              </Panel>
            </Collapse>

            <Button
              type="default"
              icon={<ShopOutlined />}
              onClick={handleViewOnShopify}
              block
              size="large"
            >
              Visualizza su Shopify
            </Button>
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
            Taglia <Text mark>{selectedVariant}</Text> dell'articolo{" "}
            <Text mark>{productDetails?.nomeArticolo}</Text> è stata rimossa
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
            Taglia <Text mark>{selectedVariant}</Text> dell'articolo{" "}
            <Text mark>{productDetails?.nomeArticolo}</Text> è stata re-inserita
          </p>
          <Button type="primary" icon={<CloseOutlined />} onClick={handleReset}>
            Chiudi
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;
