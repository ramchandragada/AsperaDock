const REPO = "ramchandragada/AsperaDock";
const API = `https://api.github.com/repos/${REPO}/releases/latest`;

const downloadBtns = [
  document.getElementById("download-deb"),
  document.getElementById("download-deb-footer"),
].filter(Boolean);
const meta = document.getElementById("download-meta");

function pickDebAsset(assets = []) {
  const list = assets.filter((a) => /\.deb$/i.test(a.name));
  const amd = list.find((a) => /amd64|x86_64/i.test(a.name));
  return amd || list[0] || null;
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
        btn.setAttribute("download", asset.name);
      }
      if (meta) {
        meta.textContent = `Latest ${version} · ${asset.name} · ${formatBytes(asset.size)}`;
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

function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return "";
  const mb = n / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
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
    { threshold: 0.14 },
  );
  nodes.forEach((n) => io.observe(n));
}

loadLatestRelease();
setupReveal();
