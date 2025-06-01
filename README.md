# 🏪 Inventario CappellettoShop

A modern desktop inventory management application for Shopify stores, built with **Tauri**, **React**, and **TypeScript**. This application provides real-time inventory tracking, product search, and barcode scanning capabilities for retail store operations.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Setup & Installation](#-setup--installation)
- [Usage Guide](#-usage-guide)
- [API Integration](#-api-integration)
- [Development Methodology](#-development-methodology)
- [Configuration](#-configuration)
- [Contributing](#-contributing)

## ✨ Features

### Core Functionality
- **Product Search & Lookup**: Search products by name, SKU, or barcode with intelligent search suggestions
- **Real-time Inventory Management**: View and modify inventory levels across multiple store locations
- **Barcode Scanner Integration**: Quick product lookup using barcode scanning
- **Multi-location Support**: Manage inventory for multiple store locations (Treviso, Mogliano)
- **Inventory Adjustments**: Decrease inventory with automatic logging and undo functionality
- **Product Status Management**: Toggle products between draft and active status
- **Change History**: Complete audit trail of all inventory modifications with timestamps

### User Interface
- **Modern Design**: Built with Ant Design components for a professional look
- **Responsive Layout**: Optimized for desktop with mobile-friendly elements
- **Real-time Updates**: Live inventory data with automatic refresh capabilities
- **Keyboard Shortcuts**: Quick access to settings and frequently used functions
- **Customizable Settings**: Configurable search sorting and location preferences

### Integration Capabilities
- **Shopify API Integration**: Full integration with Shopify Admin API for product and inventory data
- **Firebase Logging**: Comprehensive activity logging stored in Firebase Firestore
- **External Links**: Direct links to Shopify admin and store front for products

## 🏗 Architecture

### Frontend Architecture
The application follows a **component-based React architecture** with clear separation of concerns:

```
Frontend (React + TypeScript)
├── Components (UI Layer)
├── Services (API Communication)
├── Contexts (State Management)
├── Types (TypeScript Definitions)
└── Hooks (Custom React Hooks)
```

### Backend Architecture
The Tauri backend provides a **Rust-based API layer** that handles all external integrations:

```
Backend (Rust + Tauri)
├── Commands (API Endpoints)
├── Services (External API Clients)
├── Models (Data Structures)
└── Utils (Helper Functions)
```

### Data Flow
1. **User Input** → React Frontend
2. **Frontend** → Tauri Commands (IPC)
3. **Tauri Backend** → External APIs (Shopify, Firebase)
4. **Response** → Frontend State Update
5. **UI Update** → User Feedback

## 🛠 Technology Stack

### Frontend
- **React 18.3** - UI library with hooks and functional components
- **TypeScript 5.6** - Type safety and developer experience
- **Ant Design 5.25** - Professional UI component library
- **Vite 6.0** - Fast build tool and development server
- **Day.js 1.11** - Date manipulation and formatting

### Backend
- **Tauri 2.0** - Rust-based desktop application framework
- **Rust** - Systems programming language for performance and safety
- **Reqwest** - HTTP client for API requests
- **Serde** - Serialization/deserialization framework
- **Tokio** - Asynchronous runtime for Rust

### External Services
- **Shopify Admin API** - Product and inventory data management
- **Firebase Firestore** - Activity logging and audit trails
- **Multiple Store Locations** - Inventory tracking across physical stores

## 📁 Project Structure

```
inventario-cappellettoshop/
├── src/                          # React frontend source
│   ├── components/               # UI components
│   │   ├── HomePage.tsx         # Main application interface
│   │   ├── SearchBar.tsx        # Product search component
│   │   ├── DataPage.tsx         # Recent changes panel
│   │   └── StatisticsPage.tsx   # Analytics dashboard
│   ├── contexts/                # React contexts
│   │   └── LogContext.tsx       # Logging state management
│   ├── services/                # API service layer
│   │   └── tauri.ts            # Tauri command bindings
│   ├── types/                   # TypeScript definitions
│   │   └── index.ts            # Core data models
│   └── App.tsx                 # Main application component
├── src-tauri/                   # Rust backend
│   ├── src/                    # Rust source code
│   │   ├── main.rs            # Application entry point
│   │   ├── commands/          # Tauri command handlers
│   │   ├── services/          # External API clients
│   │   └── models/            # Data structures
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri configuration
├── public/                     # Static assets
├── dist/                       # Built frontend files
└── package.json               # Node.js dependencies
```

## 🚀 Setup & Installation

### Prerequisites
- **Node.js 18+** and **npm**
- **Rust** (latest stable version)
- **Tauri CLI**: `npm install -g @tauri-apps/cli`

### Environment Setup
1. Clone the repository:
```bash
git clone <repository-url>
cd inventario-cappellettoshop
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install Rust dependencies:
```bash
cd src-tauri
cargo build
cd ..
```

4. Configure environment variables:
Create a `.env` file in the root directory with:
```env
# Shopify API Configuration
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET_KEY=your_secret_key
SHOPIFY_ACCESS_TOKEN=your_access_token
SHOPIFY_SHOP_DOMAIN=your_shop.myshopify.com
SHOPIFY_API_VERSION=2024-04

# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_bucket.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id

# Store Locations
LOCATION_TREVISO=location_id_1
LOCATION_MOGLIANO=location_id_2
```

### Development Commands
```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run Tauri in development mode
npm run tauri dev

# Build Tauri application
npm run tauri build
```

## 📖 Usage Guide

### Basic Operations

1. **Product Search**:
   - Use the search bar to find products by name, SKU, or barcode
   - Click on search results to load product details
   - Barcode scanning automatically populates the search field

2. **Inventory Management**:
   - Select a product variant from the available options
   - Use the "Diminuisci" button to decrease inventory
   - View real-time inventory levels for both store locations

3. **Location Management**:
   - Switch between primary locations (Treviso/Mogliano) in settings
   - View inventory levels for both locations simultaneously
   - Changes are applied to the currently selected primary location

4. **Change History**:
   - Access the "Modifiche" panel to view recent inventory changes
   - Use the undo functionality to reverse recent modifications
   - All changes are logged with timestamps and details

### Keyboard Shortcuts
- **Cmd/Ctrl + ,**: Open settings modal
- **Enter**: Submit search query
- **Escape**: Close modals and clear selections

### Settings Configuration
- **Primary Location**: Set your main store location
- **Search Sorting**: Configure how search results are ordered
- **Sort Direction**: Choose ascending or descending order

## 🔌 API Integration

### Shopify Integration
The application integrates with Shopify's Admin API to:
- Fetch product details and variants
- Retrieve real-time inventory levels
- Update inventory quantities
- Manage product status (draft/active)
- Search products across the store catalog

### Firebase Integration
Firebase Firestore is used for:
- Logging all inventory modifications
- Storing audit trails with timestamps
- Enabling undo functionality
- Providing change history and analytics

### Location Management
The system supports multiple store locations:
- **Location IDs**: Each physical store has a unique identifier
- **Inventory Tracking**: Separate inventory levels per location
- **Cross-location Visibility**: View inventory across all locations
- **Location-specific Operations**: All changes apply to selected location

## 🔬 Development Methodology

### Code Organization
- **Separation of Concerns**: Clear distinction between UI, business logic, and data access
- **Type Safety**: Comprehensive TypeScript coverage for all data models
- **Component Composition**: Reusable React components with single responsibilities
- **Service Layer**: Abstracted API communications through service classes

### State Management
- **Context API**: React Context for global state (logging, user preferences)
- **Local State**: Component-level state for UI interactions
- **Persistent Storage**: LocalStorage for user preferences and settings

### Error Handling
- **Rust Error Types**: Custom error types with proper error propagation
- **Frontend Error Boundaries**: React error boundaries for graceful failure handling
- **User Feedback**: Toast notifications and loading states for user guidance

### Performance Optimization
- **Parallel API Calls**: Concurrent requests for inventory and product data
- **Intelligent Caching**: Strategic caching of frequently accessed data
- **Debounced Search**: Optimized search input handling
- **Lazy Loading**: Components and data loaded on demand

### Security Considerations
- **Environment Variables**: Sensitive API keys stored securely
- **Input Validation**: All user inputs validated on frontend and backend
- **API Rate Limiting**: Respectful API usage with proper rate limiting
- **Access Control**: Shopify API permissions properly configured

## ⚙️ Configuration

### Application Settings
- **Window Size**: 2000x1000px default for optimal inventory management
- **Auto-updates**: Configured for automatic application updates
- **Security**: CSP disabled for Shopify and Firebase integration

### Build Configuration
- **Vite**: Modern build tool with HMR for development
- **Tauri**: Cross-platform compilation with native performance
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code quality and consistency enforcement

## 🤝 Contributing

### Development Setup
1. Follow the installation guide above
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes with proper TypeScript types
4. Test thoroughly in development mode
5. Submit a pull request with clear description

### Code Standards
- **TypeScript**: All new code must include proper type definitions
- **React**: Use functional components with hooks
- **Rust**: Follow standard Rust conventions and error handling
- **Documentation**: Update README and inline documentation for new features

### Testing
- Test all features in both development and production builds
- Verify Shopify API integration with test data
- Ensure proper error handling for network failures
- Validate UI responsiveness across different screen sizes

## 📄 License

This project is proprietary software for CappellettoShop internal use.

## 📞 Support

For technical support or questions about the inventory management system, please contact the development team.

---

**Version**: 3.0.0  
**Last Updated**: 2024  
**Built with** ❤️ **for CappellettoShop**
