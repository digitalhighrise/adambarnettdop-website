/* Home: a black film-grain preloader (WebGL) with a white progress bar that
   fills as the homepage assets load; once done it fades to reveal the reel.
   Then black cab plays and stays highlighted by default; hovering a project
   swaps the loop, leaving reverts to the default, clicking opens the project. */
(function () {
  /* =================== preloader =================== */
  var pre = document.getElementById("preloader");
  var fill = document.getElementById("preload-fill");
  var grainCanvas = document.getElementById("grain");
  var preDone = false, glStop = false, rafGrain = null;

  function stopGrain() { glStop = true; if (rafGrain) cancelAnimationFrame(rafGrain); }

  function endPreloader() {
    if (preDone || !pre) return;
    preDone = true;
    if (fill) fill.style.width = "100%";
    setTimeout(function () {
      pre.classList.add("done");
      setTimeout(function () {
        if (pre && pre.parentNode) pre.parentNode.removeChild(pre);
        stopGrain();
      }, 800);
    }, 220);
  }

  // animated film grain via WebGL (falls back to a plain black frame)
  (function initGrain() {
    if (!grainCanvas) return;
    var gl = grainCanvas.getContext("webgl") || grainCanvas.getContext("experimental-webgl");
    if (!gl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    function resize() {
      grainCanvas.width = Math.floor(innerWidth * dpr);
      grainCanvas.height = Math.floor(innerHeight * dpr);
      gl.viewport(0, 0, grainCanvas.width, grainCanvas.height);
    }
    resize();
    window.addEventListener("resize", resize);

    var vsrc = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
    var fsrc =
      "precision highp float;uniform float t;" +
      "float hash(vec2 v){v=fract(v*vec2(123.34,456.21));v+=dot(v,v+45.32);return fract(v.x*v.y);}" +
      "void main(){vec2 uv=gl_FragCoord.xy;" +
      "float n=hash(uv*0.85+t);" +
      "float g=n*0.07;" +              // grain intensity on black (subtle)
      "gl_FragColor=vec4(vec3(g),1.0);}";

    function mk(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var prog = gl.createProgram();
    gl.attachShader(prog, mk(gl.VERTEX_SHADER, vsrc));
    gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, fsrc));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uT = gl.getUniformLocation(prog, "t");

    var frame = 0;
    function draw() {
      if (glStop) return;
      frame++;
      gl.uniform1f(uT, frame * 1.37);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafGrain = requestAnimationFrame(draw);
    }
    draw();
  })();

  // preload the homepage assets and drive the white bar to 100%
  (function preload() {
    var linkEls = document.querySelectorAll(".projlist a.proj");
    var assets = [];
    linkEls.forEach(function (a) {
      var slug = a.dataset.slug;
      if (!slug) return;
      if (a.dataset.loop === "1") {
        assets.push({ url: "assets/loops/" + slug + ".mp4", type: "video" });
        assets.push({ url: "assets/posters/" + slug + ".jpg", type: "img" });
      } else if (a.dataset.stills) {
        assets.push({ url: a.dataset.stills.split(",")[0], type: "img" });
      }
    });
    assets.push({ url: "assets/wpa.webp", type: "img" });

    var total = assets.length || 1, loaded = 0;
    function bump() {
      loaded++;
      if (fill) fill.style.width = Math.min(100, Math.round((loaded / total) * 100)) + "%";
      if (loaded >= total) endPreloader();
    }
    assets.forEach(function (a) {
      var counted = false;
      function finish() { if (counted) return; counted = true; bump(); }
      if (a.type === "video") {
        var v = document.createElement("video");
        v.muted = true; v.preload = "auto"; v.src = a.url;
        v.addEventListener("loadeddata", finish, { once: true });
        v.addEventListener("canplaythrough", finish, { once: true });
        v.addEventListener("error", finish, { once: true });
      } else {
        var im = new Image();
        im.onload = finish; im.onerror = finish; im.src = a.url;
      }
      setTimeout(finish, 9000); // per-asset safety
    });
    window.addEventListener("load", function () { setTimeout(endPreloader, 600); });
    setTimeout(endPreloader, 14000); // absolute safety — never trap the user
  })();

  /* =================== "selected work" expander =================== */
  var sectionToggles = document.querySelectorAll(".worktoggle");
  function closeAllSections() {
    sectionToggles.forEach(function (o) {
      o.setAttribute("aria-expanded", "false");
      var l = o.nextElementSibling;
      if (l && l.classList.contains("collapse")) l.classList.remove("open");
    });
  }
  sectionToggles.forEach(function (t) {
    var list = t.nextElementSibling; // the collapsible list right after this label
    if (!list || !list.classList.contains("collapse")) return;
    var toggleSection = function () {
      var willOpen = !list.classList.contains("open");
      closeAllSections();            // accordion: opening one closes the others
      if (willOpen) {
        list.classList.add("open");
        t.setAttribute("aria-expanded", "true");
      }
    };
    t.addEventListener("click", toggleSection);
    t.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSection(); }
    });
  });

  /* =================== background reel =================== */
  var bg = document.getElementById("bg");
  var hud = document.getElementById("hud");
  var hudText = document.getElementById("hud-text");
  var links = document.querySelectorAll(".projlist a.proj");
  if (!bg || !links.length) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var noHover = window.matchMedia("(hover: none)").matches;
  if (noHover) return; // touch layout shows inline thumbnails instead

  var layers = bg.querySelectorAll(".layer");
  var front = 0;            // which layer is visible
  var current = null;       // slug currently shown
  var slideTimer = null;
  var cache = {};           // slug -> prepared media element

  function makeVideo(slug) {
    var v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    v.poster = "assets/posters/" + slug + ".jpg";
    v.src = "assets/loops/" + slug + ".mp4";
    return v;
  }

  function makeImg(src) {
    var im = document.createElement("img");
    im.src = src;
    im.alt = "";
    return im;
  }

  function show(el) {
    var next = layers[1 - front];
    next.replaceChildren(el);
    if (el.tagName === "VIDEO" && !reduced) {
      el.currentTime = 0;
      var p = el.play();
      if (p) p.catch(function () {});
    }
    next.classList.add("on");
    layers[front].classList.remove("on");
    var prev = layers[front].querySelector("video");
    if (prev) prev.pause();
    front = 1 - front;
  }

  function stopSlides() {
    if (slideTimer) { clearInterval(slideTimer); slideTimer = null; }
  }

  function playBg(a) {
    var slug = a.dataset.slug;
    if (a.dataset.loop === "1" && !reduced) {
      if (!cache[slug]) cache[slug] = makeVideo(slug);
      show(cache[slug]);
    } else {
      var stills = (a.dataset.stills || "").split(",").filter(Boolean);
      if (!stills.length) return;
      var i = 0;
      show(makeImg(stills[0]));
      if (stills.length > 1 && !reduced) {
        slideTimer = setInterval(function () {
          i = (i + 1) % stills.length;
          show(makeImg(stills[i]));
        }, 3000);
      }
    }
  }

  function enter(a) {
    var slug = a.dataset.slug;
    if (slug === current) return;
    current = slug;
    stopSlides();
    if (hud) {
      hud.classList.add("live");
      hudText.textContent = a.dataset.meta + " — " + a.dataset.title;
    }
    playBg(a);
  }

  var defaultLink = links[0]; // black cab — the resting selection

  function restToDefault() {
    stopSlides();
    current = defaultLink.dataset.slug;
    playBg(defaultLink);
    if (hud) {
      hud.classList.remove("live");
      hudText.textContent = hud.dataset.idle;
    }
  }

  // hover any project — but only commit once the pointer settles (>0.5s), so a
  // quick flick across the list doesn't churn the background
  document.querySelectorAll("a.proj").forEach(function (a) {
    var intent = null;
    a.addEventListener("mouseenter", function () {
      intent = setTimeout(function () { enter(a); }, 200);
    });
    a.addEventListener("mouseleave", function () {
      if (intent) { clearTimeout(intent); intent = null; }
    });
    a.addEventListener("focus", function () { enter(a); }); // keyboard: immediate
  });
  // leaving the list keeps the last project shown (no revert to the default)

  // start on the default background right away (plays behind the preloader)
  restToDefault();

  // warm the next few loops so hovering feels instant
  window.addEventListener("load", function () {
    var n = 0;
    links.forEach(function (a) {
      if (a.dataset.loop === "1" && n < 4) {
        if (!cache[a.dataset.slug]) cache[a.dataset.slug] = makeVideo(a.dataset.slug);
        n++;
      }
    });
  });
})();
