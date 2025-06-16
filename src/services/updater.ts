import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export interface UpdateProgress {
  event: "Started" | "Progress" | "Finished";
  data: {
    contentLength?: number;
    chunkLength?: number;
  };
}

export class UpdaterService {
  private static instance: UpdaterService;

  public static getInstance(): UpdaterService {
    if (!UpdaterService.instance) {
      UpdaterService.instance = new UpdaterService();
    }
    return UpdaterService.instance;
  }

  /**
   * Check if an update is available
   */
  async checkForUpdates(): Promise<Update | null> {
    try {
      console.log("🔍 Checking for updates...");
      const update = await check();

      if (update) {
        console.log(`✅ Update found: ${update.version} from ${update.date}`);
        console.log(`📝 Release notes: ${update.body}`);
        return update;
      } else {
        console.log("ℹ️ No updates available");
        return null;
      }
    } catch (error) {
      console.error("❌ Error checking for updates:", error);
      throw new Error(
        `Errore nel controllo aggiornamenti: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  /**
   * Download and install an update with progress callback
   */
  async downloadAndInstallUpdate(
    update: Update,
    onProgress?: (progress: UpdateProgress) => void
  ): Promise<void> {
    try {
      console.log("📥 Starting update download and installation...");

      await update.downloadAndInstall((event) => {
        console.log("📊 Update progress:", event);
        if (onProgress) {
          onProgress(event);
        }
      });

      console.log("✅ Update installed successfully");
    } catch (error) {
      console.error("❌ Error downloading/installing update:", error);
      throw new Error(
        `Errore nell'installazione aggiornamento: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  /**
   * Restart the application
   */
  async restartApp(): Promise<void> {
    try {
      console.log("🔄 Restarting application...");
      await relaunch();
    } catch (error) {
      console.error("❌ Error restarting app:", error);
      throw new Error(
        `Errore nel riavvio applicazione: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }

  /**
   * Check for updates with custom timeout and headers
   */
  async checkForUpdatesWithConfig(config?: {
    timeout?: number;
    headers?: Record<string, string>;
  }): Promise<Update | null> {
    try {
      console.log("🔍 Checking for updates with custom config...");
      const update = await check(config);

      if (update) {
        console.log(`✅ Update found: ${update.version}`);
        return update;
      } else {
        console.log("ℹ️ No updates available");
        return null;
      }
    } catch (error) {
      console.error("❌ Error checking for updates:", error);
      throw new Error(
        `Errore nel controllo aggiornamenti: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    }
  }
}

export default UpdaterService.getInstance();
