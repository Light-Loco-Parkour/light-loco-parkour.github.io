(() => {
  const diagrams = Array.from(
    document.querySelectorAll("[data-pipeline-flow]"),
  );
  if (!diagrams.length) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const inView = new Set();

  const sync = () => {
    const canMove =
      !reducedMotion.matches && document.visibilityState === "visible";
    diagrams.forEach((diagram) => {
      diagram.classList.toggle(
        "is-flowing",
        canMove && inView.has(diagram),
      );
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) inView.add(entry.target);
        else inView.delete(entry.target);
      });
      sync();
    },
    { rootMargin: "140px 0px", threshold: 0.08 },
  );

  diagrams.forEach((diagram) => observer.observe(diagram));
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener?.("change", sync);
})();
