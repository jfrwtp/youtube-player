# StreamHub – YouTube Streaming UI

Tampilan terinspirasi dari desain Dribbble modern video streaming platform.

## Fitur
- Sidebar gelap + navigasi (Home, Popular, Favorites, Playlist)
- Featured videos (2 card besar)
- Category pills
- Video grid modern
- Custom player dengan volume, next/prev
- Playlist & Favorites (Cloudflare D1)
- Dark theme dengan aksen hijau mint

## Setup
1. Upload ke GitHub
2. Deploy ke Cloudflare Pages (Framework: None, Output: /)
3. Environment Variable: `YOUTUBE_API_KEY`
4. Binding D1 dengan variable name `DB`
5. Pastikan tabel playlist & favorites sudah dibuat
