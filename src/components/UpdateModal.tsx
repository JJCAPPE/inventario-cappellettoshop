import React, { useState } from "react";
import {
  Modal,
  Button,
  Space,
  Typography,
  Progress,
  Divider,
  Tag,
  message,
  notification,
  Alert,
} from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  CloseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloudDownloadOutlined,
  RocketOutlined,
} from "@ant-design/icons";
import { Update } from "@tauri-apps/plugin-updater";
import UpdaterService, { UpdateProgress } from "../services/updater";

const { Title, Text } = Typography;

interface UpdateModalProps {
  visible: boolean;
  update: Update | null;
  onClose: () => void;
  onUpdateCompleted?: () => void;
}

const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  update,
  onClose,
  onUpdateCompleted,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadSize, setDownloadSize] = useState<number | null>(null);
  const [downloadedBytes, setDownloadedBytes] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "Data non disponibile";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("it-IT", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Data non valida";
    }
  };

  const handleDownloadUpdate = async () => {
    if (!update) return;

    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);
    setDownloadedBytes(0);

    // Show initial notification
    notification.info({
      message: "Aggiornamento Avviato",
      description: `Inizio download della versione ${update.version}`,
      icon: <CloudDownloadOutlined style={{ color: "#1890ff" }} />,
      duration: 3,
    });

    try {
      await UpdaterService.downloadAndInstallUpdate(
        update,
        (progress: UpdateProgress) => {
          switch (progress.event) {
            case "Started":
              if (progress.data?.contentLength) {
                setDownloadSize(progress.data.contentLength);

                // Toast for download start
                message.info({
                  content: `Download iniziato (${formatBytes(
                    progress.data.contentLength
                  )})`,
                  duration: 2,
                });

                // Detailed notification for download start
                notification.open({
                  message: "Download Iniziato",
                  description: `Scaricamento di ${formatBytes(
                    progress.data.contentLength
                  )} in corso...`,
                  icon: <DownloadOutlined style={{ color: "#1890ff" }} />,
                  duration: 3,
                });
              }
              break;

            case "Progress":
              if (progress.data?.chunkLength) {
                setDownloadedBytes((prev) => {
                  const newTotal = prev + progress.data!.chunkLength!;
                  if (downloadSize) {
                    const newProgress = Math.round(
                      (newTotal / downloadSize) * 100
                    );
                    setDownloadProgress(newProgress);
                  }
                  return newTotal;
                });
              }
              break;

            case "Finished":
              setDownloadProgress(100);

              // Toast for download completion
              message.success({
                content: "Download completato! Installazione in corso...",
                duration: 3,
              });

              // Detailed notification for download completion
              notification.success({
                message: "Download Completato",
                description:
                  "File scaricato con successo. Installazione dell'aggiornamento in corso...",
                icon: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
                duration: 4,
              });

              setIsCompleted(true);
              break;
          }
        }
      );

      // Final success notifications
      message.success({
        content: "Aggiornamento installato con successo!",
        duration: 4,
      });

      notification.success({
        message: "Aggiornamento Installato!",
        description: `La versione ${update.version} è stata installata con successo. Riavvia l'applicazione per utilizzare la nuova versione.`,
        icon: <RocketOutlined style={{ color: "#52c41a" }} />,
        duration: 8,
        placement: "topRight",
      });

      // Notify parent component
      if (onUpdateCompleted) {
        onUpdateCompleted();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Errore sconosciuto";
      setError(errorMessage);

      // Error toast
      message.error({
        content: errorMessage,
        duration: 5,
      });

      // Detailed error notification
      notification.error({
        message: "Errore Aggiornamento",
        description: `Si è verificato un errore durante l'aggiornamento: ${errorMessage}`,
        icon: <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />,
        duration: 8,
        placement: "topRight",
      });

      console.error("❌ Update failed:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRestartApp = async () => {
    try {
      // Show restart notification
      notification.info({
        message: "Riavvio in Corso",
        description: "L'applicazione si sta riavviando...",
        icon: <ReloadOutlined style={{ color: "#1890ff" }} />,
        duration: 2,
      });

      // Small delay to show the notification
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await UpdaterService.restartApp();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Errore nel riavvio";

      message.error({
        content: errorMessage,
        duration: 4,
      });

      notification.error({
        message: "Errore Riavvio",
        description: errorMessage,
        duration: 6,
      });

      console.error("❌ Restart failed:", err);
    }
  };

  const handleClose = () => {
    if (!isDownloading) {
      onClose();
      // Reset state when closing
      setDownloadProgress(0);
      setDownloadedBytes(0);
      setDownloadSize(null);
      setIsCompleted(false);
      setError(null);

      // Show reminder if update was completed but not restarted
      if (isCompleted && !error) {
        notification.warning({
          message: "Riavvio Necessario",
          description:
            "Ricorda di riavviare l'applicazione per utilizzare la nuova versione.",
          icon: <ExclamationCircleOutlined style={{ color: "#faad14" }} />,
          duration: 8,
          placement: "topRight",
        });
      }
    }
  };

  if (!update) return null;

  return (
    <Modal
      title={
        <Space>
          <DownloadOutlined />
          Aggiornamento Disponibile
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      footer={null}
      closable={!isDownloading}
      maskClosable={!isDownloading}
      width={500}
    >
      <div style={{ padding: "16px 0" }}>
        {/* Version Information */}
        <div style={{ marginBottom: 16 }}>
          <Space align="center" style={{ marginBottom: 8 }}>
            <Title level={4} style={{ margin: 0 }}>
              Versione {update.version}
            </Title>
            <Tag color="blue">Nuovo</Tag>
          </Space>

          <Text type="secondary">Pubblicata il {formatDate(update.date)}</Text>
        </div>

        {/* Release Notes */}
        {update.body && (
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>Note di rilascio:</Title>
            <div
              style={{
                backgroundColor: "#f5f5f5",
                padding: 12,
                borderRadius: 6,
                maxHeight: 120,
                overflowY: "auto",
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              {update.body.split("\n").map((line, index) => (
                <div key={index}>{line || "\u00A0"}</div>
              ))}
            </div>
          </div>
        )}

        <Divider />

        {/* Error Message */}
        {error && (
          <Alert
            message="Errore durante l'aggiornamento"
            description={error}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Download Progress */}
        {isDownloading && (
          <div style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text strong>
                  {isCompleted
                    ? "Installazione completata"
                    : "Download in corso..."}
                </Text>
                {downloadSize && (
                  <Text type="secondary">
                    {formatBytes(downloadedBytes)} / {formatBytes(downloadSize)}
                  </Text>
                )}
              </div>

              <Progress
                percent={downloadProgress}
                status={isCompleted ? "success" : "active"}
                strokeColor={isCompleted ? "#52c41a" : "#1890ff"}
                trailColor="#f0f0f0"
              />
            </Space>
          </div>
        )}

        {/* Completion Message */}
        {isCompleted && !error && (
          <Alert
            message="Aggiornamento completato con successo!"
            description="L'aggiornamento è stato installato. Riavvia l'applicazione per utilizzare la nuova versione."
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Action Buttons */}
        <div style={{ textAlign: "center" }}>
          {!isDownloading && !isCompleted && (
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadUpdate}
                size="large"
              >
                Scarica e Installa
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={handleClose}
                size="large"
              >
                Più tardi
              </Button>
            </Space>
          )}

          {isCompleted && !error && (
            <Space>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={handleRestartApp}
                size="large"
              >
                Riavvia Ora
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={handleClose}
                size="large"
              >
                Riavvia Più Tardi
              </Button>
            </Space>
          )}

          {error && (
            <Space>
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadUpdate}
                size="large"
              >
                Riprova
              </Button>
              <Button
                icon={<CloseOutlined />}
                onClick={handleClose}
                size="large"
              >
                Chiudi
              </Button>
            </Space>
          )}
        </div>

        {/* Warning for completed update */}
        {isCompleted && !error && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="Importante"
              description="Per sicurezza, salva il tuo lavoro prima di riavviare l'applicazione."
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};

export default UpdateModal;
