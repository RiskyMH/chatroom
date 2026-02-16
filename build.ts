#!/usr/bin/env bun
import { build } from "bun";
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";

const start = performance.now();

// Clean the dist directory
const distPath = path.join(process.cwd(), "dist");
if (existsSync(distPath)) {
  await rm(distPath, { recursive: true });
}

// Build all the HTML files
const result = await build({
  entrypoints: ["src/index.tsx"],
  outdir: "dist",
  plugins: [plugin],
  minify: true,
  target: "bun",
  bytecode: true,
  compile: {
    outfile: "chatroom",
  },
  sourcemap: "linked",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
});

// Print the results
const end = performance.now();

// Helper function to format file sizes
const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};


const outputTable = result.outputs.map(output => ({
  "File": path.relative(process.cwd(), output.path),
  "Type": output.kind,
  "Size": formatFileSize(output.size),
}));

console.table(outputTable);
const buildTime = (end - start).toFixed(2);

console.log(`\n✅ Build completed in ${buildTime}ms\n`);
