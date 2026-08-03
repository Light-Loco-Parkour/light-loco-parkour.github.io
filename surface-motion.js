(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const revealTargets = Array.from(
    document.querySelectorAll(
      ".data-figure, .equation-note, .range-readout, .runtime-facts, .motion-space-frame",
    ),
  );
  const sequences = Array.from(
    document.querySelectorAll("[data-visual-sequence]"),
  );

  root.classList.add("has-surface-motion");

  if (reducedMotion.matches || typeof IntersectionObserver !== "function") {
    revealTargets.forEach((target) => target.classList.add("is-revealed"));
    sequences.forEach((target) => target.classList.add("is-sequenced"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, activeObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const target = entry.target;
        if (target.matches("[data-visual-sequence]")) {
          target.classList.add("is-sequenced");
        } else {
          target.classList.add("is-revealed");
        }
        activeObserver.unobserve(target);
      });
    },
    { rootMargin: "0px 0px -12%", threshold: 0.16 },
  );

  revealTargets.forEach((target) => observer.observe(target));
  sequences.forEach((target) => observer.observe(target));
})();
