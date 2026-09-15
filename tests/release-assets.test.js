const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const {
    normalizeLineEndings,
    prepareRelease,
    readVersion,
    validateChangelog,
    validateVersion
} = require("../scripts/prepare-release.js");

test("normalizes release assets to LF line endings", () => {
    assert.equal(normalizeLineEndings("one\r\ntwo\rthree\n"), "one\ntwo\nthree\n");
});

test("accepts only plain semantic release versions", () => {
    assert.equal(validateVersion(" 1.2.3\r\n"), "1.2.3");

    for (const value of ["", "v1.2.3", "1.2", "01.2.3", "1.02.3", "1.2.03", "1.2.3-beta.1"]) {
        assert.throws(() => validateVersion(value), /Invalid VERSION value/);
    }
});

test("requires one changelog entry with a valid release date", () => {
    assert.equal(
        validateChangelog("1.2.3", "## [Unreleased]\r\n\r\n## [1.2.3] - 2026-09-15\r\n"),
        "2026-09-15"
    );

    for (const [changelog, error] of [
        ["## [1.2.3] - Unreleased\n", /must use a YYYY-MM-DD release date/],
        ["## [1.2.2] - 2026-09-15\n", /exactly one 1.2.3 release heading/],
        [
            "## [1.2.3] - 2026-09-15\n## [1.2.3] - 2026-09-16\n",
            /exactly one 1.2.3 release heading/
        ],
        ["## [1.2.3] - 2026-02-30\n", /has an invalid release date/]
    ]) {
        assert.throws(() => validateChangelog("1.2.3", changelog), error);
    }
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

test("rejects unexpected files in the release directory", (context) => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-lite-release-"));
    const outputDirectory = path.join(temporaryRoot, `v${readVersion()}`);

    context.after(() => {
        const resolvedTemporaryRoot = path.resolve(temporaryRoot);
        const resolvedSystemTemp = path.resolve(os.tmpdir()) + path.sep;

        assert.ok(resolvedTemporaryRoot.startsWith(resolvedSystemTemp));
        fs.rmSync(resolvedTemporaryRoot, { recursive: true, force: true });
    });

    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, "unexpected.txt"), "unexpected\n", "utf8");

    assert.throws(
        () => prepareRelease(temporaryRoot),
        /Unexpected release assets: unexpected\.txt/
    );
    assert.deepEqual(fs.readdirSync(outputDirectory), ["unexpected.txt"]);
});
