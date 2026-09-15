const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");

function normalizeLineEndings(value) {
    return value.replace(/\r\n?/g, "\n");
}

function validateVersion(value) {
    const version = value.trim();

    if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version)) {
        throw new Error(`Invalid VERSION value: ${version}`);
    }

    return version;
}

function readVersion() {
    return validateVersion(fs.readFileSync(path.join(ROOT, "VERSION"), "utf8"));
}

function validateChangelog(version, changelog) {
    const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const headingPattern = new RegExp(
        `^## \\[${escapedVersion}\\](?: - ([^\\r\\n]+))?\\r?$`,
        "gm"
    );
    const entries = [...changelog.matchAll(headingPattern)];

    if (entries.length !== 1) {
        throw new Error(
            `CHANGELOG.md must contain exactly one ${version} release heading`
        );
    }

    const releaseDate = entries[0][1] || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
        throw new Error(
            `CHANGELOG.md entry for ${version} must use a YYYY-MM-DD release date`
        );
    }

    const parsedDate = new Date(`${releaseDate}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) ||
        parsedDate.toISOString().slice(0, 10) !== releaseDate) {
        throw new Error(`CHANGELOG.md entry for ${version} has an invalid release date`);
    }

    return releaseDate;
}

function prepareRelease(outputRoot = path.join(ROOT, "dist")) {
    const version = readVersion();
    const changelog = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");
    validateChangelog(version, changelog);

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
    const expectedFiles = new Set(["cursor-trail.js", "SHA256SUMS.txt"]);
    const unexpectedFiles = fs
        .readdirSync(outputDirectory)
        .filter((name) => !expectedFiles.has(name));

    if (unexpectedFiles.length > 0) {
        throw new Error(`Unexpected release assets: ${unexpectedFiles.join(", ")}`);
    }

    fs.writeFileSync(outputPath, source);
    fs.writeFileSync(checksumPath, `${checksum}  cursor-trail.js\n`, "ascii");

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

module.exports = {
    normalizeLineEndings,
    prepareRelease,
    readVersion,
    validateChangelog,
    validateVersion
};
