import React, { useEffect } from "react";
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
} from "antd";
import {
  SearchOutlined,
  ShoppingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useLogs } from "../contexts/LogContext";
import dayjs from "dayjs";

const { Text, Title } = Typography;
const { Search } = Input;

const DataPage: React.FC = () => {
  const { logs, loading, error, fetchLogs, refreshLogs } = useLogs();

  useEffect(() => {
    console.log(
      "📋 DataPage mounted - fetching fresh logs for modifications panel"
    );
    fetchLogs(undefined, true); // Force refresh when panel opens
  }, []); // Only run on mount

  const handleSearch = (value: string) => {
    console.log("🔍 DataPage: Searching logs with query:", value);
    fetchLogs(value);
  };

  const handleRefresh = () => {
    console.log("🔄 DataPage: Manual refresh button clicked");
    refreshLogs();
  };

  const formatTime = (timestamp: string) => {
    return dayjs(timestamp).format("DD/MM HH:mm");
  };

  const getRequestTypeColor = (requestType: string) => {
    switch (requestType) {
      case "Rettifica":
        return "green";
      case "Annullamento":
        return "red";
      default:
        return "blue";
    }
  };

  const getRequestTypeIcon = () => {
    return <ShoppingOutlined />;
  };

  // Get current location for display
  const currentLocation = localStorage.getItem("primaryLocation") || "Treviso";

  console.log(
    "📊 DataPage render - logs count:",
    logs.length,
    "loading:",
    loading,
    "error:",
    error
  );

  return (
    <div style={{ padding: 16, height: "100%", backgroundColor: "#fafafa" }}>
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
            {currentLocation}
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

      <Search
        placeholder="Filtra modifiche..."
        allowClear
        onSearch={handleSearch}
        style={{ marginBottom: 16 }}
        prefix={<SearchOutlined />}
        disabled={loading}
      />

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

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px 0" }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              Caricamento modifiche per {currentLocation}...
            </Text>
          </div>
        </div>
      ) : logs.length === 0 ? (
        <Empty
          description={
            error
              ? "Errore nel caricamento delle modifiche"
              : `Nessuna modifica nelle ultime 24 ore per ${currentLocation}`
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <List
          itemLayout="horizontal"
          dataSource={logs}
          renderItem={(log) => (
            <List.Item
              style={{
                backgroundColor:
                  log.requestType === "Annullamento"
                    ? "#ffebee" // Light red background for Annullamento
                    : log.requestType === "Rettifica"
                    ? "#e8f5e8" // Light green background for Rettifica
                    : "#fff", // Default white for other types
                border: "1px solid #f0f0f0",
                borderRadius: 8,
                marginBottom: 8,
                padding: 12,
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
                    {log.data.images && log.data.images[0] ? (
                      <Avatar
                        src={log.data.images[0]}
                        size={48}
                        shape="square"
                        style={{ marginBottom: 4 }}
                      />
                    ) : (
                      <Avatar
                        icon={getRequestTypeIcon()}
                        size={48}
                        shape="square"
                        style={{ marginBottom: 4 }}
                      />
                    )}
                    {log.data.variant !== "Default Title" && (
                      <Text strong style={{ fontSize: 12 }}>
                        {log.data.variant}
                      </Text>
                    )}
                  </div>
                }
                title={
                  <div>
                    <Text strong style={{ fontSize: 14 }}>
                      {log.data.nome}
                    </Text>
                    <br />
                    <Space>
                      <Tag color={getRequestTypeColor(log.requestType)}>
                        {log.requestType}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        da {log.data.negozio}
                      </Text>
                    </Space>
                  </div>
                }
                description={
                  <div>
                    <Space direction="vertical" size={2}>
                      <Text style={{ fontSize: 12 }}>
                        <strong>Orario:</strong> {formatTime(log.timestamp)}
                      </Text>
                      <Text style={{ fontSize: 12 }}>
                        <strong>Prezzo:</strong> €{log.data.prezzo}
                      </Text>
                      <Text style={{ fontSize: 12 }}>
                        <strong>Quantità Rettifica:</strong>{" "}
                        <Text
                          style={{
                            color:
                              log.data.rettifica > 0 ? "#52c41a" : "#f5222d",
                            fontWeight: "bold",
                          }}
                        >
                          {log.data.rettifica > 0 ? "+" : ""}
                          {log.data.rettifica}
                        </Text>
                      </Text>
                    </Space>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default DataPage;
