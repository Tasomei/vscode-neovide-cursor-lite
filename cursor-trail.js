// VS Code Neovide-like cursor, designed for Custom CSS and JS Loader.
(function () {
    const CONFIG = {
        opacity: 0.88,
        holdMs: 170,
        fadeMs: 180,
        // 需要压在编辑器文本之上，但要低于命令面板 / 右键菜单 / hover 浮层，
        // 否则动画未淡出时拖尾会画到这些浮层上面
        zIndex: 100,
        minWidth: 2,
        // 拖尾绘制宽度的上限，故意小于常见的 editor.cursorWidth。
        // 移动时光标收窄成细长的一条，是 Neovide smear 效果的一部分，不是缺陷。
        // 调大它会让拖尾跟随真实光标宽度，看起来更厚重。
        maxDrawWidth: 4,
        scanIntervalMs: 100,
        // 被唤醒后至少保持运行这么久，再考虑挂起。
        // keydown 在 capture 阶段先于 VS Code 更新光标 DOM，如果唤醒的那一帧
        // 发现"光标没动"就立刻睡下，真正的移动就得等下一次 scan 才被发现，
        // 表现为按键后动画慢半拍。
        idleGraceMs: 250,

        animationLength: 0.16,
        shortAnimationLength: 0.065,
        shortMoveThreshold: 14,
        shortMoveVerticalThreshold: 0.2,

        rankTrailFactors: [1.05, 0.82, 0.36, 0.08],
        // 让朝着移动方向的那个角收敛得更快，拉开和拖尾角的差距。
        // 它只是缩短该角的 animationLength，不做瞬间吸附。
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

    if (window[GLOBAL_KEY] && window[GLOBAL_KEY].dispose) {
        window[GLOBAL_KEY].dispose();
    }

    let manager = null;
    let startTimer = 0;

    // 立刻占位注册。若等 DOM 就绪后再注册，脚本在 body 出现前被注入第二次时，
    // 上面的 dispose 检查会读到 undefined，导致两条启动链和两套 rAF 循环并存。
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

    // 接收已经取好的 style，避免调用方重复触发样式重算。
    // 主题色作为兜底放在 find 之后，只有前面四个候选都不可用时才会去读
    // documentElement 的样式（写在数组字面量里会被无条件求值）。
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

            // dt 接近或超过 animationLength 时单步积分会发散。早期版本在这种情况下
            // 直接把弹簧归零，结果是 60Hz(dt≈0.0167) 瞬间吸附、高刷新率(dt≈0.0069)
            // 走完整弹簧，同一份配置在不同屏幕上手感不同。
            // 这里改成把一帧拆成若干子步积分：高刷新率下 steps 恒为 1，行为不变；
            // 低帧率下拆开推进，收敛曲线向高刷新率看齐，而不是被截断成硬吸附。
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

            // 领先角用更短的 animationLength 收敛得更快，但依然走完整的弹簧积分，
            // 不做瞬间吸附——跨刷新率的一致性交给 DampedSpring 的子步进保证。
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

            // rAF 空闲时会被挂起，恢复时必须重置时间基准，
            // 否则第一帧的 dt 会把整段空闲时间算进去。
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
            this.style.textContent = `
                .monaco-editor .cursors-layer .cursor {
                    transition: none !important;
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

            // 光标移动只可能由用户操作引发，用这两个事件把挂起的 rAF 立刻唤醒，
            // 这样首帧没有轮询延迟。scan 里的位置比对负责兜底非用户触发的移动。
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
        }

        // 循环在空闲时会停下，这里负责重新拉起。
        // 无论循环是否已在运行都要续上活跃窗口，连续输入时窗口才能不断顺延。
        requestFrame() {
            this.keepAliveUntil = performance.now() + CONFIG.idleGraceMs;

            if (this.animationFrame) return;

            this.cursors.forEach((data) => data.instance.resetClock());
            this.animationFrame = requestAnimationFrame(this.loop);
        }

        resize() {
            this.devicePixelRatio = window.devicePixelRatio || 1;
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

        // 每帧只读几何信息。getBoundingClientRect 会触发布局，但不像 getComputedStyle
        // 那样强制整棵样式树重算，样式相关的判断都挪到 readCursorStyle 里按 scan 频率做。
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

        // 唯一读取 getComputedStyle 的地方，每 scanIntervalMs 调用一次。
        readCursorStyle(cursor) {
            const style = getComputedStyle(cursor);

            return {
                color: getCursorColor(style),
                // VS Code 把闲置光标 transform 到视口外来隐藏，这里靠字符串识别。
                // 属于对上游实现细节的依赖：若哪天改了写法，最坏结果是多画一个
                // 本该隐藏的光标，不会抛错，届时调整这里即可。
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
                    // 光标从隐藏恢复可见时，位置往往没变，下面那轮位置比对察觉不到，
                    // 而循环可能已经挂起，所以在这里显式唤醒。
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
                    cursor.style.opacity = "";
                    cursor.style.transition = "";
                    this.cursors.delete(cursor);
                    return;
                }

                // 兜底：rAF 挂起期间若光标被非用户操作移动（扩展、格式化等），
                // 键鼠事件不会触发，靠这里的位置比对唤醒。
                const rect = this.readCursorRect(cursor);
                if (
                    rect &&
                    data.lastRect &&
                    (Math.round(rect.left) !== Math.round(data.lastRect.left) ||
                        Math.round(rect.top) !== Math.round(data.lastRect.top))
                ) {
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
                    this.cursors.delete(cursor);
                    return;
                }

                const rect = this.readCursorRect(cursor);
                const visible = Boolean(rect) && data.styleVisible && this.isRectInViewport(rect);

                if (!visible) {
                    data.active = false;
                    return;
                }

                const moved =
                    !data.lastRect ||
                    Math.round(rect.left) !== Math.round(data.lastRect.left) ||
                    Math.round(rect.top) !== Math.round(data.lastRect.top) ||
                    Math.round(rect.width) !== Math.round(data.lastRect.width) ||
                    Math.round(rect.height) !== Math.round(data.lastRect.height);

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
                        cursor.style.transition = "opacity 0s linear";
                        cursor.style.opacity = "0";
                    }
                });
            } else {
                const recentlyAnimated =
                    performance.now() - this.lastAnimationAt <= CONFIG.holdMs + CONFIG.fadeMs;

                if (recentlyAnimated) {
                    this.setCanvasVisible(false);
                }

                this.cursors.forEach((data, cursor) => {
                    if (data.active) {
                        cursor.style.transition = "";
                        cursor.style.opacity = "";
                    }
                });
            }

            // 空闲时挂起循环。停下后画布保留最后一帧内容，但 opacity 已是 0，
            // 下次唤醒的第一件事就是 clearRect，所以不会有残影。
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
                cursor.style.opacity = "";
                cursor.style.transition = "";
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
        manager = new CursorManager();
        manager.start();
    }

    startWhenReady();
})();
