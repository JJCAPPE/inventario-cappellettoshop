import React, { useState, useEffect, useRef } from "react";
import { Layout, Button, Drawer, ConfigProvider } from "antd";

import {
  DatabaseOutlined,
  CloseOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import HomePage from "./components/HomePage";
import DataPage from "./components/DataPage";
import CheckRequestsPage from "./components/CheckRequestsPage";
import StatisticsPage from "./components/StatisticsPage";
import { LogProvider } from "./contexts/LogContext";
import "antd/dist/reset.css";
import "./App.css";

const { Header, Content } = Layout;

type SidebarView = "data" | "checkRequests" | "statistics";

// Custom theme configuration
const customTheme = {
  token: {
    // Primary colors
    colorPrimary: "#492513",
    colorPrimaryHover: "#5a2e18",
    colorPrimaryActive: "#3a1e0f",
    colorPrimaryBorder: "#492513",

    // Background colors
    colorBgBase: "#fff2e3",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",

    // Text colors
    colorTextBase: "#492513",
    colorText: "#492513",
    colorTextSecondary: "#5a2e18",

    // Border colors
    colorBorder: "#d9d9d9",
    colorBorderSecondary: "#f0f0f0",

    // Link colors
    colorLink: "#492513",
    colorLinkHover: "#5a2e18",
    colorLinkActive: "#3a1e0f",

    // Success, warning, error colors (keeping defaults but you can customize)
    colorSuccess: "#52c41a",
    colorWarning: "#faad14",
    colorError: "#ff4d4f",
  },
  components: {
    Layout: {
      headerBg: "#492513",
      bodyBg: "#fff2e3",
      siderBg: "#492513",
    },
    Button: {
      primaryColor: "#ffffff",
      primaryShadow: "0 2px 0 rgba(73, 37, 19, 0.045)",
    },
    Input: {
      activeBorderColor: "#492513",
      hoverBorderColor: "#5a2e18",
    },
    Table: {
      headerBg: "#fff2e3",
      rowSelectedBg: "#fff2e3",
      rowSelectedHoverBg: "#ffe8d1",
    },
  },
};

function App() {
  const [currentView, setCurrentView] = useState<SidebarView>("data");
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [targetProductId, setTargetProductId] = useState<string | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "Inventario CappellettoShop";
  }, []);

  // Function to handle navigation to a specific product
  const handleNavigateToProduct = (productId: string) => {
    console.log("🚀 App: Navigating to product:", productId);
    setTargetProductId(productId);
    setSidebarVisible(false); // Close the sidebar when navigating
  };

  // Simplified toggle function
  const handleDataPanelToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    console.log("🔄 Data panel toggle clicked:", { sidebarVisible });

    if (sidebarVisible && currentView === "data") {
      // If data panel is already open, close it
      setSidebarVisible(false);
    } else {
      // Open data panel or switch to it
      setCurrentView("data");
      setSidebarVisible(true);
    }
  };

  // Function to handle check requests panel toggle
  const handleCheckRequestsPanelToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    console.log("🔄 Check requests panel toggle clicked:", { sidebarVisible });

    if (sidebarVisible && currentView === "checkRequests") {
      // If checkRequests panel is already open, close it
      setSidebarVisible(false);
    } else {
      // Open checkRequests panel or switch to it
      setCurrentView("checkRequests");
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

        // Also check if click is on the toggle button itself
        const isToggleButton = target.closest(
          'button[title*="pannello modifiche"]'
        );

        if (!isAntdOverlay && !isToggleButton) {
          console.log("📱 Clicking outside - closing sidebar");
          setSidebarVisible(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [sidebarVisible]);

  // Keyboard shortcut for toggling logs panel (Cmd+M)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+M (metaKey is Cmd on Mac, ctrlKey on Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "m") {
        event.preventDefault(); // Prevent default browser behavior
        console.log(
          "⌨️ Keyboard shortcut triggered: Cmd+M - toggling logs panel"
        );
        handleDataPanelToggle(event as any); // Cast to React.MouseEvent for compatibility
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [sidebarVisible]); // Include sidebarVisible as dependency since handleDataPanelToggle uses it

  const renderSidebarContent = () => {
    switch (currentView) {
      case "data":
        return <DataPage onNavigateToProduct={handleNavigateToProduct} />;
      case "checkRequests":
        return (
          <CheckRequestsPage onNavigateToProduct={handleNavigateToProduct} />
        );
      case "statistics":
        return <StatisticsPage />;
      default:
        return <DataPage onNavigateToProduct={handleNavigateToProduct} />;
    }
  };

  const getSidebarTitle = () => {
    switch (currentView) {
      case "data":
        return "Modifiche Recenti (Ultime 24h)";
      case "checkRequests":
        return "Richieste di Controllo";
      case "statistics":
        return "Statistiche";
      default:
        return "Modifiche";
    }
  };

  return (
    <LogProvider>
      <ConfigProvider theme={customTheme}>
        <Layout style={{ minHeight: "100vh" }}>
          <Header
            style={{
              position: "fixed",
              zIndex: 1,
              width: "100%",
              background: "#492513",
              padding: "0 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{ color: "white", fontSize: "24px", fontWeight: "bold" }}
            >
              Inventario CappellettoShop
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <Button
                className={
                  sidebarVisible && currentView === "data"
                    ? "modifiche-button-active"
                    : ""
                }
                icon={<DatabaseOutlined />}
                onClick={handleDataPanelToggle}
                style={{
                  background:
                    sidebarVisible && currentView === "data"
                      ? "#FFE8D1"
                      : "transparent",
                  borderColor:
                    sidebarVisible && currentView === "data"
                      ? "#FFE8D1"
                      : "#d9d9d9",
                  color:
                    sidebarVisible && currentView === "data"
                      ? "#492513"
                      : "#d9d9d9",
                  transition: "all 0.2s ease",
                }}
                title={
                  sidebarVisible && currentView === "data"
                    ? "Chiudi pannello modifiche"
                    : "Apri pannello modifiche"
                }
              >
                {sidebarVisible && currentView === "data"
                  ? "Chiudi Modifiche"
                  : "Modifiche"}
              </Button>

              <Button
                className={
                  sidebarVisible && currentView === "checkRequests"
                    ? "controlli-button-active"
                    : ""
                }
                icon={<CheckCircleOutlined />}
                onClick={handleCheckRequestsPanelToggle}
                style={{
                  background:
                    sidebarVisible && currentView === "checkRequests"
                      ? "#FFE8D1"
                      : "transparent",
                  borderColor:
                    sidebarVisible && currentView === "checkRequests"
                      ? "#FFE8D1"
                      : "#d9d9d9",
                  color:
                    sidebarVisible && currentView === "checkRequests"
                      ? "#492513"
                      : "#d9d9d9",
                  transition: "all 0.2s ease",
                }}
                title={
                  sidebarVisible && currentView === "checkRequests"
                    ? "Chiudi pannello richieste"
                    : "Apri pannello richieste"
                }
              >
                {sidebarVisible && currentView === "checkRequests"
                  ? "Chiudi Richieste"
                  : "Richieste"}
              </Button>
            </div>
          </Header>

          <Layout style={{ marginTop: 64 }}>
            <Content style={{ position: "relative" }}>
              <HomePage
                targetProductId={targetProductId}
                onTargetProductProcessed={() => setTargetProductId(null)}
              />
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
      </ConfigProvider>
    </LogProvider>
  );
}

export default App;
