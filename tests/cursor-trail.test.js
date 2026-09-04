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
        clearRect() {},
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        closePath() {},
        fill() {}
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
        createElement(tagName) {
            return new FakeElement(tagName);
        },
        querySelectorAll(selector) {
            assert.equal(selector, ".monaco-editor .cursors-layer .cursor");
            return cursor.isConnected ? [cursor] : [];
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
        inject() {
            new vm.Script(SOURCE, { filename: "cursor-trail.js" }).runInContext(context);
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
