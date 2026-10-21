// Videos: load only when near the viewport, play while visible, pause when off-screen.
const videos = document.querySelectorAll("video.autoplay");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    for (const { target: v, isIntersecting } of entries) {
      if (isIntersecting) {
        if (!v.src) { v.src = v.dataset.src; }
        if (reduceMotion) { v.controls = true; } else { v.play().catch(() => { v.controls = true; }); }
      } else if (!v.paused) {
        v.pause();
      }
    }
  }, { rootMargin: "200px 0px" });
  videos.forEach((v) => io.observe(v));
} else {
  videos.forEach((v) => { v.src = v.dataset.src; v.controls = true; });
}

// Copy BibTeX.
document.querySelectorAll(".bibtex .copy").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const text = btn.parentElement.querySelector("code").innerText;
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
    } catch {
      btn.textContent = "Select & copy";
    }
    setTimeout(() => { btn.textContent = "Copy"; }, 1500);
  });
});

// Highlight the current section in the table of contents.
const tocLinks = [...document.querySelectorAll(".toc a")];
const targets = tocLinks.map((a) => document.querySelector(a.getAttribute("href")));
function updateToc() {
  const y = window.scrollY + window.innerHeight * 0.3;
  let current = 0;
  targets.forEach((el, i) => { if (el && el.offsetTop <= y) current = i; });
  tocLinks.forEach((a, i) => a.classList.toggle("active", i === current));
}
window.addEventListener("scroll", updateToc, { passive: true });
updateToc();
