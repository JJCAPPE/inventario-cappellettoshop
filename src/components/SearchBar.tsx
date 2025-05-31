import React, { useState, useEffect } from "react";
import { AutoComplete, Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import TauriAPI from "../services/tauri";

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSelect: (id: string, query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ query, setQuery, onSelect }) => {
  const [options, setOptions] = useState<
    Array<{ value: string; label: React.ReactNode }>
  >([]);
  const [loading, setLoading] = useState(false);

  const searchProducts = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      console.log("🚀 SearchBar: Starting enhanced search for:", searchQuery);

      // Use enhanced search that looks for both title and SKU matches
      const products = await TauriAPI.Product.searchProductsEnhanced(
        searchQuery
      );
      console.log(
        `✅ SearchBar: Received ${products.length} products from search`
      );

      const searchOptions = products.map((product) => ({
        value: product.id,
        label: (
          <div style={{ display: "flex", alignItems: "center" }}>
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.title}
                style={{
                  width: 40,
                  height: 40,
                  marginRight: 12,
                  borderRadius: 4,
                  objectFit: "cover",
                }}
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  console.log(
                    "🖼️ SearchBar: Image failed to load, using placeholder for:",
                    product.title
                  );
                  e.currentTarget.src = "https://via.placeholder.com/40";
                }}
              />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  marginRight: 12,
                  borderRadius: 4,
                  backgroundColor: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  color: "#999",
                }}
              >
                IMG
              </div>
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, marginBottom: 2 }}>
                {product.title}
              </div>
              {product.variants &&
                product.variants.length > 0 &&
                product.variants[0].sku && (
                  <div style={{ fontSize: "12px", color: "#666" }}>
                    SKU: {product.variants[0].sku}
                  </div>
                )}
              <div style={{ fontSize: "12px", color: "#999" }}>
                €{product.price} • {product.total_inventory} in stock
              </div>
            </div>
          </div>
        ),
      }));

      console.log(
        `📋 SearchBar: Created ${searchOptions.length} search options`
      );
      setOptions(searchOptions);
    } catch (error) {
      console.error("❌ SearchBar: Error searching products:", error);
      setOptions([]);

      // Show user-friendly error in development mode
      if (import.meta.env.DEV) {
        const errorOption = {
          value: "error",
          label: (
            <div style={{ color: "#ff4d4f", padding: "8px" }}>
              Error: {error instanceof Error ? error.message : "Search failed"}
            </div>
          ),
        };
        setOptions([errorOption]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query) {
        console.log(`⏰ SearchBar: Debounced search triggered for: "${query}"`);
      }
      searchProducts(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const handleSelect = (value: string) => {
    // Don't handle error selections
    if (value === "error") return;

    console.log("🎯 SearchBar: Product selected with ID:", value);
    const selectedOption = options.find((option) => option.value === value);
    if (selectedOption) {
      console.log("✅ SearchBar: Calling onSelect with query:", query);
      onSelect(value, query);
    }
  };

  return (
    <AutoComplete
      style={{ width: "100%" }}
      options={options}
      onSelect={handleSelect}
      onSearch={setQuery}
      value={query}
    >
      <Input
        size="large"
        prefix={<SearchOutlined />}
        suffix={loading ? <Spin size="small" /> : null}
        placeholder="Cerca prodotti per nome o SKU..."
      />
    </AutoComplete>
  );
};

export default SearchBar;
