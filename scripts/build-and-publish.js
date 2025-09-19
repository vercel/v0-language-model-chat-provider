import { join, dirname } from "path";
import { fileURLToPath } from "url";
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
