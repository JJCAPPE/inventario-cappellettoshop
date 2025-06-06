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
  Timeline,
  message,
  Button,
} from "antd";
import {
  HistoryOutlined,
  AppstoreOutlined,
  ShopOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import {
  ProductModificationHistory,
  VariantModificationHistory,
  ModificationDetail,
  TimeRangeOption,
  DailyModificationGroup,
} from "../types/index";
import TauriAPI from "../services/tauri";

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// Component for displaying net changes with proper formatting and colors
const NetChangeTag: React.FC<{
  value: number;
  source?: "app" | "shopify" | "total";
}> = ({ value, source = "total" }) => {
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

  const color =
    source === "app" ? "#1890ff" : source === "shopify" ? "#52c41a" : "#722ed1";
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

  // Get status tag based on modification data
  const getStatusTag = (variant: VariantModificationHistory) => {
    if (variant.discrepancy) {
      return (
        <Tag color="error" icon={<ExclamationCircleOutlined />}>
          Discrepanza
        </Tag>
      );
    } else if (
      variant.app_net_change === 0 &&
      variant.shopify_net_change === 0
    ) {
      return (
        <Tag color="default" icon={<InfoCircleOutlined />}>
          Nessuna Modifica
        </Tag>
      );
    } else {
      return (
        <Tag color="success" icon={<InfoCircleOutlined />}>
          Sincronizzato
        </Tag>
      );
    }
  };

  // Format modification details timeline
  const formatModificationTimeline = (details: ModificationDetail[]) => {
    return (
      <Timeline
        items={details.map((detail) => ({
          color: detail.source === "app" ? "#1890ff" : "#52c41a",
          dot:
            detail.source === "app" ? <AppstoreOutlined /> : <ShopOutlined />,
          children: (
            <div>
              <Space direction="vertical" size={2}>
                <Space>
                  <Text strong>
                    {detail.change > 0 ? `+${detail.change}` : detail.change}
                  </Text>
                  <Tag color={detail.source === "app" ? "blue" : "green"}>
                    {detail.source === "app" ? "App" : "Shopify"}
                  </Tag>
                  {detail.reason && <Tag color="default">{detail.reason}</Tag>}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(detail.timestamp).format("DD/MM/YYYY HH:mm")} (
                  {dayjs(detail.timestamp).fromNow()})
                </Text>
              </Space>
            </div>
          ),
        }))}
      />
    );
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
      render: (value: number) => <NetChangeTag value={value} source="app" />,
    },
    {
      title: (
        <span>
          <ShopOutlined style={{ color: "#52c41a", marginRight: 4 }} />
          Modifiche Shopify
        </span>
      ),
      dataIndex: "shopify_net_change",
      key: "shopify_net_change",
      align: "center" as const,
      render: (value: number) => (
        <NetChangeTag value={value} source="shopify" />
      ),
    },
    {
      title: "Stato",
      dataIndex: "status",
      key: "status",
      align: "center" as const,
      render: (_: any, record: VariantModificationHistory) =>
        getStatusTag(record),
    },
  ];

  // Expanded row render function
  const expandedRowRender = (record: VariantModificationHistory) => {
    if (record.daily_modifications.length === 0) {
      return (
        <div
          style={{
            backgroundColor: "#fafafa",
            padding: "16px",
            borderRadius: "4px",
          }}
        >
          <Alert
            message="Nessuna modifica registrata nel periodo selezionato"
            type="info"
            showIcon
            style={{ margin: 0 }}
          />
        </div>
      );
    }

    // Return daily modifications as simple table rows
    return (
      <div style={{ backgroundColor: "#fafafa" }}>
        {record.daily_modifications.map((dailyMod, index) => {
          const [year, month, day] = dailyMod.date.split("-");
          const formattedDate = `${day}/${month}/${year.slice(2)}`;

          return (
            <div
              key={dailyMod.date}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 16px",
                backgroundColor: "#fafafa",
                borderBottom:
                  index < record.daily_modifications.length - 1
                    ? "1px solid #f0f0f0"
                    : "none",
              }}
            >
              {/* Indent to show hierarchy */}
              <div style={{ width: "20px" }}></div>

              {/* Date column */}
              <div style={{ flex: 1, fontWeight: "normal", fontSize: "14px" }}>
                {formattedDate}
              </div>

              {/* App modifications column */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <NetChangeTag value={dailyMod.app_net_change} source="app" />
              </div>

              {/* Shopify modifications column */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <NetChangeTag
                  value={dailyMod.shopify_net_change}
                  source="shopify"
                />
              </div>

              {/* Status column */}
              <div style={{ flex: 1, textAlign: "center" }}>
                <Text
                  style={{
                    color: dailyMod.synchronized ? "#52c41a" : "#f5222d",
                    fontSize: 12,
                  }}
                >
                  {dailyMod.synchronized
                    ? "Sincronizzato"
                    : "Non Sincronizzato"}
                </Text>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Get row className for styling
  const getRowClassName = (record: VariantModificationHistory) => {
    if (record.discrepancy) {
      return "discrepancy-row";
    }
    return "";
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

        {data && data.variants.some((v) => v.discrepancy) && (
          <Alert
            message="Discrepanze Rilevate"
            description="Alcune varianti mostrano differenze tra le modifiche dell'app e quelle di Shopify. Controlla i dettagli espandendo le righe evidenziate."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Spin spinning={loading}>
          {data && (
            <Table
              columns={columns}
              dataSource={data.variants}
              rowKey="variant_title"
              pagination={false}
              expandable={{
                expandedRowRender,
                expandedRowKeys: expandedRows,
                onExpandedRowsChange: (keys) =>
                  setExpandedRows(keys as string[]),
                rowExpandable: (record) =>
                  record.app_net_change !== 0 ||
                  record.shopify_net_change !== 0,
                expandIcon: ({ expanded, onExpand, record }) => {
                  // Don't show expand icon if no modifications
                  if (
                    record.app_net_change === 0 &&
                    record.shopify_net_change === 0
                  ) {
                    return null;
                  }

                  return (
                    <Tooltip
                      title={
                        expanded
                          ? "Nascondi cronologia giornaliera"
                          : "Mostra cronologia giornaliera"
                      }
                    >
                      {expanded ? (
                        <CaretDownOutlined
                          onClick={(e) => onExpand(record, e)}
                          style={{
                            cursor: "pointer",
                            color: "#1890ff",
                          }}
                        />
                      ) : (
                        <CaretRightOutlined
                          onClick={(e) => onExpand(record, e)}
                          style={{
                            cursor: "pointer",
                            color: "#8c8c8c",
                          }}
                        />
                      )}
                    </Tooltip>
                  );
                },
              }}
              rowClassName={getRowClassName}
              size="middle"
            />
          )}
        </Spin>

        {data && data.variants.length === 0 && !loading && (
          <Alert
            message="Nessun dato disponibile"
            description="Non sono state trovate varianti per questo prodotto nel periodo selezionato."
            type="info"
            showIcon
          />
        )}
      </Modal>
    </>
  );
};

export default ModificationHistoryModal;
