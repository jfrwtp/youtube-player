let player;
let currentVideo = null;
let isPlaying = false;
let playlist = [];
let favorites = [];

// User ID (disimpan di localStorage)
function getUserId() {
  let id = localStorage.getItem("userId");
  if (!id) {
    id = "user_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("userId", id);
  }
  return id;
}
const userId = getUserId();

// Theme
function initTheme() {
  const saved = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  document.getElementById("themeToggle").textContent = saved === "dark" ? "☀️" : "🌙";
}

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  document.getElementById("themeToggle").textContent = next === "dark" ? "☀️" : "🌙";
});

// YouTube API
function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "100%",
    width: "100%",
    playerVars: {
      controls: 0,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      enablejsapi: 1,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerReady() {
  setInterval(updateProgress, 500);
  loadPlaylist();
  loadFavorites();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    document.getElementById("playPauseBtn").textContent = "❚❚";
  } else {
    isPlaying = false;
    document.getElementById("playPauseBtn").textContent = "▶";
  }
}

function updateProgress() {
  if (!player || !player.getDuration) return;
  const current = player.getCurrentTime() || 0;
  const duration = player.getDuration() || 0;
  if (duration > 0) {
    document.getElementById("progress").value = (current / duration) * 100;
    document.getElementById("timeDisplay").textContent =
      formatTime(current) + " / " + formatTime(duration);
  }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// Search
document.getElementById("searchBtn").addEventListener("click", searchVideos);
document.getElementById("searchInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchVideos();
});

async function searchVideos() {
  const q = document.getElementById("searchInput").value.trim();
  if (!q) return;

  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&maxResults=12`);
  const data = await res.json();

  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = "";

  if (!data.items) {
    resultsEl.innerHTML = "<p>Tidak ada hasil atau API key bermasalah.</p>";
    return;
  }

  data.items.forEach((item) => {
    const video = {
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium.url,
    };

    const card = document.createElement("div");
    card.className = "video-card";
    card.innerHTML = `
      <img src="${video.thumbnail}" alt="" />
      <div class="info">
        <h4>${video.title}</h4>
        <p>${video.channel}</p>
      </div>
    `;
    card.onclick = () => playVideo(video);
    resultsEl.appendChild(card);
  });
}

function playVideo(video) {
  currentVideo = video;
  player.loadVideoById(video.id);
  document.getElementById("videoTitle").textContent = video.title;
  document.getElementById("videoChannel").textContent = video.channel;
  updateFavButton();
}

// Controls
document.getElementById("playPauseBtn").addEventListener("click", () => {
  if (!player) return;
  if (isPlaying) player.pauseVideo();
  else player.playVideo();
});

document.getElementById("progress").addEventListener("input", (e) => {
  if (!player || !player.getDuration) return;
  const duration = player.getDuration();
  player.seekTo((e.target.value / 100) * duration, true);
});

// ===== Favorites (D1) =====
async function loadFavorites() {
  try {
    const res = await fetch(`/api/favorites?userId=${userId}`);
    favorites = await res.json();
    if (!Array.isArray(favorites)) favorites = [];
    renderFavorites();
  } catch (e) {
    console.error("Gagal load favorites:", e);
    favorites = [];
  }
}

document.getElementById("favBtn").addEventListener("click", async () => {
  if (!currentVideo) return;

  const isFav = favorites.some((v) => v.id === currentVideo.id);

  try {
    if (isFav) {
      await fetch(`/api/favorites?userId=${userId}&videoId=${currentVideo.id}`, {
        method: "DELETE",
      });
    } else {
      await fetch(`/api/favorites?userId=${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentVideo),
      });
    }
    await loadFavorites();
    updateFavButton();
  } catch (e) {
    console.error("Gagal update favorite:", e);
  }
});

function updateFavButton() {
  if (!currentVideo) return;
  const isFav = favorites.some((v) => v.id === currentVideo.id);
  document.getElementById("favBtn").textContent = isFav ? "♥" : "♡";
}

function renderFavorites() {
  const el = document.getElementById("favorites");
  el.innerHTML = "";
  favorites.forEach((video) => {
    const li = document.createElement("li");
    li.textContent = video.title.slice(0, 40) + (video.title.length > 40 ? "..." : "");
    li.onclick = () => playVideo(video);
    el.appendChild(li);
  });
}

// ===== Playlist (D1) =====
async function loadPlaylist() {
  try {
    const res = await fetch(`/api/playlist?userId=${userId}`);
    playlist = await res.json();
    if (!Array.isArray(playlist)) playlist = [];
    renderPlaylist();
  } catch (e) {
    console.error("Gagal load playlist:", e);
    playlist = [];
  }
}

document.getElementById("addPlaylistBtn").addEventListener("click", async () => {
  if (!currentVideo) return;

  try {
    await fetch(`/api/playlist?userId=${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentVideo),
    });
    await loadPlaylist();
  } catch (e) {
    console.error("Gagal tambah playlist:", e);
  }
});

function renderPlaylist() {
  const el = document.getElementById("playlist");
  el.innerHTML = "";
  playlist.forEach((video) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${video.title.slice(0, 35)}${video.title.length > 35 ? "..." : ""}</span>
      <button class="remove-btn" data-id="${video.id}">✕</button>
    `;
    li.querySelector("span").onclick = () => playVideo(video);
    li.querySelector(".remove-btn").onclick = async (e) => {
      e.stopPropagation();
      try {
        await fetch(`/api/playlist?userId=${userId}&videoId=${video.id}`, {
          method: "DELETE",
        });
        await loadPlaylist();
      } catch (err) {
        console.error("Gagal hapus dari playlist:", err);
      }
    };
    el.appendChild(li);
  });
}

// Init
initTheme();
