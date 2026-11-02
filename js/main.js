import * as THREE from 'three';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!RM && window.Lenis) { lenis = new Lenis({ lerp: 0.09 }); const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); lenis ? lenis.scrollTo(0) : scrollTo(0, 0); }));

/* ---------- three ---------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const fog = new THREE.FogExp2(0x0a1630, 0.012); scene.fog = fog;
scene.background = new THREE.Color(0x0a1630);
const camera = new THREE.PerspectiveCamera(MOBILE ? 70 : 58, innerWidth / innerHeight, 0.1, 900);

const LEN = 520;
const H = (x, z) => z * 0.42 + Math.sin(x * 0.05) * 3 + Math.cos(z * 0.03 + x * 0.02) * 4 + Math.abs(x) * Math.abs(x) * 0.004;
const pathX = z => Math.sin(z * 0.012) * 22;

// slope
const g = new THREE.PlaneGeometry(240, LEN + 200, MOBILE ? 80 : 140, MOBILE ? 160 : 260);
g.rotateX(-Math.PI / 2);
const p = g.attributes.position;
for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i) - LEN / 2 + 60; p.setZ(i, z); p.setY(i, H(x - pathX(z) * 0.6, z)); }
g.computeVertexNormals();
const slope = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xeef6ff, roughness: 0.92, metalness: 0 }));
scene.add(slope);

// trees
const treeN = MOBILE ? 380 : 900;
const tg = new THREE.ConeGeometry(1.6, 6, 7); tg.translate(0, 3, 0);
const trees = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ color: 0x173b33, roughness: 1 }), treeN);
const capg = new THREE.ConeGeometry(1.0, 2.2, 7); capg.translate(0, 5.4, 0);
const caps = new THREE.InstancedMesh(capg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), treeN);
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
for (let i = 0; i < treeN; i++) {
  const z = 40 - Math.random() * (LEN + 80);
  let off = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 95);
  const x = pathX(z) + off;
  const k = 0.7 + Math.random() * 1.3;
  m4.compose(v.set(x, H(x - pathX(z) * 0.6, z) - 0.3, z), q, s.set(k, k * (0.9 + Math.random() * 0.5), k));
  trees.setMatrixAt(i, m4); caps.setMatrixAt(i, m4);
}
scene.add(trees, caps);

// lights
const hemi = new THREE.HemisphereLight(0x9cc8ff, 0x0a1630, 0.9); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xcfe3ff, 1.1); moon.position.set(-40, 80, 30); scene.add(moon);

// lodge + wordmark at top
function textSprite(txt, color, glow, w = 1024, h = 256, font = '900 150px Unbounded, sans-serif') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = glow; x.shadowBlur = 40; x.fillStyle = color;
  x.fillText(txt, w / 2, h / 2); x.fillText(txt, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w / 40, h / 40), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
}
const lodge = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 12), new THREE.MeshStandardMaterial({ color: 0x3b2516, roughness: .9 }));
body.position.y = 5;
const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 21, 9, 4, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }));
roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, .5); roof.position.y = 14.5;
lodge.add(body, roof);
for (let i = -2; i <= 2; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({ color: 0xffb35c })); w.position.set(i * 5.5, 5, 6.05); lodge.add(w); }
const word = textSprite('AFRISKII', '#eaf6ff', '#7fc4ff'); word.position.set(0, 24, 0); word.scale.setScalar(1.15); lodge.add(word);
lodge.position.set(0, H(0, 60) - 1, 60); lodge.rotation.y = Math.PI;
scene.add(lodge);
const lodgeLight = new THREE.PointLight(0xffa94d, 25, 30, 1.8); lodgeLight.position.set(0, H(0, 50) + 4, 50); scene.add(lodgeLight);

// stop props along the path
const stopZ = { bonfire: -110, pool: -200, apres: -290, gala: -380 };
const at = (z, dx = 0) => { const x = pathX(z) + dx; return new THREE.Vector3(x, H(x - pathX(z) * 0.6, z), z); };
// bonfire
const fire = new THREE.Group(); fire.position.copy(at(stopZ.bonfire, -10));
for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 4), new THREE.MeshStandardMaterial({ color: 0x4a2a14 })); l.rotation.z = Math.PI / 2.6; l.rotation.y = i * Math.PI / 3; l.position.y = .8; fire.add(l); }
const flames = []; for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.9 - i * .1, 3.4 - i * .3, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb03a : 0xff5a1f, transparent: true, opacity: .85, fog: false })); f.position.set((Math.random() - .5) * 1.2, 2.2, (Math.random() - .5) * 1.2); fire.add(f); flames.push(f); }
const fireLight = new THREE.PointLight(0xff7a2f, 0, 70, 1.4); fireLight.position.y = 4; fire.add(fireLight);
scene.add(fire);
// pool
const poolPos = at(stopZ.pool, 10);
const pool = new THREE.Mesh(new THREE.BoxGeometry(22, .4, 14), new THREE.MeshStandardMaterial({ color: 0x18c7e6, emissive: 0x0aa3c2, emissiveIntensity: .8, transparent: true, opacity: .85 }));
pool.position.copy(poolPos).add(new THREE.Vector3(0, .5, 0)); scene.add(pool);
const poolLight = new THREE.PointLight(0x3fe0ff, 0, 60, 1.4); poolLight.position.copy(poolPos).add(new THREE.Vector3(0, 4, 0)); scene.add(poolLight);
// apres lodge with neon
const apres = new THREE.Group(); apres.position.copy(at(stopZ.apres, -14));
const ab = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 10), new THREE.MeshStandardMaterial({ color: 0x2c1a10 })); ab.position.y = 4.5; apres.add(ab);
const aw = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ color: 0xff3fb0 })); aw.position.set(0, 4.5, 5.05); apres.add(aw);
const neon = textSprite('APRÈS', '#ff7fe0', '#ff2fb0', 1024, 256, '900 170px Unbounded, sans-serif'); neon.scale.setScalar(.45); neon.position.set(0, 11.5, 5.2); apres.add(neon);
apres.rotation.y = .35; scene.add(apres);
const apresLight = new THREE.PointLight(0xff3fb0, 0, 60, 1.4); apresLight.position.copy(apres.position).add(new THREE.Vector3(0, 6, 12)); scene.add(apresLight);
// gala: gold lanterns
const gala = new THREE.Group(); const gp = at(stopZ.gala);
for (let i = 0; i < (MOBILE ? 24 : 50); i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd877, fog: false })); const z = gp.z + 30 - Math.random() * 60, dx = (Math.random() - .5) * 60; const pp = at(z, dx); b.position.set(pp.x, pp.y + 4 + Math.random() * 10, pp.z); gala.add(b); }
scene.add(gala);
const galaLight = new THREE.PointLight(0xffd877, 0, 90, 1.2); galaLight.position.copy(gp).add(new THREE.Vector3(0, 10, 0)); scene.add(galaLight);
// gondola cable at the end
const endZ = -LEN + 40;

// snow in 3D
const SN = MOBILE ? 1500 : 4000; const sg = new THREE.BufferGeometry(); const sp = new Float32Array(SN * 3);
for (let i = 0; i < SN; i++) { sp[i * 3] = (Math.random() - .5) * 120; sp[i * 3 + 1] = Math.random() * 60; sp[i * 3 + 2] = (Math.random() - .5) * 120; }
sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
const snow3 = new THREE.Points(sg, new THREE.PointsMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })(), color: 0xffffff, size: MOBILE ? .35 : .28, transparent: true, opacity: .85, depthWrite: false }));
scene.add(snow3);

// path
const pts = []; for (let z = 40; z >= endZ; z -= 20) pts.push(new THREE.Vector3(pathX(z), 0, z));
const curve = new THREE.CatmullRomCurve3(pts);

/* palette keyframes (progress -> bg, hemi, fog) */
const KF = [
  [0.00, 0x0a1630, 0x9cc8ff, .012],
  [0.18, 0x0d1d40, 0x9cc8ff, .013],
  [0.30, 0x2a1210, 0xffb27a, .016],
  [0.45, 0x063247, 0x7fe8ff, .018],
  [0.60, 0x1c0a2e, 0xff8fe0, .016],
  [0.74, 0xf3ecdc, 0xfff0c8, .010],
  [0.86, 0x0e2350, 0xcfe3ff, .010],
  [1.00, 0x183a7a, 0xffe2c0, .006],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function palette(t) {
  let i = 0; while (i < KF.length - 2 && t > KF[i + 1][0]) i++;
  const a = KF[i], b = KF[i + 1], k = THREE.MathUtils.smoothstep(t, a[0], b[0]);
  scene.background.copy(cA.setHex(a[1]).lerp(cB.setHex(b[1]), k)); fog.color.copy(scene.background);
  hemi.color.copy(cA.setHex(a[2]).lerp(cB.setHex(b[2]), k)); fog.density = a[3] + (b[3] - a[3]) * k;
  const bright = scene.background.getHSL({}).l; document.body.classList.toggle('lightbg', bright > .6);
}
const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);

/* progress */
let target = 0, prog = 0;
const readScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; target = max > 0 ? scrollY / max : 0; };
addEventListener('scroll', readScroll, { passive: true }); readScroll();

const look = new THREE.Vector3(), camPos = new THREE.Vector3();
const mouse = { x: 0, y: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; }, { passive: true });
const skier = document.getElementById('skier');
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
  prog += (target - prog) * (RM ? 1 : Math.min(1, dt * 4));
  const t = Math.min(.999, prog);
  const runT = Math.min(1, t / 0.86);
  const c = curve.getPointAt(Math.min(.98, runT));
  const ahead = curve.getPointAt(Math.min(.999, runT + .03));
  const carve = Math.sin(runT * 40) * 2.2 * (1 - bump(t, 0, .06));
  camPos.set(c.x + carve, H(c.x * .4, c.z) + 4.2, c.z);
  look.set(ahead.x, H(ahead.x * .4, ahead.z) + 1.2, ahead.z);
  if (t < .1) { const k = THREE.MathUtils.smoothstep(1 - t / .1, 0, 1); camPos.lerp(new THREE.Vector3(0, H(0, 5) + 5, 5), k); look.lerp(lodge.position.clone().add(new THREE.Vector3(0, 30, 0)), k); }
  // pool dive
  const dive = bump(t, .45, .07); camPos.y -= dive * 3;
  // gondola: rise above at end
  const up = THREE.MathUtils.smoothstep(t, .86, 1);
  camPos.y += up * 60; camPos.z += up * 20; look.y += up * 50;
  camera.position.copy(camPos); camera.position.x += mouse.x * 2; camera.position.y -= mouse.y * 1.2;
  camera.lookAt(look);
  camera.rotation.z += carve * -.012;
  palette(t);
  fireLight.intensity = 140 * bump(t, .30, .12) * (0.85 + Math.sin(time * 18) * .15);
  flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(time * 10 + i * 2) * .25; });
  poolLight.intensity = 160 * bump(t, .45, .12);
  apresLight.intensity = 160 * bump(t, .60, .12);
  galaLight.intensity = 180 * bump(t, .74, .12);
  // snow follows camera
  const a = sg.attributes.position;
  if (!RM) for (let i = 0; i < SN; i++) { let y = a.array[i * 3 + 1] - dt * (3 + (i % 5)); if (y < -10) y = 50; a.array[i * 3 + 1] = y; a.array[i * 3] += Math.sin(time + i) * dt * .4; }
  a.needsUpdate = true; snow3.position.set(camPos.x, camPos.y - 20, camPos.z - 30);
  if (skier) skier.style.left = (t * 100) + '%';
  gondola(t);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

/* ---------- gondola DOM ---------- */
const cab = document.querySelector('.gondola .cab');
function gondola(t) { if (!cab) return; const k = THREE.MathUtils.smoothstep(t, .86, 1); cab.style.setProperty('--gx', (5 + k * 60) + '%'); cab.style.setProperty('--gy', (k * 60 * Math.tan(12 * Math.PI / 180) * 4) + 'px'); }

/* ---------- 2D push-able snow ---------- */
(() => {
  const c = document.getElementById('snow'), x = c.getContext('2d'); let w, h, dpr = Math.min(devicePixelRatio, 2);
  const N = RM ? 0 : (MOBILE ? 90 : 220), fl = [];
  const size = () => { w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); };
  size(); addEventListener('resize', size);
  for (let i = 0; i < N; i++) fl.push({ x: Math.random() * w, y: Math.random() * h, r: .8 + Math.random() * 2.4, vx: 0, vy: 0, s: .3 + Math.random() * .9 });
  const P = { x: -999, y: -999, px: -999, py: -999 };
  const mv = e => { P.px = P.x; P.py = P.y; P.x = e.clientX; P.y = e.clientY; };
  addEventListener('pointermove', mv, { passive: true }); addEventListener('pointerdown', mv, { passive: true });
  addEventListener('touchmove', e => { const t = e.touches[0]; mv({ clientX: t.clientX, clientY: t.clientY }); }, { passive: true });
  const loop = () => {
    x.clearRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.9)';
    const sx = P.x - P.px, sy = P.y - P.py;
    for (const f of fl) {
      const dx = f.x - P.x, dy = f.y - P.y, d2 = dx * dx + dy * dy;
      if (d2 < 14000) { const d = Math.sqrt(d2) || 1, k = (1 - d / 118) * 2.2; f.vx += dx / d * k + sx * .03; f.vy += dy / d * k + sy * .03; }
      f.vx *= .94; f.vy *= .94; f.x += f.vx + Math.sin(f.y * .01) * .3; f.y += f.vy + f.s;
      if (f.y > h + 5) { f.y = -5; f.x = Math.random() * w; } if (f.x < -5) f.x = w + 5; if (f.x > w + 5) f.x = -5; if (f.y < -10) f.y = h;
      x.beginPath(); x.arc(f.x, f.y, f.r, 0, 6.283); x.fill();
    }
    P.px = P.x; P.py = P.y; requestAnimationFrame(loop);
  };
  if (N) loop();
})();

/* ---------- countdown ---------- */
const T0 = new Date('2027-02-04T00:00:00-05:00').getTime();
const units = [...document.querySelectorAll('#clock b')];
const pad = n => String(n).padStart(2, '0');
function tick() { let d = Math.max(0, T0 - Date.now()) / 1000; const D = Math.floor(d / 86400); d -= D * 86400; const Hh = Math.floor(d / 3600); d -= Hh * 3600; const M = Math.floor(d / 60); const S = Math.floor(d - M * 60); [D, Hh, M, S].forEach((n, i) => { const s = i ? pad(n) : String(n); if (units[i].textContent !== s) units[i].textContent = s; }); }
tick(); setInterval(tick, 1000);

/* ---------- clips (manifest-driven; placeholders until footage is added) ---------- */
const icons = { bonfire: '🔥', pool: '🌊', apres: '🪩', gala: '🥂' };
fetch('assets/clips/clips.json').then(r => r.json()).catch(() => ({})).then(man => {
  document.querySelectorAll('.clip').forEach(fig => {
    const k = fig.dataset.clip, vid = fig.querySelector('video'), m = man[k];
    if (m && m.src) { vid.src = m.src; if (m.poster) vid.poster = m.poster; const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !RM) vid.play().catch(() => {}); else vid.pause(); }, { threshold: .25 }); io.observe(fig); }
    else { vid.remove(); const ph = document.createElement('div'); ph.className = 'ph'; ph.innerHTML = `<em>${icons[k]}</em>2026 footage<small>Clip by @jedit.jed goes here</small>`; fig.prepend(ph); }
  });
});

/* ---------- passes ---------- */
const ring = document.getElementById('ring'), clipped = document.getElementById('clipped'), cname = document.getElementById('clippedName');
document.querySelectorAll('.pass').forEach(p => p.querySelector('.clipbtn').addEventListener('click', () => {
  ring.classList.remove('on'); void ring.offsetWidth; ring.dataset.n = p.dataset.name; ring.classList.add('on');
  cname.textContent = p.dataset.name; clipped.hidden = false;
  if (window.gsap && !RM) gsap.fromTo(p, { y: 0 }, { y: -30, duration: .25, yoyo: true, repeat: 1, ease: 'power2.out' });
}));

/* ---------- crew ---------- */
const lift = document.getElementById('lift'), nEl = document.getElementById('crewN'), wEl = document.getElementById('crewWord'), msg = document.getElementById('crewMsg');
const faces = ['⛷️', '🏂', '🕺', '💃', '🧣', '🧤', '😎', '🥶', '🔥', '🎿'], cols = ['#2f6bff', '#ff3b5c', '#e8c46a', '#18c7e6', '#ff7a2f', '#9b5cff'];
let n = 1;
function renderCrew() {
  while (lift.children.length > n) lift.lastChild.remove();
  while (lift.children.length < n) { const i = lift.children.length; const d = document.createElement('div'); d.className = 'chair'; d.style.setProperty('--c', cols[i % cols.length]); d.innerHTML = `<div class="pole"></div><div class="seat">${faces[i % faces.length]}</div>`; lift.append(d); }
  nEl.textContent = n; wEl.textContent = n === 1 ? 'rider' : 'riders';
  if (n >= 3) { msg.textContent = `Crew of ${n} unlocked: 10% off for groups of 3+. Ask the team for the group code.`; msg.classList.add('win'); }
  else { msg.textContent = `Add ${3 - n} more to unlock the group discount.`; msg.classList.remove('win'); }
}
document.getElementById('plus').onclick = () => { n = Math.min(10, n + 1); renderCrew(); };
document.getElementById('minus').onclick = () => { n = Math.max(1, n - 1); renderCrew(); };
renderCrew();

/* ---------- reveals ---------- */
if (window.gsap && window.ScrollTrigger && !RM) {
  gsap.registerPlugin(ScrollTrigger);
  if (lenis) lenis.on('scroll', ScrollTrigger.update);
  gsap.utils.toArray('.card,.clip,.pass,.clock,.passes h2,.crew h2,.finale .snowy').forEach(el => gsap.from(el, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
  gsap.from('.hero .snowy span', { y: 120, opacity: 0, stagger: .12, duration: 1.2, ease: 'power4.out', delay: .2 });
}
