import React, { useState, useEffect } from "react";
import { AutoComplete, Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import TauriAPI from "../services/tauri";

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSelect: (id: string, query: string) => void;
  onAutoSelect?: (id: string, query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  query,
  setQuery,
  onSelect,
  onAutoSelect,
}) => {
  const [options, setOptions] = useState<
    Array<{ value: string; label: React.ReactNode }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"" | "warning" | "error">(
    ""
  );

  const searchProducts = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setOptions([]);
      setSearchStatus("");
      return;
    }

    setLoading(true);
    setSearchStatus(""); // Reset status while searching
    try {
      console.log("🚀 SearchBar: Starting enhanced search for:", searchQuery);

      // Use the new enhanced search that handles SKU-first logic
      const products = await TauriAPI.Product.enhancedSearchProducts(
        searchQuery
      );

      console.log(
        "✅ SearchBar: Enhanced search returned",
        products.length,
        "products"
      );

      // Auto-select logic: select immediately if only one result is found
      if (products.length === 1 && onAutoSelect) {
        const product = products[0];

        // Check if it's an exact SKU match first
        const matchingVariant = product.variants.find(
          (v) =>
            v.sku && v.sku.toLowerCase() === searchQuery.trim().toLowerCase()
        );

        if (matchingVariant) {
          console.log(
            "✅ SearchBar: Exact SKU match found, auto-selecting:",
            product.title
          );
        } else {
          console.log(
            "✅ SearchBar: Only one search result found, auto-selecting:",
            product.title
          );
        }

        onAutoSelect(product.id, searchQuery);
        setOptions([]);
        return;
      }

      // Process all products for display
      const allProducts = products;

      const searchOptions = allProducts.map((product) => ({
        value: product.id,
        label: (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "4px 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              {product.images && product.images.length > 0 && (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: "cover",
                    borderRadius: 4,
                    marginRight: 10,
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, lineHeight: 1.3 }}>
                <div
                  style={{ fontWeight: 500, marginBottom: 1, fontSize: "14px" }}
                >
                  {product.title}
                </div>
                {product.variants &&
                  product.variants.length > 0 &&
                  product.variants[0].sku && (
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        marginBottom: 1,
                      }}
                    >
                      SKU: {product.variants[0].sku}
                    </div>
                  )}
                <div style={{ fontSize: "11px", color: "#999" }}>
                  €{product.price} • {product.total_inventory} in stock
                </div>
              </div>
            </div>
          </div>
        ),
      }));

      console.log(
        `📋 SearchBar: Created ${searchOptions.length} search options`
      );

      // Set status based on results
      if (searchOptions.length === 0) {
        setSearchStatus("warning");
        // Add a "no results" option to show user feedback
        const noResultsOption = {
          value: "no-results",
          label: (
            <div
              style={{
                color: "#faad14",
                padding: "8px 12px",
                textAlign: "center",
                fontStyle: "italic",
              }}
            >
              Nessun risultato trovato per "{searchQuery}"
            </div>
          ),
        };
        setOptions([noResultsOption]);
      } else {
        setSearchStatus("");
        setOptions(searchOptions);
      }
    } catch (error) {
      console.error("❌ SearchBar: Search failed:", error);
      setSearchStatus("error");
      setOptions([]);
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
    // Don't handle error or no-results selections
    if (value === "error" || value === "no-results") return;

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
      listHeight={600}
      dropdownMatchSelectWidth={true}
      dropdownStyle={{
        maxHeight: "600px",
        minHeight: "200px",
        overflowY: "auto",
        zIndex: 1050,
      }}
      popupClassName="search-dropdown-large"
    >
      <Input
        size="large"
        prefix={<SearchOutlined />}
        suffix={loading ? <Spin size="small" /> : null}
        placeholder="Cerca per nome prodotto o inserisci SKU per selezione automatica..."
        status={searchStatus}
      />
    </AutoComplete>
  );
};

export default SearchBar;
