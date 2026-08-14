let player = null;
let currentVideo = null;
let isPlaying = false;
let isMuted = false;
let playlist = [];
let favorites = [];
let currentPlaylistIndex = -1;
let searchResults = [];

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
document.getElementById("themeToggle").addEventListener("click", () => {
  // for now just toggle icon, full light theme can be added later
  const icon = document.querySelector("#themeToggle i");
  icon.classList.toggle("fa-moon");
  icon.classList.toggle("fa-sun");
});

// ===== YouTube API =====
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
      onReady: () => {
        player.setVolume(100);
        setInterval(updateProgress, 400);
        loadPlaylist();
        loadFavorites();
        // load initial content
        searchVideos("trending music 2024", true);
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.PLAYING) {
          isPlaying = true;
          document.querySelector("#playPauseBtn i").className = "fa-solid fa-pause";
        } else if (e.data === YT.PlayerState.ENDED) {
          playNext();
        } else {
          isPlaying = false;
          document.querySelector("#playPauseBtn i").className = "fa-solid fa-play";
        }
      },
    },
  });
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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

// ===== Search =====
document.getElementById("searchInput").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const q = e.target.value.trim();
    if (q) searchVideos(q);
  }
});

document.querySelectorAll(".pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    searchVideos(pill.dataset.q);
  });
});

async function searchVideos(query, isInitial = false) {
  const resultsEl = document.getElementById("results");
  const featuredEl = document.getElementById("featured");
  document.getElementById("sectionTitle").textContent = isInitial ? "Videos to try" : `Results for "${query}"`;

  resultsEl.innerHTML = `<p class="empty-msg">Loading...</p>`;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&maxResults=16`);
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      resultsEl.innerHTML = `<p class="empty-msg">No videos found.</p>`;
      featuredEl.innerHTML = "";
      return;
    }

    searchResults = data.items.map((item) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.medium?.url,
      channelId: item.snippet.channelId,
    }));

    // Featured (2 pertama)
    featuredEl.innerHTML = searchResults.slice(0, 2).map((v) => `
      <div class="featured-card" onclick='playVideo(${JSON.stringify(v).replace(/'/g, "&#39;")})'>
        <img src="${v.thumbnail}" alt="" />
        <div class="overlay">
          <div class="tags"><span class="tag">VIDEO</span></div>
          <h4>${escapeHtml(v.title)}</h4>
          <div class="channel">
            <span>${escapeHtml(v.channel)}</span>
          </div>
        </div>
      </div>
    `).join("");

    // Grid
    resultsEl.innerHTML = searchResults.slice(2).map((v) => `
      <div class="video-card" onclick='playVideo(${JSON.stringify(v).replace(/'/g, "&#39;")})'>
        <div class="thumb-wrap">
          <img src="${v.thumbnail}" alt="" loading="lazy" />
        </div>
        <h4>${escapeHtml(v.title)}</h4>
        <div class="meta">
          <span>${escapeHtml(v.channel)}</span>
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error(err);
    resultsEl.innerHTML = `<p class="empty-msg">Failed to load videos. Check API key.</p>`;
  }
}

// ===== Play =====
function playVideo(video) {
  if (!player || !video) return;
  currentVideo = video;
  player.loadVideoById(video.id);

  document.getElementById("videoTitle").textContent = video.title;
  document.getElementById("videoChannel").textContent = video.channel;

  // Switch view
  document.getElementById("browseView").classList.add("hidden");
  document.getElementById("playerView").classList.remove("hidden");

  currentPlaylistIndex = playlist.findIndex((v) => v.id === video.id);
  updateFavButton();
  renderUpNext();
}

document.getElementById("backBtn").addEventListener("click", () => {
  document.getElementById("playerView").classList.add("hidden");
  document.getElementById("browseView").classList.remove("hidden");
  if (player && isPlaying) player.pauseVideo();
});

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

document.getElementById("volume").addEventListener("input", (e) => {
  if (!player) return;
  const vol = Number(e.target.value);
  player.setVolume(vol);
  isMuted = vol === 0;
  document.querySelector("#muteBtn i").className = isMuted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
});

document.getElementById("muteBtn").addEventListener("click", () => {
  if (!player) return;
  if (isMuted) {
    player.unMute();
    document.querySelector("#muteBtn i").className = "fa-solid fa-volume-high";
    isMuted = false;
  } else {
    player.mute();
    document.querySelector("#muteBtn i").className = "fa-solid fa-volume-xmark";
    isMuted = true;
  }
});

document.getElementById("prevBtn").addEventListener("click", playPrev);
document.getElementById("nextBtn").addEventListener("click", playNext);

function playPrev() {
  if (playlist.length === 0) return;
  currentPlaylistIndex = currentPlaylistIndex <= 0 ? playlist.length - 1 : currentPlaylistIndex - 1;
  playVideo(playlist[currentPlaylistIndex]);
}

function playNext() {
  if (playlist.length === 0) {
    // fallback ke search results
    if (searchResults.length === 0) return;
    const idx = searchResults.findIndex((v) => v.id === currentVideo?.id);
    const next = searchResults[(idx + 1) % searchResults.length];
    playVideo(next);
    return;
  }
  currentPlaylistIndex = currentPlaylistIndex >= playlist.length - 1 || currentPlaylistIndex === -1 ? 0 : currentPlaylistIndex + 1;
  playVideo(playlist[currentPlaylistIndex]);
}

// ===== Favorites =====
async function loadFavorites() {
  try {
    const res = await fetch(`/api/favorites?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    favorites = Array.isArray(data) ? data : [];
  } catch (e) {
    favorites = [];
  }
}

document.getElementById("favBtn").addEventListener("click", async () => {
  if (!currentVideo) return;
  const isFav = favorites.some((v) => v.id === currentVideo.id);
  try {
    if (isFav) {
      await fetch(`/api/favorites?userId=${encodeURIComponent(userId)}&videoId=${encodeURIComponent(currentVideo.id)}`, { method: "DELETE" });
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
    alert("Gagal menyimpan favorit. Pastikan D1 sudah di-binding.");
  }
});

function updateFavButton() {
  const btn = document.getElementById("favBtn");
  if (!currentVideo) return;
  const isFav = favorites.some((v) => v.id === currentVideo.id);
  btn.classList.toggle("active", isFav);
  btn.innerHTML = isFav
    ? `<i class="fa-solid fa-heart"></i> Favorited`
    : `<i class="fa-regular fa-heart"></i> Favorite`;
}

// ===== Playlist =====
async function loadPlaylist() {
  try {
    const res = await fetch(`/api/playlist?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    playlist = Array.isArray(data) ? data : [];
    renderSidebarPlaylist();
  } catch (e) {
    playlist = [];
    renderSidebarPlaylist();
  }
}

document.getElementById("addPlaylistBtn").addEventListener("click", async () => {
  if (!currentVideo) return;
  if (playlist.some((v) => v.id === currentVideo.id)) {
    alert("Sudah ada di playlist");
    return;
  }
  try {
    await fetch(`/api/playlist?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(currentVideo),
    });
    await loadPlaylist();
  } catch (e) {
    alert("Gagal menambah playlist. Pastikan D1 sudah di-binding.");
  }
});

document.getElementById("openPlaylistBtn").addEventListener("click", () => {
  if (playlist.length > 0) {
    playVideo(playlist[0]);
  } else {
    alert("Playlist masih kosong. Tambahkan video dulu.");
  }
});

function renderSidebarPlaylist() {
  const el = document.getElementById("sidebarPlaylist");
  if (playlist.length === 0) {
    el.innerHTML = `<div style="padding:8px 12px;font-size:12px;color:var(--text-muted)">Belum ada video</div>`;
    return;
  }
  el.innerHTML = playlist.slice(0, 8).map((v) => `
    <div class="subs-item" onclick='playVideo(${JSON.stringify(v).replace(/'/g, "&#39;")})'>
      <img class="thumb" src="${v.thumbnail || ''}" alt="" />
      <span>${escapeHtml(v.title)}</span>
    </div>
  `).join("");
}

function renderUpNext() {
  const el = document.getElementById("upNext");
  const list = playlist.length > 0 ? playlist : searchResults;
  el.innerHTML = list.slice(0, 10).map((v) => `
    <div class="up-next-item" onclick='playVideo(${JSON.stringify(v).replace(/'/g, "&#39;")})'>
      <img src="${v.thumbnail || ''}" alt="" />
      <div class="info">
        <h5>${escapeHtml(v.title)}</h5>
        <p>${escapeHtml(v.channel)}</p>
      </div>
    </div>
  `).join("");
}

// Nav items
document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    item.classList.add("active");

    const view = item.dataset.view;
    if (view === "favorites") {
      if (favorites.length === 0) {
        alert("Belum ada favorit");
        return;
      }
      // tampilkan favorites di grid
      document.getElementById("featured").innerHTML = "";
      document.getElementById("sectionTitle").textContent = "Your Favorites";
      document.getElementById("results").innerHTML = favorites.map((v) => `
        <div class="video-card" onclick='playVideo(${JSON.stringify(v).replace(/'/g, "&#39;")})'>
          <div class="thumb-wrap"><img src="${v.thumbnail || ''}" alt="" /></div>
          <h4>${escapeHtml(v.title)}</h4>
          <div class="meta"><span>${escapeHtml(v.channel)}</span></div>
        </div>
      `).join("");
      document.getElementById("playerView").classList.add("hidden");
      document.getElementById("browseView").classList.remove("hidden");
    } else if (view === "playlist") {
      if (playlist.length === 0) {
        alert("Playlist kosong");
        return;
      }
      document.getElementById("featured").innerHTML = "";
      document.getElementById("sectionTitle").textContent = "Your Playlist";
      document.getElementById("results").innerHTML = playlist.map((v) => `
        <div class="video-card" onclick='playVideo(${JSON.stringify(v).replace(/'/g, "&#39;")})'>
          <div class="thumb-wrap"><img src="${v.thumbnail || ''}" alt="" /></div>
          <h4>${escapeHtml(v.title)}</h4>
          <div class="meta"><span>${escapeHtml(v.channel)}</span></div>
        </div>
      `).join("");
      document.getElementById("playerView").classList.add("hidden");
      document.getElementById("browseView").classList.remove("hidden");
    } else if (view === "home") {
      searchVideos("trending", true);
      document.getElementById("playerView").classList.add("hidden");
      document.getElementById("browseView").classList.remove("hidden");
    }
  });
});
