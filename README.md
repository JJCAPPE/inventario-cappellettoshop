# 🏪 Inventario CappellettoShop

A modern desktop inventory management application for Shopify stores, built with **Tauri**, **React**, and **TypeScript**. This application provides real-time inventory tracking, product search, barcode scanning, and automated update management for retail store operations.

## 📋 Table of Contents

- [✨ Features](#-features)
- [🚀 Getting Started](#-getting-started)
- [🛠️ Technology Stack](#️-technology-stack)
- [📁 Project Structure](#-project-structure)
- [📜 Scripts](#-scripts)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Features

### Core Functionality
- **Product Search & Lookup**: Search products by name, SKU, or barcode with intelligent search suggestions
- **Real-time Inventory Management**: View and modify inventory levels across multiple store locations
- **Barcode Scanner Integration**: Quick product lookup using barcode scanning
- **Multi-location Support**: Manage inventory for multiple store locations (Treviso, Mogliano)
- **Inventory Adjustments**: Decrease inventory with automatic logging and undo functionality
- **Product Status Management**: Toggle products between draft and active status
- **Change History**: Complete audit trail of all inventory modifications with timestamps

### Check Requests System 🆕
- **Quality Control Workflow**: Create and manage product check requests for quality assurance
- **Request Tracking**: Monitor pending, in-progress, and completed check requests
- **Status Management**: Update check request status with closing notes
- **Firebase Integration**: All check requests stored and synchronized via Firebase Firestore
- **Real-time Updates**: Live synchronization of check request status across the application

### Auto-Update System 🆕
- **Automatic Updates**: Seamless application updates with GitHub releases integration
- **Smart Update Detection**: Intelligent checking every 30 minutes with visual feedback
- **Update Status Indicators**:
  - 🔄 **Checking**: Shows download icon with "Controllo..." text
  - ✅ **Up to Date**: Green checkmark icon (no text) when app is current
  - 📥 **Update Available**: Download icon with update modal
- **Persistent Update Management**: Updates remain available for installation even after closing modal
- **Progress Tracking**: Real-time download and installation progress with detailed feedback
- **Signed Updates**: Cryptographically signed updates for security and authenticity

### User Interface
- **Modern Design**: Built with Ant Design components for a professional look
- **Responsive Layout**: Optimized for desktop with mobile-friendly elements
- **Real-time Updates**: Live inventory data with automatic refresh capabilities
- **Enhanced Navigation**:
  - Sidebar panels for recent changes and check requests
  - Keyboard shortcuts for quick access
  - Contextual tooltips and help text
- **Visual Feedback**:
  - Color-coded status indicators
  - Loading states and progress bars
  - Success/error notifications with detailed messages
- **Customizable Settings**: Configurable search sorting and location preferences

### Integration Capabilities
- **Shopify API Integration**: Full integration with Shopify Admin API for product and inventory data
- **Firebase Logging**: Comprehensive activity logging stored in Firebase Firestore
- **GitHub Releases**: Automated update delivery through GitHub releases
- **External Links**: Direct links to Shopify admin and store front for products

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** and **npm**
- **Rust** (latest stable version)
- **Tauri CLI**: `npm install -g @tauri-apps/cli`

### Installation
1. Clone the repository:
```bash
git clone <repository-url>
cd inventario-cappellettoshop
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
Create a `.env` file in the root directory with the following content:
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

# Tauri Auto-Update Signing (for builds only)
TAURI_SIGNING_PRIVATE_KEY=your_private_signing_key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your_key_password

# Application Version
VERSION=3.1.0
VITE_VERSION=3.1.0
```

4. Run the development server:
```bash
npm run tauri dev
```

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Ant Design, Vite
- **Backend**: Rust, Tauri
- **External Services**: Shopify Admin API, Firebase Firestore

## 📁 Project Structure

```
inventario-cappellettoshop/
├── src/                          # React frontend source
│   ├── components/               # UI components
│   ├── contexts/                # React contexts
│   ├── services/                # API service layer
│   ├── hooks/                   # Custom React hooks
│   ├── types/                   # TypeScript definitions
│   └── App.tsx                 # Main application component
├── src-tauri/                   # Rust backend
│   ├── src/                    # Rust source code
│   └── Cargo.toml             # Rust dependencies
├── .github/workflows/          # GitHub Actions
├── public/                     # Static assets
├── dist/                       # Built frontend files
└── package.json               # Node.js dependencies
```

## 📜 Scripts

- `npm run dev`: Starts the development server.
- `npm run build`: Builds the application for production.
- `npm run tauri dev`: Runs the Tauri application in development mode.
- `npm run tauri build`: Builds the Tauri application for production.
- `npm run version:sync`: Synchronizes the version across `package.json` and `tauri.conf.json`.
- `npm run version:patch`: Bumps the patch version.
- `npm run version:minor`: Bumps the minor version.
- `npm run version:major`: Bumps the major version.
- `npm run stock:update`: Updates the stock information.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/your-feature`
3. Make your changes.
4. Commit your changes: `git commit -m 'Add some feature'`
5. Push to the branch: `git push origin feature/your-feature`
6. Submit a pull request.

## 📄 License

This project is licensed under the MIT License.