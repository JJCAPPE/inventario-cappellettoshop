import React, { useState, useEffect } from "react";
import { AutoComplete, Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import TauriAPI from "../services/tauri";

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSelect: (id: string, query: string) => void;
  onAutoSelect?: (id: string, query: string) => void;
  sortKey?: string;
  sortReverse?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  query,
  setQuery,
  onSelect,
  onAutoSelect,
  sortKey = "RELEVANCE",
  sortReverse = false,
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
      console.log("🚀 SearchBar: Starting search for:", searchQuery);
      console.log("📊 Using sort:", sortKey, "reverse:", sortReverse);

      let products = [];

      // First, try exact SKU matching (this should be fast and exact)
      console.log("🔍 SearchBar: Checking for exact SKU match");
      const exactSkuResult =
        await TauriAPI.Product.findProductByExactSkuGraphQL(searchQuery.trim());

      if (exactSkuResult) {
        console.log(
          "✅ SearchBar: Found exact SKU match:",
          exactSkuResult.product.title
        );
        products = [exactSkuResult.product];
      } else {
        // If no exact SKU match, search by name with sorting
        console.log(
          "🔍 SearchBar: No exact SKU match, searching by name with sorting"
        );
        products = await TauriAPI.Product.searchProductsByNameGraphQL(
          searchQuery,
          sortKey,
          sortReverse
        );
        console.log(
          `✅ SearchBar: Name search returned ${products.length} products (sorted by ${sortKey}, reverse: ${sortReverse})`
        );
      }

      console.log(
        "✅ SearchBar: Total search results:",
        products.length,
        "products"
      );

      // Auto-select logic: select immediately if exact SKU match or only one result
      if (onAutoSelect) {
        if (exactSkuResult) {
          // Auto-select for exact SKU match
          console.log(
            "✅ SearchBar: Exact SKU match found, auto-selecting:",
            exactSkuResult.product.title
          );
          onAutoSelect(exactSkuResult.product.id, searchQuery);
          setOptions([]);
          return;
        } else if (products.length === 1) {
          // Auto-select for single search result
          console.log(
            "✅ SearchBar: Only one search result found, auto-selecting:",
            products[0].title
          );
          onAutoSelect(products[0].id, searchQuery);
          setOptions([]);
          return;
        }
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
              padding: "2px 4px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
              {product.images && product.images.length > 0 && (
                <img
                  src={product.images[0]}
                  alt={product.title}
                  style={{
                    width: 80,
                    height: 70,
                    objectFit: "cover",
                    borderRadius: 6,
                    marginRight: 12,
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                  }}
                />
              )}
              <div style={{ flex: 1, lineHeight: 1.2 }}>
                <div
                  style={{
                    fontWeight: 500,
                    marginBottom: 2,
                    fontSize: "13px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {product.title}
                </div>
                {product.variants &&
                  product.variants.length > 0 &&
                  product.variants[0].sku && (
                    <div
                      style={{
                        fontSize: "10px",
                        color: "#666",
                        marginBottom: 1,
                      }}
                    >
                      SKU: {product.variants[0].sku}
                    </div>
                  )}
                <div style={{ fontSize: "10px", color: "#999" }}>
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
        console.log(
          `⏰ SearchBar: Debounced search triggered for: "${query}" with sort: ${sortKey}, reverse: ${sortReverse}`
        );
      }
      searchProducts(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, sortKey, sortReverse]);

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
      popupMatchSelectWidth={true}
      classNames={{ popup: { root: "search-dropdown-large" } }}
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
