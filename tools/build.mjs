// Static site generator: reads projects.json + assets, emits index.html,
// about.html and work/<slug>.html. Run: node tools/build.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "tools", "projects.json"), "utf8"));

/* full films live on Cloudflare R2 (1.3GB total, files >100MB — too big for
   the git repo / Vercel deploy). Loops, stills and posters stay local. */
const FILMS_BASE = "https://pub-23da5571b7904d2d86965021887fa2b2.r2.dev/films";

const stillsOf = (slug) => {
  const dir = join(root, "assets", "stills", slug);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
};

const head = (title, base) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="adam barnett — director of photography, london. narrative, commercials and music promos. represented by wpa.">
<link rel="stylesheet" href="${base}assets/css/site.css">
<link rel="icon" href="${base}assets/favicon.svg">
</head>`;

const vf = ``; // viewfinder corner marks removed

/* secondary projects shown under the "selected work" expanders (not in the
   main reel). Same shape as data.projects so they get work pages too. */
const moreWork = [
  {
    label: "selected tv work",
    items: [
      { slug: "just-act-normal", title: "just act normal", meta: "television — camera & grade tests", loop: true, film: false },
      { slug: "champion", title: "champion", meta: "television — bbc + netflix", loop: true, film: false },
      { slug: "boombox", title: "boom box", meta: "television — hbo series", loop: true, film: false },
    ],
  },
  {
    label: "selected other",
    items: [
      { slug: "royal-marines", title: "royal marines", meta: "commercial", loop: true, film: false },
      { slug: "bmth-strangers", title: "bring me the horizon", meta: "music promo", loop: true, film: false },
      { slug: "eaves-wilder-the-great-plain", title: "eaves wilder — the great plain", meta: "music promo", loop: true, film: false },
    ],
  },
  { label: "photography + stills", soon: true, items: [] },
];
const moreWorkFlat = moreWork.flatMap((s) => s.items);
const allProjects = data.projects.concat(moreWorkFlat);

const projLink = (p) => {
  const stills = stillsOf(p.slug).slice(0, 5).map((f) => `assets/stills/${p.slug}/${f}`);
  return `<a class="proj" href="work/${p.slug}.html" data-slug="${p.slug}" data-title="${p.title}" data-meta="${p.meta}" data-loop="${p.loop ? 1 : 0}" data-stills="${stills.join(",")}">${p.title}</a>`;
};
const expander = moreWork
  .map((s) => {
    const body = s.soon
      ? `        <li><span class="soon">coming soon</span></li>`
      : s.items.map((p) => `        <li>${projLink(p)}</li>`).join("\n");
    return `      <p class="worklabel worktoggle" role="button" tabindex="0" aria-expanded="false">${s.label}</p>
      <ul class="morework collapse">
${body}
      </ul>`;
  })
  .join("\n");

/* ---------------- index ---------------- */
{
  const items = data.projects
    .map((p, i) => {
      const stills = stillsOf(p.slug).slice(0, 5).map((f) => `assets/stills/${p.slug}/${f}`);
      const poster = p.loop ? `assets/posters/${p.slug}.jpg` : stills[0] || "";
      const active = i === 0 ? " active" : ""; // first project is the resting/highlighted state
      return `      <li><a class="proj${active}" href="work/${p.slug}.html" data-slug="${p.slug}" data-title="${p.title}" data-meta="${p.meta}" data-loop="${p.loop ? 1 : 0}" data-stills="${stills.join(",")}">
        <img class="thumb" src="${poster}" alt="" loading="lazy"><span class="t">${p.title}<span class="m">${p.meta}</span></span>
      </a></li>`;
    })
    .join("\n");

  const html = `${head("adam barnett — director of photography", "")}
<body class="home">
  <div class="preloader" id="preloader" aria-hidden="true">
    <div class="preload-bar"><i id="preload-fill"></i></div>
  </div>
  <div class="bg" id="bg" aria-hidden="true">
    <div class="layer"></div>
    <div class="layer"></div>
    <div class="scrim"></div>
  </div>
  ${vf}
  <div class="credit">represented by <a class="wpa" href="https://www.wp-a.co.uk" target="_blank" rel="noopener"><img src="assets/wpa.webp" alt="wpa"></a></div>

  <div class="home-col">
    <header class="masthead">
      <h1><a href="index.html">adam barnett <span class="role">/ director of photography</span></a></h1>
    </header>

    <div class="workblock">
      <p class="worklabel worktoggle" role="button" tabindex="0" aria-expanded="true">latest work</p>
      <ul class="projlist collapse open">
${items}
      </ul>
${expander}
    </div>

    <footer class="homefoot">
      <a href="about.html">about + contact</a>
    </footer>
  </div>

  <script src="assets/js/home.js"></script>
</body>
</html>
`;
  writeFileSync(join(root, "index.html"), html);
}

/* ---------------- project pages ---------------- */
mkdirSync(join(root, "work"), { recursive: true });

allProjects.forEach((p, idx) => {
  const prev = allProjects[(idx - 1 + allProjects.length) % allProjects.length];
  const next = allProjects[(idx + 1) % allProjects.length];
  const stills = stillsOf(p.slug).slice(0, 8); // at most 8 screengrabs per project
  const btsStills = p.bts ? stillsOf(p.bts).slice(0, 8) : [];

  const hero = p.loop
    ? `<video autoplay muted loop playsinline preload="auto" poster="../assets/posters/${p.slug}.jpg" src="../assets/loops/${p.slug}.mp4"></video>`
    : stills.length
      ? `<img src="../assets/stills/${p.slug}/${stills[0]}" alt="${p.title} — still">`
      : "";

  const filmBlock = p.film
    ? `    <section class="filmblock">
      <p class="mono">${p.filmLabel}</p>
      ${p.filmUnavailable
        ? `<p class="mono filmnote">${p.filmUnavailable}</p>`
        : `<video controls preload="none" poster="../assets/posters/${p.slug}.jpg" src="${FILMS_BASE}/${p.slug}.mp4"></video>`}
    </section>`
    : "";

  const grid = (list, dir) =>
    list.map((f, i) => `      <img src="../assets/stills/${dir}/${f}" alt="${p.title} — still ${i + 1}" loading="lazy">`).join("\n");

  const stillsBlock = stills.length
    ? `    <p class="mono gridlabel">stills</p>
    <section class="stillsgrid">
${grid(stills, p.slug)}
    </section>`
    : "";

  const btsBlock = btsStills.length
    ? `    <p class="mono gridlabel">behind the scenes</p>
    <section class="stillsgrid">
${grid(btsStills, p.bts)}
    </section>`
    : "";

  const html = `${head(`${p.title} — adam barnett`, "../")}
<body class="project">
  <header class="topbar">
    <div class="brand"><a href="../index.html">adam barnett <span class="role">/ director of photography</span></a></div>
    <nav><a href="../index.html">index</a><a href="../about.html">about + contact</a></nav>
  </header>

  <section class="hero">
    <div class="bg" aria-hidden="true">
      <div class="layer on">${hero}</div>
      <div class="layer"></div>
      <div class="scrim"></div>
    </div>
    <div class="titleblock">
      <h1>${p.title}</h1>
      <p class="mono">${p.meta} — dop adam barnett</p>
    </div>
  </section>

  <main class="pagebody">
${filmBlock}
${stillsBlock}
${btsBlock}
    <nav class="pagenav">
      <a href="${prev.slug}.html">&larr; ${prev.title}</a>
      <a href="${next.slug}.html">${next.title} &rarr;</a>
    </nav>
  </main>
</body>
</html>
`;
  writeFileSync(join(root, "work", `${p.slug}.html`), html);
});

/* ---------------- about ---------------- */
{
  const html = `${head("about + contact — adam barnett", "")}
<body class="about">
  <div class="bg" aria-hidden="true">
    <div class="layer on"><img src="assets/stills/eaves-wilder-the-great-plain/001.jpg" alt=""></div>
    <div class="layer"></div>
    <div class="scrim"></div>
  </div>
  ${vf}

  <div class="about-col">
    <header class="masthead">
      <h1><a href="index.html">adam barnett <span class="role">/ director of photography</span></a></h1>
    </header>

    <div class="content">
      <p class="bio">adam barnett is a director of photography working across narrative,
      commercials and music promos. a graduate of the nfts cinematography ma,
      his work spans television drama, short film and promos. born in manchester
      by way of newcastle, he is based in london and represented worldwide by wpa.</p>

      <div class="contactblock">
        <div>
          <p class="mono">direct</p>
          <p><a href="mailto:adambarnettdop@gmail.com">adambarnettdop@gmail.com</a></p>
        </div>
        <div>
          <p class="mono">representation — wpa · worldwide production agency · +44 (0)207 287 9564</p>
          <p>features &amp; drama — <a href="mailto:amber@wp-a.co.uk">amber thompson</a><br>
          commercials &amp; promos — <a href="mailto:barnaby@wp-a.co.uk">barnaby laws</a> · <a href="mailto:estere@wp-a.co.uk">estere sulca</a></p>
        </div>
        <div>
          <p class="mono">elsewhere</p>
          <p class="socials">
            <a href="https://www.instagram.com/adambarnettdop" target="_blank" rel="noopener" aria-label="Instagram"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="17.4" cy="6.6" r="1.25" fill="currentColor"/></svg></a>
            <a href="https://vimeo.com/adambarnettdop" target="_blank" rel="noopener" aria-label="Vimeo"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881l-1.918-7.114c-.719-2.584-1.488-3.878-2.312-3.878-.179 0-.806.378-1.881 1.132L0 7.593c1.19-1.048 2.365-2.094 3.523-3.143C5.117 3.074 6.315 2.242 7.121 2.163c1.902-.184 3.074 1.117 3.516 3.903.481 3.043.815 4.935 1.003 5.676.548 2.583 1.152 3.874 1.813 3.874.512 0 1.281-.811 2.312-2.432 1.028-1.62 1.578-2.855 1.65-3.703.145-1.377-.394-2.068-1.65-2.068-.594 0-1.202.135-1.828.406 1.216-3.976 3.536-5.906 6.96-5.789 2.541.075 3.739 1.729 3.596 4.958z"/></svg></a>
            <a href="https://www.imdb.com/name/nm5168031/" target="_blank" rel="noopener" aria-label="IMDb"><svg class="ico ico-imdb" viewBox="0 0 64 32" aria-hidden="true"><rect x="1" y="4" width="62" height="24" rx="4" fill="currentColor"/><text x="32" y="22" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="17" letter-spacing="0.5" fill="#0a0a0b">IMDb</text></svg></a>
          </p>
        </div>
      </div>
    </div>

    <footer class="homefoot">
      <a class="backlink" href="index.html" aria-label="back to index"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7"/></svg></a>
    </footer>
  </div>
</body>
</html>
`;
  writeFileSync(join(root, "about.html"), html);
}

console.log("build ok:", data.projects.length, "project pages + index + about");
