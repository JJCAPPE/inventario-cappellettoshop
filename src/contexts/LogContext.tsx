import React, { createContext, useContext, useState, ReactNode } from "react";
import { LogEntry } from "../types";

interface LogContextType {
  logs: LogEntry[];
  fetchLogs: (query?: string) => Promise<void>;
  addLog: (log: LogEntry) => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export const LogProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const fetchLogs = async (query?: string) => {
    try {
      // TODO: Implement actual API call when backend is ready
      console.log("Fetching logs with query:", query);
      // Mock data for now
      const mockLogs: LogEntry[] = [
        {
          requestType: "Rettifica",
          timestamp: new Date().toISOString(),
          data: {
            id: "123",
            variant: "M",
            negozio: "Treviso",
            inventory_item_id: "456",
            nome: "MARC JACOBS - The Small Tote Bag",
            prezzo: "350.00",
            rettifica: -1,
            images: ["https://via.placeholder.com/100"],
          },
        },
      ];

      if (query) {
        // Filter logs based on query
        const filteredLogs = mockLogs.filter(
          (log) =>
            log.data.nome.toLowerCase().includes(query.toLowerCase()) ||
            log.data.negozio.toLowerCase().includes(query.toLowerCase())
        );
        setLogs(filteredLogs);
      } else {
        setLogs(mockLogs);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      setLogs([]);
    }
  };

  const addLog = (log: LogEntry) => {
    setLogs((prev) => [log, ...prev]);
  };

  return (
    <LogContext.Provider value={{ logs, fetchLogs, addLog }}>
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
