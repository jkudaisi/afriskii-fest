import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer: coarse)').matches;

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!RM && window.Lenis) { lenis = new Lenis({ lerp: 0.09 }); const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); lenis ? lenis.scrollTo(0) : scrollTo(0, 0); }));

/* ---------- three (v2: physically based night) ---------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.25 : 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
renderer.shadowMap.enabled = !MOBILE;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const FOG0 = new THREE.Color(0x1d3354);
const fog = new THREE.FogExp2(FOG0.clone(), 0.0105); scene.fog = fog;
scene.background = new THREE.Color(0x0b1830);
const camera = new THREE.PerspectiveCamera(MOBILE ? 68 : 55, innerWidth / innerHeight, 0.1, 2000);
const TL = new THREE.TextureLoader();
const pmrem = new THREE.PMREMGenerator(renderer);
TL.load('assets/tex/sky.jpg', t => {
  t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t; scene.backgroundIntensity = 1.0;
  scene.environment = pmrem.fromEquirectangular(t).texture; scene.environmentIntensity = 0.55;
  scene.backgroundRotation && scene.backgroundRotation.set(0, Math.PI * 0.9, 0);
  scene.environmentRotation && scene.environmentRotation.set(0, Math.PI * 0.9, 0);
});
const texSuffix = MOBILE ? '_512' : '';
const snowTex = n => { const t = TL.load(`assets/tex/snow_${n}${texSuffix}.jpg`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(18, 40); t.anisotropy = MOBILE ? 2 : 8; if (n === 'diff') t.colorSpace = THREE.SRGBColorSpace; return t; };
const snowMat = new THREE.MeshStandardMaterial({ map: snowTex('diff'), normalMap: snowTex('nor'), roughnessMap: snowTex('rough'), normalScale: new THREE.Vector2(0.45, 0.45), color: 0xe6eef9, roughness: 1, metalness: 0 });

const LEN = 520;
const H = (x, z) => z * 0.42 + Math.sin(x * 0.05) * 3 + Math.cos(z * 0.03 + x * 0.02) * 4 + Math.sin(x * 0.21 + z * 0.17) * 0.35 + Math.abs(x) * Math.abs(x) * 0.004;
const pathX = z => Math.sin(z * 0.012) * 22;

// slope
const g = new THREE.PlaneGeometry(260, LEN + 220, MOBILE ? 90 : 180, MOBILE ? 180 : 340);
g.rotateX(-Math.PI / 2);
const p = g.attributes.position;
for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i) - LEN / 2 + 60; p.setZ(i, z); p.setY(i, H(x - pathX(z) * 0.6, z)); }
g.computeVertexNormals();
const slope = new THREE.Mesh(g, snowMat); slope.receiveShadow = true; scene.add(slope);

// distant ridges (atmospheric depth)
function ridge(w, d, amp, seed, y, z, x = 0) {
  const rg = new THREE.PlaneGeometry(w, d, MOBILE ? 60 : 120, MOBILE ? 20 : 40); rg.rotateX(-Math.PI / 2);
  const a = rg.attributes.position;
  for (let i = 0; i < a.count; i++) { const X = a.getX(i), Z = a.getZ(i); const e = Math.max(0, 1 - Math.abs(Z) / (d / 2)); a.setY(i, e * e * (amp * (0.6 + 0.4 * Math.sin(X * 0.004 + seed)) + Math.abs(Math.sin(X * 0.013 + seed * 3)) * amp * 0.5 + Math.sin(X * 0.05 + seed) * 6)); }
  rg.computeVertexNormals();
  const m = new THREE.Mesh(rg, snowMat); m.position.set(x, y, z); scene.add(m); return m;
}
ridge(2400, 300, 230, 1.3, -260, -880);
ridge(2000, 260, 160, 4.1, -220, -640, 200);
ridge(1600, 220, 120, 2.2, -120, 330, 0).rotation.y = Math.PI;

// pine trees: tiered silhouettes with snow loads
function pineGeo(snow) {
  const parts = []; const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const k = 1 - i / tiers, r = 0.6 + k * 1.9, h = 1.6 + k * 0.9;
    const c = new THREE.ConeGeometry(snow ? r * 0.82 : r, snow ? h * 0.35 : h, 9, 1, true);
    c.translate(0, 1.2 + i * 1.05 + (snow ? h * 0.32 : 0), 0);
    const pp = c.attributes.position; for (let j = 0; j < pp.count; j++) { const ang = Math.atan2(pp.getZ(j), pp.getX(j)); const jag = 1 + 0.18 * Math.sin(ang * 9 + i * 1.7); pp.setX(j, pp.getX(j) * jag); pp.setZ(j, pp.getZ(j) * jag); }
    parts.push(c);
  }
  if (!snow) { const tr = new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6); tr.translate(0, 0.8, 0); parts.push(tr); }
  return mergeGeometries(parts.map(x => x.toNonIndexed()), false);
}
const treeN = MOBILE ? 420 : 1100;
const needles = new THREE.InstancedMesh(pineGeo(false), new THREE.MeshStandardMaterial({ color: 0x1a2e22, roughness: 0.95, side: THREE.DoubleSide }), treeN);
const loads = new THREE.InstancedMesh(pineGeo(true), new THREE.MeshStandardMaterial({ color: 0xe9f1ff, roughness: 0.85, side: THREE.DoubleSide }), treeN);
needles.castShadow = !MOBILE; loads.castShadow = false; needles.receiveShadow = loads.receiveShadow = !MOBILE;
const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), eu = new THREE.Euler();
for (let i = 0; i < treeN; i++) {
  const z = 50 - Math.random() * (LEN + 100);
  const side = Math.random() < 0.5 ? -1 : 1; const off = side * (11 + Math.pow(Math.random(), 0.7) * 110);
  const x = pathX(z) + off; const k = 0.8 + Math.random() * 1.1;
  q.setFromEuler(eu.set((Math.random() - .5) * .06, Math.random() * 6.28, (Math.random() - .5) * .06));
  m4.compose(v.set(x, H(x - pathX(z) * 0.6, z) - 0.2, z), q, s.set(k, k * (0.85 + Math.random() * 0.6), k));
  needles.setMatrixAt(i, m4); loads.setMatrixAt(i, m4);
}
scene.add(needles, loads);

// moon + rim
const hemi = new THREE.HemisphereLight(0x8fb3e8, 0x1a2436, 0.35); scene.add(hemi);
const moon = new THREE.DirectionalLight(0xbcd4ff, 1.6);
moon.castShadow = !MOBILE; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04;
Object.assign(moon.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
scene.add(moon, moon.target);

// lodge with warm spill
function textSprite(txt, color, glow, w = 1024, h = 256, font = '900 150px Unbounded, sans-serif') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = glow; x.shadowBlur = 40; x.fillStyle = color;
  x.fillText(txt, w / 2, h / 2); x.fillText(txt, w / 2, h / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w / 40, h / 40), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
}
const wood = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.85 });
const warm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.62, 0.28).multiplyScalar(2.2), toneMapped: false });
const lodge = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(30, 10, 12), wood); body.position.y = 5; body.castShadow = body.receiveShadow = !MOBILE;
const roof = new THREE.Mesh(new THREE.CylinderGeometry(0, 21, 9, 4, 1), new THREE.MeshStandardMaterial({ color: 0xeef4ff, roughness: .9 }));
roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, .5); roof.position.y = 14.5; roof.castShadow = !MOBILE;
lodge.add(body, roof);
for (let i = -2; i <= 2; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.6), warm); w.position.set(i * 5.5, 5, 6.05); lodge.add(w); }
const word = textSprite('AFRISKII', '#eaf6ff', '#7fc4ff'); word.position.set(0, 24, 0); word.scale.setScalar(1.15); lodge.add(word);
lodge.position.set(0, H(0, 60) - 1, 60); lodge.rotation.y = Math.PI; scene.add(lodge);
const lodgeLight = new THREE.PointLight(0xffa04a, 220, 50, 2); lodgeLight.position.set(0, H(0, 50) + 4, 51); scene.add(lodgeLight);

// stop props
const stopZ = { bonfire: -110, pool: -200, apres: -290, gala: -380 };
const at = (z, dx = 0) => { const x = pathX(z) + dx; return new THREE.Vector3(x, H(x - pathX(z) * 0.6, z), z); };
const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const glow = (col, sc) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })); sp.scale.setScalar(sc); return sp; };
// bonfire
const fire = new THREE.Group(); fire.position.copy(at(stopZ.bonfire, -10));
for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.28, .32, 4, 7), wood); l.rotation.z = Math.PI / 2.7; l.rotation.y = i * Math.PI / 3.5; l.position.y = .9; l.castShadow = !MOBILE; fire.add(l); }
for (let i = 0; i < 10; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(.5, 0), new THREE.MeshStandardMaterial({ color: 0x55575c, roughness: 1 })); const a = i / 10 * 6.28; st.position.set(Math.cos(a) * 2.6, .2, Math.sin(a) * 2.6); fire.add(st); }
const flames = []; for (let i = 0; i < 6; i++) { const f = glow(i % 2 ? 0xffa53a : 0xff5a1f, 3.5 - i * .3); f.position.set((Math.random() - .5) * 1, 1.8 + i * .45, (Math.random() - .5) * 1); fire.add(f); flames.push(f); }
const sparks = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(90).map((_, i) => i % 3 === 1 ? Math.random() * 10 : (Math.random() - .5) * 2), 3)), new THREE.PointsMaterial({ color: 0xffb060, size: .18, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
fire.add(sparks);
const fireLight = new THREE.PointLight(0xff7a2f, 0, 45, 2); fireLight.position.y = 3; fireLight.castShadow = false; fire.add(fireLight);
scene.add(fire);
// pool: heated pool with steam
const poolPos = at(stopZ.pool, 12);
const deck = new THREE.Mesh(new THREE.BoxGeometry(28, 1, 18), new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: .7 })); deck.position.copy(poolPos).add(new THREE.Vector3(0, .2, 0)); deck.receiveShadow = !MOBILE; scene.add(deck);
const water = new THREE.Mesh(new THREE.PlaneGeometry(22, 12, 1, 1).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x0d8fb0, emissive: 0x06b6d8, emissiveIntensity: 1.2, roughness: .05, metalness: 0, clearcoat: 1, transparent: true, opacity: .92 }));
water.position.copy(poolPos).add(new THREE.Vector3(0, .75, 0)); scene.add(water);
const steam = []; for (let i = 0; i < 8; i++) { const st = glow(0x9fdcff, 7); st.material.opacity = .18; st.position.copy(water.position).add(new THREE.Vector3((Math.random() - .5) * 18, 1 + Math.random() * 2, (Math.random() - .5) * 8)); scene.add(st); steam.push(st); }
const poolLight = new THREE.PointLight(0x37d6ff, 0, 50, 2); poolLight.position.copy(poolPos).add(new THREE.Vector3(0, 3, 0)); scene.add(poolLight);
// apres lodge
const apres = new THREE.Group(); apres.position.copy(at(stopZ.apres, -15));
const ab = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 10), wood); ab.position.y = 4.5; ab.castShadow = !MOBILE; apres.add(ab);
const ar = new THREE.Mesh(new THREE.CylinderGeometry(0, 13, 6, 4, 1), new THREE.MeshStandardMaterial({ color: 0xeef4ff, roughness: .9 })); ar.rotation.y = Math.PI / 4; ar.scale.set(1, 1, .6); ar.position.y = 12; apres.add(ar);
const aw = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .35, .75).multiplyScalar(1.6), toneMapped: false })); aw.position.set(0, 4.5, 5.05); apres.add(aw);
const neon = textSprite('APRÈS', '#ff9be8', '#ff2fb0', 1024, 256, '900 170px Unbounded, sans-serif'); neon.scale.setScalar(.42); neon.position.set(0, 10.4, 5.4); apres.add(neon);
apres.rotation.y = .35; scene.add(apres);
const apresLight = new THREE.PointLight(0xff4fb8, 0, 45, 2); apresLight.position.copy(apres.position).add(new THREE.Vector3(0, 5, 10)); scene.add(apresLight);
// gala: string lights
const gala = new THREE.Group(); const gp = at(stopZ.gala);
const bulbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .82, .45).multiplyScalar(2.5), toneMapped: false });
for (let line = 0; line < (MOBILE ? 4 : 7); line++) { const z0 = gp.z + 24 - line * 8; const a = at(z0, -18), b = at(z0, 18); for (let i = 0; i <= 20; i++) { const t = i / 20; const pnt = a.clone().lerp(b, t); pnt.y += 7 - Math.sin(t * Math.PI) * 2.2; const bl = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), bulbMat); bl.position.copy(pnt); gala.add(bl); } }
scene.add(gala);
const galaLight = new THREE.PointLight(0xffd27a, 0, 70, 1.6); galaLight.position.copy(gp).add(new THREE.Vector3(0, 8, 0)); scene.add(galaLight);
const endZ = -LEN + 40;

// falling snow: 3 depth layers
const snowLayers = [];
[[MOBILE ? 700 : 1800, .16, 60], [MOBILE ? 400 : 1000, .32, 30], [MOBILE ? 80 : 160, .8, 12]].forEach(([n, size, spread]) => {
  const geo = new THREE.BufferGeometry(); const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = (Math.random() - .5) * spread * 2; arr[i * 3 + 1] = Math.random() * 40; arr[i * 3 + 2] = -Math.random() * spread * 1.6; }
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTex, color: 0xffffff, size, transparent: true, opacity: size > .5 ? .55 : .85, depthWrite: false, toneMapped: false }));
  pts.frustumCulled = false; scene.add(pts); snowLayers.push({ pts, n, speed: 1.5 + size * 4 });
});

// bloom (desktop)
let composer = null;
if (!MOBILE && !RM) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 0.85));
  composer.addPass(new OutputPass());
}

// path
const pts = []; for (let z = 40; z >= endZ; z -= 20) pts.push(new THREE.Vector3(pathX(z), 0, z));
const curve = new THREE.CatmullRomCurve3(pts);

/* palette keyframes: progress, fog color, exposure, moon intensity */
const KF = [
  [0.00, 0x1d3354, .95, 1.6],
  [0.18, 0x1a2e4e, .9, 1.6],
  [0.30, 0x2b2230, .85, 1.0],
  [0.45, 0x14364a, .9, 1.2],
  [0.60, 0x251a38, .85, 1.0],
  [0.74, 0x6a6458, 1.25, 1.4],
  [0.86, 0x1d3354, .95, 1.6],
  [1.00, 0x2a4470, 1.05, 1.8],
];
const cA = new THREE.Color(), cB = new THREE.Color();
function palette(t) {
  let i = 0; while (i < KF.length - 2 && t > KF[i + 1][0]) i++;
  const a = KF[i], b = KF[i + 1], k = THREE.MathUtils.smoothstep(t, a[0], b[0]);
  fog.color.copy(cA.setHex(a[1]).lerp(cB.setHex(b[1]), k));
  renderer.toneMappingExposure = a[2] + (b[2] - a[2]) * k;
  moon.intensity = a[3] + (b[3] - a[3]) * k;
  document.body.classList.toggle('lightbg', false);
}
const bump = (t, c, w) => Math.max(0, 1 - Math.abs(t - c) / w);

let target = 0, prog = 0;
const readScroll = () => { const max = document.documentElement.scrollHeight - innerHeight; target = max > 0 ? scrollY / max : 0; };
addEventListener('scroll', readScroll, { passive: true }); readScroll();

const look = new THREE.Vector3(), camPos = new THREE.Vector3();
const mouse = { x: 0, y: 0 };
addEventListener('pointermove', e => { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; }, { passive: true });
const skier = document.getElementById('skier');
const clock = new THREE.Clock();
const lodgeLook = lodge.position.clone().add(new THREE.Vector3(0, 30, 0));
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
  if (t < .1) { const k = THREE.MathUtils.smoothstep(1 - t / .1, 0, 1); camPos.lerp(v.set(0, H(0, 5) + 5, 5), k); look.lerp(lodgeLook, k); }
  camPos.y -= bump(t, .45, .07) * 2.5;
  const up = THREE.MathUtils.smoothstep(t, .86, 1);
  camPos.y += up * 60; camPos.z += up * 20; look.y += up * 50;
  camera.position.copy(camPos); camera.position.x += mouse.x * 2; camera.position.y -= mouse.y * 1.2;
  camera.lookAt(look); camera.rotation.z += carve * -.012;
  moon.position.set(camPos.x - 60, camPos.y + 90, camPos.z + 40); moon.target.position.set(camPos.x, camPos.y - 5, camPos.z - 30);
  palette(t);
  const fl = 0.8 + Math.sin(time * 17) * .1 + Math.sin(time * 7.3) * .1;
  fireLight.intensity = 900 * bump(t, .30, .14) * fl;
  flames.forEach((f, i) => { f.scale.setScalar((3.4 - i * .3) * (0.85 + Math.sin(time * 9 + i * 2) * .15)); f.position.x = Math.sin(time * 3 + i) * .2; });
  const sa = sparks.geometry.attributes.position; for (let i = 0; i < sa.count; i++) { let y = sa.getY(i) + dt * 2.5; if (y > 10) y = 1; sa.setY(i, y); } sa.needsUpdate = true;
  poolLight.intensity = 700 * bump(t, .45, .14);
  steam.forEach((st, i) => { st.position.y = water.position.y + 1 + ((time * .4 + i * .7) % 4); st.material.opacity = .2 * (1 - ((time * .4 + i * .7) % 4) / 4); });
  apresLight.intensity = 800 * bump(t, .60, .14);
  galaLight.intensity = 1400 * bump(t, .74, .14);
  if (!RM) snowLayers.forEach(L => { const a = L.pts.geometry.attributes.position; for (let i = 0; i < L.n; i++) { let y = a.array[i * 3 + 1] - dt * L.speed; if (y < -8) y = 32; a.array[i * 3 + 1] = y; a.array[i * 3] += Math.sin(time * .7 + i) * dt * .3; } a.needsUpdate = true; });
  snowLayers.forEach(L => { L.pts.position.copy(camera.position).add(v.set(0, -14, 0)); L.pts.rotation.y = Math.atan2(camera.position.x - look.x, camera.position.z - look.z); });
  if (skier) skier.style.left = (t * 100) + '%';
  gondola(t);
  composer ? composer.render() : renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer && composer.setSize(innerWidth, innerHeight); });


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

/* ---------- checkout (hand-off to Makena's Stripe checkout) ---------- */
const MK = 'https://makenaevents.com';
const TIERS = [
  { id: 'access', name: 'Après Ski All Access', note: 'Tier 1 · every party, no skiing', price: 255, url: MK + '/afriskii#all-access', qty: true },
  { id: 'ski', name: 'Ski & Snowboard Day Pass', note: 'Equipment, lift ticket and a lesson', price: 275, url: MK + '/afriskii#tickets', qty: true },
  { id: 'shared', name: 'Stay Slay · shared king', note: '4 nights + every event · $200 deposit to reserve', price: 850, url: MK + '/afriskii-snow-escape?room=shared', deposit: 200 },
  { id: 'private', name: 'Makena Snow Escape · private room', note: '4 nights + every event · $200 deposit to reserve', price: 1200, url: MK + '/afriskii-snow-escape?room=private', deposit: 200 },
];
const co = document.getElementById('co'), coList = document.getElementById('coList'), coTot = document.getElementById('coTot'), coFine = document.getElementById('coFine'), coGroup = document.getElementById('coGroup'), coGo = document.getElementById('coGo');
let sel = null, qty = 1;
const money = n => '$' + n.toLocaleString('en-US');
coList.innerHTML = TIERS.map(t => `<div class="co-row" data-id="${t.id}" role="radio" tabindex="0" aria-checked="false"><div><h4>${t.name}</h4><p>${t.note}</p></div><div class="pr">${money(t.price)}</div><div class="co-q" hidden><button type="button" data-d="-1" aria-label="Fewer">−</button><b>1</b><button type="button" data-d="1" aria-label="More">+</button><span>tickets</span></div></div>`).join('');
function coRender() {
  coList.querySelectorAll('.co-row').forEach(r => { const on = sel && r.dataset.id === sel.id; r.classList.toggle('on', !!on); r.setAttribute('aria-checked', on); const qq = r.querySelector('.co-q'); qq.hidden = !(on && sel.qty); qq.querySelector('b').textContent = qty; });
  if (!sel) { coTot.textContent = '$0'; coFine.textContent = 'Choose a pass to see the total.'; coGroup.textContent = ''; coGo.disabled = true; return; }
  const n = sel.qty ? qty : 1;
  coTot.textContent = money(sel.price * n);
  coFine.textContent = sel.deposit ? `Per person. Reserve with a ${money(sel.deposit)} non-refundable deposit, balance due Jan 1, 2027. Makena shows fees before you pay.` : `Before fees. Set quantity ${n} again on Makena's checkout.`;
  coGroup.textContent = n >= 3 ? 'Crew of 3+: 10% group discount. Ask the team for the group code.' : '';
  coGo.disabled = false; coGo.textContent = `Continue to secure checkout · ${sel.name.split(' ·')[0]}`;
}
coList.addEventListener('click', e => {
  const r = e.target.closest('.co-row'); if (!r) return;
  const d = e.target.closest('[data-d]');
  if (d) { qty = Math.max(1, Math.min(10, qty + +d.dataset.d)); }
  else { const t = TIERS.find(x => x.id === r.dataset.id); if (sel !== t) { sel = t; qty = 1; } }
  coRender();
});
coList.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('co-row')) { e.preventDefault(); e.target.click(); } });
function openCo(id) { if (id) { sel = TIERS.find(x => x.id === id) || null; qty = Math.max(1, Math.min(10, typeof n === 'number' && n >= 3 && sel && sel.qty ? n : 1)); } coRender(); co.hidden = false; lenis && lenis.stop(); document.body.style.overflow = 'hidden'; setTimeout(() => co.querySelector('.co-x').focus(), 50); }
function closeCo() { co.hidden = true; lenis && lenis.start(); document.body.style.overflow = ''; }
co.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeCo));
addEventListener('keydown', e => { if (e.key === 'Escape' && !co.hidden) closeCo(); });
coGo.addEventListener('click', () => { if (sel) window.open(sel.url, '_blank', 'noopener'); });
document.querySelectorAll('[data-checkout]').forEach(b => b.addEventListener('click', () => openCo(null)));
document.getElementById('clippedBuy').addEventListener('click', () => openCo(document.querySelector('.pass.picked')?.dataset.tier));
document.querySelectorAll('.pass').forEach(p => p.querySelector('.clipbtn').addEventListener('click', () => { document.querySelectorAll('.pass').forEach(x => x.classList.remove('picked')); p.classList.add('picked'); }));
