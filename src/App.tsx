import React, { useState, useEffect, useRef } from "react";
import {
  Layout,
  Button,
  Drawer,
  ConfigProvider,
  notification,
  message,
  Modal,
} from "antd";

import {
  DatabaseOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  RocketOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import HomePage from "./components/HomePage";
import DataPage from "./components/DataPage";
import CheckRequestsPage from "./components/CheckRequestsPage";
import StatisticsPage from "./components/StatisticsPage";
import UpdateModal from "./components/UpdateModal";
import { LogProvider } from "./contexts/LogContext";
import { useUpdater } from "./hooks/useUpdater";
import {
  getDisplayVersion,
  getBuildInfo,
  getCommitHash,
  isDevelopmentVersion,
} from "./utils/version";
import { getPrimaryLocationName } from "./utils/location";
import { listen } from "@tauri-apps/api/event";
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

  // New states for menu-triggered modals
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [triggerSettingsModal, setTriggerSettingsModal] = useState(false);

  const sidebarRef = useRef<HTMLDivElement>(null);

  // Initialize updater with configuration
  const {
    update,
    isChecking,
    showUpdateModal,
    lastCheckFoundNoUpdate,
    checkForUpdates,
    openUpdateModal,
    closeUpdateModal,
  } = useUpdater({
    checkOnMount: true, // Check for updates when app starts
    checkInterval: 30 * 60 * 1000, // Check every 30 minutes
    showErrorMessages: false, // Don't show error messages automatically
  });

  useEffect(() => {
    document.title = `Inventario CappellettoShop ${getDisplayVersion()}`;

    // Set up menu event listeners
    const setupMenuListeners = async () => {
      // Listen for settings menu event
      await listen("show-settings", () => {
        console.log("📱 Settings menu triggered from native menu");
        setShowAboutModal(false); // Close about modal if open
        setShowSettingsModal(true);
        setTriggerSettingsModal(true);
      });

      // Listen for about menu event
      await listen("show-about", () => {
        console.log("ℹ️ About menu triggered from native menu");
        setShowSettingsModal(false); // Close settings modal if open
        setShowAboutModal(true);
      });
    };

    setupMenuListeners().catch(console.error);
  }, []);

  // Function to handle navigation to a specific product
  const handleNavigateToProduct = (productId: string) => {
    console.log("🚀 App: Navigating to product:", productId);
    setTargetProductId(productId);
    setSidebarVisible(false); // Close the sidebar when navigating
  };

  // Manual update check function
  const handleManualUpdateCheck = async () => {
    console.log("🔍 Manual update check triggered");

    // If we already have an update available, just reopen the modal
    if (update && !showUpdateModal) {
      console.log(
        "📋 Reopening update modal for existing update:",
        update.version
      );

      openUpdateModal();

      message.info({
        content: `Aggiornamento alla versione ${update.version} ancora disponibile`,
        duration: 3,
      });

      return;
    }

    try {
      await checkForUpdates();

      // If no update was found (modal didn't show), inform the user
      setTimeout(() => {
        if (!showUpdateModal) {
          message.success({
            content: "La tua app è già aggiornata all'ultima versione",
            duration: 3,
          });
        }
      }, 500);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Errore nel controllo aggiornamenti";

      message.error({
        content: errorMessage,
        duration: 4,
      });

      notification.error({
        message: "Errore Controllo Aggiornamenti",
        description: errorMessage,
        duration: 6,
        placement: "topRight",
      });
    }
  };

  // Handle update completion
  const handleUpdateCompleted = () => {
    console.log("✅ Update completed successfully from App component");

    // Show celebration notification
    notification.success({
      message: "🎉 Aggiornamento Completato!",
      description:
        "L'applicazione è stata aggiornata con successo. Tutte le nuove funzionalità sono ora disponibili!",
      icon: <RocketOutlined style={{ color: "#52c41a" }} />,
      duration: 10,
      placement: "topRight",
    });
  };

  // Simplified toggle function
  const handleDataPanelToggle = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    e.preventDefault(); // Prevent default behavior
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
    e.preventDefault(); // Prevent default behavior
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
          'button[title*="pannello modifiche"], button[title*="pannello richieste"]'
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

  // Keyboard shortcut for toggling logs panel (Cmd+M) and About modal (Cmd+.)
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

      // Check for Cmd+R to toggle controlli (check requests) panel
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault(); // Prevent default browser behavior
        console.log(
          "⌨️ Keyboard shortcut triggered: Cmd+R - toggling controlli panel"
        );
        handleCheckRequestsPanelToggle(event as any); // Cast to React.MouseEvent for compatibility
      }

      // Check for Cmd+. (Command+Period) to open About modal
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault(); // Prevent default browser behavior
        console.log(
          "⌨️ Keyboard shortcut triggered: Cmd+. - opening About modal"
        );
        setShowSettingsModal(false); // Close settings modal if open
        setShowAboutModal(true);
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

  // New function to handle about modal
  const handleAboutClose = () => {
    setShowAboutModal(false);
  };

  // Function to handle settings modal
  const handleSettingsOpen = () => {
    setShowAboutModal(false); // Close about modal if open
    setShowSettingsModal(true);
  };

  const handleSettingsClose = () => {
    setShowSettingsModal(false);
  };

  // Function to reset the settings trigger after HomePage handles it
  const handleSettingsTriggered = () => {
    setTriggerSettingsModal(false);
  };

  return (
    <LogProvider>
      <ConfigProvider theme={customTheme}>
        <Layout style={{ minHeight: "100vh" }}>
          <Header
            className="app-header"
            style={{
              position: "fixed",
              zIndex: 1,
              width: "100%",
              background: "#492513",
              padding: "0 16px",
              paddingLeft: navigator.platform.includes("Mac") ? "80px" : "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
              {/* Update Check Button */}
              <Button
                icon={
                  isChecking ? (
                    <DownloadOutlined />
                  ) : lastCheckFoundNoUpdate ? (
                    <CheckCircleOutlined />
                  ) : (
                    <DownloadOutlined />
                  )
                }
                onClick={handleManualUpdateCheck}
                loading={isChecking}
                style={{
                  background: "transparent",
                  borderColor: lastCheckFoundNoUpdate ? "#52c41a" : "#d9d9d9",
                  color: lastCheckFoundNoUpdate ? "#52c41a" : "#d9d9d9",
                  transition: "all 0.2s ease",
                }}
                title={
                  isChecking
                    ? "Controllo aggiornamenti in corso..."
                    : lastCheckFoundNoUpdate
                    ? "App aggiornata - Clicca per ricontrollare"
                    : "Controlla aggiornamenti"
                }
              >
                {isChecking
                  ? "Controllo..."
                  : lastCheckFoundNoUpdate
                  ? ""
                  : "Aggiornamenti"}
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
            </div>
          </Header>

          <Layout style={{ marginTop: 64 }}>
            <Content
              style={{ position: "relative", minHeight: "calc(100vh - 64px)" }}
            >
              <HomePage
                targetProductId={targetProductId}
                onTargetProductProcessed={() => setTargetProductId(null)}
                triggerSettingsModal={triggerSettingsModal}
                onSettingsTriggered={handleSettingsTriggered}
                settingsModalVisible={showSettingsModal}
                onSettingsOpen={handleSettingsOpen}
                onSettingsClose={handleSettingsClose}
              />

              {/* Discrete version indicator at bottom center */}
              <div
                style={{
                  position: "fixed",
                  bottom: "8px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: "10px",
                  color: "#999",
                  zIndex: 1,
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              >
                {getDisplayVersion()}
              </div>
            </Content>

            {/* Sidebar Drawer for mobile/tablet */}
            <Drawer
              title={getSidebarTitle()}
              placement="right"
              onClose={() => setSidebarVisible(false)}
              open={sidebarVisible && window.innerWidth < 1200}
              width={500}
              styles={{ body: { padding: 0 } }}
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

          {/* Update Modal */}
          <UpdateModal
            open={showUpdateModal}
            update={update}
            onClose={closeUpdateModal}
            onUpdateCompleted={handleUpdateCompleted}
          />

          {/* About Modal */}
          <Modal
            title={
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <InfoCircleOutlined />
                Informazioni
              </div>
            }
            open={showAboutModal}
            onCancel={handleAboutClose}
            footer={[
              <Button key="close" type="primary" onClick={handleAboutClose}>
                Chiudi
              </Button>,
            ]}
            width={600}
          >
            <div style={{ padding: "16px 0", textAlign: "center" }}>
              <div style={{ fontSize: "24px", marginBottom: "16px" }}>🏪</div>
              <h2 style={{ marginBottom: "8px" }}>
                Inventario CappellettoShop
              </h2>
              <p style={{ color: "#666", marginBottom: "16px" }}>
                Versione {getDisplayVersion()}
                {isDevelopmentVersion() && (
                  <span style={{ color: "#f5a623", marginLeft: "8px" }}>
                    🚧 Dev
                  </span>
                )}
              </p>

              {/* Primary Location Indicator */}
              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#e6f7ff",
                  border: "2px solid #1890ff",
                  borderRadius: "8px",
                  marginBottom: "24px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "18px",
                    fontWeight: "bold",
                    color: "#1890ff",
                    marginBottom: "4px",
                  }}
                >
                  📍 POSIZIONE SELEZIONATA
                </div>
                <div
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#1890ff",
                  }}
                >
                  {getPrimaryLocationName().toUpperCase()}
                </div>
              </div>

              {/* Build Information */}
              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#f9f9f9",
                  borderRadius: "6px",
                  marginBottom: "24px",
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                <div style={{ marginBottom: "4px" }}>
                  <strong>Build:</strong> {getBuildInfo()}
                </div>
                <div>
                  <strong>Commit:</strong> {getCommitHash()}
                </div>
              </div>

              <div style={{ textAlign: "left", marginBottom: "24px" }}>
                <p>
                  <strong>📦 Gestione Inventario</strong>
                </p>
                <p style={{ marginLeft: "20px", color: "#666" }}>
                  Sistema completo per la gestione dell'inventario del negozio,
                  con sincronizzazione in tempo reale con Shopify.
                </p>

                <p>
                  <strong>🔄 Funzionalità Principali</strong>
                </p>
                <div style={{ marginLeft: "20px", color: "#666" }}>
                  <p>• Ricerca prodotti per SKU e nome</p>
                  <p>• Aggiornamento quantità inventario</p>
                  <p>• Gestione richieste di controllo</p>
                  <p>• Logging completo delle modifiche</p>
                  <p>• Auto-aggiornamenti</p>
                </div>
              </div>

              <div
                style={{
                  padding: "12px",
                  backgroundColor: "#f6f6f6",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "#666",
                }}
              >
                Sviluppato con ❤️ per CappellettoShop
              </div>
            </div>
          </Modal>
        </Layout>
      </ConfigProvider>
    </LogProvider>
  );
}

export default App;
