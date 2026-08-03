(() => {
  const canvases = [...document.querySelectorAll("[data-motion-seed]")];
  if (!canvases.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const colors = {
    ink: "#173c33",
    line: "rgba(31, 72, 61, .24)",
    ghost: "rgba(60, 94, 83, .12)",
    grid: "rgba(36, 77, 65, .075)",
    pale: "rgba(229, 236, 232, .94)",
    mint: "#bdd1c7",
    contact: "#9b6a5c",
  };

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const ease = (value) => 1 - Math.pow(1 - clamp(value), 3);
  const mix = (a, b, amount) => a + (b - a) * amount;

  canvases.forEach(async (canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let motion;
    try {
      const response = await fetch(canvas.dataset.motionSeed, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Motion data returned ${response.status}`);
      motion = await response.json();
    } catch {
      canvas.closest(".system-motion-lab-v5")?.classList.add("is-motion-unavailable");
      return;
    }

    const lab = canvas.closest(".system-motion-lab-v5");
    const phaseNodes = [...(lab?.querySelectorAll("[data-motion-phase]") || [])];
    const [minX, minY, maxX, maxY] = motion.projectedBounds;
    const frames = motion.frames;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let active = false;
    let animationFrame = 0;
    let startedAt = performance.now();
    let currentPhase = "";

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const setPhase = (phase) => {
      if (phase === currentPhase) return;
      currentPhase = phase;
      lab?.setAttribute("data-motion-state", phase);
      phaseNodes.forEach((node) => node.classList.toggle("is-active", node.dataset.motionPhase === phase));
    };

    const point = (joint) => ({
      x: width * (0.07 + 0.86 * (1 - (joint[0] - minX) / (maxX - minX))),
      y: height * (0.08 + 0.72 * ((joint[1] - minY) / (maxY - minY))),
    });

    const clear = () => {
      ctx.clearRect(0, 0, width, height);
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, "rgba(247, 249, 247, .92)");
      gradient.addColorStop(1, "rgba(224, 233, 228, .92)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = colors.grid;
      const step = Math.max(18, Math.round(width / 26));
      for (let x = step; x < width; x += step) {
        for (let y = step; y < height; y += step) {
          ctx.beginPath();
          ctx.arc(x, y, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const drawGround = (alpha = 1) => {
      const groundY = height * 0.84;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(32, 70, 60, .24)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width * 0.04, groundY);
      ctx.lineTo(width * 0.96, groundY);
      ctx.stroke();
      ctx.restore();
    };

    const drawObstacle = (topRatio, alpha = 1, center = 0.52, span = 0.19) => {
      const groundY = height * 0.84;
      const topY = height * topRatio;
      const x = width * (center - span / 2);
      const w = width * span;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colors.pale;
      ctx.strokeStyle = "rgba(28, 68, 57, .38)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(x, topY, w, groundY - topY, Math.min(7, w * 0.08));
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, .7)";
      ctx.fillRect(x + 1, topY + 1, w - 2, 2);
      ctx.restore();
      return { x, y: topY, width: w };
    };

    const drawSkeleton = (frame, options = {}) => {
      const {
        alpha = 1,
        lineWidth = 2,
        color = colors.ink,
        transform = null,
        joints = true,
      } = options;
      const mapped = {};
      Object.entries(frame.j).forEach(([name, joint]) => {
        const base = point(joint);
        mapped[name] = transform ? transform(base, name) : base;
      });

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      motion.edges.forEach(([from, to]) => {
        const a = mapped[from];
        const b = mapped[to];
        if (!a || !b) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });
      if (joints) {
        ["head", "left_wrist", "right_wrist", "left_ankle", "right_ankle"].forEach((name) => {
          const p = mapped[name];
          if (!p) return;
          ctx.beginPath();
          ctx.arc(p.x, p.y, name === "head" ? lineWidth * 2.1 : lineWidth * 1.2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.restore();
      return mapped;
    };

    const drawTrajectory = (endIndex, alpha = 1) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(37, 79, 67, .22)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      for (let i = 0; i <= endIndex; i += 3) {
        const p = point(frames[i].j.pelvis);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    };

    const drawContact = (mapped, intensity) => {
      const names = ["left_wrist", "right_wrist", "left_foot", "right_foot"];
      names.forEach((name, index) => {
        const p = mapped[name];
        if (!p) return;
        const pulse = 3 + 7 * ((intensity + index * 0.17) % 1);
        ctx.save();
        ctx.strokeStyle = colors.contact;
        ctx.globalAlpha = 0.55 * (1 - ((intensity + index * 0.17) % 1));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });
    };

    const drawFilmMark = (text, rightText) => {
      ctx.save();
      ctx.font = `600 ${Math.max(8, width * 0.018)}px ${getComputedStyle(document.documentElement).getPropertyValue("--mono") || "monospace"}`;
      ctx.fillStyle = "rgba(29, 67, 57, .56)";
      ctx.textBaseline = "top";
      ctx.fillText(text.toUpperCase(), width * 0.045, height * 0.055);
      const metrics = ctx.measureText(rightText.toUpperCase());
      ctx.fillText(rightText.toUpperCase(), width * 0.955 - metrics.width, height * 0.055);
      ctx.restore();
    };

    const drawSeed = (progress, contactProgress = 0) => {
      drawGround();
      drawObstacle(0.59);
      const frameIndex = Math.round(ease(progress) * (frames.length - 1));
      const ghosts = [12, 8, 4];
      ghosts.forEach((offset, index) => {
        const ghostIndex = Math.max(0, frameIndex - offset);
        drawSkeleton(frames[ghostIndex], {
          alpha: 0.035 + index * 0.025,
          lineWidth: 1.1,
          color: colors.ink,
          joints: false,
        });
      });
      drawTrajectory(frameIndex, 0.8);
      const mapped = drawSkeleton(frames[frameIndex], { lineWidth: Math.max(1.7, width * 0.0042) });
      if (contactProgress > 0) drawContact(mapped, contactProgress);
      drawFilmMark(`frame ${String(frames[frameIndex].f).padStart(3, "0")}`, "motion seed");
    };

    const drawFamily = (progress) => {
      drawGround(0.45);
      const family = [
        { height: 45, top: 0.69, frame: 48 },
        { height: 55, top: 0.62, frame: 55 },
        { height: 65, top: 0.55, frame: 62 },
        { height: 75, top: 0.48, frame: 69 },
      ];
      const cellWidth = width * 0.21;
      const source = { x: width * 0.075, y: height * 0.79 };

      family.forEach((item, index) => {
        const reveal = ease(clamp(progress * 4.6 - index * 0.82));
        if (!reveal) return;
        const centerX = width * (0.17 + index * 0.215);
        const obstacle = drawObstacle(item.top, reveal * 0.86, centerX / width, 0.13);
        const frame = frames[item.frame];
        const pelvis = point(frame.j.pelvis);
        const target = { x: centerX, y: height * (item.top - 0.15) };
        const scale = Math.min(0.58, cellWidth / (width * 0.28));
        const transform = (base) => ({
          x: target.x + (base.x - pelvis.x) * scale,
          y: target.y + (base.y - pelvis.y) * scale,
        });

        ctx.save();
        ctx.globalAlpha = reveal * 0.42;
        ctx.strokeStyle = colors.line;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.bezierCurveTo(source.x + width * 0.13, source.y, centerX - width * 0.1, target.y + height * 0.12, centerX, target.y);
        ctx.stroke();
        ctx.restore();

        drawSkeleton(frame, {
          alpha: reveal * (index === 3 ? 0.92 : 0.58),
          lineWidth: index === 3 ? 2 : 1.35,
          transform,
        });

        ctx.save();
        ctx.globalAlpha = reveal;
        ctx.fillStyle = index === 3 ? colors.ink : "rgba(37, 73, 63, .62)";
        ctx.font = `600 ${Math.max(8, width * 0.018)}px ${getComputedStyle(document.documentElement).getPropertyValue("--mono") || "monospace"}`;
        ctx.textAlign = "center";
        ctx.fillText(`${item.height} CM`, obstacle.x + obstacle.width / 2, height * 0.91);
        ctx.restore();
      });

      ctx.save();
      ctx.fillStyle = colors.contact;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      ctx.arc(source.x, source.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawFilmMark("one seed", "terrain-paired family");
    };

    const draw = (time) => {
      if (!width || !height) resize();
      clear();
      const cycle = reducedMotion.matches ? 8_900 : (time - startedAt) % 11_800;

      if (cycle < 4_100) {
        setPhase("seed");
        drawSeed(cycle / 4_100);
      } else if (cycle < 6_300) {
        setPhase("ground");
        const local = (cycle - 4_100) / 2_200;
        drawSeed(0.27 + Math.sin(local * Math.PI) * 0.012, local * 2.2);
      } else {
        setPhase("grow");
        drawFamily((cycle - 6_300) / 5_500);
      }

      if (active && !reducedMotion.matches) animationFrame = requestAnimationFrame(draw);
    };

    const observer = new IntersectionObserver((entries) => {
      active = entries[0]?.isIntersecting ?? false;
      if (active) {
        startedAt = performance.now() - ((performance.now() - startedAt) % 11_800);
        cancelAnimationFrame(animationFrame);
        animationFrame = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(animationFrame);
      }
    }, { rootMargin: "160px 0px" });

    const resizeObserver = new ResizeObserver(() => {
      resize();
      if (!active || reducedMotion.matches) draw(performance.now());
    });

    resizeObserver.observe(canvas);
    observer.observe(canvas);
    reducedMotion.addEventListener?.("change", () => draw(performance.now()));
    resize();
    draw(performance.now());
  });
})();
