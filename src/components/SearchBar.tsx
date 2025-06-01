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
      console.log("🚀 SearchBar: Starting concurrent search for:", searchQuery);

      // Start both searches concurrently
      const skuSearchPromise = searchQuery.trim()
        ? TauriAPI.Product.findProductByExactSku(searchQuery.trim()).catch(
            () => null
          )
        : Promise.resolve(null);

      const graphqlSearchPromise = TauriAPI.Product.searchProductsByNameGraphQL(
        searchQuery,
        sortKey,
        sortReverse
      ).catch(() => []);

      console.log("🏷️ SearchBar: Started exact SKU search for:", searchQuery);
      console.log(
        "🔍 SearchBar: Started GraphQL title search for:",
        searchQuery
      );
      console.log(
        "📊 SearchBar: Using sort key:",
        sortKey,
        "reverse:",
        sortReverse
      );

      // Wait for both searches to complete
      const [skuProduct, products] = await Promise.all([
        skuSearchPromise,
        graphqlSearchPromise,
      ]);

      // Check if we found an exact SKU match
      if (skuProduct) {
        console.log("✅ SearchBar: Found exact SKU match:", skuProduct.title);
        // Auto-select the SKU match immediately
        if (onAutoSelect) {
          onAutoSelect(skuProduct.id, searchQuery);
          setOptions([]);
          return;
        }
      }

      console.log(
        `✅ SearchBar: GraphQL search returned ${products.length} products`
      );

      // If GraphQL didn't return enough results, also try enhanced search as fallback
      let allProducts = products;
      if (products.length < 10) {
        try {
          console.log(
            "🔄 SearchBar: Adding enhanced search results as fallback"
          );
          const enhancedProducts =
            await TauriAPI.Product.searchProductsEnhanced(searchQuery);

          // Combine and deduplicate results
          const existingIds = new Set(products.map((p) => p.id));
          const newProducts = enhancedProducts.filter(
            (p) => !existingIds.has(p.id)
          );
          allProducts = [...products, ...newProducts];

          console.log(
            `📊 SearchBar: Combined search returned ${allProducts.length} total products`
          );
        } catch (error) {
          console.log(
            "⚠️ SearchBar: Enhanced search fallback failed, using GraphQL results only"
          );
        }
      }

      const searchOptions = allProducts.map((product) => ({
        value: product.id,
        label: (
          <div
            style={{ display: "flex", alignItems: "center", padding: "4px 0" }}
          >
            {product.images && product.images.length > 0 ? (
              <img
                src={product.images[0]}
                alt={product.title}
                style={{
                  width: 32,
                  height: 32,
                  marginRight: 8,
                  borderRadius: 4,
                  objectFit: "cover",
                }}
                onError={(e) => {
                  // Fallback to placeholder if image fails to load
                  console.log(
                    "🖼️ SearchBar: Image failed to load, using placeholder for:",
                    product.title
                  );
                  e.currentTarget.src = "https://via.placeholder.com/32";
                }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  marginRight: 8,
                  borderRadius: 4,
                  backgroundColor: "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  color: "#999",
                }}
              >
                IMG
              </div>
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
                    style={{ fontSize: "11px", color: "#666", marginBottom: 1 }}
                  >
                    SKU: {product.variants[0].sku}
                  </div>
                )}
              <div style={{ fontSize: "11px", color: "#999" }}>
                €{product.price} • {product.total_inventory} in stock
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
      console.error("❌ SearchBar: Error searching products:", error);
      setSearchStatus("error");

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
      } else {
        setOptions([]);
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
