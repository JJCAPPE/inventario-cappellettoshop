import React, { useEffect } from "react";
import { Input, List, Avatar, Tag, Typography, Empty, Space } from "antd";
import { SearchOutlined, ShoppingOutlined } from "@ant-design/icons";
import { useLogs } from "../contexts/LogContext";
import dayjs from "dayjs";

const { Text, Title } = Typography;
const { Search } = Input;

const DataPage: React.FC = () => {
  const { logs, fetchLogs } = useLogs();

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSearch = (value: string) => {
    fetchLogs(value);
  };

  const formatTime = (timestamp: string) => {
    return dayjs(timestamp).format("HH:mm");
  };

  const getRequestTypeColor = (requestType: string) => {
    switch (requestType) {
      case "Rettifica":
        return "red";
      case "Annullamento":
        return "orange";
      default:
        return "blue";
    }
  };

  const getRequestTypeIcon = () => {
    return <ShoppingOutlined />;
  };

  return (
    <div style={{ padding: 16, height: "100%", backgroundColor: "#fafafa" }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        Modifiche Recenti
      </Title>

      <Search
        placeholder="Filtra modifiche..."
        allowClear
        onSearch={handleSearch}
        style={{ marginBottom: 16 }}
        prefix={<SearchOutlined />}
      />

      {logs.length === 0 ? (
        <Empty
          description="Nessuna modifica oggi"
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
                  log.requestType === "Annullamento" ? "#fff2e8" : "#fff",
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
