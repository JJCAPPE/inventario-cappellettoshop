import React, { useState, useEffect } from "react";
import {
  Input,
  List,
  Avatar,
  Tag,
  Typography,
  Empty,
  Space,
  Button,
  Alert,
  Spin,
  Select,
  DatePicker,
  Row,
  Col,
} from "antd";
import {
  SearchOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/it";
import TauriAPI, { CheckRequest } from "../services/tauri";
import CheckRequestActionModal from "./CheckRequestActionModal";

// Configure dayjs
dayjs.extend(relativeTime);
dayjs.locale("it");

const { Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface CheckRequestsPageProps {
  onNavigateToProduct?: (productId: string) => void;
}

const CheckRequestsPage: React.FC<CheckRequestsPageProps> = ({
  onNavigateToProduct,
}) => {
  const [checkRequests, setCheckRequests] = useState<CheckRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<CheckRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>(
    undefined
  );
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    "pending"
  );
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    null
  );
  const [selectedRequest, setSelectedRequest] = useState<CheckRequest | null>(
    null
  );
  const [actionModalVisible, setActionModalVisible] = useState(false);

  // Get current location for filtering
  const currentLocation = localStorage.getItem("primaryLocation") || "Treviso";

  useEffect(() => {
    console.log("📋 CheckRequestsPage mounted - fetching check requests");
    fetchCheckRequests();
  }, [currentLocation]);

  useEffect(() => {
    // Apply filters whenever any filter changes
    applyFilters();
  }, [checkRequests, searchQuery, priorityFilter, statusFilter, dateRange]);

  const fetchCheckRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const requests = await TauriAPI.Firebase.getCheckRequests(
        currentLocation
      );
      setCheckRequests(requests);
      console.log(
        `📊 Loaded ${requests.length} check requests for ${currentLocation}`
      );
    } catch (error) {
      console.error("❌ Error fetching check requests:", error);
      setError(error instanceof Error ? error.message : "Errore sconosciuto");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...checkRequests];

    // Text search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (request) =>
          request.product_name.toLowerCase().includes(query) ||
          request.requested_by.toLowerCase().includes(query) ||
          request.notes.toLowerCase().includes(query) ||
          (request.variant_name &&
            request.variant_name.toLowerCase().includes(query))
      );
    }

    // Priority filter
    if (priorityFilter) {
      filtered = filtered.filter(
        (request) => request.priority === priorityFilter
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter((request) => request.status === statusFilter);
    }

    // Date range filter
    if (dateRange) {
      const [startDate, endDate] = dateRange;
      filtered = filtered.filter((request) => {
        const requestDate = dayjs(request.timestamp);
        return (
          requestDate.isAfter(startDate.startOf("day")) &&
          requestDate.isBefore(endDate.endOf("day"))
        );
      });
    }

    // Sort by timestamp (newest first)
    filtered.sort(
      (a, b) => dayjs(b.timestamp).unix() - dayjs(a.timestamp).unix()
    );

    setFilteredRequests(filtered);
  };

  const handleSearch = (value: string) => {
    console.log("🔍 CheckRequestsPage: Searching with query:", value);
    setSearchQuery(value);
  };

  const handleRefresh = () => {
    console.log("🔄 CheckRequestsPage: Manual refresh button clicked");
    fetchCheckRequests();
  };

  const formatTime = (timestamp: string) => {
    return dayjs(timestamp).format("DD/MM HH:mm");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#f5222d";
      case "medium":
        return "#faad14";
      case "low":
        return "#52c41a";
      default:
        return "#999";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "orange";
      case "completed":
        return "green";
      case "cancelled":
        return "red";
      default:
        return "default";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <ClockCircleOutlined />;
      case "completed":
        return <CheckCircleOutlined />;
      case "cancelled":
        return <CloseCircleOutlined />;
      default:
        return <ExclamationCircleOutlined />;
    }
  };

  const handleRequestClick = (request: CheckRequest) => {
    if (request.status === "pending") {
      setSelectedRequest(request);
      setActionModalVisible(true);
    } else if (onNavigateToProduct) {
      // Navigate to product for completed/cancelled requests
      console.log(
        "🔄 CheckRequestsPage: Navigating to product:",
        request.product_id.toString()
      );
      onNavigateToProduct(request.product_id.toString());
    }
  };

  const handleRequestUpdated = () => {
    // Refresh the list after updating a request
    fetchCheckRequests();
    setActionModalVisible(false);
    setSelectedRequest(null);
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    } else {
      setDateRange(null);
    }
  };

  return (
    <div style={{ padding: 16, height: "100%", backgroundColor: "#fafafa" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Tag
            className="location-tag"
            style={{
              fontSize: 14,
              padding: "4px 12px",
              backgroundColor: "#492513",
              color: "#FFF2E3",
              border: "1px solid #492513",
              fontWeight: "bold",
            }}
          >
            Controlli {currentLocation}
          </Tag>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading}
          type="default"
        >
          Aggiorna
        </Button>
      </div>

      {/* Filters */}
      <div style={{ marginBottom: 16 }}>
        {/* Search Bar Row */}
        <Row style={{ marginBottom: 8 }}>
          <Col span={24}>
            <Search
              placeholder="Cerca controlli..."
              allowClear
              onSearch={handleSearch}
              prefix={<SearchOutlined />}
              disabled={loading}
            />
          </Col>
        </Row>

        {/* Filters Row */}
        <Row gutter={12}>
          <Col span={12}>
            <Select
              placeholder="Priorità"
              allowClear
              value={priorityFilter}
              onChange={setPriorityFilter}
              style={{ width: "100%" }}
            >
              <Option value="high">
                <Space>
                  <span style={{ color: "#f5222d" }}>●</span>
                  Alta
                </Space>
              </Option>
              <Option value="medium">
                <Space>
                  <span style={{ color: "#faad14" }}>●</span>
                  Media
                </Space>
              </Option>
              <Option value="low">
                <Space>
                  <span style={{ color: "#52c41a" }}>●</span>
                  Bassa
                </Space>
              </Option>
            </Select>
          </Col>
          <Col span={12}>
            <Select
              placeholder="Stato"
              allowClear
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: "100%" }}
            >
              <Option value="pending">In attesa</Option>
              <Option value="completed">Completato</Option>
              <Option value="cancelled">Annullato</Option>
            </Select>
          </Col>
        </Row>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert
          message="Errore nel caricamento"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={handleRefresh}>
              Riprova
            </Button>
          }
        />
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              Caricamento controlli per {currentLocation}...
            </Text>
          </div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <Empty
          description={
            error
              ? "Errore nel caricamento dei controlli"
              : checkRequests.length === 0
              ? `Nessun controllo trovato per ${currentLocation}`
              : "Nessun controllo corrisponde ai filtri"
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={filteredRequests}
          renderItem={(request) => (
            <List.Item
              onClick={() => handleRequestClick(request)}
              style={{
                backgroundColor:
                  request.status === "completed" ||
                  request.status === "cancelled"
                    ? "#e8f5e8" // Light green background for completed/cancelled
                    : "#ffebee", // Light red background for pending
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                marginBottom: 8,
                padding: 12,
                cursor: "pointer",
                transition: "box-shadow 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <List.Item.Meta
                avatar={
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                    }}
                  >
                    {request.image_url ? (
                      <Avatar
                        size={128}
                        shape="square"
                        src={request.image_url}
                        style={{ marginBottom: 4 }}
                      />
                    ) : (
                      <Avatar
                        icon={getStatusIcon(request.status)}
                        size={129}
                        shape="square"
                        style={{
                          backgroundColor: getPriorityColor(request.priority),
                          marginBottom: 4,
                        }}
                      />
                    )}
                    <Text strong style={{ fontSize: 10 }}>
                      ID: {request.product_id}
                    </Text>
                  </div>
                }
                title={
                  <div>
                    <Text strong style={{ fontSize: 14 }}>
                      {request.product_name}
                    </Text>
                    <br />
                    <Space>
                      <Tag color={getStatusColor(request.status)}>
                        {request.status === "pending"
                          ? "In attesa"
                          : request.status === "completed"
                          ? "Completato"
                          : "Annullato"}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        da {request.requested_by}
                      </Text>
                    </Space>
                  </div>
                }
                description={
                  <div>
                    <Space direction="vertical" size={2}>
                      <Text style={{ fontSize: 12 }}>
                        <strong>Richiesto:</strong>{" "}
                        {formatTime(request.timestamp)}
                      </Text>
                      <Text style={{ fontSize: 12 }}>
                        <strong>Variante:</strong>{" "}
                        {request.check_all || request.variant_name === "all"
                          ? "Tutte Le Varianti"
                          : request.variant_name}
                      </Text>
                      <Text style={{ fontSize: 12 }}>
                        <strong>Priorità:</strong>{" "}
                        <span
                          style={{ color: getPriorityColor(request.priority) }}
                        >
                          ●{" "}
                          {request.priority === "high"
                            ? "Alta"
                            : request.priority === "medium"
                            ? "Media"
                            : "Bassa"}
                        </span>
                      </Text>
                      {request.notes && (
                        <Text style={{ fontSize: 12 }}>
                          <strong>Note:</strong> {request.notes}
                        </Text>
                      )}
                      {request.closing_notes && (
                        <Text style={{ fontSize: 12, color: "#666" }}>
                          <strong>Note chiusura:</strong>{" "}
                          {request.closing_notes}
                        </Text>
                      )}
                    </Space>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}

      {/* Action Modal */}
      {selectedRequest && (
        <CheckRequestActionModal
          visible={actionModalVisible}
          onClose={() => {
            setActionModalVisible(false);
            setSelectedRequest(null);
          }}
          checkRequest={selectedRequest}
          onRequestUpdated={handleRequestUpdated}
          onNavigateToProduct={onNavigateToProduct}
        />
      )}
    </div>
  );
};

export default CheckRequestsPage;
