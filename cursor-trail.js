// 适用于 Custom CSS and JS Loader 的 VS Code Neovide 风格光标动画。
(function () {
    const CONFIG = {
        opacity: 0.88,
        holdMs: 170,
        fadeMs: 180,
        // 画布置于正文上方、菜单及悬浮组件下方，避免拖尾遮挡界面。
        zIndex: 100,
        minWidth: 2,
        // 限制普通线状光标的拖尾宽度，保留细长形变。
        maxDrawWidth: 4,
        // 限制画布像素比，控制随像素比平方增长的显存占用。
        maxDevicePixelRatio: 2,
        scanIntervalMs: 100,
        // 输入后短暂保持渲染，等待 VS Code 更新光标 DOM，避免首帧延迟。
        idleGraceMs: 250,
        // 遵循系统减少动态效果设置，窗口失焦时暂停。
        respectReducedMotion: true,
        pauseWhenWindowBlurred: true,

        animationLength: 0.16,
        shortAnimationLength: 0.065,
        shortMoveThreshold: 14,
        shortMoveVerticalThreshold: 0.2,

        rankTrailFactors: [1.05, 0.82, 0.36, 0.08],
        // 缩短前缘角点的收敛时间，保留连续运动。
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

    // 立即注册实例占位，避免 DOM 就绪前重复注入产生多个渲染循环。
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
            Math.round(next.height) !== Math.round(previous.height) ||
            next.shape !== previous.shape
        );
    }

    function isUsableColor(value) {
        if (!value) return false;
        const color = value.trim();
        if (!color || color === "transparent") return false;
        if (/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i.test(color)) return false;
        // RGB 末项为蓝色分量；仅透明度为零时视为透明。
        if (/^rgba\([^,]+,[^,]+,[^,]+,\s*0(?:\.0+)?\s*\)$/i.test(color)) return false;
        if (/^(?:rgb|hsl)a?\([^)]*\/\s*0(?:\.0+)?%?\s*\)$/i.test(color)) return false;
        return true;
    }

    function getThemeCursorColor() {
        const rootColor = getComputedStyle(document.documentElement)
            .getPropertyValue("--vscode-editorCursor-foreground")
            .trim();

        if (isUsableColor(rootColor)) return rootColor;
        return CONFIG.fallbackColor;
    }

    // 复用已读取的样式，仅在直接颜色均无效时读取主题颜色。
    function getCursorColor(style) {
        const candidates = [
            style.backgroundColor,
            style.borderBottomColor,
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

            // 长帧分步积分，避免数值失稳并保持不同刷新率下的运动一致性。
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

            // 前缘角点采用较短时长，仍执行完整的分步弹簧积分。
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
        let outline = false;
        let transfer = null;
        let lastTime = performance.now();

        function prepareJump(nextCenter, nextDimensions, movement) {
            const ranks = new Array(corners.length);
            corners
                .map((corner, index) => ({
                    index,
                    value: corner.getAlignment(nextCenter, nextDimensions)
                }))
                .sort((a, b) => a.value - b.value)
                .forEach((item, rank) => {
                    ranks[item.index] = rank;
                });

            corners.forEach((corner, index) => {
                corner.jump(nextCenter, nextDimensions, movement, ranks[index]);
            });
        }

        return {
            move(rect, nextColor, immediate = false, sourceVisual = null, waitForTarget = false) {
                const nextDimensions = {
                    width: rect.shape === "line"
                        ? clamp(rect.width, CONFIG.minWidth, CONFIG.maxDrawWidth)
                        : rect.width,
                    height: rect.height
                };
                const nextCenter = {
                    x: rect.left + nextDimensions.width / 2,
                    y: rect.top + nextDimensions.height / 2
                };
                const nextOutline = rect.shape === "block-outline";
                color = nextColor || color;

                if (sourceVisual) {
                    // 跨编辑器复用四角弹簧，连续切换时保留上一帧角点。
                    dimensions = { ...sourceVisual.dimensions };
                    outline = sourceVisual.outline;
                    corners.forEach((corner, index) => {
                        corner.setAt(sourceVisual.center, dimensions);
                        if (sourceVisual.points) {
                            corner.current = { ...sourceVisual.points[index] };
                        }
                    });
                    initialized = true;
                    previousCenter = { ...sourceVisual.center };
                    center = nextCenter;
                    jumped = true;
                    transfer = {
                        endDimensions: nextDimensions,
                        endOutline: nextOutline,
                        shapeChanged: dimensions.width !== nextDimensions.width ||
                            dimensions.height !== nextDimensions.height || outline !== nextOutline,
                        waitFrames: waitForTarget ? 1 : 0,
                        started: false,
                        interrupted: Boolean(sourceVisual.points)
                    };
                    // 从源角点向目标尺寸收敛，避免过渡结束时尺寸突变。
                    dimensions = nextDimensions;
                    outline = nextOutline;
                    return;
                }

                if (transfer && !immediate) {
                    if (center.x === nextCenter.x && center.y === nextCenter.y &&
                        dimensions.width === nextDimensions.width && dimensions.height === nextDimensions.height &&
                        outline === nextOutline) return;
                    // 尚未起跳时保留源位置，避免将目标旧行作为中间起点。
                    if (transfer.started) {
                        previousCenter = {
                            x: corners.reduce((sum, corner) => sum + corner.current.x, 0) / corners.length,
                            y: corners.reduce((sum, corner) => sum + corner.current.y, 0) / corners.length
                        };
                    }
                    transfer.waitFrames = 0;
                    center = nextCenter;
                    dimensions = nextDimensions;
                    outline = nextOutline;
                    transfer.endDimensions = nextDimensions;
                    transfer.endOutline = nextOutline;
                    jumped = true;
                    return;
                }

                transfer = null;
                dimensions = nextDimensions;
                outline = nextOutline;
                const startCenter = initialized && !immediate ? center : nextCenter;

                if (!initialized || immediate) {
                    corners.forEach((corner) => corner.setAt(startCenter, dimensions));
                    initialized = true;
                }

                previousCenter = startCenter;
                center = nextCenter;
                jumped = true;
            },

            isTransferring() {
                return Boolean(transfer);
            },

            getTransferVisual() {
                if (!transfer) return null;
                return {
                    center: {
                        x: corners.reduce((sum, corner) => sum + corner.current.x, 0) / corners.length,
                        y: corners.reduce((sum, corner) => sum + corner.current.y, 0) / corners.length
                    },
                    points: corners.map((corner) => ({ ...corner.current })),
                    dimensions: { ...dimensions },
                    outline
                };
            },

            // 恢复渲染时重置时钟，避免将空闲时长计入首帧。
            resetClock(time = performance.now()) {
                lastTime = time;
            },

            draw(context, immediate) {
                if (!initialized) return false;

                const now = performance.now();
                const dt = Math.min((now - lastTime) / 1000, 1 / 30);
                lastTime = now;

                // 滚动时直接同步目标位置，其余移动使用弹簧积分。
                if (transfer && immediate) {
                    dimensions = { ...transfer.endDimensions };
                    outline = transfer.endOutline;
                }

                const waiting = transfer && transfer.waitFrames > 0 && !immediate;
                if (waiting) transfer.waitFrames -= 1;

                if (jumped && !waiting) {
                    const movement = previousCenter
                        ? { x: center.x - previousCenter.x, y: center.y - previousCenter.y }
                        : { x: 0, y: 0 };
                    prepareJump(center, dimensions, movement);
                    jumped = false;
                }

                let animating = false;
                if (waiting || (transfer && dt === 0 && !immediate)) {
                    // 时间未推进时保留交接帧，避免浮点偏移。
                    animating = true;
                } else {
                    if (transfer) transfer.started = true;
                    corners.forEach((corner) => {
                        if (corner.update(center, dimensions, dt, immediate)) {
                            animating = true;
                        }
                    });
                }
                if (transfer && !animating) {
                    const shapeChanged = dimensions.width !== transfer.endDimensions.width ||
                        dimensions.height !== transfer.endDimensions.height || outline !== transfer.endOutline;
                    dimensions = { ...transfer.endDimensions };
                    outline = transfer.endOutline;
                    if (shapeChanged || transfer.shapeChanged || transfer.interrupted) {
                        corners.forEach((corner) => corner.setAt(center, dimensions));
                    }
                    transfer = null;
                }

                context.save();
                context.globalAlpha = CONFIG.opacity;
                context.fillStyle = color;
                context.strokeStyle = color;
                context.lineWidth = 1;

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
                if (outline) {
                    context.stroke();
                } else {
                    context.fill();
                }
                context.restore();

                return animating;
            }
        };
    }

    class CursorManager {
        constructor() {
            this.cursors = new Map();
            this.focusedEditor = null;
            this.focusedVisual = null;
            this.focusScanPending = false;
            this.pointerFocus = null;
            this.lastFrameAt = performance.now();
            this.paused = true;
            this.disposed = false;
            this.windowFocused = document.hasFocus();
            this.reducedMotion = typeof window.matchMedia === "function"
                ? window.matchMedia("(prefers-reduced-motion: reduce)")
                : null;
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
            this.onUserInput = (event) => {
                if (event?.type === "mousedown") {
                    const editor = event.target?.closest?.(".monaco-editor");
                    this.pointerFocus = event.button === 0 && editor && editor !== this.focusedEditor
                        ? { editor, at: performance.now() } : null;
                }
                this.requestFrame();
            };
            this.onEditorFocus = () => {
                if (this.paused || this.disposed) return;
                this.focusScanPending = true;
                this.requestFrame();
            };
            this.onActivityChange = this.updateActivity.bind(this);
            this.onFocus = () => {
                this.windowFocused = true;
                this.updateActivity();
            };
            this.onBlur = () => {
                this.windowFocused = false;
                this.updateActivity();
            };
            this.loop = this.loop.bind(this);
        }

        start() {
            // 无法创建二维画布时保留原生光标，不注入样式或监听器。
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
            window.addEventListener("focus", this.onFocus);
            window.addEventListener("blur", this.onBlur);
            document.addEventListener("visibilitychange", this.onActivityChange);
            document.addEventListener("focusin", this.onEditorFocus);
            document.addEventListener("focusout", this.onEditorFocus);
            this.reducedMotion?.addEventListener("change", this.onActivityChange);
            document.addEventListener("scroll", this.onScroll, {
                capture: true,
                passive: true
            });

            // 输入事件立即唤醒渲染，定期扫描补充检测其他位置变化。
            document.addEventListener("keydown", this.onUserInput, {
                capture: true,
                passive: true
            });
            document.addEventListener("mousedown", this.onUserInput, {
                capture: true,
                passive: true
            });

            this.updateActivity();
            return true;
        }

        updateActivity() {
            if (this.disposed) return;
            const paused = document.hidden ||
                (CONFIG.pauseWhenWindowBlurred && !this.windowFocused) ||
                (CONFIG.respectReducedMotion && this.reducedMotion?.matches);
            this.style.disabled = Boolean(paused);
            if (Boolean(paused) === this.paused) return;
            this.paused = Boolean(paused);
            if (this.paused) {
                cancelAnimationFrame(this.animationFrame);
                clearInterval(this.scanTimer);
                clearTimeout(this.scrollTimer);
                clearTimeout(this.fadeTimer);
                this.animationFrame = 0;
                this.scanTimer = 0;
                this.scrollTimer = 0;
                this.fadeTimer = 0;
                this.keepAliveUntil = 0;
                this.lastAnimationAt = 0;
                this.isScrolling = false;
                this.fadePending = false;
                this.canvasVisible = false;
                this.canvas.style.transition = "none";
                this.canvas.style.opacity = "0";
                this.context.clearRect(0, 0, this.viewportWidth, this.viewportHeight);
                this.cursors.forEach((_, cursor) => cursor.classList.remove(HIDDEN_CLASS));
                // 暂停时清除旧坐标，恢复后不重播后台移动。
                this.cursors.clear();
                this.focusedEditor = null;
                this.focusedVisual = null;
                this.focusScanPending = false;
                this.pointerFocus = null;
            } else {
                this.resize();
                this.scan();
                this.scanTimer = window.setInterval(() => this.scan(), CONFIG.scanIntervalMs);
                this.requestFrame();
            }
        }

        // 每次输入均延长渲染活跃期，避免提前进入空闲状态。
        requestFrame() {
            if (this.paused || this.disposed) return;
            this.keepAliveUntil = performance.now() + CONFIG.idleGraceMs;

            if (this.animationFrame) return;

            this.lastFrameAt = performance.now();
            this.cursors.forEach((data) => data.instance.resetClock(this.lastFrameAt));
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
            if (this.paused || this.disposed) return;
            this.isScrolling = true;
            clearTimeout(this.scrollTimer);
            this.scrollTimer = setTimeout(() => {
                this.isScrolling = false;
            }, 100);
            this.requestFrame();
        }

        // 逐帧读取几何；样式由扫描更新，减少每帧样式计算。
        readCursorRect(cursor) {
            const rect = cursor.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return null;

            // 根据 Monaco 类名识别光标形状，不读取字符。
            const classes = cursor.closest(".cursors-layer")?.classList;
            let shape = ["block-outline", "block", "underline-thin", "underline", "line-thin"]
                .find((name) => classes?.contains(`cursor-${name}-style`)) || "line";
            // 扩展搜索框使用原生细光标尺寸，不读取搜索文字。
            if (shape === "line" && cursor.closest(".monaco-editor")
                ?.closest(".extensions-viewlet .suggest-input-container")) {
                shape = "line-thin";
            }
            const height = shape === "underline-thin" ? Math.min(rect.height, 1) : rect.height;
            const inset = shape === "block-outline" ? Math.min(0.5, rect.width / 2, height / 2) : 0;

            return {
                left: rect.left + inset,
                top: rect.top + rect.height - height + inset,
                width: rect.width - inset * 2,
                height: height - inset * 2,
                shape
            };
        }

        // 集中读取光标样式，由定期扫描或焦点事件触发。
        readCursorStyle(cursor) {
            const style = getComputedStyle(cursor);

            return {
                color: getCursorColor(style),
                // 排除通过变换移出视口的光标；此判定依赖 VS Code 内部实现。
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

        isEditorFocused(editor) {
            if (!editor) return false;
            // 精简编辑器可能缺少 focused 类，优先使用实际输入焦点。
            const activeEditor = document.activeElement?.closest?.(".monaco-editor");
            if (activeEditor) return activeEditor === editor;
            return Boolean(editor.classList?.contains("focused") || editor
                .closest(".extensions-viewlet .suggest-input-container")
                ?.classList.contains("synthetic-focus"));
        }

        scan() {
            if (this.paused || this.disposed) return;
            const liveElements = new Set();
            const elements = document.querySelectorAll(".monaco-editor .cursors-layer .cursor");
            let shouldWake = false;

            elements.forEach((cursor) => {
                liveElements.add(cursor);

                const styleState = this.readCursorStyle(cursor);
                const existing = this.cursors.get(cursor);
                const editor = cursor.closest(".monaco-editor");
                const editorFocused = this.isEditorFocused(editor);

                if (existing) {
                    // 可见性或颜色变化也需唤醒渲染，不能仅比较坐标。
                    if (existing.styleVisible !== styleState.styleVisible ||
                        existing.color !== styleState.color) {
                        existing.styleDirty = true;
                        shouldWake = true;
                    }
                    if (existing.editorFocused !== editorFocused) {
                        shouldWake = true;
                    }

                    existing.color = styleState.color;
                    existing.styleVisible = styleState.styleVisible;
                    existing.editorFocused = editorFocused;
                    return;
                }

                const rect = this.readCursorRect(cursor);
                if (!rect) return;

                const instance = createAnimatedCursor();
                if (this.animationFrame) instance.resetClock(this.lastFrameAt);
                instance.move(rect, styleState.color);

                this.cursors.set(cursor, {
                    instance,
                    lastRect: rect,
                    color: styleState.color,
                    styleVisible: styleState.styleVisible,
                    editor,
                    editorFocused,
                    styleDirty: false,
                    active: false
                });
                shouldWake = true;
            });

            this.cursors.forEach((data, cursor) => {
                if (!liveElements.has(cursor) || !cursor.isConnected) {
                    cursor.classList.remove(HIDDEN_CLASS);
                    this.cursors.delete(cursor);
                    shouldWake = true;
                    return;
                }

                // 空闲时扫描几何变化，渲染期间避免重复读取布局。
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
            if (this.paused || this.disposed) {
                this.animationFrame = 0;
                return;
            }
            // 焦点变化后在下一帧扫描，避免等待轮询。
            if (this.focusScanPending) {
                this.focusScanPending = false;
                this.scan();
            }
            this.lastFrameAt = performance.now();
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
            let nextFocusedEditor = null;
            let nextFocusedVisual = null;
            let focusTransferUsed = false;

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
                const editor = cursor.closest(".monaco-editor");
                const editorFocused = this.isEditorFocused(editor);
                const transferSource = editorFocused && this.focusedEditor &&
                    editor !== this.focusedEditor && this.focusedVisual && !focusTransferUsed
                    ? this.focusedVisual
                    : null;
                const reset = !data.active || data.editor !== editor ||
                    data.lastRect?.shape !== rect.shape;

                if (transferSource) {
                    // 仅跨编辑器焦点切换继承源位置，新增次要光标独立初始化。
                    // 点击后目标几何尚未更新时等待一帧，避免途经旧行。
                    const waitForTarget = !moved && this.pointerFocus?.editor === editor &&
                        performance.now() - this.pointerFocus.at <= CONFIG.idleGraceMs;
                    data.instance.move(rect, data.color, false, transferSource, waitForTarget);
                    this.pointerFocus = null;
                    data.active = true;
                    focusTransferUsed = true;
                } else if (!editorFocused && data.instance.isTransferring()) {
                    // 取消失焦编辑器的过渡，避免残留拖尾。
                    data.instance.move(rect, data.color, true);
                    data.active = true;
                } else if (reset && !data.instance.isTransferring()) {
                    data.instance.move(rect, data.color, true);
                    data.active = true;
                } else if (moved || data.styleDirty || reset) {
                    data.instance.move(rect, data.color);
                }

                data.lastRect = rect;
                data.editor = editor;
                data.editorFocused = editorFocused;
                data.styleDirty = false;

                if (editorFocused && !nextFocusedEditor) {
                    const width = rect.shape === "line"
                        ? clamp(rect.width, CONFIG.minWidth, CONFIG.maxDrawWidth)
                        : rect.width;
                    nextFocusedEditor = editor;
                    nextFocusedVisual = {
                        center: {
                            x: rect.left + width / 2,
                            y: rect.top + rect.height / 2
                        },
                        dimensions: { width, height: rect.height },
                        outline: rect.shape === "block-outline"
                    };
                }

                if (data.instance.draw(this.context, this.isScrolling)) {
                    anyAnimating = true;
                }
                if (editorFocused && nextFocusedEditor === editor) {
                    // 记录本帧过渡位置，供连续切换接续。
                    nextFocusedVisual = data.instance.getTransferVisual() || nextFocusedVisual;
                }
            });

            if (nextFocusedEditor) {
                this.focusedEditor = nextFocusedEditor;
                this.focusedVisual = nextFocusedVisual;
            }

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

            // 空闲时暂停渲染；下次绘制前清空画布，避免残留拖尾。
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
            this.disposed = true;
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = 0;
            clearInterval(this.scanTimer);
            clearTimeout(this.scrollTimer);
            clearTimeout(this.fadeTimer);
            window.removeEventListener("resize", this.onResize);
            window.removeEventListener("focus", this.onFocus);
            window.removeEventListener("blur", this.onBlur);
            document.removeEventListener("visibilitychange", this.onActivityChange);
            document.removeEventListener("focusin", this.onEditorFocus);
            document.removeEventListener("focusout", this.onEditorFocus);
            this.reducedMotion?.removeEventListener("change", this.onActivityChange);
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
