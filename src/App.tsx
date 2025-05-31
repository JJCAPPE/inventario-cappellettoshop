import { useState, useEffect, useRef } from "react";
import { Layout, Button, Drawer } from "antd";
import {
  HistoryOutlined,
  BarChartOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import HomePage from "./components/HomePage";
import DataPage from "./components/DataPage";
import StatisticsPage from "./components/StatisticsPage";
import { LogProvider } from "./contexts/LogContext";
import "antd/dist/reset.css";
import "./App.css";

const { Header, Content } = Layout;

type SidebarView = "data" | "statistics";

function App() {
  const [currentView, setCurrentView] = useState<SidebarView>("data");
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleSidebarToggle = (view: SidebarView) => {
    if (sidebarVisible && currentView === view) {
      setSidebarVisible(false);
    } else {
      setCurrentView(view);
      setSidebarVisible(true);
    }
  };

  // Close sidebar when clicking outside (for desktop)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sidebarVisible &&
        sidebarRef.current &&
        !sidebarRef.current.contains(event.target as Node) &&
        window.innerWidth >= 1200
      ) {
        // Check if the click is on an Ant Design overlay (dropdown, date picker, etc.)
        const target = event.target as Element;
        const isAntdOverlay =
          target.closest(".ant-picker-dropdown") ||
          target.closest(".ant-dropdown") ||
          target.closest(".ant-select-dropdown") ||
          target.closest(".ant-tooltip") ||
          target.closest(".ant-popover") ||
          target.closest(".ant-modal") ||
          target.closest(".ant-drawer");

        if (!isAntdOverlay) {
          setSidebarVisible(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarVisible]);

  const renderSidebarContent = () => {
    switch (currentView) {
      case "data":
        return <DataPage />;
      case "statistics":
        return <StatisticsPage />;
      default:
        return <DataPage />;
    }
  };

  const getSidebarTitle = () => {
    return currentView === "data" ? "Modifiche Recenti" : "Statistiche";
  };

  return (
    <LogProvider>
      <Layout style={{ minHeight: "100vh" }}>
        <Header
          style={{
            position: "fixed",
            zIndex: 1,
            width: "100%",
            background: "#001529",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ color: "white", fontSize: "24px", fontWeight: "bold" }}>
            Inventario CappellettoShop
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <Button
              type={
                sidebarVisible && currentView === "data" ? "primary" : "default"
              }
              icon={<HistoryOutlined />}
              onClick={() => handleSidebarToggle("data")}
              style={{
                background:
                  sidebarVisible && currentView === "data"
                    ? "#1890ff"
                    : "transparent",
                borderColor:
                  sidebarVisible && currentView === "data"
                    ? "#1890ff"
                    : "#d9d9d9",
                color:
                  sidebarVisible && currentView === "data"
                    ? "white"
                    : "#d9d9d9",
              }}
            >
              Modifiche
            </Button>
            <Button
              type={
                sidebarVisible && currentView === "statistics"
                  ? "primary"
                  : "default"
              }
              icon={<BarChartOutlined />}
              onClick={() => handleSidebarToggle("statistics")}
              style={{
                background:
                  sidebarVisible && currentView === "statistics"
                    ? "#1890ff"
                    : "transparent",
                borderColor:
                  sidebarVisible && currentView === "statistics"
                    ? "#1890ff"
                    : "#d9d9d9",
                color:
                  sidebarVisible && currentView === "statistics"
                    ? "white"
                    : "#d9d9d9",
              }}
            >
              Statistiche
            </Button>
          </div>
        </Header>

        <Layout style={{ marginTop: 64 }}>
          <Content style={{ position: "relative" }}>
            <HomePage />
          </Content>

          {/* Sidebar Drawer for mobile/tablet */}
          <Drawer
            title={getSidebarTitle()}
            placement="right"
            onClose={() => setSidebarVisible(false)}
            visible={sidebarVisible && window.innerWidth < 1200}
            width={500}
            bodyStyle={{ padding: 0 }}
          >
            {renderSidebarContent()}
          </Drawer>

          {/* Fixed Sidebar for desktop when data/stats are selected */}
          {sidebarVisible && window.innerWidth >= 1200 && (
            <div
              ref={sidebarRef}
              style={{
                position: "fixed",
                right: 0,
                top: 64,
                bottom: 0,
                zIndex: 100,
                width: 450,
                background: "white",
                boxShadow: "-2px 0 8px rgba(0,0,0,0.15)",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  borderBottom: "1px solid #f0f0f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <h3 style={{ margin: 0 }}>{getSidebarTitle()}</h3>
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={() => setSidebarVisible(false)}
                  size="small"
                />
              </div>
              <div
                className="sidebar-content"
                style={{ height: "calc(100% - 65px)", overflow: "auto" }}
              >
                {renderSidebarContent()}
              </div>
            </div>
          )}
        </Layout>
      </Layout>
    </LogProvider>
  );
}

export default App;
