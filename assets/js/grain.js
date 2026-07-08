/* Site-wide filmic film grain.
   A subtle monochrome grain rendered in WebGL and blended over the whole page
   with `mix-blend-mode: overlay`, so it modulates the underlying image the way
   real film grain does (more felt in the mid-tones, gentle in pure black/white).
   Animated at ~24fps for film cadence; static (single frame) under reduced-motion. */
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var canvas = document.createElement("canvas");
  canvas.id = "filmgrain";
  canvas.setAttribute("aria-hidden", "true");
  (function attach() {
    if (document.body) document.body.appendChild(canvas);
    else document.addEventListener("DOMContentLoaded", attach);
  })();

  var gl = canvas.getContext("webgl", { antialias: false, alpha: true, premultipliedAlpha: false }) ||
           canvas.getContext("experimental-webgl");
  if (!gl) { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); return; }

  var vsrc = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
  var fsrc =
    "precision highp float;uniform float uSeed;" +
    // decorrelated hash — the per-frame grain field
    "float hash(vec2 p){p=fract(p*vec2(5.3987,5.4421));p+=dot(p.yx,p.xy+vec2(21.5351,14.3137));return fract(p.x*p.y*95.4307);}" +
    "void main(){" +
    "  vec2 uv=gl_FragCoord.xy;" +
    // two taps at different scales → a softer, more filmic texture than raw static
    "  float n1=hash(uv+uSeed);" +
    "  float n2=hash(uv*0.5+uSeed*1.73);" +
    "  float n=mix(n1,n2,0.35);" +
    // centre at 0.5 so it is overlay-neutral; the deviation IS the grain
    "  gl_FragColor=vec4(vec3(0.5+(n-0.5)*0.8),1.0);" +
    "}";

  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; }
  var prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, vsrc));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fsrc));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { if (canvas.parentNode) canvas.parentNode.removeChild(canvas); return; }
  gl.useProgram(prog);

  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  var uSeed = gl.getUniformLocation(prog, "uSeed");

  function resize() {
    // render at CSS-pixel resolution (grain ends up ~1 CSS px → filmic, and cheaper)
    var w = Math.max(2, Math.floor(window.innerWidth));
    var h = Math.max(2, Math.floor(window.innerHeight));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
  function draw() {
    gl.uniform1f(uSeed, Math.random() * 1000.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  window.addEventListener("resize", resize);
  draw();

  if (!reduce) {
    var last = 0, frame = 1000 / 24; // film cadence
    (function loop(now) {
      if (now - last >= frame) { last = now; resize(); draw(); }
      requestAnimationFrame(loop);
    })(0);
  }
})();
