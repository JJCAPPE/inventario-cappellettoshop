import { useState, useEffect, useCallback } from "react";
import { Update } from "@tauri-apps/plugin-updater";
import UpdaterService from "../services/updater";
import { message } from "antd";

interface UseUpdaterOptions {
  checkOnMount?: boolean;
  checkInterval?: number; // in milliseconds
  showErrorMessages?: boolean;
}

interface UseUpdaterReturn {
  update: Update | null;
  isChecking: boolean;
  error: string | null;
  showUpdateModal: boolean;
  checkForUpdates: () => Promise<void>;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
  clearError: () => void;
}

export const useUpdater = (
  options: UseUpdaterOptions = {}
): UseUpdaterReturn => {
  const {
    checkOnMount = true,
    checkInterval,
    showErrorMessages = true,
  } = options;

  const [update, setUpdate] = useState<Update | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
    setError(null);

    try {
      console.log("🔍 useUpdater: Checking for updates...");
      const availableUpdate = await UpdaterService.checkForUpdates();

      if (availableUpdate) {
        console.log("✅ useUpdater: Update found:", availableUpdate.version);
        setUpdate(availableUpdate);
        setShowUpdateModal(true);
        message.info(
          `Aggiornamento disponibile: versione ${availableUpdate.version}`
        );
      } else {
        console.log("ℹ️ useUpdater: No updates available");
        setUpdate(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Errore nel controllo aggiornamenti";
      console.error("❌ useUpdater: Error checking for updates:", err);
      setError(errorMessage);

      if (showErrorMessages) {
        message.error(errorMessage);
      }
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, showErrorMessages]);

  const openUpdateModal = useCallback(() => {
    setShowUpdateModal(true);
  }, []);

  const closeUpdateModal = useCallback(() => {
    setShowUpdateModal(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check for updates on mount
  useEffect(() => {
    if (checkOnMount) {
      console.log("🚀 useUpdater: Checking for updates on mount");
      checkForUpdates();
    }
  }, [checkOnMount, checkForUpdates]);

  // Set up periodic checking if interval is provided
  useEffect(() => {
    if (!checkInterval || checkInterval <= 0) return;

    console.log(
      `⏰ useUpdater: Setting up periodic update check every ${checkInterval}ms`
    );

    const intervalId = setInterval(() => {
      console.log("⏰ useUpdater: Periodic update check triggered");
      checkForUpdates();
    }, checkInterval);

    return () => {
      console.log("🛑 useUpdater: Clearing periodic update check");
      clearInterval(intervalId);
    };
  }, [checkInterval, checkForUpdates]);

  return {
    update,
    isChecking,
    error,
    showUpdateModal,
    checkForUpdates,
    openUpdateModal,
    closeUpdateModal,
    clearError,
  };
};

export default useUpdater;
