const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "dist");

if (out !== path.resolve(root, "dist") || path.dirname(out) !== root) {
  throw new Error("Frontend output must stay inside the project dist directory");
}
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, "public"), out, { recursive: true });
fs.cpSync(
  path.join(root, "node_modules", "vditor", "dist"),
  path.join(out, "vendor", "vditor", "dist"),
  { recursive: true }
);
fs.copyFileSync(path.join(root, "node_modules", "vditor", "LICENSE"), path.join(out, "vendor", "vditor", "LICENSE"));
for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md", "licenses"]) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
