// VS Code Neovide-like cursor, designed for Custom CSS and JS Loader.
(function () {
    const CONFIG = {
        opacity: 0.88,
        holdMs: 170,
        fadeMs: 180,
        // Keep the overlay above editor text but below command palettes, context menus and hovers.
        // Otherwise the trail can remain visible over those surfaces while it fades out.
        zIndex: 100,
        minWidth: 2,
        // Keep the trail narrower than common editor.cursorWidth values. The narrow shape during
        // movement is part of the Neovide smear effect; increasing this value makes it heavier.
        maxDrawWidth: 4,
        // Full-screen canvas memory grows with the square of the device pixel ratio. This cap
        // limits GPU memory use on very high-DPI displays without affecting ratios up to 2x.
        maxDevicePixelRatio: 2,
        scanIntervalMs: 100,
        // Keep the loop active for at least this long after a wake-up. A capture-phase keydown
        // occurs before VS Code updates the caret DOM; suspending immediately would defer the
        // resulting movement until the next scan and make the animation appear delayed.
        idleGraceMs: 250,

        animationLength: 0.16,
        shortAnimationLength: 0.065,
        shortMoveThreshold: 14,
        shortMoveVerticalThreshold: 0.2,

        rankTrailFactors: [1.05, 0.82, 0.36, 0.08],
        // Let the corner facing the movement direction converge faster than the trailing corners.
        // This shortens its animation length without snapping it directly to the destination.
        useLeadingBoost: true,
        leadingBoostFactor: 0.045,
        leadingBoostThreshold: 0.45,
        resetThreshold: 0.08,
        maxStretchFactor: 56,

        useShadow: false,
        shadowBlurFactor: 0.45,
        fallbackColor: "#ca9ee6"
    };

    const GLOBAL_KEY = "__vscodeNeovideCursorLite";
    const HIDDEN_CLASS = "vscode-neovide-cursor-lite-hidden";

    if (window[GLOBAL_KEY] && window[GLOBAL_KEY].dispose) {
        window[GLOBAL_KEY].dispose();
    }

    let manager = null;
    let startTimer = 0;

    // Register a placeholder immediately. Waiting for DOM readiness would allow a second
    // pre-body injection to create two startup chains and two animation loops.
    window[GLOBAL_KEY] = {
        dispose() {
            clearTimeout(startTimer);
            startTimer = 0;
            if (manager) {
                manager.dispose();
                manager = null;
            }
            delete window[GLOBAL_KEY];
        }
    };

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function normalize(vector) {
        const length = Math.hypot(vector.x, vector.y);
        return length ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 };
    }

    function rectChanged(previous, next) {
        if (!previous || !next) return previous !== next;

        return (
            Math.round(next.left) !== Math.round(previous.left) ||
            Math.round(next.top) !== Math.round(previous.top) ||
            Math.round(next.width) !== Math.round(previous.width) ||
            Math.round(next.height) !== Math.round(previous.height)
        );
    }

    function isUsableColor(value) {
        if (!value) return false;
        const color = value.trim();
        if (!color || color === "transparent") return false;
        if (/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(color)) return false;
        if (/rgba?\([^)]*,\s*0\s*\)$/i.test(color)) return false;
        return true;
    }

    function getThemeCursorColor() {
        const rootColor = getComputedStyle(document.documentElement)
            .getPropertyValue("--vscode-editorCursor-foreground")
            .trim();

        if (isUsableColor(rootColor)) return rootColor;
        return CONFIG.fallbackColor;
    }

    // Accept a previously read style object to avoid duplicate style recalculation. Read the
    // document theme only when all direct colour candidates are unusable.
    function getCursorColor(style) {
        const candidates = [
            style.backgroundColor,
            style.borderLeftColor,
            style.borderColor,
            style.color
        ];

        return candidates.find(isUsableColor) || getThemeCursorColor();
    }

    const CORNER_POINTS = [
        { x: -0.5, y: -0.5 },
        { x: 0.5, y: -0.5 },
        { x: 0.5, y: 0.5 },
        { x: -0.5, y: 0.5 }
    ];

    class DampedSpring {
        constructor(animationLength) {
            this.position = 0;
            this.velocity = 0;
            this.animationLength = animationLength;
        }

        update(dt) {
            if (Math.abs(this.position) < 0.001) {
                this.reset();
                return false;
            }

            // A single integration step becomes unstable when dt approaches animationLength.
            // Subdivide longer frames so 60 Hz and high-refresh-rate displays follow comparable
            // spring curves instead of snapping or diverging.
            const maxStep = this.animationLength * 0.5;
            const steps = Math.min(Math.max(1, Math.ceil(dt / maxStep)), 8);
            const stepDt = dt / steps;
            const omega = 4 / this.animationLength;

            for (let step = 0; step < steps; step += 1) {
                const start = this.position;
                const helper = this.position * omega + this.velocity;
                const decay = Math.exp(-omega * stepDt);

                this.position = (start + helper * stepDt) * decay;
                this.velocity = decay * (-start * omega - helper * stepDt * omega + helper);
            }

            return Math.abs(this.position) >= 0.01;
        }

        reset() {
            this.position = 0;
            this.velocity = 0;
        }
    }

    class Corner {
        constructor(relativePoint) {
            this.relativePoint = relativePoint;
            this.current = { x: 0, y: 0 };
            this.previousDest = { x: -100000, y: -100000 };
            this.springX = new DampedSpring(CONFIG.animationLength);
            this.springY = new DampedSpring(CONFIG.animationLength);
        }

        getDest(center, dimensions) {
            return {
                x: center.x + this.relativePoint.x * dimensions.width,
                y: center.y + this.relativePoint.y * dimensions.height
            };
        }

        setAt(center, dimensions) {
            const dest = this.getDest(center, dimensions);
            this.current = { ...dest };
            this.previousDest = { ...dest };
            this.springX.reset();
            this.springY.reset();
        }

        getAlignment(center, dimensions) {
            const dest = this.getDest(center, dimensions);
            const travel = normalize({
                x: dest.x - this.current.x,
                y: dest.y - this.current.y
            });
            const cornerDirection = normalize(this.relativePoint);
            return travel.x * cornerDirection.x + travel.y * cornerDirection.y;
        }

        jump(center, dimensions, movement, rank) {
            const normalizedMovement = normalize(movement);
            const normalizedCorner = normalize(this.relativePoint);
            const leadingAlignment =
                normalizedMovement.x * normalizedCorner.x +
                normalizedMovement.y * normalizedCorner.y;

            const moveInCells = {
                x: Math.abs(movement.x) / Math.max(dimensions.width, 1),
                y: Math.abs(movement.y) / Math.max(dimensions.height, 1)
            };
            const isShortMove =
                moveInCells.x <= CONFIG.shortMoveThreshold &&
                moveInCells.y <= CONFIG.shortMoveVerticalThreshold;
            const baseLength = isShortMove
                ? CONFIG.shortAnimationLength
                : CONFIG.animationLength;

            let factor = CONFIG.rankTrailFactors[rank] || 1;

            // The leading corner uses a shorter animation length but still follows the complete
            // spring integration. DampedSpring substeps keep the result consistent across rates.
            if (CONFIG.useLeadingBoost && leadingAlignment > CONFIG.leadingBoostThreshold) {
                factor = CONFIG.leadingBoostFactor;
            }

            const length = clamp(baseLength * factor, 0.016, 1.2);
            this.springX.animationLength = length;
            this.springY.animationLength = length;

            if (length > CONFIG.resetThreshold) {
                this.springX.velocity = 0;
                this.springY.velocity = 0;
            }
        }

        update(center, dimensions, dt, immediate) {
            const dest = this.getDest(center, dimensions);

            if (dest.x !== this.previousDest.x || dest.y !== this.previousDest.y) {
                this.springX.position = dest.x - this.current.x;
                this.springY.position = dest.y - this.current.y;
                this.previousDest = { ...dest };
            }

            if (immediate) {
                this.setAt(center, dimensions);
                return false;
            }

            this.springX.update(dt);
            this.springY.update(dt);

            const maxStretch =
                Math.max(dimensions.width, dimensions.height) * CONFIG.maxStretchFactor;
            this.springX.position = clamp(this.springX.position, -maxStretch, maxStretch);
            this.springY.position = clamp(this.springY.position, -maxStretch, maxStretch);

            this.current.x = dest.x - this.springX.position;
            this.current.y = dest.y - this.springY.position;

            return Math.abs(this.springX.position) > 0.35 || Math.abs(this.springY.position) > 0.35;
        }
    }

    function createAnimatedCursor() {
        const corners = CORNER_POINTS.map((point) => new Corner(point));
        let dimensions = { width: 8, height: 18 };
        let center = { x: 0, y: 0 };
        let previousCenter = null;
        let color = CONFIG.fallbackColor;
        let initialized = false;
        let jumped = false;
        let lastTime = performance.now();

        return {
            move(rect, nextColor, sourceCenter) {
                const nextDimensions = {
                    width: clamp(rect.width, CONFIG.minWidth, CONFIG.maxDrawWidth),
                    height: rect.height
                };
                const nextCenter = {
                    x: rect.left + nextDimensions.width / 2,
                    y: rect.top + nextDimensions.height / 2
                };
                const startCenter = initialized ? center : sourceCenter || nextCenter;

                dimensions = nextDimensions;
                color = nextColor || color;

                if (!initialized) {
                    corners.forEach((corner) => corner.setAt(startCenter, dimensions));
                    initialized = true;
                }

                previousCenter = startCenter;
                center = nextCenter;
                jumped = true;
            },

            // Reset the clock after an idle suspension so the first resumed frame does not include
            // the entire idle period in its delta time.
            resetClock() {
                lastTime = performance.now();
            },

            draw(context, immediate) {
                if (!initialized) return false;

                const now = performance.now();
                const dt = Math.min((now - lastTime) / 1000, 1 / 30);
                lastTime = now;

                if (jumped) {
                    const movement = previousCenter
                        ? { x: center.x - previousCenter.x, y: center.y - previousCenter.y }
                        : { x: 0, y: 0 };

                    const ranks = new Array(corners.length);
                    corners
                        .map((corner, index) => ({
                            index,
                            value: corner.getAlignment(center, dimensions)
                        }))
                        .sort((a, b) => a.value - b.value)
                        .forEach((item, rank) => {
                            ranks[item.index] = rank;
                        });

                    corners.forEach((corner, index) => {
                        corner.jump(center, dimensions, movement, ranks[index]);
                    });

                    jumped = false;
                }

                let animating = false;
                corners.forEach((corner) => {
                    if (corner.update(center, dimensions, dt, immediate)) {
                        animating = true;
                    }
                });

                context.save();
                context.globalAlpha = CONFIG.opacity;
                context.fillStyle = color;

                if (CONFIG.useShadow) {
                    context.shadowColor = color;
                    context.shadowBlur =
                        CONFIG.shadowBlurFactor * Math.max(dimensions.width, dimensions.height);
                }

                context.beginPath();
                context.moveTo(corners[0].current.x, corners[0].current.y);
                for (let index = 1; index < corners.length; index += 1) {
                    context.lineTo(corners[index].current.x, corners[index].current.y);
                }
                context.closePath();
                context.fill();
                context.restore();

                return animating;
            }
        };
    }

    class CursorManager {
        constructor() {
            this.cursors = new Map();
            this.lastGlobalCenter = null;
            this.isScrolling = false;
            this.lastAnimationAt = 0;
            this.fadeTimer = 0;
            this.scrollTimer = 0;
            this.fadePending = false;
            this.canvasVisible = false;
            this.animationFrame = 0;
            this.scanTimer = 0;
            this.keepAliveUntil = 0;
            this.devicePixelRatio = 1;
            this.viewportWidth = 0;
            this.viewportHeight = 0;

            this.style = document.createElement("style");
            this.canvas = document.createElement("canvas");
            this.context = this.canvas.getContext("2d");

            this.onResize = this.resize.bind(this);
            this.onScroll = this.markScrolling.bind(this);
            this.onUserInput = this.requestFrame.bind(this);
            this.loop = this.loop.bind(this);
        }

        start() {
            // If the environment cannot provide a 2D context, leave the native caret untouched
            // and avoid installing styles or listeners.
            if (!this.context) return false;

            this.style.textContent = `
                .monaco-editor .cursors-layer .cursor {
                    transition: none !important;
                }

                .monaco-editor .cursors-layer .cursor.${HIDDEN_CLASS} {
                    opacity: 0 !important;
                }
            `;
            document.head.appendChild(this.style);

            this.canvas.style.cssText = `
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: ${CONFIG.zIndex};
                opacity: 0;
                transition: opacity ${CONFIG.fadeMs}ms ease-out;
            `;
            document.body.appendChild(this.canvas);

            this.resize();
            window.addEventListener("resize", this.onResize);
            document.addEventListener("scroll", this.onScroll, {
                capture: true,
                passive: true
            });

            // Wake the suspended animation loop immediately after direct user input. Periodic
            // geometry comparison remains the fallback for movement caused by other sources.
            document.addEventListener("keydown", this.onUserInput, {
                capture: true,
                passive: true
            });
            document.addEventListener("mousedown", this.onUserInput, {
                capture: true,
                passive: true
            });

            this.scan();
            this.scanTimer = window.setInterval(() => this.scan(), CONFIG.scanIntervalMs);
            this.requestFrame();
            return true;
        }

        // Wake the loop after an idle suspension and extend its active window on every input,
        // including when a frame is already scheduled.
        requestFrame() {
            this.keepAliveUntil = performance.now() + CONFIG.idleGraceMs;

            if (this.animationFrame) return;

            this.cursors.forEach((data) => data.instance.resetClock());
            this.animationFrame = requestAnimationFrame(this.loop);
        }

        resize() {
            const maxRatio = Math.max(1, Number(CONFIG.maxDevicePixelRatio) || 1);
            this.devicePixelRatio = clamp(window.devicePixelRatio || 1, 1, maxRatio);
            this.viewportWidth = window.innerWidth;
            this.viewportHeight = window.innerHeight;
            this.canvas.width = Math.ceil(this.viewportWidth * this.devicePixelRatio);
            this.canvas.height = Math.ceil(this.viewportHeight * this.devicePixelRatio);
            this.canvas.style.width = `${this.viewportWidth}px`;
            this.canvas.style.height = `${this.viewportHeight}px`;
            this.context.setTransform(
                this.devicePixelRatio,
                0,
                0,
                this.devicePixelRatio,
                0,
                0
            );
            this.requestFrame();
        }

        markScrolling() {
            this.isScrolling = true;
            clearTimeout(this.scrollTimer);
            this.scrollTimer = setTimeout(() => {
                this.isScrolling = false;
            }, 100);
            this.requestFrame();
        }

        // Read only geometry on each frame. Style-dependent checks run at scan frequency in
        // readCursorStyle to avoid forcing a complete style recalculation every frame.
        readCursorRect(cursor) {
            const rect = cursor.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return null;

            return {
                left: rect.left,
                top: rect.top,
                width: Math.max(rect.width, CONFIG.minWidth),
                height: rect.height
            };
        }

        // This is the only per-caret getComputedStyle read and runs once per scan interval.
        readCursorStyle(cursor) {
            const style = getComputedStyle(cursor);

            return {
                color: getCursorColor(style),
                // VS Code hides inactive carets by transforming them outside the viewport. This
                // string check depends on that implementation detail; failure only draws an extra
                // caret and does not interrupt the script.
                styleVisible:
                    style.display !== "none" &&
                    style.visibility !== "hidden" &&
                    !style.transform.includes("-10000px")
            };
        }

        isRectInViewport(rect) {
            return (
                rect.left > -100 &&
                rect.top > -100 &&
                rect.left < this.viewportWidth + 100 &&
                rect.top < this.viewportHeight + 100
            );
        }

        scan() {
            const liveElements = new Set();
            const elements = document.querySelectorAll(".monaco-editor .cursors-layer .cursor");
            let shouldWake = false;

            elements.forEach((cursor) => {
                liveElements.add(cursor);

                const styleState = this.readCursorStyle(cursor);
                const existing = this.cursors.get(cursor);

                if (existing) {
                    // A caret can become visible without moving. Wake the loop explicitly because
                    // the geometry comparison below would not detect that transition.
                    if (!existing.styleVisible && styleState.styleVisible) {
                        shouldWake = true;
                    }

                    existing.color = styleState.color;
                    existing.styleVisible = styleState.styleVisible;
                    return;
                }

                const rect = this.readCursorRect(cursor);
                if (!rect) return;

                const instance = createAnimatedCursor();
                instance.move(rect, styleState.color, this.lastGlobalCenter);

                this.cursors.set(cursor, {
                    instance,
                    lastRect: rect,
                    color: styleState.color,
                    styleVisible: styleState.styleVisible,
                    active: false
                });
                shouldWake = true;
            });

            this.cursors.forEach((data, cursor) => {
                if (!liveElements.has(cursor) || !cursor.isConnected) {
                    cursor.classList.remove(HIDDEN_CLASS);
                    this.cursors.delete(cursor);
                    return;
                }

                // While rAF is suspended, geometry comparison detects movement caused by
                // extensions or formatting. Avoid the duplicate layout read while rAF is active.
                if (this.animationFrame) return;

                const rect = this.readCursorRect(cursor);
                if (rectChanged(data.lastRect, rect)) {
                    shouldWake = true;
                }
            });

            if (shouldWake) this.requestFrame();
        }

        setCanvasVisible(visible) {
            if (visible) {
                clearTimeout(this.fadeTimer);
                this.fadePending = false;
                this.canvasVisible = true;
                this.canvas.style.transition = "none";
                this.canvas.style.opacity = "1";
                return;
            }

            if (!this.canvasVisible || this.fadePending) return;

            this.fadePending = true;
            this.fadeTimer = setTimeout(() => {
                this.canvas.style.transition = `opacity ${CONFIG.fadeMs}ms ease-out`;
                this.canvas.style.opacity = "0";
                this.canvasVisible = false;
                this.fadePending = false;
            }, CONFIG.holdMs);
        }

        loop() {
            this.context.setTransform(
                this.devicePixelRatio,
                0,
                0,
                this.devicePixelRatio,
                0,
                0
            );
            this.context.clearRect(0, 0, this.viewportWidth, this.viewportHeight);

            let anyAnimating = false;

            this.cursors.forEach((data, cursor) => {
                if (!cursor.isConnected) {
                    cursor.classList.remove(HIDDEN_CLASS);
                    this.cursors.delete(cursor);
                    return;
                }

                const rect = this.readCursorRect(cursor);
                const visible = Boolean(rect) && data.styleVisible && this.isRectInViewport(rect);

                if (!visible) {
                    data.active = false;
                    cursor.classList.remove(HIDDEN_CLASS);
                    return;
                }

                const moved = rectChanged(data.lastRect, rect);

                if (!data.active) {
                    data.instance.move(rect, data.color, this.lastGlobalCenter);
                    data.active = true;
                } else if (moved) {
                    data.instance.move(rect, data.color);
                }

                data.lastRect = rect;

                this.lastGlobalCenter = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2
                };

                if (data.instance.draw(this.context, this.isScrolling)) {
                    anyAnimating = true;
                }
            });

            if (anyAnimating) {
                this.lastAnimationAt = performance.now();
                this.setCanvasVisible(true);
                this.cursors.forEach((data, cursor) => {
                    if (data.active) {
                        cursor.classList.add(HIDDEN_CLASS);
                    }
                });
            } else {
                const recentlyAnimated =
                    performance.now() - this.lastAnimationAt <= CONFIG.holdMs + CONFIG.fadeMs;

                if (recentlyAnimated) {
                    this.setCanvasVisible(false);
                }

                this.cursors.forEach((_, cursor) => {
                    cursor.classList.remove(HIDDEN_CLASS);
                });
            }

            // Suspend the loop while idle. The last canvas frame is transparent and is cleared
            // before the next visible frame, so it cannot reappear as a stale trail.
            if (
                anyAnimating ||
                this.canvasVisible ||
                this.fadePending ||
                performance.now() < this.keepAliveUntil
            ) {
                this.animationFrame = requestAnimationFrame(this.loop);
            } else {
                this.animationFrame = 0;
            }
        }

        dispose() {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = 0;
            clearInterval(this.scanTimer);
            clearTimeout(this.scrollTimer);
            clearTimeout(this.fadeTimer);
            window.removeEventListener("resize", this.onResize);
            document.removeEventListener("scroll", this.onScroll, { capture: true });
            document.removeEventListener("keydown", this.onUserInput, { capture: true });
            document.removeEventListener("mousedown", this.onUserInput, { capture: true });

            this.cursors.forEach((_, cursor) => {
                cursor.classList.remove(HIDDEN_CLASS);
            });

            this.cursors.clear();
            this.canvas.remove();
            this.style.remove();
        }
    }

    function startWhenReady() {
        if (!document.head || !document.body) {
            startTimer = window.setTimeout(startWhenReady, 100);
            return;
        }

        startTimer = 0;
        const nextManager = new CursorManager();
        manager = nextManager.start() ? nextManager : null;
    }

    startWhenReady();
})();
