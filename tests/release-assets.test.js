const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const {
    normalizeLineEndings,
    prepareRelease,
    readVersion
} = require("../scripts/prepare-release.js");

test("normalizes release assets to LF line endings", () => {
    assert.equal(normalizeLineEndings("one\r\ntwo\rthree\n"), "one\ntwo\nthree\n");
});

test("builds reproducible release assets with a matching SHA-256 checksum", (context) => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-lite-release-"));

    context.after(() => {
        const resolvedTemporaryRoot = path.resolve(temporaryRoot);
        const resolvedSystemTemp = path.resolve(os.tmpdir()) + path.sep;

        assert.ok(resolvedTemporaryRoot.startsWith(resolvedSystemTemp));
        fs.rmSync(resolvedTemporaryRoot, { recursive: true, force: true });
    });

    const result = prepareRelease(temporaryRoot);
    const source = Buffer.from(
        normalizeLineEndings(
            fs.readFileSync(path.join(__dirname, "..", "cursor-trail.js"), "utf8")
        ),
        "utf8"
    );
    const output = fs.readFileSync(result.outputPath);
    const expectedChecksum = crypto.createHash("sha256").update(source).digest("hex");

    assert.equal(result.version, readVersion());
    assert.deepEqual(output, source);
    assert.equal(result.checksum, expectedChecksum);
    assert.deepEqual(
        fs.readdirSync(result.outputDirectory).sort(),
        ["SHA256SUMS.txt", "cursor-trail.js"]
    );
    assert.equal(
        fs.readFileSync(result.checksumPath, "ascii"),
        `${expectedChecksum}  cursor-trail.js\n`
    );
});
