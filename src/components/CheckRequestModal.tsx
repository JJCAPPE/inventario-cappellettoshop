import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  Space,
  Typography,
  Divider,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  UserOutlined,
  EnvironmentOutlined,
  TagOutlined,
} from "@ant-design/icons";
import { ProductDetails } from "../types/index";
import TauriAPI from "../services/tauri";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface CheckRequestModalProps {
  open: boolean;
  onClose: () => void;
  productDetails: ProductDetails;
  selectedVariant?: string | null;
  primaryLocation: string;
}

interface CheckRequestFormData {
  check_all: boolean;
  variant_id?: string;
  variant_name?: string;
  location: string[];
  notes: string;
  priority: "low" | "medium" | "high";
  requested_by: string;
}

const CheckRequestModal: React.FC<CheckRequestModalProps> = ({
  open,
  onClose,
  productDetails,
  selectedVariant,
  primaryLocation,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [checkAll, setCheckAll] = useState(false);

  // Reset checkAll state when modal opens/closes
  useEffect(() => {
    if (open) {
      // Reset checkAll state when modal opens
      setCheckAll(false);
    }
  }, [open]);

  const handleSubmit = async (values: CheckRequestFormData) => {
    try {
      setLoading(true);

      // Get the selected variant details if not checking all
      let variantId: string | undefined;
      let variantName: string | undefined;

      if (!values.check_all) {
        if (values.variant_name && values.variant_name !== "all") {
          const selectedVariantObj = productDetails.varaintiArticolo.find(
            (v) => v.title === values.variant_name
          );
          if (selectedVariantObj) {
            variantId = selectedVariantObj.variant_id;
            variantName = selectedVariantObj.title;
          }
        }
      }

      const checkRequest = {
        // Firebase document structure
        check_all: values.check_all,
        checked: false,
        location: values.location,
        notes: values.notes || "",
        priority: values.priority,
        product_id: parseInt(productDetails.id),
        product_name: productDetails.nomeArticolo,
        requested_by: values.requested_by,
        status: "pending",
        timestamp: new Date().toISOString(),
        variant_id: variantId ? parseInt(variantId) : null,
        variant_name: variantName || (values.check_all ? "all" : null),
        image_url: productDetails.immaginiArticolo[0] || "",
      };

      console.log("🔄 Creating check request:", checkRequest);

      // Create the document in Firebase
      await TauriAPI.Firebase.createCheckRequest(checkRequest);

      message.success("Richiesta di controllo creata con successo!");
      form.resetFields();
      onClose();
    } catch (error) {
      console.error("❌ Error creating check request:", error);
      message.error(
        `Errore nella creazione della richiesta: ${
          error instanceof Error ? error.message : "Errore sconosciuto"
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setCheckAll(false);
    onClose();
  };

  const handleCheckAllChange = (checked: boolean) => {
    setCheckAll(checked);
    if (checked) {
      form.setFieldsValue({ variant_name: "all" });
    } else {
      form.setFieldsValue({ variant_name: selectedVariant || undefined });
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CheckCircleOutlined />
          <span>Richiesta Controllo Inventario</span>
        </Space>
      }
      open={open}
      onCancel={handleCancel}
      onOk={form.submit}
      okText="Crea Richiesta"
      cancelText="Annulla"
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          {productDetails.nomeArticolo}
        </Title>
        <Text type="secondary">
          ID Prodotto: {productDetails.id} • Prezzo: €{productDetails.prezzo}
        </Text>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          check_all: false,
          variant_name: selectedVariant || undefined,
          location: [primaryLocation],
          priority: "medium",
          notes: "",
        }}
      >
        <Form.Item
          name="requested_by"
          label={
            <Space>
              <UserOutlined />
              <span>Richiesto da</span>
            </Space>
          }
          rules={[
            {
              required: true,
              message: "Inserisci il nome di chi richiede il controllo",
            },
          ]}
        >
          <Input placeholder="Nome della persona che richiede il controllo" />
        </Form.Item>

        <Form.Item
          name="check_all"
          valuePropName="checked"
          label="Tipo di controllo"
        >
          <Checkbox onChange={(e) => handleCheckAllChange(e.target.checked)}>
            Controlla tutte le varianti del prodotto
          </Checkbox>
        </Form.Item>

        {!checkAll && (
          <Form.Item
            name="variant_name"
            label={
              <Space>
                <TagOutlined />
                <span>Variante da controllare</span>
              </Space>
            }
            rules={[
              {
                required: !checkAll,
                message: "Seleziona la variante da controllare",
              },
            ]}
          >
            <Select placeholder="Seleziona una variante">
              {productDetails.varaintiArticolo.map((variant) => (
                <Option key={variant.title} value={variant.title}>
                  {variant.title} (Quantità: {variant.inventory_quantity})
                </Option>
              ))}
            </Select>
          </Form.Item>
        )}

        <Form.Item
          name="location"
          label={
            <Space>
              <EnvironmentOutlined />
              <span>Posizioni da controllare</span>
            </Space>
          }
          rules={[
            {
              required: true,
              message: "Seleziona almeno una posizione",
            },
          ]}
        >
          <Checkbox.Group>
            <Space direction="vertical">
              <Checkbox value="Treviso">Treviso</Checkbox>
              <Checkbox value="Mogliano">Mogliano</Checkbox>
            </Space>
          </Checkbox.Group>
        </Form.Item>

        <Form.Item
          name="priority"
          label="Priorità"
          rules={[{ required: true, message: "Seleziona la priorità" }]}
        >
          <Select>
            <Option value="low">
              <Space>
                <span style={{ color: "#52c41a" }}>●</span>
                <span>Bassa</span>
              </Space>
            </Option>
            <Option value="medium">
              <Space>
                <span style={{ color: "#faad14" }}>●</span>
                <span>Media</span>
              </Space>
            </Option>
            <Option value="high">
              <Space>
                <span style={{ color: "#f5222d" }}>●</span>
                <span>Alta</span>
              </Space>
            </Option>
          </Select>
        </Form.Item>

        <Form.Item name="notes" label="Note aggiuntive">
          <TextArea
            rows={3}
            placeholder="Motivo del controllo, dettagli aggiuntivi..."
          />
        </Form.Item>
      </Form>

      <Divider />

      <Text type="secondary" style={{ fontSize: 12 }}>
        💡 La richiesta verrà salvata e sarà visibile nel sistema di gestione
        dei controlli inventario.
      </Text>
    </Modal>
  );
};

export default CheckRequestModal;
