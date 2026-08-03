const REPO = "ramchandragada/AsperaDock";
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

const downloadBtns = [
  document.getElementById("download-deb"),
  document.getElementById("download-deb-mid"),
  document.getElementById("download-deb-footer"),
].filter(Boolean);
const meta = document.getElementById("download-meta");

function pickDebAsset(assets = []) {
  const list = assets.filter((a) => /\.deb$/i.test(a.name));
  const amd = list.find((a) => /amd64|x86_64/i.test(a.name));
  return amd || list[0] || null;
}

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadLatestRelease() {
  try {
    const res = await fetch(API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    const data = await res.json();
    const asset = pickDebAsset(data.assets || []);
    const version = (data.tag_name || "").replace(/^v/, "") || "latest";
    if (asset?.browser_download_url) {
      for (const btn of downloadBtns) {
        btn.href = asset.browser_download_url;
        if (btn.id !== "download-deb-mid") {
          btn.setAttribute("download", asset.name);
        }
      }
      if (meta) {
        meta.textContent = `v${version} · ${asset.name} · ${formatBytes(asset.size)} · Debian · Ubuntu · Mint`;
      }
    } else if (meta) {
      meta.textContent = `Latest ${version} — open GitHub Releases for the .deb`;
    }
  } catch (err) {
    console.warn(err);
    if (meta) {
      meta.classList.add("error");
      meta.textContent =
        "Could not reach GitHub right now — use the button to open Releases and download the .deb.";
    }
  }
}

function setupReveal() {
  const nodes = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((n) => n.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  nodes.forEach((n) => io.observe(n));
}

function setupDockCycle() {
  const tabs = [...document.querySelectorAll(".dock-tabs .tab")];
  if (tabs.length < 2) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  let i = 0;
  setInterval(() => {
    tabs.forEach((t) => t.classList.remove("on"));
    i = (i + 1) % tabs.length;
    tabs[i].classList.add("on");
    tabs.forEach((t, idx) => {
      t.classList.toggle("cold", idx !== i && idx === tabs.length - 1);
    });
  }, 3200);
}

function setupCopyInstall() {
  const btn = document.getElementById("copy-install");
  const code = document.getElementById("install-code");
  if (!btn || !code) return;

  btn.addEventListener("click", async () => {
    const text = code.textContent || "";
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copied";
      btn.classList.add("copied");
      setTimeout(() => {
        btn.textContent = "Copy";
        btn.classList.remove("copied");
      }, 1600);
    } catch {
      btn.textContent = "Select & copy";
    }
  });
}

loadLatestRelease();
setupReveal();
setupDockCycle();
setupCopyInstall();
