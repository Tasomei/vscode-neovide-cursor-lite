const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE = fs.readFileSync(path.join(__dirname, "..", "cursor-trail.js"), "utf8");
const GLOBAL_KEY = "__vscodeNeovideCursorLite";
const HIDDEN_CLASS = "vscode-neovide-cursor-lite-hidden";

class FakeClassList {
    constructor() {
        this.values = new Set();
    }

    add(value) {
        this.values.add(value);
    }

    remove(value) {
        this.values.delete(value);
    }

    contains(value) {
        return this.values.has(value);
    }
}

function createHarness(options = {}) {
    let now = 0;
    let nextId = 1;
    const animationFrames = new Map();
    const timeouts = new Map();
    const intervals = new Map();
    const documentListeners = new Map();
    const windowListeners = new Map();
    const mediaListeners = new Map();
    const drawings = [];
    let points = [];
    let focused = options.focused ?? true;

    function addListener(store, type, callback) {
        if (!store.has(type)) store.set(type, new Set());
        store.get(type).add(callback);
    }

    function removeListener(store, type, callback) {
        store.get(type)?.delete(callback);
    }

    function emit(store, type) {
        for (const callback of [...(store.get(type) || [])]) {
            callback({ type });
        }
    }

    function requestAnimationFrame(callback) {
        const id = nextId;
        nextId += 1;
        animationFrames.set(id, callback);
        return id;
    }

    function cancelAnimationFrame(id) {
        animationFrames.delete(id);
    }

    function setTimeoutFake(callback, delay = 0) {
        const id = nextId;
        nextId += 1;
        timeouts.set(id, { callback, at: now + delay });
        return id;
    }

    function clearTimeoutFake(id) {
        timeouts.delete(id);
    }

    function setIntervalFake(callback, delay = 0) {
        const id = nextId;
        nextId += 1;
        intervals.set(id, { callback, delay });
        return id;
    }

    function clearIntervalFake(id) {
        intervals.delete(id);
    }

    const context2d = {
        setTransform() {},
        clearRect() { drawings.length = 0; },
        save() {},
        restore() {},
        beginPath() { points = []; },
        moveTo(x, y) { points.push({ x, y }); },
        lineTo(x, y) { points.push({ x, y }); },
        closePath() {},
        fill() { drawings.push({ points: [...points], color: this.fillStyle, outline: false }); },
        stroke() { drawings.push({ points: [...points], color: this.strokeStyle, outline: true }); }
    };

    class FakeElement {
        constructor(tagName) {
            this.tagName = tagName.toUpperCase();
            this.children = [];
            this.parentNode = null;
            this.isConnected = false;
            this.classList = new FakeClassList();
            this.style = { cssText: "" };
            this.textContent = "";
            this.width = 0;
            this.height = 0;
            this.rect = { left: 0, top: 0, width: 0, height: 0 };
        }

        appendChild(child) {
            child.parentNode = this;
            child.isConnected = true;
            this.children.push(child);
            return child;
        }

        remove() {
            if (this.parentNode) {
                const index = this.parentNode.children.indexOf(this);
                if (index >= 0) this.parentNode.children.splice(index, 1);
            }
            this.parentNode = null;
            this.isConnected = false;
        }

        getBoundingClientRect() {
            return { ...this.rect };
        }

        closest(selector) {
            if (selector === ".cursors-layer") return this.layer;
            if (selector === ".monaco-editor") return this.editor;
            throw new Error(`Unexpected selector: ${selector}`);
        }

        getContext(type) {
            if (this.tagName !== "CANVAS" || type !== "2d") return null;
            return options.contextAvailable === false ? null : context2d;
        }
    }

    const cursor = new FakeElement("div");
    cursor.isConnected = true;
    cursor.rect = { left: 20, top: 30, width: 6, height: 18 };
    cursor.style.opacity = options.opacity ?? "0.45";
    cursor.style.transition = options.transition ?? "opacity 2s";
    cursor.computedStyle = {
        backgroundColor: "rgb(202, 158, 230)",
        borderLeftColor: "transparent",
        borderColor: "transparent",
        color: "rgb(202, 158, 230)",
        display: "block",
        visibility: "visible",
        transform: "none"
    };
    cursor.layer = new FakeElement("div");
    cursor.layer.classList.add("cursor-line-style");
    cursor.editor = new FakeElement("div");
    const cursors = [cursor];
    const mediaQuery = {
        matches: options.reducedMotion ?? false,
        addEventListener(type, callback) { addListener(mediaListeners, type, callback); },
        removeEventListener(type, callback) { removeListener(mediaListeners, type, callback); }
    };

    const head = new FakeElement("head");
    const body = new FakeElement("body");
    const documentElement = new FakeElement("html");
    head.isConnected = true;
    body.isConnected = true;
    documentElement.isConnected = true;

    const document = {
        head,
        body,
        documentElement,
        hidden: options.hidden ?? false,
        hasFocus() { return focused; },
        createElement(tagName) {
            return new FakeElement(tagName);
        },
        querySelectorAll(selector) {
            assert.equal(selector, ".monaco-editor .cursors-layer .cursor");
            return cursors.filter((item) => item.isConnected);
        },
        addEventListener(type, callback) {
            addListener(documentListeners, type, callback);
        },
        removeEventListener(type, callback) {
            removeListener(documentListeners, type, callback);
        }
    };

    const window = {
        innerWidth: options.width ?? 800,
        innerHeight: options.height ?? 600,
        devicePixelRatio: options.devicePixelRatio ?? 1,
        matchMedia(query) {
            assert.equal(query, "(prefers-reduced-motion: reduce)");
            return mediaQuery;
        },
        addEventListener(type, callback) {
            addListener(windowListeners, type, callback);
        },
        removeEventListener(type, callback) {
            removeListener(windowListeners, type, callback);
        },
        setTimeout: setTimeoutFake,
        clearTimeout: clearTimeoutFake,
        setInterval: setIntervalFake,
        clearInterval: clearIntervalFake,
        requestAnimationFrame,
        cancelAnimationFrame
    };

    function getComputedStyle(element) {
        if (element === documentElement) {
            return {
                getPropertyValue(name) {
                    return name === "--vscode-editorCursor-foreground" ? "#ca9ee6" : "";
                }
            };
        }
        return element.computedStyle;
    }

    const sandbox = {
        window,
        document,
        getComputedStyle,
        performance: { now: () => now },
        requestAnimationFrame,
        cancelAnimationFrame,
        setTimeout: setTimeoutFake,
        clearTimeout: clearTimeoutFake,
        setInterval: setIntervalFake,
        clearInterval: clearIntervalFake,
        console
    };
    const context = vm.createContext(sandbox);

    function runDueTimeouts() {
        let ranTimeout = true;
        while (ranTimeout) {
            ranTimeout = false;
            for (const [id, timer] of [...timeouts]) {
                if (timer.at <= now) {
                    timeouts.delete(id);
                    timer.callback();
                    ranTimeout = true;
                }
            }
        }
    }

    function runFrame(delta = 1000 / 60) {
        now += delta;
        runDueTimeouts();
        const callbacks = [...animationFrames.values()];
        animationFrames.clear();
        for (const callback of callbacks) callback(now);
        runDueTimeouts();
    }

    function drainFrames(limit = 600) {
        let count = 0;
        while (animationFrames.size > 0 && count < limit) {
            runFrame();
            count += 1;
        }
        assert.ok(count < limit, "the animation loop should suspend after becoming idle");
    }

    return {
        window,
        document,
        cursor,
        drawings,
        setShape(shape, target = cursor) {
            target.layer.classList.values.clear();
            target.layer.classList.add(`cursor-${shape}-style`);
        },
        addCursor(rect, editor = cursor.editor) {
            const next = new FakeElement("div");
            next.isConnected = true;
            next.rect = { ...rect };
            next.computedStyle = { ...cursor.computedStyle };
            next.layer = new FakeElement("div");
            next.layer.classList.add("cursor-line-style");
            next.editor = editor;
            cursors.push(next);
            return next;
        },
        setFocused(value) {
            focused = value;
            emit(windowListeners, value ? "focus" : "blur");
        },
        setHidden(value) {
            document.hidden = value;
            emit(documentListeners, "visibilitychange");
        },
        setReducedMotion(value) {
            mediaQuery.matches = value;
            emit(mediaListeners, "change");
        },
        inject() {
            new vm.Script(options.source || SOURCE, { filename: "cursor-trail.js" }).runInContext(context);
        },
        runFrame,
        drainFrames,
        emitDocument(type) {
            emit(documentListeners, type);
        },
        tickIntervals() {
            for (const timer of [...intervals.values()]) timer.callback();
        },
        listenerCount(store, type) {
            const listeners = store === "window" ? windowListeners : documentListeners;
            return listeners.get(type)?.size || 0;
        },
        get pendingAnimationFrames() {
            return animationFrames.size;
        },
        get intervalCount() {
            return intervals.size;
        },
        get mediaListenerCount() {
            return mediaListeners.get("change")?.size || 0;
        },
        get timeoutCount() {
            return timeouts.size;
        }
    };
}

test("caps the device pixel ratio without overwriting existing inline caret styles", () => {
    const harness = createHarness({ devicePixelRatio: 3 });
    const originalOpacity = harness.cursor.style.opacity;
    const originalTransition = harness.cursor.style.transition;

    harness.inject();

    const canvas = harness.document.body.children.find((item) => item.tagName === "CANVAS");
    assert.ok(canvas);
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 1200);
    assert.equal(harness.listenerCount("document", "keydown"), 1);
    assert.equal(harness.listenerCount("document", "mousedown"), 1);

    harness.drainFrames();
    harness.cursor.rect.left += 60;
    harness.emitDocument("keydown");
    harness.runFrame();

    assert.equal(harness.cursor.classList.contains(HIDDEN_CLASS), true);
    assert.equal(harness.cursor.style.opacity, originalOpacity);
    assert.equal(harness.cursor.style.transition, originalTransition);

    harness.drainFrames();
    assert.equal(harness.cursor.classList.contains(HIDDEN_CLASS), false);

    harness.window[GLOBAL_KEY].dispose();
    assert.equal(harness.cursor.style.opacity, originalOpacity);
    assert.equal(harness.cursor.style.transition, originalTransition);
    assert.equal(harness.document.body.children.length, 0);
    assert.equal(harness.document.head.children.length, 0);
    assert.equal(harness.listenerCount("document", "keydown"), 0);
    assert.equal(harness.listenerCount("document", "mousedown"), 0);
    assert.equal(harness.listenerCount("document", "scroll"), 0);
    assert.equal(harness.listenerCount("window", "resize"), 0);
    assert.equal(harness.intervalCount, 0);
    assert.equal(harness.pendingAnimationFrames, 0);
});

test("cleans up the previous instance before reinjection", () => {
    const harness = createHarness();

    harness.inject();
    const firstInstance = harness.window[GLOBAL_KEY];
    harness.inject();

    assert.notEqual(harness.window[GLOBAL_KEY], firstInstance);
    assert.equal(
        harness.document.body.children.filter((item) => item.tagName === "CANVAS").length,
        1
    );
    assert.equal(
        harness.document.head.children.filter((item) => item.tagName === "STYLE").length,
        1
    );
    assert.equal(harness.listenerCount("document", "keydown"), 1);
    assert.equal(harness.listenerCount("document", "mousedown"), 1);
    assert.equal(harness.listenerCount("document", "scroll"), 1);
    assert.equal(harness.listenerCount("window", "resize"), 1);
    assert.equal(harness.intervalCount, 1);

    harness.window[GLOBAL_KEY].dispose();
});

test("wakes the suspended loop when only the caret dimensions change", () => {
    const harness = createHarness();

    harness.inject();
    harness.drainFrames();
    assert.equal(harness.pendingAnimationFrames, 0);

    harness.cursor.rect.width += 4;
    harness.tickIntervals();

    assert.equal(harness.pendingAnimationFrames, 1);
    harness.window[GLOBAL_KEY].dispose();
});

test("preserves the native caret when a 2D context is unavailable", () => {
    const harness = createHarness({ contextAvailable: false });

    assert.doesNotThrow(() => harness.inject());
    assert.equal(harness.document.body.children.length, 0);
    assert.equal(harness.document.head.children.length, 0);
    assert.equal(harness.listenerCount("document", "keydown"), 0);
    assert.equal(harness.listenerCount("window", "resize"), 0);
    assert.equal(harness.intervalCount, 0);
    assert.equal(harness.pendingAnimationFrames, 0);

    harness.window[GLOBAL_KEY].dispose();
    assert.equal(harness.window[GLOBAL_KEY], undefined);
});

test("uses every public configuration option in the runtime", () => {
    const configBlock = SOURCE.match(/const CONFIG = \{([\s\S]*?)\n    \};/);
    assert.ok(configBlock, "the CONFIG block should be present");

    const definedKeys = [...configBlock[1].matchAll(/^\s{8}([A-Za-z][A-Za-z0-9]*):/gm)]
        .map((match) => match[1])
        .sort();
    const referencedKeys = [...SOURCE.matchAll(/CONFIG\.([A-Za-z][A-Za-z0-9]*)/g)]
        .map((match) => match[1])
        .filter((value, index, values) => values.indexOf(value) === index)
        .sort();

    assert.deepEqual(referencedKeys, definedKeys);
});

test("contains no network, storage or dynamic-execution entry points", () => {
    const forbiddenPatterns = [
        /\bfetch\s*\(/,
        /\bXMLHttpRequest\b/,
        /\bWebSocket\b/,
        /\bEventSource\b/,
        /\bsendBeacon\s*\(/,
        /\beval\s*\(/,
        /\bnew\s+Function\b/,
        /\brequire\s*\(/,
        /\bdocument\.cookie\b/,
        /\blocalStorage\b/,
        /\bsessionStorage\b/,
        /\bnavigator\.clipboard\b/
    ];

    for (const pattern of forbiddenPatterns) {
        assert.doesNotMatch(SOURCE, pattern);
    }
});

function bounds(drawing) {
    const xs = drawing.points.map((point) => point.x);
    const ys = drawing.points.map((point) => point.y);
    return {
        left: Math.min(...xs), top: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys)
    };
}

for (const [shape, width, height, expectedWidth, expectedHeight, top] of [
    ["line", 6, 18, 4, 18, 30],
    ["line-thin", 1, 18, 1, 18, 30],
    ["block", 10, 18, 10, 18, 30],
    ["underline", 10, 2, 10, 2, 30],
    ["underline-thin", 10, 2, 10, 1, 31]
]) {
    test(`renders the native ${shape} geometry`, () => {
        const harness = createHarness();
        harness.setShape(shape);
        Object.assign(harness.cursor.rect, { width, height });
        harness.inject();
        harness.runFrame();
        assert.deepEqual(bounds(harness.drawings[0]), {
            left: 20, top, width: expectedWidth, height: expectedHeight
        });
        harness.window[GLOBAL_KEY].dispose();
    });
}

test("draws block-outline as an outline instead of a solid block", () => {
    const harness = createHarness();
    harness.setShape("block-outline");
    harness.cursor.rect.width = 10;
    harness.inject();
    harness.runFrame();
    assert.equal(harness.drawings[0].outline, true);
    harness.window[GLOBAL_KEY].dispose();
});

test("switches Vim-style shapes at the same position without waiting for a scan", () => {
    const harness = createHarness();
    harness.inject();
    harness.drainFrames();
    harness.setShape("block");
    harness.emitDocument("keydown");
    harness.runFrame();
    assert.equal(bounds(harness.drawings[0]).width, 6);
    harness.setShape("line");
    harness.runFrame();
    assert.equal(bounds(harness.drawings[0]).width, 4);
    harness.window[GLOBAL_KEY].dispose();
});

for (const mode of ["blur", "hidden", "reducedMotion"]) {
    test(`stops all animation work on ${mode} and resumes at the current caret`, () => {
        const harness = createHarness();
        const setPaused = (paused) => {
            if (mode === "blur") harness.setFocused(!paused);
            if (mode === "hidden") harness.setHidden(paused);
            if (mode === "reducedMotion") harness.setReducedMotion(paused);
        };
        harness.inject();
        harness.drainFrames();
        harness.cursor.rect.left += 80;
        harness.emitDocument("keydown");
        harness.runFrame();
        assert.equal(harness.cursor.classList.contains(HIDDEN_CLASS), true);
        setPaused(true);
        assert.equal(harness.pendingAnimationFrames, 0);
        assert.equal(harness.intervalCount, 0);
        assert.equal(harness.timeoutCount, 0);
        assert.equal(harness.cursor.classList.contains(HIDDEN_CLASS), false);
        assert.equal(harness.drawings.length, 0);
        harness.emitDocument("keydown");
        harness.emitDocument("scroll");
        assert.equal(harness.pendingAnimationFrames, 0);
        assert.equal(harness.timeoutCount, 0);
        harness.cursor.rect.left = 400;
        setPaused(false);
        harness.runFrame();
        assert.equal(bounds(harness.drawings[0]).left, 400);
        assert.equal(harness.cursor.classList.contains(HIDDEN_CLASS), false);
        assert.equal(harness.intervalCount, 1);
        harness.drainFrames();
        harness.cursor.rect.left += 80;
        harness.emitDocument("keydown");
        harness.runFrame();
        assert.equal(harness.cursor.classList.contains(HIDDEN_CLASS), true);
        harness.window[GLOBAL_KEY].dispose();
        assert.equal(harness.mediaListenerCount, 0);
        for (const event of ["blur", "focus", "resize"]) {
            assert.equal(harness.listenerCount("window", event), 0);
        }
        assert.equal(harness.listenerCount("document", "visibilitychange"), 0);
    });
}

test("starts suspended when reduced motion is enabled and respects overlapping pause reasons", () => {
    const harness = createHarness({ reducedMotion: true });
    harness.inject();
    assert.equal(harness.pendingAnimationFrames, 0);
    assert.equal(harness.intervalCount, 0);
    harness.setHidden(true);
    harness.setReducedMotion(false);
    assert.equal(harness.intervalCount, 0);
    harness.setFocused(false);
    harness.setHidden(false);
    assert.equal(harness.intervalCount, 0);
    harness.setFocused(true);
    assert.equal(harness.intervalCount, 1);
    harness.inject();
    assert.equal(harness.mediaListenerCount, 1);
    assert.equal(harness.listenerCount("window", "blur"), 1);
    harness.window[GLOBAL_KEY].dispose();
    harness.setReducedMotion(true);
    harness.setReducedMotion(false);
    assert.equal(harness.pendingAnimationFrames, 0);
    assert.equal(harness.intervalCount, 0);
});

test("isolates new split/diff carets, multicursor additions and removed carets", () => {
    const harness = createHarness();
    harness.inject();
    harness.drainFrames();
    for (const editor of [{}, harness.cursor.editor]) {
        const next = harness.addCursor({ left: 500, top: 80, width: 6, height: 18 }, editor);
        harness.tickIntervals();
        harness.runFrame();
        assert.equal(bounds(harness.drawings[1]).left, 500);
        assert.equal(next.classList.contains(HIDDEN_CLASS), false);
        next.rect.left += 60;
        harness.emitDocument("keydown");
        harness.runFrame();
        assert.equal(next.classList.contains(HIDDEN_CLASS), true);
        next.isConnected = false;
        harness.runFrame();
        assert.equal(next.classList.contains(HIDDEN_CLASS), false);
        assert.equal(harness.drawings.length, 1);
        harness.drainFrames();
    }
    harness.window[GLOBAL_KEY].dispose();
});

test("resynchronizes a hidden or reparented editor caret without a cross-editor flight", () => {
    const harness = createHarness();
    harness.inject();
    harness.drainFrames();
    harness.cursor.computedStyle.visibility = "hidden";
    harness.tickIntervals();
    harness.runFrame();
    assert.equal(harness.drawings.length, 0);
    harness.cursor.rect.left = 450;
    harness.cursor.computedStyle.visibility = "visible";
    harness.tickIntervals();
    harness.runFrame();
    assert.equal(bounds(harness.drawings[0]).left, 450);
    harness.cursor.editor = {};
    harness.cursor.rect.left = 100;
    harness.runFrame();
    assert.equal(bounds(harness.drawings[0]).left, 100);
    harness.window[GLOBAL_KEY].dispose();
});

test("updates a stationary caret colour on the next style scan", () => {
    const harness = createHarness();
    harness.inject();
    harness.drainFrames();
    harness.cursor.computedStyle.backgroundColor = "rgb(255, 0, 0)";
    harness.tickIntervals();
    harness.runFrame();
    assert.equal(harness.drawings[0].color, "rgb(255, 0, 0)");
    harness.window[GLOBAL_KEY].dispose();
});

test("allows opting out of reduced motion and blur suspension while still pausing hidden pages", () => {
    const harness = createHarness({
        reducedMotion: true, focused: false,
        source: SOURCE.replace("respectReducedMotion: true", "respectReducedMotion: false")
            .replace("pauseWhenWindowBlurred: true", "pauseWhenWindowBlurred: false")
    });
    harness.inject();
    assert.equal(harness.intervalCount, 1);
    harness.setHidden(true);
    assert.equal(harness.intervalCount, 0);
    harness.setHidden(false);
    assert.equal(harness.intervalCount, 1);
    harness.window[GLOBAL_KEY].dispose();
});

test("rejects transparent alpha without discarding an opaque RGB zero component", () => {
    const harness = createHarness();
    harness.cursor.computedStyle.backgroundColor = "rgba(255, 0, 0, 0)";
    harness.cursor.computedStyle.borderBottomColor = "rgb(255 0 0 / 0)";
    harness.cursor.computedStyle.borderLeftColor = "rgb(0, 255, 0)";
    harness.inject();
    harness.runFrame();
    assert.equal(harness.drawings[0].color, "rgb(0, 255, 0)");
    harness.window[GLOBAL_KEY].dispose();
});
