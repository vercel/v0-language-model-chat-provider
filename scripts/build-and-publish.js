import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { readFile, writeFile, mkdir, rm } from "fs/promises";
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

// Create a temporary clean directory for vsce
const tempDir = join(root, ".vsce-temp");
await rm(tempDir, { recursive: true, force: true });
await mkdir(tempDir, { recursive: true });

try {
  // Copy only the necessary files to temp directory
  await $$`cp package.json LICENSE README.md ${tempDir}/`;
  await $$`cp -r out ${tempDir}/`;
  await $$`cp .vscodeignore ${tempDir}/`;

  // Clean the package.json in temp directory
  const pkg = JSON.parse(await readFile(join(tempDir, "package.json"), "utf-8"));
  delete pkg.packageManager;
  delete pkg.devDependencies;
  await writeFile(join(tempDir, "package.json"), JSON.stringify(pkg, null, "\t"));

  // Run vsce from the clean temp directory
  const $$temp = $({ cwd: tempDir });
  
  if (publish) {
    if (preRelease) {
      await $$temp`npx --yes @vscode/vsce publish --pre-release -p ${pat}`;
    } else {
      await $$temp`npx --yes @vscode/vsce publish -p ${pat}`;
    }
  } else {
    await $$temp`npx --yes @vscode/vsce package`;
  }
} finally {
  // Clean up temp directory
  await rm(tempDir, { recursive: true, force: true });
}
