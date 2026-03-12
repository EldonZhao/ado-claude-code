#!/usr/bin/env node

/**
 * Bump version across all config files.
 * Usage: node scripts/bump-version.js <X.Y.Z>
 */

const fs = require("fs");
const path = require("path");

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/bump-version.js <X.Y.Z>");
  process.exit(1);
}

const root = path.resolve(__dirname, "..");

const files = [
  {
    path: path.join(root, "package.json"),
    update(obj) {
      obj.version = version;
    },
  },
  {
    path: path.join(root, ".claude-plugin", "plugin.json"),
    update(obj) {
      obj.version = version;
    },
  },
  {
    path: path.join(root, ".claude-plugin", "marketplace.json"),
    update(obj) {
      obj.plugins[0].version = version;
      // Pin source ref to the release tag so users install this exact version
      if (obj.plugins[0].source && obj.plugins[0].source.ref) {
        obj.plugins[0].source.ref = `v${version}`;
      }
    },
  },
];

for (const file of files) {
  const content = JSON.parse(fs.readFileSync(file.path, "utf8"));
  file.update(content);
  fs.writeFileSync(file.path, JSON.stringify(content, null, 2) + "\n", "utf8");
  console.log(`Updated ${path.relative(root, file.path)} → ${version}`);
}

console.log(`\nAll files set to v${version}`);
