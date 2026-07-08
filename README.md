# adambarnettdop — portfolio site

Static site for Adam Barnett, director of photography. No framework, no build
dependencies — plain HTML/CSS/JS generated from `tools/projects.json`.

## Structure

- `index.html` — project index; hovering a title plays that project's loop
  fullscreen behind the list (touch devices get a thumbnail list instead)
- `work/<slug>.html` — per-project page: hero loop, full film/teaser player, stills
- `about.html` — bio + contact (direct email, WPA representation, socials)
- `assets/loops/` — muted ~16s 720p hover loops (~2 MB each)
- `assets/films/` — 1080p full pieces with audio (**1.3 GB total** — consider a
  video host/CDN or Vimeo embeds if hosting bandwidth is a concern)
- `assets/stills/<slug>/` — web-sized stills (max 1600px)
- `assets/posters/` — poster frames for videos

## Rebuilding

- Edit `tools/projects.json` (titles, order, categories), then: `node tools/build.mjs`
- Re-generate media from the source masters (expects them extracted at
  `Desktop/ADAMBARNETTDOP_ASSETS/ADAMBARNETTDOP_WEBSITE`):
  `bash tools/transcode.sh` and `bash tools/stills.sh` (needs ffmpeg)

## Preview

Any static server, e.g. `python -m http.server 8741` then http://localhost:8741

## Notes

- "just act normal" only has a WIP grade/camera-test reel as source; the site
  uses a 16s excerpt as its hover loop and publishes no full video. Remove the
  entry from `tools/projects.json` if it shouldn't be public yet.
- "they found her in a field" full video is the teaser (the long conform has no
  audio); "oh wonder — 22 break" uses the trailer.
