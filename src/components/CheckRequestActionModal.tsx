import React, { useState } from "react";
import {
  Modal,
  Button,
  Input,
  Space,
  Typography,
  Divider,
  message,
  Alert,
  Tag,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { CheckRequest } from "../services/tauri";
import TauriAPI from "../services/tauri";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface CheckRequestActionModalProps {
  visible: boolean;
  onClose: () => void;
  checkRequest: CheckRequest;
  onRequestUpdated: () => void;
  onNavigateToProduct?: (productId: string) => void;
}

const CheckRequestActionModal: React.FC<CheckRequestActionModalProps> = ({
  visible,
  onClose,
  checkRequest,
  onRequestUpdated,
  onNavigateToProduct,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedAction, setSelectedAction] = useState<
    "completed" | "cancelled" | null
  >(null);
  const [closingNotes, setClosingNotes] = useState("");

  const handleAction = async () => {
    if (!selectedAction) {
      message.warning("Seleziona un'azione prima di continuare");
      return;
    }

    if (!closingNotes.trim()) {
      message.warning("Inserisci delle note di chiusura");
      return;
    }

    try {
      setLoading(true);

      await TauriAPI.Firebase.updateCheckRequest(
        checkRequest.id!,
        selectedAction,
        closingNotes.trim()
      );

      message.success(
        selectedAction === "completed"
          ? "Controllo marcato come completato!"
          : "Controllo annullato!"
      );

      onRequestUpdated();
    } catch (error) {
      console.error("❌ Error updating check request:", error);
      message.error(
        `Errore nell'aggiornamento: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedAction(null);
    setClosingNotes("");
    onClose();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "#f5222d";
      case "medium":
        return "#faad14";
      case "low":
        return "#52c41a";
      default:
        return "#999";
    }
  };

  const formatTime = (timestamp: string) => {
    return dayjs(timestamp).format("DD/MM/YYYY HH:mm");
  };

  const handleOpenProduct = () => {
    if (onNavigateToProduct) {
      onNavigateToProduct(checkRequest.product_id.toString());
      onClose();
    }
  };

  return (
    <Modal
      title={
        <Space>
          <InfoCircleOutlined />
          <span>Gestione Controllo Inventario</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Annulla
        </Button>,
        <Button
          key="open-product"
          icon={<DatabaseOutlined />}
          onClick={handleOpenProduct}
          style={{
            backgroundColor: "#492513",
            borderColor: "#492513",
            color: "#fff",
          }}
        >
          Apri Pagina Prodotto
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={
            selectedAction === "completed" ? (
              <CheckCircleOutlined />
            ) : selectedAction === "cancelled" ? (
              <CloseCircleOutlined />
            ) : undefined
          }
          loading={loading}
          disabled={!selectedAction || !closingNotes.trim()}
          onClick={handleAction}
          style={{
            backgroundColor:
              selectedAction === "completed"
                ? "#52c41a"
                : selectedAction === "cancelled"
                ? "#f5222d"
                : "#492513",
            borderColor:
              selectedAction === "completed"
                ? "#52c41a"
                : selectedAction === "cancelled"
                ? "#f5222d"
                : "#492513",
            color: "#fff",
            opacity: !selectedAction || !closingNotes.trim() ? 0.6 : 1,
          }}
        >
          {selectedAction === "completed"
            ? "Marca come Completato"
            : selectedAction === "cancelled"
            ? "Annulla Controllo"
            : "Conferma"}
        </Button>,
      ]}
      width={600}
      destroyOnClose
    >
      {/* Request Details */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          {checkRequest.product_name}
        </Title>
        <Text type="secondary">ID Prodotto: {checkRequest.product_id}</Text>

        <div style={{ marginTop: 16 }}>
          <Space direction="vertical" size={8} style={{ width: "100%" }}>
            <div>
              <Text strong>Richiesto da: </Text>
              <Text>{checkRequest.requested_by}</Text>
            </div>

            <div>
              <Text strong>Data richiesta: </Text>
              <Text>{formatTime(checkRequest.timestamp)}</Text>
            </div>

            <div>
              <Text strong>Variante da controllare: </Text>
              <Text>
                {checkRequest.check_all
                  ? "Tutte le varianti"
                  : checkRequest.variant_name}
              </Text>
            </div>

            <div>
              <Text strong>Posizioni: </Text>
              <Space>
                {checkRequest.location.map((loc) => (
                  <Tag key={loc} color="blue">
                    {loc}
                  </Tag>
                ))}
              </Space>
            </div>

            <div>
              <Text strong>Priorità: </Text>
              <span style={{ color: getPriorityColor(checkRequest.priority) }}>
                ●{" "}
                {checkRequest.priority === "high"
                  ? "Alta"
                  : checkRequest.priority === "medium"
                  ? "Media"
                  : "Bassa"}
              </span>
            </div>

            {checkRequest.notes && (
              <div>
                <Text strong>Note originali: </Text>
                <Text>{checkRequest.notes}</Text>
              </div>
            )}
          </Space>
        </div>
      </div>

      <Divider />

      {/* Action Selection */}
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>Seleziona Azione</Title>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Button
            type={selectedAction === "completed" ? "primary" : "default"}
            icon={<CheckCircleOutlined />}
            onClick={() => setSelectedAction("completed")}
            style={{
              width: "100%",
              textAlign: "left",
              backgroundColor:
                selectedAction === "completed" ? "#f6ffed" : undefined,
              borderColor:
                selectedAction === "completed" ? "#52c41a" : undefined,
            }}
          >
            Controllo completato - l'inventario è stato verificato
          </Button>

          <Button
            type={selectedAction === "cancelled" ? "primary" : "default"}
            icon={<CloseCircleOutlined />}
            onClick={() => setSelectedAction("cancelled")}
            danger={selectedAction === "cancelled"}
            style={{
              width: "100%",
              textAlign: "left",
              backgroundColor:
                selectedAction === "cancelled" ? "#fff2f0" : undefined,
            }}
          >
            Annulla controllo - impossibile verificare o non necessario
          </Button>
        </Space>
      </div>

      {/* Notes Input */}
      {selectedAction && (
        <div style={{ marginBottom: 16 }}>
          <Title level={5}>Note di Chiusura</Title>
          <TextArea
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
            placeholder={
              selectedAction === "completed"
                ? "Descrivi cosa è stato verificato, eventuali discrepanze trovate, azioni correttive prese..."
                : "Spiega il motivo dell'annullamento (prodotto non trovato, controllo non necessario, ecc.)"
            }
            rows={4}
            maxLength={500}
            showCount
          />
        </div>
      )}

      {/* Warning */}
      {selectedAction && (
        <Alert
          message={
            selectedAction === "completed"
              ? "Conferma completamento"
              : "Conferma annullamento"
          }
          description={
            selectedAction === "completed"
              ? "Il controllo verrà marcato come completato e non sarà più modificabile."
              : "Il controllo verrà annullato e non sarà più modificabile."
          }
          type={selectedAction === "completed" ? "info" : "warning"}
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Modal>
  );
};

export default CheckRequestActionModal;
