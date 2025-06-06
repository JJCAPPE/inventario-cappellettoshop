import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { LogEntry } from "../types/index";
import { TauriAPI } from "../services/tauri";

interface LogContextType {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  fetchLogs: (query?: string, forceRefresh?: boolean) => Promise<void>;
  addLog: (log: LogEntry) => void;
  refreshLogs: () => Promise<void>;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const LogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (query?: string, forceRefresh: boolean = false) => {
      try {
        setLoading(true);
        setError(null);

        console.log("🔍 Fetching logs from Firebase...");
        console.log("   📝 Query:", query || "none");
        console.log("   🔄 Force refresh:", forceRefresh);

        // Get current location using the same logic as HomePage
        const savedLocation = localStorage.getItem("primaryLocation");
        const currentLocation =
          savedLocation &&
          (savedLocation === "Treviso" || savedLocation === "Mogliano")
            ? savedLocation
            : "Treviso"; // Default fallback to Treviso

        console.log("   🏪 Current location:", currentLocation);
        console.log(
          "   📅 Fetching last 24 hours logs for location:",
          currentLocation
        );

        // Fetch logs from Firebase (now using proper Firestore queries like ShopifyReact)
        const fetchedLogs = await TauriAPI.Firebase.getLogs(
          query,
          currentLocation
        );

        console.log(
          `✅ Successfully fetched ${fetchedLogs.length} logs from Firebase`
        );

        if (fetchedLogs.length > 0) {
          console.log("   📊 Sample log structure:", fetchedLogs[0]);
          console.log("   📊 Latest log timestamp:", fetchedLogs[0]?.timestamp);
        } else {
          console.log("   ℹ️ No logs found for the current filters");
        }

        // Convert backend format to frontend format (handle both snake_case and camelCase)
        const formattedLogs: LogEntry[] = fetchedLogs.map((log) => ({
          requestType: log.requestType, // Handle both formats
          timestamp: log.timestamp,
          data: log.data,
        }));

        console.log(
          `✅ Successfully formatted ${formattedLogs.length} logs for display`
        );
        setLogs(formattedLogs);
      } catch (error) {
        console.error("❌ Error fetching logs:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";
        console.error("   📋 Error details:", errorMessage);
        setError(`Failed to fetch logs: ${errorMessage}`);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    },
    []
  ); // Empty dependency array since this function doesn't depend on any changing values

  const refreshLogs = useCallback(async () => {
    console.log("🔄 Manual refresh requested - fetching fresh logs");
    await fetchLogs(undefined, true); // Force refresh without query
  }, [fetchLogs]);

  const addLog = useCallback((log: LogEntry) => {
    console.log("➕ Adding new log to context:", log);
    setLogs((prev) => [log, ...prev]);
  }, []);

  return (
    <LogContext.Provider
      value={{
        logs,
        loading,
        error,
        fetchLogs,
        addLog,
        refreshLogs,
      }}
    >
      {children}
    </LogContext.Provider>
  );
};

export const useLogs = () => {
  const context = useContext(LogContext);
  if (context === undefined) {
    throw new Error("useLogs must be used within a LogProvider");
  }
  return context;
};
