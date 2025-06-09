import React, { useState, useEffect } from "react";
import {
  Modal,
  Table,
  Select,
  Typography,
  Space,
  Tag,
  Alert,
  Spin,
  Tooltip,
  Badge,
  message,
  Button,
} from "antd";
import {
  HistoryOutlined,
  AppstoreOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  ProductModificationHistory,
  VariantModificationHistory,
  TimeRangeOption,
} from "../types/index";
import TauriAPI from "../services/tauri";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// Component for displaying net changes with proper formatting and colors
const NetChangeTag: React.FC<{
  value: number;
}> = ({ value }) => {
  if (value === 0) {
    return (
      <Badge
        count={0}
        style={{
          backgroundColor: "#d9d9d9",
          color: "#666",
        }}
        showZero
      />
    );
  }

  const color = "#1890ff"; // Always use app color
  const sign = value > 0 ? "+" : "";

  return (
    <Badge
      count={`${sign}${value}`}
      style={{
        backgroundColor: color,
        color: "#fff",
      }}
    />
  );
};

interface ModificationHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  primaryLocation: string;
}

// Time range options with Italian labels
const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { label: "1 Settimana", value: 7, description: "Ultimi 7 giorni" },
  { label: "2 Settimane", value: 14, description: "Ultimi 14 giorni" },
  { label: "1 Mese", value: 30, description: "Ultimi 30 giorni" },
  { label: "3 Mesi", value: 90, description: "Ultimi 90 giorni" },
  { label: "6 Mesi", value: 180, description: "Ultimi 180 giorni" },
];

const ModificationHistoryModal: React.FC<ModificationHistoryModalProps> = ({
  visible,
  onClose,
  productId,
  productName,
  primaryLocation,
}) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ProductModificationHistory | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(30); // Default to 1 month
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // Fetch modification history data
  const fetchModificationHistory = async (daysBack: number) => {
    setLoading(true);
    try {
      console.log(`🔍 Fetching modification history for product ${productId}`);
      const history = await TauriAPI.Inventory.getProductModificationHistory(
        productId,
        primaryLocation,
        daysBack
      );

      console.log("📊 Received modification history:", history);
      setData(history);

      // Don't auto-expand any rows - let user choose what to expand
      setExpandedRows([]);
    } catch (error) {
      console.error("❌ Error fetching modification history:", error);
      message.error("Errore nel caricamento della cronologia modifiche");
    } finally {
      setLoading(false);
    }
  };

  // Load data when modal opens or time range changes
  useEffect(() => {
    if (visible && productId) {
      fetchModificationHistory(selectedTimeRange);
    }
  }, [visible, productId, selectedTimeRange, primaryLocation]);

  // Handle time range change
  const handleTimeRangeChange = (value: number) => {
    setSelectedTimeRange(value);
  };

  // Handle modal close
  const handleClose = () => {
    setData(null);
    setExpandedRows([]);
    onClose();
  };

  // Table columns configuration
  const columns = [
    {
      title: "Variante",
      dataIndex: "variant_title",
      key: "variant_title",
      render: (title: string, record: VariantModificationHistory) => (
        <div>
          <Text strong>{title}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Quantità: {record.current_quantity}
          </Text>
        </div>
      ),
    },
    {
      title: (
        <span>
          <AppstoreOutlined style={{ color: "#1890ff", marginRight: 4 }} />
          Modifiche App
        </span>
      ),
      dataIndex: "app_net_change",
      key: "app_net_change",
      align: "center" as const,
      render: (value: number) => <NetChangeTag value={value} />,
    },
  ];

  // Render the timeline for daily modifications
  const expandedRowRender = (record: VariantModificationHistory) => {
    if (record.daily_modifications.length === 0) {
      return (
        <Alert
          message="Nessuna modifica registrata dall'app in questo periodo."
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ margin: "16px" }}
        />
      );
    }

    return (
      <div style={{ padding: "20px", backgroundColor: "#f9f9f9" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {record.daily_modifications.map((group, index) => (
            <div
              key={group.date}
              style={{
                display: "flex",
                width: "100%",
                gap: "20px",
                alignItems: "flex-start",
              }}
            >
              {/* Date section */}
              <div
                style={{
                  minWidth: "140px",
                  textAlign: "left",
                  paddingTop: "8px",
                }}
              >
                <Text strong style={{ fontSize: "16px", display: "block" }}>
                  {dayjs(group.date).format("DD/MM/YYYY")}
                </Text>
                <Text
                  type="secondary"
                  style={{ fontSize: "12px", display: "block" }}
                >
                  {dayjs(group.date).format("dddd")}
                </Text>
              </div>

              {/* Timeline connector */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingTop: "8px",
                }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "50%",
                    backgroundColor: "#1890ff",
                    border: "2px solid #fff",
                    boxShadow: "0 0 0 2px #1890ff",
                  }}
                />
                {index < record.daily_modifications.length - 1 && (
                  <div
                    style={{
                      width: "2px",
                      height: "80px",
                      backgroundColor: "#e6f4ff",
                      marginTop: "4px",
                    }}
                  />
                )}
              </div>

              {/* Content section */}
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    padding: "16px",
                    border: "1px solid #e6f4ff",
                    borderRadius: "8px",
                    backgroundColor: "#fff",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
                  }}
                >
                  <Space
                    align="center"
                    style={{
                      width: "100%",
                      marginBottom: "16px",
                      justifyContent: "space-between",
                    }}
                  >
                    <Title level={5} style={{ margin: 0, color: "#1890ff" }}>
                      <AppstoreOutlined style={{ marginRight: "8px" }} />
                      Modifiche App
                    </Title>
                    <NetChangeTag value={group.app_net_change} />
                  </Space>

                  {group.app_details.length > 0 ? (
                    <div style={{ marginLeft: "0" }}>
                      {group.app_details.map((detail, detailIndex) => (
                        <div
                          key={detailIndex}
                          style={{
                            padding: "12px 0",
                            borderBottom:
                              detailIndex < group.app_details.length - 1
                                ? "1px solid #f0f0f0"
                                : "none",
                          }}
                        >
                          <Space
                            direction="vertical"
                            size={4}
                            style={{ width: "100%" }}
                          >
                            <Space>
                              <Text strong style={{ fontSize: "14px" }}>
                                {detail.change > 0
                                  ? `+${detail.change}`
                                  : detail.change}
                              </Text>
                              <Tag color="blue">App</Tag>
                              {detail.reason && (
                                <Tag color="default">{detail.reason}</Tag>
                              )}
                            </Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs(detail.timestamp).format(
                                "DD/MM/YYYY HH:mm"
                              )}{" "}
                              ({dayjs(detail.timestamp).fromNow()})
                            </Text>
                          </Space>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Text type="secondary" style={{ fontStyle: "italic" }}>
                      Nessuna modifica registrata per questo giorno.
                    </Text>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const selectedTimeRangeOption = TIME_RANGE_OPTIONS.find(
    (option) => option.value === selectedTimeRange
  );

  return (
    <>
      <Modal
        title={
          <Space>
            <HistoryOutlined />
            <span>Cronologia Modifiche</span>
          </Space>
        }
        open={visible}
        onCancel={handleClose}
        footer={null}
        width={900}
        destroyOnClose
      >
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ margin: 0 }}>
            {productName}
          </Title>
          <Text type="secondary">
            Posizione: {primaryLocation} • ID Shopify Prodotto: {productId}
          </Text>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Space>
            <Text strong>Periodo di analisi:</Text>
            <Select
              value={selectedTimeRange}
              onChange={handleTimeRangeChange}
              style={{ width: 200 }}
              loading={loading}
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <Select.Option key={option.value} value={option.value}>
                  <Tooltip title={option.description}>{option.label}</Tooltip>
                </Select.Option>
              ))}
            </Select>
            {selectedTimeRangeOption && (
              <Text type="secondary">
                ({selectedTimeRangeOption.description})
              </Text>
            )}
          </Space>
        </div>

        <Spin spinning={loading} size="large">
          {data ? (
            <Table
              dataSource={data.variants}
              columns={columns}
              rowKey="inventory_item_id"
              pagination={false}
              expandable={{
                expandedRowRender,
                rowExpandable: (record) =>
                  record.daily_modifications.length > 0,
                expandedRowKeys: expandedRows,
                onExpand: (expanded, record) => {
                  const keys = expanded
                    ? [...expandedRows, record.inventory_item_id]
                    : expandedRows.filter(
                        (key) => key !== record.inventory_item_id
                      );
                  setExpandedRows(keys);
                },
                expandIcon: ({ expanded, onExpand, record }) =>
                  record.daily_modifications.length > 0 ? (
                    <Button
                      type="text"
                      shape="circle"
                      onClick={(e) => onExpand(record, e)}
                      icon={
                        expanded ? (
                          <CaretDownOutlined />
                        ) : (
                          <CaretRightOutlined />
                        )
                      }
                    />
                  ) : null,
              }}
            />
          ) : (
            !loading && (
              <Alert
                message="Nessun dato disponibile"
                description="Non sono state trovate varianti per questo prodotto nel periodo selezionato."
                type="info"
                showIcon
              />
            )
          )}
        </Spin>
      </Modal>
    </>
  );
};

export default ModificationHistoryModal;
