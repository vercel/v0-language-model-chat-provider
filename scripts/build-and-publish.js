import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile } from "fs/promises";
import { $ } from "execa";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const $$ = $({ cwd: root });

const args = process.argv.slice(2);
const publish = args[0] === "--publish";
const preRelease = args.includes("--pre-release");

const pat = process.env.AZURE_TOKEN;

// Compile TypeScript
await $$`npm run compile`;

// Temporarily create a clean package.json for vsce
const originalPkg = await readFile(join(root, "package.json"), "utf-8");
const pkg = JSON.parse(originalPkg);

// Remove problematic fields that confuse vsce in pnpm workspace
delete pkg.packageManager;
const cleanPkg = JSON.stringify(pkg, null, "\t");
await writeFile(join(root, "package.json"), cleanPkg);

try {
  // Package or publish the extension
  if (publish) {
    if (preRelease) {
      await $$`vsce publish --pre-release -p ${pat}`;
    } else {
      await $$`vsce publish -p ${pat}`;
    }
  } else {
    await $$`vsce package`;
  }
} finally {
  // Restore original package.json
  await writeFile(join(root, "package.json"), originalPkg);
}
