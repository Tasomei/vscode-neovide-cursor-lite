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
    const warnings = [];
    let points = [];
    let focused = options.focused ?? true;

    function addListener(store, type, callback) {
        if (!store.has(type)) store.set(type, new Set());
        store.get(type).add(callback);
    }

    function removeListener(store, type, callback) {
        store.get(type)?.delete(callback);
    }

    function emit(store, type, details = {}) {
        for (const callback of [...(store.get(type) || [])]) {
            callback({ type, ...details });
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
            if (selector === ".extensions-viewlet .suggest-input-container") return this.searchContainer;
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
    cursor.editor.classList.add("focused");
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
        activeElement: null,
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
        console: { warn: (...args) => warnings.push(args) }
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
        context2d,
        warnings,
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
        emitDocument(type, details) {
            emit(documentListeners, type, details);
        },
        emitWindow(type) {
            emit(windowListeners, type);
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

function assertStoppedAfterFailure(harness) {
    assert.equal(harness.cursor.classList.contains(HIDDEN_CLASS), false);
    assert.equal(harness.document.body.children.length, 0);
    assert.equal(harness.document.head.children.length, 0);
    assert.equal(harness.pendingAnimationFrames, 0);
    assert.equal(harness.intervalCount, 0);
    assert.equal(harness.timeoutCount, 0);
    assert.equal(harness.mediaListenerCount, 0);
    for (const event of ["keydown", "mousedown", "scroll", "visibilitychange", "focusin", "focusout"]) {
        assert.equal(harness.listenerCount("document", event), 0);
    }
    for (const event of ["resize", "focus", "blur"]) {
        assert.equal(harness.listenerCount("window", event), 0);
    }
    assert.equal(harness.warnings.length, 1);
    assert.equal(harness.warnings[0].length, 1);
    assert.equal(typeof harness.warnings[0][0], "string");
    assert.doesNotMatch(harness.warnings[0][0], /PRIVATE_ERROR_DETAIL/);
}

for (const fault of ["draw", "scan", "geometry", "resize", "suspend"]) {
    test(`restores the native caret and stops all work after a ${fault} failure`, (context) => {
        const h = createHarness();
        context.after(() => h.window[GLOBAL_KEY]?.dispose());
        h.inject();
        h.drainFrames();
        h.cursor.rect.left += 200;
        h.emitDocument("keydown");
        h.runFrame();
        assert.equal(h.cursor.classList.contains(HIDDEN_CLASS), true);
        const fail = () => { throw new Error("PRIVATE_ERROR_DETAIL"); };
        let trigger;
        if (fault === "draw") { h.context2d.fill = fail; trigger = () => h.runFrame(); }
        if (fault === "scan") { h.document.querySelectorAll = fail; trigger = () => h.tickIntervals(); }
        if (fault === "geometry") { h.cursor.getBoundingClientRect = fail; trigger = () => h.runFrame(); }
        if (fault === "resize") { h.context2d.setTransform = fail; trigger = () => h.emitWindow("resize"); }
        if (fault === "suspend") { h.context2d.clearRect = fail; trigger = () => h.setHidden(true); }
        assert.doesNotThrow(trigger);
        assertStoppedAfterFailure(h);
        h.emitDocument("keydown");
        h.tickIntervals();
        h.runFrame();
        assertStoppedAfterFailure(h);
    });
}

test("cleans up a partially initialized instance when startup drawing setup fails", (context) => {
    const h = createHarness();
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    h.context2d.setTransform = () => { throw new Error("PRIVATE_ERROR_DETAIL"); };
    assert.doesNotThrow(() => h.inject());
    assertStoppedAfterFailure(h);
});

test("reinjects successfully after a drawing failure without duplicating resources", () => {
    const h = createHarness();
    h.inject();
    h.drainFrames();
    h.cursor.rect.left += 200;
    h.emitDocument("keydown");
    h.runFrame();
    const originalFill = h.context2d.fill;
    h.context2d.fill = () => { throw new Error("PRIVATE_ERROR_DETAIL"); };
    h.runFrame();
    assertStoppedAfterFailure(h);
    h.context2d.fill = originalFill;
    h.inject();
    assert.equal(h.document.body.children.length, 1);
    assert.equal(h.document.head.children.length, 1);
    assert.equal(h.intervalCount, 1);
    assert.equal(h.listenerCount("document", "keydown"), 1);
    assert.equal(h.listenerCount("document", "focusin"), 1);
    h.drainFrames();
    h.cursor.rect.left += 200;
    h.emitDocument("keydown");
    h.runFrame();
    assert.equal(h.cursor.classList.contains(HIDDEN_CLASS), true);
    h.drainFrames();
    assert.equal(h.cursor.classList.contains(HIDDEN_CLASS), false);
    h.window[GLOBAL_KEY].dispose();
    assertStoppedAfterFailure(h);
});

test("disables hiding styles and completes cleanup even if a caret node rejects class removal", () => {
    const h = createHarness();
    const extra = h.addCursor({ left: 300, top: 60, width: 6, height: 18 });
    h.inject();
    h.drainFrames();
    h.cursor.rect.left += 200;
    h.emitDocument("keydown");
    h.runFrame();
    const style = h.document.head.children[0];
    h.cursor.classList.remove = () => { throw new Error("PRIVATE_ERROR_DETAIL"); };
    assert.doesNotThrow(() => h.window[GLOBAL_KEY].dispose());
    assert.equal(style.disabled, true);
    assert.equal(style.isConnected, false);
    assert.equal(extra.classList.contains(HIDDEN_CLASS), false);
    assert.equal(h.document.body.children.length, 0);
    assert.equal(h.document.head.children.length, 0);
    assert.equal(h.pendingAnimationFrames, 0);
    assert.equal(h.intervalCount, 0);
    assert.equal(h.timeoutCount, 0);
    assert.equal(h.listenerCount("document", "keydown"), 0);
    assert.equal(h.mediaListenerCount, 0);
    assert.equal(h.warnings.length, 1);
    assert.doesNotMatch(JSON.stringify(h.warnings), /PRIVATE_ERROR_DETAIL/);
});

function statusOf(harness) {
    return JSON.parse(JSON.stringify(harness.window[GLOBAL_KEY].getStatus()));
}

test("diagnostics distinguish active, idle and missing carets without waking the runtime", (context) => {
    const h = createHarness();
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    h.inject();
    assert.equal(statusOf(h).state, "active");
    h.drainFrames();
    assert.deepEqual(statusOf(h), {
        schemaVersion: 1, state: "idle", enabled: true, pauseReasons: [], cursorCount: 1,
        frameScheduled: false, scanScheduled: true, failure: null
    });
    h.document.querySelectorAll = () => { throw new Error("diagnostics must not scan"); };
    h.cursor.getBoundingClientRect = () => { throw new Error("diagnostics must not read geometry"); };
    Object.defineProperty(h.document, "hidden", { get() { throw new Error("diagnostics must not read live DOM state"); } });
    for (let i = 0; i < 100; i++) assert.equal(statusOf(h).state, "idle");
    assert.equal(h.pendingAnimationFrames, 0);
    assert.equal(h.intervalCount, 1);
    assert.equal(h.warnings.length, 0);
    h.window[GLOBAL_KEY].dispose();

    const empty = createHarness();
    context.after(() => empty.window[GLOBAL_KEY]?.dispose());
    empty.cursor.isConnected = false;
    empty.inject();
    empty.drainFrames();
    assert.equal(statusOf(empty).state, "no-cursor");
    assert.equal(statusOf(empty).cursorCount, 0);
});

test("diagnostics report overlapping pause reasons and return isolated snapshots", (context) => {
    const h = createHarness({ reducedMotion: true, focused: false, hidden: true });
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    h.inject();
    assert.deepEqual(statusOf(h).pauseReasons, ["hidden", "blur", "reduced-motion"]);
    const snapshot = h.window[GLOBAL_KEY].getStatus();
    snapshot.pauseReasons.length = 0;
    snapshot.state = "active";
    snapshot.enabled = false;
    assert.equal(statusOf(h).state, "paused");
    assert.equal(statusOf(h).enabled, true);
    assert.deepEqual(statusOf(h).pauseReasons, ["hidden", "blur", "reduced-motion"]);
    h.setHidden(false);
    assert.deepEqual(statusOf(h).pauseReasons, ["blur", "reduced-motion"]);
    h.setFocused(true);
    assert.deepEqual(statusOf(h).pauseReasons, ["reduced-motion"]);
    h.setReducedMotion(false);
    h.drainFrames();
    assert.equal(statusOf(h).state, "idle");
});

test("diagnostics distinguish unavailable canvas, initialization errors and runtime errors", (context) => {
    for (const fault of ["canvas", "init", "runtime"]) {
        const h = createHarness({ contextAvailable: fault !== "canvas" });
        context.after(() => h.window[GLOBAL_KEY]?.dispose());
        if (fault === "init") h.context2d.setTransform = () => { throw new Error("PRIVATE_ERROR_DETAIL"); };
        h.inject();
        if (fault === "runtime") {
            h.context2d.fill = () => { throw new Error("PRIVATE_ERROR_DETAIL"); };
            h.runFrame();
        }
        const s = statusOf(h);
        assert.equal(s.state, fault === "canvas" ? "unavailable" : "failed");
        assert.equal(s.failure, { canvas: "canvas-unavailable", init: "initialization-error", runtime: "runtime-error" }[fault]);
        assert.equal(s.frameScheduled, false);
        assert.equal(s.scanScheduled, false);
        assert.doesNotMatch(JSON.stringify(s), /PRIVATE_ERROR_DETAIL/);
        assert.deepEqual(Object.keys(s).sort(), ["schemaVersion", "state", "enabled", "pauseReasons", "cursorCount", "frameScheduled", "scanScheduled", "failure"].sort());
    }
});

test("diagnostics retain the original failure category if cleanup also fails", (context) => {
    const h = createHarness();
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    h.inject();
    h.cursor.classList.remove = () => { throw new Error("PRIVATE_CLEANUP_DETAIL"); };
    h.context2d.fill = () => { throw new Error("PRIVATE_RUNTIME_DETAIL"); };
    h.runFrame();
    assert.equal(statusOf(h).state, "failed");
    assert.equal(statusOf(h).failure, "runtime-error");
    assert.equal(h.warnings.length, 1);
    assert.doesNotMatch(JSON.stringify(statusOf(h)), /PRIVATE_/);
});

test("diagnostics respect configured pause policies", (context) => {
    const h = createHarness({
        reducedMotion: true, focused: false,
        source: SOURCE.replace("respectReducedMotion: true", "respectReducedMotion: false")
            .replace("pauseWhenWindowBlurred: true", "pauseWhenWindowBlurred: false")
    });
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    h.inject();
    h.drainFrames();
    assert.equal(statusOf(h).state, "idle");
    assert.deepEqual(statusOf(h).pauseReasons, []);
    h.setHidden(true);
    assert.equal(statusOf(h).state, "paused");
    assert.deepEqual(statusOf(h).pauseReasons, ["hidden"]);
});

test("diagnostics identify startup and disposal without changing a reinjected instance", (context) => {
    const h = createHarness();
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    const body = h.document.body;
    h.document.body = null;
    h.inject();
    assert.equal(statusOf(h).state, "starting");
    assert.equal(h.timeoutCount, 1);
    const old = h.window[GLOBAL_KEY];
    h.document.body = body;
    h.runFrame(100);
    h.drainFrames();
    assert.equal(statusOf(h).state, "idle");
    h.inject();
    assert.equal(old.getStatus().state, "disposed");
    assert.equal(statusOf(h).state, "active");
    const current = h.window[GLOBAL_KEY];
    current.dispose();
    assert.equal(h.window[GLOBAL_KEY], undefined);
    assert.equal(current.getStatus().state, "disposed");
    assert.equal(current.getStatus().cursorCount, 0);
});

test("manual disable restores the native caret and stops work until explicitly enabled", (context) => {
    const h = createHarness();
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    h.inject();
    h.drainFrames();
    h.cursor.rect.left += 200;
    h.emitDocument("keydown");
    h.runFrame();
    assert.equal(h.cursor.classList.contains(HIDDEN_CLASS), true);
    const api = h.window[GLOBAL_KEY];
    const disabled = api.setEnabled(false);
    assert.equal(disabled.state, "disabled");
    assert.equal(disabled.enabled, false);
    assert.deepEqual(Array.from(disabled.pauseReasons), ["manual"]);
    assert.equal(h.cursor.classList.contains(HIDDEN_CLASS), false);
    assert.equal(h.document.head.children[0].disabled, true);
    assert.equal(h.document.body.children[0].style.opacity, "0");
    assert.equal(h.drawings.length, 0);
    assert.equal(h.pendingAnimationFrames, 0);
    assert.equal(h.intervalCount, 0);
    assert.equal(h.timeoutCount, 0);
    h.cursor.rect.left = 450;
    for (const event of ["keydown", "mousedown", "scroll", "focusin", "focusout"]) h.emitDocument(event);
    h.runFrame();
    assert.equal(h.pendingAnimationFrames, 0);
    assert.equal(h.intervalCount, 0);
    assert.equal(h.timeoutCount, 0);
    assert.equal(api.setEnabled(true).enabled, true);
    h.runFrame();
    assert.equal(bounds(h.drawings[0]).left, 450, "resume must not replay the disabled movement");
    assert.equal(h.cursor.classList.contains(HIDDEN_CLASS), false);
    h.drainFrames();
    h.cursor.rect.left += 80;
    h.emitDocument("keydown");
    h.runFrame();
    assert.equal(h.cursor.classList.contains(HIDDEN_CLASS), true);
});

for (const reason of ["hidden", "blur", "reduced-motion"]) {
    test(`manual enable preserves the ${reason} pause policy`, (context) => {
        const h = createHarness();
        context.after(() => h.window[GLOBAL_KEY]?.dispose());
        h.inject();
        const api = h.window[GLOBAL_KEY];
        api.setEnabled(false);
        const pause = value => {
            if (reason === "hidden") h.setHidden(value);
            if (reason === "blur") h.setFocused(!value);
            if (reason === "reduced-motion") h.setReducedMotion(value);
        };
        pause(true);
        assert.deepEqual(Array.from(api.getStatus().pauseReasons), ["manual", reason]);
        assert.equal(api.setEnabled(true).state, "paused");
        assert.deepEqual(Array.from(api.getStatus().pauseReasons), [reason]);
        assert.equal(h.pendingAnimationFrames, 0);
        assert.equal(h.intervalCount, 0);
        pause(false);
        h.drainFrames();
        assert.equal(api.getStatus().state, "idle");
        assert.equal(h.intervalCount, 1);
    });
}

test("repeated manual switches are idempotent and do not duplicate resources", (context) => {
    const h = createHarness();
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    h.inject();
    const api = h.window[GLOBAL_KEY];
    for (let i = 0; i < 30; i++) {
        api.setEnabled(false);
        api.setEnabled(false);
        assert.equal(h.pendingAnimationFrames, 0);
        assert.equal(h.intervalCount, 0);
        assert.equal(h.timeoutCount, 0);
        api.setEnabled(true);
        api.setEnabled(true);
        assert.equal(h.pendingAnimationFrames, 1);
        assert.equal(h.intervalCount, 1);
        assert.equal(h.document.head.children.length, 1);
        assert.equal(h.document.body.children.length, 1);
        assert.equal(h.listenerCount("document", "keydown"), 1);
        assert.equal(h.mediaListenerCount, 1);
        h.drainFrames();
    }
    assert.equal(h.warnings.length, 0);
});

test("manual switches validate input and cannot revive failed instances", (context) => {
    const h = createHarness();
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    h.inject();
    const api = h.window[GLOBAL_KEY];
    const before = statusOf(h);
    for (const value of [undefined, null, 0, 1, "false", {}, []]) {
        assert.throws(() => api.setEnabled(value), /布尔值/);
        assert.deepEqual(statusOf(h), before);
    }
    h.context2d.fill = () => { throw new Error("PRIVATE_ERROR_DETAIL"); };
    h.runFrame();
    assert.equal(api.setEnabled(false).state, "failed");
    assert.equal(api.setEnabled(true).state, "failed");
    assertStoppedAfterFailure(h);
});

for (const value of [false, true]) {
    test(`failures during manual setEnabled(${value}) fall back safely`, (context) => {
        const h = createHarness();
        context.after(() => h.window[GLOBAL_KEY]?.dispose());
        h.inject();
        h.drainFrames();
        const api = h.window[GLOBAL_KEY];
        if (value) api.setEnabled(false);
        h.context2d[value ? "setTransform" : "clearRect"] = () => { throw new Error("PRIVATE_ERROR_DETAIL"); };
        assert.doesNotThrow(() => api.setEnabled(value));
        assert.equal(api.getStatus().state, "failed");
        assertStoppedAfterFailure(h);
    });
}

test("manual disable before startup persists only until reinjection", (context) => {
    const h = createHarness();
    context.after(() => h.window[GLOBAL_KEY]?.dispose());
    const body = h.document.body;
    h.document.body = null;
    h.inject();
    const old = h.window[GLOBAL_KEY];
    assert.equal(old.setEnabled(false).enabled, false);
    h.document.body = body;
    h.runFrame(100);
    assert.equal(statusOf(h).state, "disabled");
    assert.equal(h.intervalCount, 0);
    assert.equal(h.pendingAnimationFrames, 0);
    h.inject();
    const current = h.window[GLOBAL_KEY];
    assert.equal(current.getStatus().enabled, true);
    assert.equal(old.setEnabled(true).state, "disposed");
    old.dispose();
    assert.equal(h.window[GLOBAL_KEY], current, "old handles must not remove a newer instance");
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
    for (const editor of [harness.document.createElement("div"), harness.cursor.editor]) {
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

test("animates between focused split editors without seeding unrelated carets", () => {
    const harness = createHarness();
    harness.inject();
    harness.drainFrames();

    const secondEditor = harness.document.createElement("div");
    const second = harness.addCursor(
        { left: 500, top: 80, width: 6, height: 18 },
        secondEditor
    );
    harness.tickIntervals();
    harness.drainFrames();

    harness.cursor.editor.classList.remove("focused");
    secondEditor.classList.add("focused");
    harness.tickIntervals();
    harness.runFrame();

    assert.equal(second.classList.contains(HIDDEN_CLASS), true);
    const transitionBounds = bounds(harness.drawings[harness.drawings.length - 1]);
    assert.ok(transitionBounds.left < 100,
        "the focused caret should start from the previous editor");
    assert.ok(transitionBounds.width > 6,
        "the split transition should retain a visible trail");
    const transitionPoints = harness.drawings[harness.drawings.length - 1].points;
    assert.ok(new Set(transitionPoints.map((point) => Math.round(point.x))).size >= 3,
        "the split transition should deform its corners instead of translating a rectangle");

    const extra = harness.addCursor(
        { left: 650, top: 80, width: 6, height: 18 },
        secondEditor
    );
    extra.computedStyle.transform = "none";
    harness.tickIntervals();
    harness.runFrame();
    assert.equal(bounds(harness.drawings[harness.drawings.length - 1]).left, 650);
    // 画布正在绘制其他光标时，次要光标由同一画布接管以避免重影。
    assert.equal(extra.classList.contains(HIDDEN_CLASS), true);
    harness.window[GLOBAL_KEY].dispose();
});

test("preserves a thick cursor and its trail when Vim updates the target shape", () => {
    const harness = createHarness();
    harness.setShape("block");
    harness.cursor.rect.width = 12;
    harness.inject();
    harness.drainFrames();

    const secondEditor = harness.document.createElement("div");
    const second = harness.addCursor(
        { left: 20, top: 300, width: 6, height: 18 },
        secondEditor
    );
    harness.tickIntervals();
    harness.drainFrames();

    harness.cursor.editor.classList.remove("focused");
    secondEditor.classList.add("focused");
    harness.tickIntervals();
    harness.runFrame();
    assert.ok(bounds(harness.drawings[harness.drawings.length - 1]).width >= 10);

    harness.setShape("block", second);
    second.rect.width = 12;
    harness.runFrame();
    assert.equal(second.classList.contains(HIDDEN_CLASS), true);
    assert.ok(bounds(harness.drawings[harness.drawings.length - 1]).width >= 10);
    harness.drainFrames();
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
    harness.cursor.editor = harness.document.createElement("div");
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

for (const hz of [60, 120, 144]) {
    for (const shape of ["line", "block", "block-outline"]) {
        test(`split and same-editor ${shape} jumps have identical spring trajectories at ${hz} Hz`, (context) => {
            const local = createHarness();
            const split = createHarness();
            context.after(() => {
                local.window[GLOBAL_KEY]?.dispose();
                split.window[GLOBAL_KEY]?.dispose();
            });
            for (const h of [local, split]) {
                h.setShape(shape);
                h.cursor.rect.width = 12;
            }
            const target = split.addCursor(
                { left: 500, top: 230, width: 12, height: 18 },
                split.document.createElement("div")
            );
            split.setShape(shape, target);
            local.inject();
            split.inject();
            local.drainFrames();
            split.drainFrames();
            local.cursor.rect.left = target.rect.left;
            local.cursor.rect.top = target.rect.top;
            split.cursor.editor.classList.remove("focused");
            target.editor.classList.add("focused");
            local.emitDocument("mousedown");
            split.emitDocument("mousedown");
            for (let frame = 0; frame < 180; frame++) {
                local.runFrame(1000 / hz);
                split.runFrame(1000 / hz);
                assert.deepEqual(split.drawings[1], local.drawings[0], `frame ${frame}`);
                assert.equal(split.pendingAnimationFrames, local.pendingAnimationFrames);
            }
        });
    }
}

function createSplitHarness(context) {
    const harness = createHarness();
    context.after(() => harness.window[GLOBAL_KEY]?.dispose());
    const carets = [harness.cursor];
    for (const left of [500, 650]) {
        carets.push(harness.addCursor(
            { left, top: 30, width: 6, height: 18 },
            harness.document.createElement("div")
        ));
    }
    harness.inject();
    harness.drainFrames();
    return {
        harness, carets,
        focus(index) {
            carets.forEach((caret) => caret.editor.classList.remove("focused"));
            carets[index].editor.classList.add("focused");
            harness.emitDocument("mousedown");
        }
    };
}

for (const hz of [60, 120, 144]) {
    for (const destination of [0, 2]) {
        test(`retargets an interrupted split transition to editor ${destination} at ${hz} Hz`, (context) => {
            const { harness, carets, focus } = createSplitHarness(context);
            focus(1);
            for (let frame = 0; frame < 3; frame++) harness.runFrame(1000 / hz);
            const before = harness.drawings[1].points.map((point) => ({ ...point }));
            focus(destination);
            harness.runFrame(0);
            assert.deepEqual(bounds(harness.drawings[1]), {
                left: 500, top: 30, width: 4, height: 18
            }, "the previous editor must stop its in-flight trail");
            assert.deepEqual(harness.drawings[destination].points, before,
                "retargeting must preserve the exact visible corners at the handoff");
            harness.drainFrames();
            assert.deepEqual(bounds(harness.drawings[destination]), {
                left: carets[destination].rect.left, top: 30, width: 4, height: 18
            });
            assert.equal(harness.pendingAnimationFrames, 0);
            carets.forEach((caret) => assert.equal(caret.classList.contains(HIDDEN_CLASS), false));
        });
    }
}

test("scrolling interrupts a split transition at the current target geometry", (context) => {
    const { harness, carets, focus } = createSplitHarness(context);
    focus(1);
    harness.runFrame();
    carets[1].rect.top = 120;
    harness.emitDocument("scroll");
    harness.runFrame();
    assert.deepEqual(bounds(harness.drawings[1]), {
        left: 500, top: 120, width: 4, height: 18
    });
    harness.drainFrames();
    assert.equal(harness.timeoutCount, 0);
});

test("a retargeted split transition settles on a delayed block shape", (context) => {
    const { harness, carets, focus } = createSplitHarness(context);
    focus(1);
    harness.runFrame();
    focus(2);
    harness.runFrame();
    harness.setShape("block", carets[2]);
    carets[2].rect.width = 12;
    harness.runFrame();
    harness.drainFrames();
    assert.deepEqual(bounds(harness.drawings[2]), {
        left: 650, top: 30, width: 12, height: 18
    });
});

test("focus changes refresh cached hidden carets on the next frame without a scan tick", (context) => {
    const { harness, carets, focus } = createSplitHarness(context);
    carets[1].computedStyle.visibility = "hidden";
    harness.tickIntervals();
    harness.drainFrames();
    focus(1);
    carets[1].computedStyle.visibility = "visible";
    harness.emitDocument("focusin");
    harness.runFrame();
    assert.equal(carets[1].classList.contains(HIDDEN_CLASS), true);
    assert.equal(harness.drawings.length, 3);
});

test("new extension-search Monaco carets animate in both directions on focus without reading text", (context) => {
    const harness = createHarness();
    context.after(() => harness.window[GLOBAL_KEY]?.dispose());
    harness.inject();
    harness.drainFrames();
    const searchEditor = harness.document.createElement("div");
    searchEditor.searchContainer = harness.document.createElement("div");
    const search = harness.addCursor({ left: 400, top: 10, width: 1, height: 20 }, searchEditor);
    const searchInput = harness.document.createElement("textarea");
    searchInput.editor = searchEditor;
    for (const name of ["value", "textContent", "selectionStart"]) {
        Object.defineProperty(searchInput, name, { get() { throw new Error("must not read search text"); } });
    }
    // 精简编辑器可能只有容器焦点标记，旧代码编辑器的类名还未来得及更新。
    searchEditor.searchContainer.classList.add("synthetic-focus");
    harness.document.activeElement = searchInput;
    harness.emitDocument("focusin");
    assert.equal(harness.pendingAnimationFrames, 1);
    harness.runFrame();
    assert.equal(search.classList.contains(HIDDEN_CLASS), true);
    assert.ok(bounds(harness.drawings[1]).left < 400);
    harness.drainFrames();
    assert.equal(bounds(harness.drawings[1]).width, 1, "the search caret retains its native thin width");
    const editorInput = harness.document.createElement("textarea");
    editorInput.editor = harness.cursor.editor;
    harness.document.activeElement = editorInput;
    searchEditor.searchContainer.classList.remove("synthetic-focus");
    harness.emitDocument("focusin");
    harness.runFrame();
    assert.equal(harness.cursor.classList.contains(HIDDEN_CLASS), true);
    assert.ok(bounds(harness.drawings[0]).width > 4);
    harness.drainFrames();
    harness.window[GLOBAL_KEY].dispose();
    assert.equal(harness.listenerCount("document", "focusin"), 0);
    assert.equal(harness.listenerCount("document", "focusout"), 0);
});

test("block to extension-search transitions converge to the thin shape before settling", (context) => {
    const { harness, carets, focus } = createSplitHarness(context);
    harness.setShape("block");
    harness.cursor.rect.width = 12;
    harness.tickIntervals();
    harness.drainFrames();
    const target = carets[1];
    target.editor.searchContainer = harness.document.createElement("div");
    Object.assign(target.rect, { left: 20, top: 300, width: 1, height: 18 });
    focus(1);
    harness.emitDocument("focusin");
    harness.runFrame();
    const firstWidth = bounds(harness.drawings[1]).width;
    assert.ok(firstWidth > 1 && firstWidth < 12);
    for (let frame = 0; frame < 4; frame++) harness.runFrame();
    assert.ok(bounds(harness.drawings[1]).width < firstWidth,
        "the width must converge during the flight, not snap only at the end");
    harness.drainFrames();
    assert.equal(bounds(harness.drawings[1]).width, 1);
});

test("a colour refresh does not restart a cross-editor spring", (context) => {
    const a = createSplitHarness(context);
    const b = createSplitHarness(context);
    for (const item of [a, b]) {
        item.focus(1);
        for (let frame = 0; frame < 3; frame++) item.harness.runFrame();
    }
    b.carets[1].computedStyle.backgroundColor = "rgb(255, 0, 0)";
    a.harness.tickIntervals();
    b.harness.tickIntervals();
    for (let frame = 0; frame < 30; frame++) {
        a.harness.runFrame();
        b.harness.runFrame();
        assert.deepEqual(a.harness.drawings[1].points, b.harness.drawings[1].points);
    }
    assert.equal(b.harness.drawings[1].color, "rgb(255, 0, 0)");
});

test("focus events remain suspended and are cleaned up after reinjection", () => {
    const harness = createHarness();
    harness.inject();
    harness.inject();
    for (const event of ["focusin", "focusout"]) {
        assert.equal(harness.listenerCount("document", event), 1);
    }
    harness.setHidden(true);
    harness.emitDocument("focusin");
    harness.emitDocument("focusout");
    assert.equal(harness.pendingAnimationFrames, 0);
    assert.equal(harness.intervalCount, 0);
    harness.window[GLOBAL_KEY].dispose();
    for (const event of ["focusin", "focusout"]) {
        assert.equal(harness.listenerCount("document", event), 0);
    }
});

for (const hz of [60, 120, 144]) {
    test(`a cross-editor click waits for a delayed target row instead of flying through the old row at ${hz} Hz`, (context) => {
        const { harness, carets } = createSplitHarness(context);
        const direct = createHarness();
        context.after(() => direct.window[GLOBAL_KEY]?.dispose());
        direct.inject();
        direct.drainFrames();
        const sourcePoints = harness.drawings[0].points.map(p => ({ ...p }));
        harness.emitDocument("mousedown", { target: carets[1], button: 0 });
        carets[0].editor.classList.remove("focused");
        carets[1].editor.classList.add("focused");
        harness.emitDocument("focusin");
        harness.runFrame(1000 / hz);
        assert.deepEqual(harness.drawings[1].points, sourcePoints,
            "the stale destination row must not produce a horizontal intermediate flight");
        direct.runFrame(1000 / hz);
        carets[1].rect.top = 300;
        direct.cursor.rect.left = carets[1].rect.left;
        direct.cursor.rect.top = carets[1].rect.top;
        direct.emitDocument("mousedown");
        for (let frame = 0; frame < 100; frame++) {
            harness.runFrame(1000 / hz);
            direct.runFrame(1000 / hz);
            assert.deepEqual(harness.drawings[1].points, direct.drawings[0].points,
                `frame ${frame} must match a direct jump to the final row`);
        }
    });
}

test("a cross-editor click with an already updated target starts immediately", (context) => {
    const { harness, carets } = createSplitHarness(context);
    const source = harness.drawings[0].points.map(p => ({ ...p }));
    harness.emitDocument("mousedown", { target: carets[1], button: 0 });
    carets[0].editor.classList.remove("focused");
    carets[1].editor.classList.add("focused");
    carets[1].rect.top = 300;
    harness.emitDocument("focusin");
    harness.runFrame();
    assert.notDeepEqual(harness.drawings[1].points, source);
    assert.ok(bounds(harness.drawings[1]).top > 30);
});

test("clicking an unchanged target position waits at most one frame", (context) => {
    const { harness, carets } = createSplitHarness(context);
    const source = harness.drawings[0].points.map(p => ({ ...p }));
    harness.emitDocument("mousedown", { target: carets[1], button: 0 });
    carets[0].editor.classList.remove("focused");
    carets[1].editor.classList.add("focused");
    harness.emitDocument("focusin");
    harness.runFrame();
    assert.deepEqual(harness.drawings[1].points, source);
    harness.runFrame();
    assert.notDeepEqual(harness.drawings[1].points, source);
    harness.drainFrames();
    assert.equal(harness.pendingAnimationFrames, 0);
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
