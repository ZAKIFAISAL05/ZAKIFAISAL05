const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : process.cwd();

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".netlify",
  ".next",
  "dist",
  "build",
]);

function walkHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let htmlFiles = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") {
      if (IGNORED_DIRS.has(entry.name)) continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      htmlFiles = htmlFiles.concat(walkHtmlFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  }

  return htmlFiles;
}

function isExternalUrl(assetUrl) {
  return /^(?:[a-z]+:)?\/\//i.test(assetUrl)
    || /^(?:data:|mailto:|javascript:|#)/i.test(assetUrl);
}

function splitUrlParts(assetUrl) {
  const hashIndex = assetUrl.indexOf("#");
  const beforeHash = hashIndex >= 0 ? assetUrl.slice(0, hashIndex) : assetUrl;
  const hash = hashIndex >= 0 ? assetUrl.slice(hashIndex) : "";
  const queryIndex = beforeHash.indexOf("?");
  const pathname = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex + 1) : "";

  return { pathname, query, hash };
}

function resolveAssetPath(assetPathname, htmlFile) {
  if (!assetPathname) return null;

  if (assetPathname.startsWith("/")) {
    return path.join(projectRoot, assetPathname.slice(1));
  }

  return path.resolve(path.dirname(htmlFile), assetPathname);
}

function createVersionFromFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("md5").update(buffer).digest("hex").slice(0, 10);
}

function withVersion(assetUrl, version) {
  const { pathname, query, hash } = splitUrlParts(assetUrl);
  const params = new URLSearchParams(query);
  params.set("v", version);
  const queryString = params.toString();
  return `${pathname}${queryString ? `?${queryString}` : ""}${hash}`;
}

function updateAttributeValue(tag, attrName, htmlFile, stats) {
  const attrRegex = new RegExp(`\\b${attrName}\\s*=\\s*(['"])([^'"]+)\\1`, "i");

  return tag.replace(attrRegex, (fullMatch, quote, assetUrl) => {
    if (isExternalUrl(assetUrl)) {
      stats.skippedExternal += 1;
      return fullMatch;
    }

    const { pathname } = splitUrlParts(assetUrl);
    if (!/\.(?:css|js)$/i.test(pathname)) {
      stats.skippedNonTarget += 1;
      return fullMatch;
    }

    const resolvedAssetPath = resolveAssetPath(pathname, htmlFile);

    if (!resolvedAssetPath || !fs.existsSync(resolvedAssetPath)) {
      stats.missingAssets.push({
        htmlFile: path.relative(projectRoot, htmlFile),
        assetUrl,
      });
      return fullMatch;
    }

    const version = createVersionFromFile(resolvedAssetPath);
    const newUrl = withVersion(assetUrl, version);

    if (newUrl !== assetUrl) {
      stats.updatedAssets += 1;
    }

    return `${attrName}=${quote}${newUrl}${quote}`;
  });
}

function processHtmlFile(htmlFile, stats) {
  const originalHtml = fs.readFileSync(htmlFile, "utf8");
  let updatedHtml = originalHtml;

  updatedHtml = updatedHtml.replace(
    /<link\b(?=[^>]*\brel\s*=\s*['"][^'"]*stylesheet[^'"]*['"])(?=[^>]*\bhref\s*=)[^>]*>/gi,
    (tag) => updateAttributeValue(tag, "href", htmlFile, stats)
  );

  updatedHtml = updatedHtml.replace(
    /<script\b(?=[^>]*\bsrc\s*=)[^>]*>/gi,
    (tag) => updateAttributeValue(tag, "src", htmlFile, stats)
  );

  if (updatedHtml !== originalHtml) {
    fs.writeFileSync(htmlFile, updatedHtml, "utf8");
    stats.updatedFiles += 1;
  }
}

function main() {
  const htmlFiles = walkHtmlFiles(projectRoot);
  const stats = {
    updatedFiles: 0,
    updatedAssets: 0,
    skippedExternal: 0,
    skippedNonTarget: 0,
    missingAssets: [],
  };

  for (const htmlFile of htmlFiles) {
    processHtmlFile(htmlFile, stats);
  }

  console.log(`Cache buster selesai.`);
  console.log(`HTML diproses : ${htmlFiles.length}`);
  console.log(`HTML berubah  : ${stats.updatedFiles}`);
  console.log(`Aset diperbarui: ${stats.updatedAssets}`);

  if (stats.missingAssets.length > 0) {
    console.warn(`Aset lokal tidak ditemukan: ${stats.missingAssets.length}`);
    for (const item of stats.missingAssets) {
      console.warn(`- ${item.htmlFile} -> ${item.assetUrl}`);
    }
  }
}

main();
