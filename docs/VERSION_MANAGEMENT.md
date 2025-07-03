# 🚀 Automated Version Management System

This project uses an **automated version management system** that ensures version consistency across all files using `package.json` as the single source of truth.

## 📋 Quick Start

### Update Version (Recommended Methods)

```bash
# Patch version (3.0.1 → 3.0.2)
npm run version:patch

# Minor version (3.0.1 → 3.1.0)  
npm run version:minor

# Major version (3.0.1 → 4.0.0)
npm run version:major

# Set specific version
npm run version:set 3.5.0
```

### Sync Existing Files

```bash
# Sync all files to current package.json version
npm run version:sync
```

## 🎯 How It Works

### Single Source of Truth
- **`package.json`** is the authoritative source for version numbers
- All other files are automatically updated to match
- No more manual find-and-replace across multiple files!

### Files Automatically Updated

| File | What Gets Updated |
|------|------------------|
| `package.json` | Main version field |
| `package-lock.json` | Version references |
| `src-tauri/tauri.conf.json` | Tauri app version |
| `src-tauri/Cargo.toml` | Rust package version |
| `.env` | VERSION and VITE_VERSION |
| `src-tauri/src/utils/mod.rs` | Fallback version strings |
| `src-tauri/tests/*.rs` | Test version references |
| `README.md` | Documentation version examples |
| `SETUP_COMPLETE.md` | Setup guide versions |

## 🔄 Release Workflow

### 1. Update Version
```bash
npm run version:patch  # or minor/major
```

### 2. Review Changes
```bash
git diff  # Review all updated files
```

### 3. Test Application
```bash
npm run tauri dev  # Ensure everything works
```

### 4. Commit and Release
```bash
git add .
git commit -m "chore: bump version to $(node -p 'require("./package.json").version')"
git tag "v$(node -p 'require("./package.json").version')"
git push origin main --tags
```

### 5. Automated GitHub Release
- GitHub Actions automatically detects the tag
- Extracts version from `package.json`
- Builds and publishes release with correct version
- **No manual GitHub secrets management needed!**

## 🛠️ Advanced Usage

### Manual Script Usage
```bash
# Update to specific version
node scripts/update-version.cjs 3.5.0

# Sync files to current package.json version
node scripts/update-version.cjs
```

### GitHub Actions Integration
The workflow automatically:
- Extracts version from `package.json`
- Sets `VERSION` and `VITE_VERSION` environment variables
- Uses dynamic version in release tags and names
- No need to update GitHub secrets for version changes

## 🔧 Troubleshooting

### Version Mismatch Issues
```bash
# Reset everything to package.json version
npm run version:sync

# Clean build cache if needed
cd src-tauri && cargo clean && rm Cargo.lock
```

### Missing Files
The script will skip missing files and report them:
```
⚠️  Skipping some-file.txt (file not found)
```

### Permission Issues
Make sure the script is executable:
```bash
chmod +x scripts/update-version.cjs
```

## 📊 What You Get

### Before (Manual Process)
❌ Find and replace across 10+ files  
❌ Easy to miss files  
❌ Version inconsistencies  
❌ Manual GitHub secrets updates  
❌ Error-prone and time-consuming  

### After (Automated Process)
✅ Single command updates everything  
✅ Guaranteed consistency  
✅ Automatic GitHub integration  
✅ No secrets management needed  
✅ Fast and reliable  

## 🎉 Benefits

1. **Consistency**: All files always have the same version
2. **Speed**: One command instead of manual editing
3. **Reliability**: No human errors in version updates
4. **Automation**: GitHub releases work automatically
5. **Simplicity**: No need to manage version secrets

## 📝 Script Details

The `scripts/update-version.cjs` script:
- Uses Node.js regex patterns for precise replacements
- Handles different file formats (JSON, TOML, Rust, Markdown)
- Provides detailed logging and error reporting
- Updates `package-lock.json` automatically
- Gives clear next-step instructions

---

**🚀 Now you can focus on building features instead of managing version numbers!** 