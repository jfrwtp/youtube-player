let player = null;
let currentVideo = null;
let isPlaying = false;
let isMuted = false;
let playlist = [];
let favorites = [];
let currentPlaylistIndex = -1;

// ===== User ID =====
function getUserId() {
  let id = localStorage.getItem("userId");
  if (!id) {
    id = "user_" + Math.random().toString(36).substring(2, 12);
    localStorage.setItem("userId", id);
  }
  return id;
}
const userId = getUserId();

// ===== Theme =====
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

// ===== YouTube IFrame API =====
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
      fs: 0,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
    },
  });
}

function onPlayerReady() {
  // Set volume awal
  player.setVolume(100);
  setInterval(updateProgress, 400);
  loadPlaylist();
  loadFavorites();
}

function onPlayerStateChange(event) {
  if (event.data === YT.PlayerState.PLAYING) {
    isPlaying = true;
    document.getElementById("playPauseBtn").textContent = "❚❚";
  } else if (event.data === YT.PlayerState.ENDED) {
    // Auto next kalau ada di playlist
    playNext();
  } else {
    isPlaying = false;
    document.getElementById("playPauseBtn").textContent = "▶";
  }
}

function updateProgress() {
  if (!player || typeof player.getDuration !== "function") return;
  const current = player.getCurrentTime() || 0;
  const duration = player.getDuration() || 0;
  if (duration > 0) {
    document.getElementById("progress").value = (current / duration) * 100;
    document.getElementById("currentTime").textContent = formatTime(current);
    document.getElementById("duration").textContent = formatTime(duration);
  }
}

function formatTime(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ===== Search =====
document.getElementById("searchBtn").addEventListener("click", searchVideos);
document.getElementById("searchInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") searchVideos();
});

async function searchVideos() {
  const q = document.getElementById("searchInput").value.trim();
  if (!q) return;

  const resultsEl = document.getElementById("results");
  resultsEl.innerHTML = `<p class="empty-msg">Mencari...</p>`;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&maxResults=16`);
    const data = await res.json();

    resultsEl.innerHTML = "";

    if (!data.items || data.items.length === 0) {
      resultsEl.innerHTML = `<p class="empty-msg">Tidak ada hasil ditemukan.</p>`;
      return;
    }

    data.items.forEach((item) => {
      const video = {
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
      };

      const card = document.createElement("div");
      card.className = "video-card";
      card.innerHTML = `
        <img src="${video.thumbnail}" alt="" loading="lazy" />
        <div class="info">
          <h4>${escapeHtml(video.title)}</h4>
          <p>${escapeHtml(video.channel)}</p>
        </div>
      `;
      card.onclick = () => playVideo(video, true);
      resultsEl.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = `<p class="empty-msg">Gagal mencari. Cek API key atau koneksi.</p>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ===== Play Video =====
function playVideo(video, fromSearch = false) {
  if (!player || !video) return;

  currentVideo = video;
  player.loadVideoById(video.id);

  document.getElementById("videoTitle").textContent = video.title;
  document.getElementById("videoChannel").textContent = video.channel;

  // Update index di playlist kalau ada
  currentPlaylistIndex = playlist.findIndex((v) => v.id === video.id);

  updateFavButton();
  highlightActiveInLists();
}

// ===== Controls =====
document.getElementById("playPauseBtn").addEventListener("click", () => {
  if (!player) return;
  if (isPlaying) player.pauseVideo();
  else player.playVideo();
});

document.getElementById("progress").addEventListener("input", (e) => {
  if (!player || typeof player.getDuration !== "function") return;
  const duration = player.getDuration() || 0;
  player.seekTo((e.target.value / 100) * duration, true);
});

// Volume
document.getElementById("volume").addEventListener("input", (e) => {
  if (!player) return;
  const vol = Number(e.target.value);
  player.setVolume(vol);
  isMuted = vol === 0;
  document.getElementById("muteBtn").textContent = isMuted ? "🔇" : "🔊";
});

document.getElementById("muteBtn").addEventListener("click", () => {
  if (!player) return;
  if (isMuted) {
    player.unMute();
    const vol = document.getElementById("volume").value || 100;
    player.setVolume(vol);
    document.getElementById("muteBtn").textContent = "🔊";
    isMuted = false;
  } else {
    player.mute();
    document.getElementById("muteBtn").textContent = "🔇";
    isMuted = true;
  }
});

// Previous / Next
document.getElementById("prevBtn").addEventListener("click", playPrev);
document.getElementById("nextBtn").addEventListener("click", playNext);

function playPrev() {
  if (playlist.length === 0) return;
  if (currentPlaylistIndex <= 0) {
    currentPlaylistIndex = playlist.length - 1;
  } else {
    currentPlaylistIndex--;
  }
  playVideo(playlist[currentPlaylistIndex]);
}

function playNext() {
  if (playlist.length === 0) return;
  if (currentPlaylistIndex >= playlist.length - 1 || currentPlaylistIndex === -1) {
    currentPlaylistIndex = 0;
  } else {
    currentPlaylistIndex++;
  }
  playVideo(playlist[currentPlaylistIndex]);
}

// ===== Favorites =====
async function loadFavorites() {
  try {
    const res = await fetch(`/api/favorites?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    favorites = Array.isArray(data) ? data : [];
    renderFavorites();
  } catch (e) {
    console.error("Gagal load favorites:", e);
    favorites = [];
    renderFavorites();
  }
}

document.getElementById("favBtn").addEventListener("click", async () => {
  if (!currentVideo) return;

  const isFav = favorites.some((v) => v.id === currentVideo.id);

  try {
    if (isFav) {
      await fetch(
        `/api/favorites?userId=${encodeURIComponent(userId)}&videoId=${encodeURIComponent(currentVideo.id)}`,
        { method: "DELETE" }
      );
    } else {
      await fetch(`/api/favorites?userId=${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentVideo),
      });
    }
    await loadFavorites();
    updateFavButton();
  } catch (e) {
    console.error("Gagal update favorite:", e);
    alert("Gagal menyimpan favorit. Pastikan D1 sudah di-binding.");
  }
});

function updateFavButton() {
  if (!currentVideo) {
    document.getElementById("favBtn").textContent = "♡";
    return;
  }
  const isFav = favorites.some((v) => v.id === currentVideo.id);
  document.getElementById("favBtn").textContent = isFav ? "♥" : "♡";
}

function renderFavorites() {
  const el = document.getElementById("favorites");
  el.innerHTML = "";
  if (favorites.length === 0) {
    el.innerHTML = `<li style="color:var(--text-muted);font-size:12px;cursor:default">Belum ada favorit</li>`;
    return;
  }
  favorites.forEach((video) => {
    const li = document.createElement("li");
    li.innerHTML = `<span title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</span>`;
    li.onclick = () => playVideo(video);
    if (currentVideo && currentVideo.id === video.id) li.classList.add("active");
    el.appendChild(li);
  });
}

// ===== Playlist =====
async function loadPlaylist() {
  try {
    const res = await fetch(`/api/playlist?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    playlist = Array.isArray(data) ? data : [];
    renderPlaylist();
  } catch (e) {
    console.error("Gagal load playlist:", e);
    playlist = [];
    renderPlaylist();
  }
}

document.getElementById("addPlaylistBtn").addEventListener("click", async () => {
  if (!currentVideo) return;

  // Cek duplikat
  if (playlist.some((v) => v.id === currentVideo.id)) {
    alert("Video sudah ada di playlist");
    return;
  }

  try {
    const res = await fetch(`/api/playlist?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentVideo),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    await loadPlaylist();
  } catch (e) {
    console.error("Gagal tambah playlist:", e);
    alert("Gagal menambah ke playlist. Pastikan D1 sudah di-binding.");
  }
});

function renderPlaylist() {
  const el = document.getElementById("playlist");
  el.innerHTML = "";
  if (playlist.length === 0) {
    el.innerHTML = `<li style="color:var(--text-muted);font-size:12px;cursor:default">Playlist kosong</li>`;
    return;
  }

  playlist.forEach((video, index) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span title="${escapeHtml(video.title)}">${escapeHtml(video.title)}</span>
      <button class="remove-btn" title="Hapus">✕</button>
    `;
    li.querySelector("span").onclick = () => {
      currentPlaylistIndex = index;
      playVideo(video);
    };
    li.querySelector(".remove-btn").onclick = async (e) => {
      e.stopPropagation();
      try {
        await fetch(
          `/api/playlist?userId=${encodeURIComponent(userId)}&videoId=${encodeURIComponent(video.id)}`,
          { method: "DELETE" }
        );
        await loadPlaylist();
      } catch (err) {
        console.error("Gagal hapus dari playlist:", err);
      }
    };
    if (currentVideo && currentVideo.id === video.id) {
      li.classList.add("active");
      currentPlaylistIndex = index;
    }
    el.appendChild(li);
  });
}

function highlightActiveInLists() {
  renderPlaylist();
  renderFavorites();
}

// Init
initTheme();
