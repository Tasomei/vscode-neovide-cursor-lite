const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");

function normalizeLineEndings(value) {
    return value.replace(/\r\n?/g, "\n");
}

function readVersion() {
    const version = fs.readFileSync(path.join(ROOT, "VERSION"), "utf8").trim();

    if (!/^\d+\.\d+\.\d+$/.test(version)) {
        throw new Error(`Invalid VERSION value: ${version}`);
    }

    return version;
}

function prepareRelease(outputRoot = path.join(ROOT, "dist")) {
    const version = readVersion();
    const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");

    if (!changelog.includes(`## [${version}]`)) {
        throw new Error(`CHANGELOG.md does not contain a ${version} release entry`);
    }

    const sourcePath = path.join(ROOT, "cursor-trail.js");
    const source = Buffer.from(
        normalizeLineEndings(fs.readFileSync(sourcePath, "utf8")),
        "utf8"
    );
    const outputDirectory = path.resolve(outputRoot, `v${version}`);
    const outputPath = path.join(outputDirectory, "cursor-trail.js");
    const checksumPath = path.join(outputDirectory, "SHA256SUMS.txt");
    const checksum = crypto.createHash("sha256").update(source).digest("hex");

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(outputPath, source);
    fs.writeFileSync(checksumPath, `${checksum}  cursor-trail.js\n`, "ascii");

    const expectedFiles = new Set(["cursor-trail.js", "SHA256SUMS.txt"]);
    const unexpectedFiles = fs
        .readdirSync(outputDirectory)
        .filter((name) => !expectedFiles.has(name));

    if (unexpectedFiles.length > 0) {
        throw new Error(`Unexpected release assets: ${unexpectedFiles.join(", ")}`);
    }

    return {
        version,
        outputDirectory,
        outputPath,
        checksumPath,
        checksum
    };
}

if (require.main === module) {
    const result = prepareRelease();
    const outputPath = path.relative(ROOT, result.outputPath);
    const checksumPath = path.relative(ROOT, result.checksumPath);
    process.stdout.write(
        [
            `Prepared v${result.version} release assets:`,
            outputPath,
            checksumPath,
            `SHA-256: ${result.checksum}`
        ].join("\n") + "\n"
    );
}

module.exports = { normalizeLineEndings, prepareRelease, readVersion };
