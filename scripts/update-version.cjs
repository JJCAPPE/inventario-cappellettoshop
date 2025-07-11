#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Automated Version Management Script
 *
 * This script uses package.json as the single source of truth for version numbers
 * and automatically updates all other files that contain version references.
 *
 * Usage:
 * node scripts/update-version.js [new-version]
 *
 * If no version is provided, it will sync all files to the current package.json version
 */

// Get the new version from command line or use current package.json version
const newVersion = process.argv[2];
const packageJsonPath = path.join(__dirname, "..", "package.json");

// Read current package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const currentVersion = packageJson.version;

// Determine target version
const targetVersion = newVersion || currentVersion;

console.log(`🚀 Version Management Script`);
console.log(`📦 Current version: ${currentVersion}`);
console.log(`🎯 Target version: ${targetVersion}`);

if (newVersion) {
    console.log(`📝 Updating package.json to ${targetVersion}...`);
    packageJson.version = targetVersion;
    fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n"
    );
}

// Define all files that need version updates
const filesToUpdate = [
    // Tauri configuration
    {
        path: "src-tauri/tauri.conf.json",
        replacements: [{
            pattern: /"version":\s*"[^"]*"/,
            replacement: `"version": "${targetVersion}"`,
        }, ],
    },

    // Cargo.toml
    {
        path: "src-tauri/Cargo.toml",
        replacements: [{
            pattern: /^version\s*=\s*"[^"]*"/m,
            replacement: `version = "${targetVersion}"`,
        }, ],
    },

    // Environment files
    {
        path: ".env",
        replacements: [
            { pattern: /^VERSION=.*/m, replacement: `VERSION=${targetVersion}` },
            {
                pattern: /^VITE_VERSION=.*/m,
                replacement: `VITE_VERSION=${targetVersion}`,
            },
        ],
    },

    // Rust source files with fallback versions
    {
        path: "src-tauri/src/utils/mod.rs",
        replacements: [{
                pattern: /\.unwrap_or_else\(\|_\|\s*"[^"]*"\.to_string\(\)\)/g,
                replacement: `.unwrap_or_else(|_| "${targetVersion}".to_string())`,
            },
            {
                pattern: /\.unwrap_or\("([^"]*)"\)\.to_string\(\)/g,
                replacement: `.unwrap_or("${targetVersion}").to_string()`,
            },
        ],
    },

    // Test files
    {
        path: "src-tauri/tests/integration_tests.rs",
        replacements: [{
            pattern: /version:\s*"[^"]*"\.to_string\(\)/g,
            replacement: `version: "${targetVersion}".to_string()`,
        }, ],
    },

    {
        path: "src-tauri/tests/test_runner.rs",
        replacements: [{
            pattern: /version:\s*"[^"]*"\.to_string\(\)/g,
            replacement: `version: "${targetVersion}".to_string()`,
        }, ],
    },

    // Documentation files
    {
        path: "README.md",
        replacements: [{
                pattern: /VERSION=\d+\.\d+\.\d+/g,
                replacement: `VERSION=${targetVersion}`,
            },
            {
                pattern: /VITE_VERSION=\d+\.\d+\.\d+/g,
                replacement: `VITE_VERSION=${targetVersion}`,
            },
            {
                pattern: /\*\*Version\*\*:\s*\d+\.\d+\.\d+/,
                replacement: `**Version**: ${targetVersion}`,
            },
        ],
    },

    {
        path: "docs/SETUP_COMPLETE.md",
        replacements: [{
            pattern: /App Version\*\*:\s*\d+\.\d+\.\d+/,
            replacement: `App Version**: ${targetVersion}`,
        }, ],
    },

    {
        path: "docs/TEST_README.md",
        replacements: [{
            pattern: /VERSION=\d+\.\d+\.\d+/g,
            replacement: `VERSION=${targetVersion}`,
        }, ],
    },
];

// Update each file
let updatedFiles = 0;
let errors = 0;

filesToUpdate.forEach((fileConfig) => {
    const filePath = path.join(__dirname, "..", fileConfig.path);

    try {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  Skipping ${fileConfig.path} (file not found)`);
            return;
        }

        let content = fs.readFileSync(filePath, "utf8");
        let hasChanges = false;

        fileConfig.replacements.forEach(({ pattern, replacement }) => {
            const originalContent = content;
            content = content.replace(pattern, replacement);
            if (content !== originalContent) {
                hasChanges = true;
            }
        });

        if (hasChanges) {
            fs.writeFileSync(filePath, content, "utf8");
            console.log(`✅ Updated ${fileConfig.path}`);
            updatedFiles++;
        } else {
            console.log(`📄 No changes needed in ${fileConfig.path}`);
        }
    } catch (error) {
        console.error(`❌ Error updating ${fileConfig.path}:`, error.message);
        errors++;
    }
});

// Update package-lock.json by running npm install
console.log(`\n📦 Updating package-lock.json...`);
try {
    const { execSync } = require("child_process");
    execSync("npm install --package-lock-only", { stdio: "pipe" });
    console.log(`✅ Updated package-lock.json`);
    updatedFiles++;
} catch (error) {
    console.error(`❌ Error updating package-lock.json:`, error.message);
    errors++;
}

// Summary
console.log(`\n📊 Summary:`);
console.log(`✅ Updated files: ${updatedFiles}`);
console.log(`❌ Errors: ${errors}`);
console.log(`🎯 All files now use version: ${targetVersion}`);

if (errors === 0) {
    console.log(`\n🎉 Version update completed successfully!`);
    console.log(`\n📋 Next steps:`);
    console.log(`   1. Review the changes: git diff`);
    console.log(`   2. Test the application: npm run tauri dev`);
    console.log(
        `   3. Commit the changes: git add . && git commit -m "chore: bump version to ${targetVersion}"`
    );
    console.log(
        `   4. Create a release: git tag v${targetVersion} && git push origin v${targetVersion}`
    );
} else {
    console.log(
        `\n⚠️  Some files could not be updated. Please review the errors above.`
    );
    process.exit(1);
}