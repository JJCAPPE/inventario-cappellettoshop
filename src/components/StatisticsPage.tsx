import React, { useState, useEffect } from "react";
import {
  Card,
  Statistic,
  Row,
  Col,
  Typography,
  Progress,
  List,
  Tag,
  Space,
  DatePicker,
  Spin,
  Alert,
  Button,
} from "antd";
import {
  ShoppingCartOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  BarChartOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { TauriAPI } from "../services/tauri";
import { LogEntry } from "../types/index";
import dayjs, { Dayjs } from "dayjs";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface StatData {
  totalModifications: number;
  todayModifications: number;
  undoCount: number;
  modificationCount: number;
  trevisoCount: number;
  moglianoCount: number;
}

const StatisticsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("week"),
    dayjs().endOf("week"),
  ]);
  const [stats, setStats] = useState<StatData>({
    totalModifications: 0,
    todayModifications: 0,
    undoCount: 0,
    modificationCount: 0,
    trevisoCount: 0,
    moglianoCount: 0,
  });

  // Get current location
  const currentLocation = localStorage.getItem("primaryLocation") || "Treviso";

  useEffect(() => {
    fetchLogsForDateRange();
  }, [dateRange, currentLocation]);

  useEffect(() => {
    calculateStats();
  }, [logs]);

  const fetchLogsForDateRange = async () => {
    try {
      setLoading(true);
      setError(null);

      const startDate = dateRange[0].format("YYYY-MM-DD");
      const endDate = dateRange[1].format("YYYY-MM-DD");

      console.log(
        "📊 Fetching statistics for date range:",
        startDate,
        "to",
        endDate
      );
      console.log("🏪 Location:", currentLocation);

      const fetchedLogs = await TauriAPI.Firebase.getLogsDateRange(
        startDate,
        endDate,
        undefined, // No query filter for statistics
        currentLocation
      );

      // Convert backend format to frontend format
      const formattedLogs: LogEntry[] = fetchedLogs.map((log) => ({
        requestType: log.requestType,
        timestamp: log.timestamp,
        data: log.data,
      }));

      console.log(
        `📊 Statistics: Found ${formattedLogs.length} logs for ${currentLocation} from ${startDate} to ${endDate}`
      );
      setLogs(formattedLogs);
    } catch (error) {
      console.error("❌ Error fetching logs for statistics:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setError(`Failed to fetch statistics: ${errorMessage}`);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (
    dates: [Dayjs | null, Dayjs | null] | null
  ) => {
    if (dates && dates[0] && dates[1]) {
      setDateRange([dates[0], dates[1]]);
    }
  };

  const handleRefresh = () => {
    console.log("🔄 Manual refresh requested for statistics");
    fetchLogsForDateRange();
  };

  const calculateStats = () => {
    const today = dayjs().startOf("day");

    const todayLogs = logs.filter((log) => dayjs(log.timestamp).isAfter(today));

    const undoLogs = logs.filter((log) => log.requestType === "Annullamento");
    const modificationLogs = logs.filter(
      (log) => log.requestType === "Rettifica"
    );
    const trevisoLogs = logs.filter((log) => log.data.negozio === "Treviso");
    const moglianoLogs = logs.filter((log) => log.data.negozio === "Mogliano");

    setStats({
      totalModifications: logs.length,
      todayModifications: todayLogs.length,
      undoCount: undoLogs.length,
      modificationCount: modificationLogs.length,
      trevisoCount: trevisoLogs.length,
      moglianoCount: moglianoLogs.length,
    });
  };

  const getTopProducts = () => {
    const productCounts = logs.reduce((acc, log) => {
      const productName = log.data.nome;
      acc[productName] = (acc[productName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  };

  const getHourlyActivity = () => {
    const hourlyData = logs.reduce((acc, log) => {
      const hour = dayjs(log.timestamp).hour();
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const maxCount = Math.max(...Object.values(hourlyData));

    return Object.entries(hourlyData)
      .map(([hour, count]) => ({
        hour: parseInt(hour),
        count,
        percentage: maxCount > 0 ? (count / maxCount) * 100 : 0,
      }))
      .sort((a, b) => a.hour - b.hour);
  };

  const topProducts = getTopProducts();
  const hourlyActivity = getHourlyActivity();

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
        <Title level={4} style={{ margin: 0 }}>
          Statistiche - {currentLocation}
        </Title>
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          loading={loading}
          type="default"
          size="small"
        >
          Aggiorna
        </Button>
      </div>

      {/* Date Range Picker */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text>Periodo:</Text>
          <RangePicker
            size="small"
            value={dateRange}
            onChange={handleDateRangeChange}
            format="DD/MM/YYYY"
            allowClear={false}
            disabled={loading}
          />
        </Space>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Dal {dateRange[0].format("DD/MM/YYYY")} al{" "}
            {dateRange[1].format("DD/MM/YYYY")} ({logs.length} modifiche totali)
          </Text>
        </div>
      </Card>

      {error && (
        <Alert
          message="Errore nel caricamento statistiche"
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
            <Text type="secondary">Caricamento statistiche...</Text>
          </div>
        </div>
      ) : (
        <>
          {/* Main Statistics */}
          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Modifiche Oggi"
                  value={stats.todayModifications}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ color: "#1890ff", fontSize: 16 }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Totale Periodo"
                  value={stats.totalModifications}
                  prefix={<BarChartOutlined />}
                  valueStyle={{ color: "#52c41a", fontSize: 16 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Action Type Statistics */}
          <Row gutter={[8, 8]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Rettifiche"
                  value={stats.modificationCount}
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: "#52c41a", fontSize: 14 }}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card size="small">
                <Statistic
                  title="Annullamenti"
                  value={stats.undoCount}
                  prefix={<ArrowUpOutlined />}
                  valueStyle={{ color: "#f5222d", fontSize: 14 }}
                />
              </Card>
            </Col>
          </Row>

          {/* Store Distribution */}
          <Card
            title="Distribuzione per Negozio"
            size="small"
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text>Treviso: {stats.trevisoCount}</Text>
                <Progress
                  percent={
                    stats.totalModifications > 0
                      ? (stats.trevisoCount / stats.totalModifications) * 100
                      : 0
                  }
                  size="small"
                  showInfo={false}
                />
              </div>
              <div>
                <Text>Mogliano: {stats.moglianoCount}</Text>
                <Progress
                  percent={
                    stats.totalModifications > 0
                      ? (stats.moglianoCount / stats.totalModifications) * 100
                      : 0
                  }
                  size="small"
                  showInfo={false}
                  strokeColor="#52c41a"
                />
              </div>
            </Space>
          </Card>

          {/* Top Products */}
          <Card
            title="Prodotti Più Modificati"
            size="small"
            style={{ marginBottom: 16 }}
          >
            <List
              size="small"
              dataSource={topProducts}
              renderItem={(item, index) => (
                <List.Item style={{ padding: "4px 0" }}>
                  <Space
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    <Text style={{ fontSize: 12 }} ellipsis>
                      {index + 1}. {item.name.substring(0, 30)}...
                    </Text>
                    <Tag>{item.count}</Tag>
                  </Space>
                </List.Item>
              )}
            />
          </Card>

          {/* Hourly Activity */}
          <Card title="Attività per Ora" size="small">
            <List
              size="small"
              dataSource={hourlyActivity.slice(0, 6)}
              renderItem={(item) => (
                <List.Item style={{ padding: "4px 0" }}>
                  <Space
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    <Text style={{ fontSize: 12 }}>
                      {item.hour}:00 - {item.hour + 1}:00
                    </Text>
                    <div style={{ flex: 1, marginLeft: 8, marginRight: 8 }}>
                      <Progress
                        percent={item.percentage}
                        size="small"
                        showInfo={false}
                        strokeColor="#722ed1"
                      />
                    </div>
                    <Text style={{ fontSize: 12 }}>{item.count}</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default StatisticsPage;
