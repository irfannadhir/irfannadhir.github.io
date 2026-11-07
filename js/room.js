/* ==========================================================================
   Irfan Nadhir — Portfolio
   Ruangan 3D di hero (Three.js, tanpa build step).
   - Klik lampu belajar  → nyala/matikan ruangan + ganti tema light/dark.
   - Klik komputer       → kamera zoom ke monitor, terminal mengetik.
   Kalau WebGL / CDN gagal, terminal HTML di #heroVisual tetap tampil.
   ========================================================================== */

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const visual = document.getElementById("heroVisual");
const container = document.getElementById("room");
const tip = document.getElementById("roomTip");
const exitBtn = document.getElementById("roomExit");
const themeToggle = document.getElementById("themeToggle");
const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const C = {
  wall: 0xe2e8f0,
  floor: 0xa47e5c,
  desk: 0xf8fafc,
  steel: 0x334155,
  dark: 0x1e293b,
  darker: 0x0f172a,
  grn: 0x22c55e,
  blu: 0x60a5fa,
  pnk: 0xf472b6,
  ylw: 0xfbbf24,
  rug: 0x14532d,
};

/* ---------- Helpers ---------- */
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
}

function box(w, h, d, material, x, y, z, radius = 0) {
  const geo =
    radius > 0 ? new RoundedBoxGeometry(w, h, d, 3, radius) : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cyl(rTop, rBottom, h, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 28), material);
  mesh.position.set(x, y, z);
  return mesh;
}

// Silinder dari titik a ke titik b (untuk lengan lampu).
function rod(a, b, r, material) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 12), material);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

function canvasTexture(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const redraw = () => {
    draw(ctx, w, h);
    tex.needsUpdate = true;
  };
  redraw();
  return { tex, redraw };
}

// Mendekati target secara halus, tidak tergantung frame rate.
function approach(current, target, dt, speed) {
  if (reduceMotion) return target;
  return current + (target - current) * (1 - Math.exp(-speed * dt));
}

const lerp = THREE.MathUtils.lerp;

/* ---------- Terminal di layar monitor ---------- */
const SCREEN_W = 1024;
const SCREEN_H = 585;
const SCRIPT = [
  { cmd: "whoami" },
  { out: "Irfan Nadhir — Web Programmer", color: "#60a5fa" },
  { cmd: "cat stack.txt" },
  { out: "go · react · nextjs · nestjs · typescript", color: "#fbbf24" },
  { out: "php · mysql · postgresql · git", color: "#fbbf24" },
  { cmd: "cat lokasi.txt" },
  { out: "Kab. Tangerang, Indonesia" },
  { cmd: "./contact --email" },
  { out: "irfannadhir1@gmail.com", color: "#f472b6" },
];
const IDLE = [
  { text: "// sistem siap." },
  { text: "// klik monitor untuk membuka terminal", color: "#fbbf24" },
  { prompt: true, text: "" },
];

let lines = [];
let cursorOn = true;
let screenDirty = true;
let runId = 0;

function drawScreen(ctx, W, H) {
  ctx.fillStyle = "#0b1120";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, W, 48);
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(30 + i * 28, 24, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.fillStyle = "#94a3b8";
  ctx.font = "22px 'JetBrains Mono', monospace";
  ctx.fillText("irfan@portfolio: ~", 120, 32);

  ctx.font = "28px 'JetBrains Mono', monospace";
  let y = 104;
  lines.forEach((line, i) => {
    let x = 36;
    if (line.prompt) {
      ctx.fillStyle = "#22c55e";
      ctx.fillText("$", x, y);
      x += ctx.measureText("$ ").width;
    }
    ctx.fillStyle = line.color || (line.prompt ? "#f8fafc" : "#94a3b8");
    ctx.fillText(line.text, x, y);
    x += ctx.measureText(line.text).width;
    if (i === lines.length - 1 && cursorOn) {
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(x + 4, y - 24, 16, 30);
    }
    y += 44;
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, reduceMotion ? 0 : ms));

function showIdle() {
  runId += 1;
  lines = IDLE.map((l) => ({ ...l }));
  screenDirty = true;
}

async function playScript() {
  const id = ++runId;
  lines = [];
  for (const step of SCRIPT) {
    if (step.cmd) {
      const line = { prompt: true, text: "" };
      lines.push(line);
      for (const ch of step.cmd) {
        await wait(45);
        if (id !== runId) return;
        line.text += ch;
        screenDirty = true;
      }
      await wait(260);
    } else {
      lines.push({ text: step.out, color: step.color });
      screenDirty = true;
      await wait(120);
    }
    if (id !== runId) return;
  }
  lines.push({ prompt: true, text: "" });
  screenDirty = true;
}

/* ---------- Init ---------- */
function init() {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (err) {
    return; // tanpa WebGL: terminal HTML tetap tampil
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  /* ----- Ruangan: lantai + dua dinding (diorama isometrik) ----- */
  const floorTex = canvasTexture(512, 512, (ctx, W, H) => {
    const plank = 64;
    for (let i = 0; i < W / plank; i++) {
      const shade = 0.9 + ((i * 37) % 10) / 50;
      ctx.fillStyle = `rgb(${164 * shade}, ${126 * shade}, ${92 * shade})`;
      ctx.fillRect(i * plank, 0, plank, H);
      ctx.fillStyle = "rgba(60, 40, 25, 0.35)";
      ctx.fillRect(i * plank, 0, 2, H);
      ctx.fillRect(i * plank, ((i * 151) % H), plank, 2);
    }
  });
  const wallMat = mat(C.wall, { roughness: 0.95 });
  const floor = box(5, 0.25, 5, mat(0xffffff, { map: floorTex.tex }), 0, -0.125, 0);
  const backWall = box(5.2, 3.2, 0.2, wallMat, -0.1, 1.6, -2.6);
  const leftWall = box(0.2, 3.2, 5, wallMat, -2.6, 1.6, 0);
  backWall.userData.noCast = true;
  leftWall.userData.noCast = true;
  scene.add(floor, backWall, leftWall);

  scene.add(box(2.2, 0.02, 1.6, mat(C.rug, { roughness: 1 }), 0.25, 0.01, -0.85));

  // Jendela di dinding kiri: warna kaca ikut siang/malam.
  const windowGroup = new THREE.Group();
  windowGroup.position.set(-2.47, 1.9, 0.3);
  const frameMat = mat(C.desk);
  windowGroup.add(box(0.05, 1.3, 1.5, frameMat, 0, 0, 0));
  const glassMat = new THREE.MeshBasicMaterial({ color: 0xbae6fd, toneMapped: false });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.16), glassMat);
  glass.rotation.y = Math.PI / 2;
  glass.position.x = 0.03;
  windowGroup.add(glass);
  windowGroup.add(box(0.04, 1.16, 0.04, frameMat, 0.05, 0, 0));
  windowGroup.add(box(0.04, 0.04, 1.36, frameMat, 0.05, 0, 0));
  windowGroup.add(box(0.14, 0.05, 1.6, frameMat, 0.05, -0.67, 0));
  scene.add(windowGroup);

  // Rak buku di dinding belakang.
  const shelf = new THREE.Group();
  shelf.position.set(-0.6, 2.4, -2.37);
  shelf.add(box(1.1, 0.05, 0.26, mat(C.desk), 0, 0, 0));
  [C.grn, C.blu, C.pnk, C.ylw, C.steel, C.blu].forEach((color, i) => {
    const h = 0.22 + ((i * 7) % 4) * 0.03;
    shelf.add(box(0.08, h, 0.2, mat(color), -0.4 + i * 0.1, 0.025 + h / 2, 0));
  });
  scene.add(shelf);

  // Poster di dinding belakang.
  const posterTex = canvasTexture(512, 340, (ctx, W, H) => {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 150px 'JetBrains Mono', monospace";
    ctx.fillText("</>", W / 2, 200);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "36px 'JetBrains Mono', monospace";
    ctx.fillText("~/irfan", W / 2, 280);
  });
  scene.add(box(0.96, 0.66, 0.03, mat(C.dark), 1.35, 2.45, -2.485));
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.6),
    new THREE.MeshStandardMaterial({ map: posterTex.tex, roughness: 0.6 })
  );
  poster.position.set(1.35, 2.45, -2.465);
  scene.add(poster);

  /* ----- Meja ----- */
  const deskTop = 1.0;
  const desk = new THREE.Group();
  desk.add(box(2.6, 0.08, 1.0, mat(C.desk, { roughness: 0.6 }), 0.2, deskTop - 0.04, -1.95, 0.02));
  const legMat = mat(C.steel, { metalness: 0.4, roughness: 0.5 });
  [-1.0, 1.4].forEach((x) =>
    [-1.55, -2.35].forEach((z) => desk.add(box(0.07, deskTop - 0.08, 0.07, legMat, x, (deskTop - 0.08) / 2, z)))
  );
  scene.add(desk);

  // Mug & tumpukan buku di meja.
  scene.add(cyl(0.06, 0.055, 0.13, mat(C.pnk), 1.1, deskTop + 0.065, -1.75));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 8, 20), mat(C.pnk));
  handle.position.set(1.17, deskTop + 0.07, -1.75);
  scene.add(handle);
  [C.blu, C.ylw, C.grn].forEach((color, i) =>
    scene.add(box(0.34 - i * 0.03, 0.05, 0.24, mat(color), 1.3, deskTop + 0.025 + i * 0.05, -2.2, 0.01))
  );

  /* ----- Komputer (monitor, keyboard, mouse, CPU) ----- */
  const computer = new THREE.Group();
  const monitor = new THREE.Group();
  monitor.position.set(0.15, deskTop, -2.15);
  monitor.add(box(0.5, 0.03, 0.28, mat(C.dark), 0, 0.015, 0, 0.01));
  monitor.add(box(0.07, 0.45, 0.05, mat(C.dark), 0, 0.24, -0.06));
  monitor.add(box(1.5, 0.88, 0.06, mat(C.darker, { roughness: 0.4 }), 0, 0.7, 0, 0.02));

  const screenTex = canvasTexture(SCREEN_W, SCREEN_H, drawScreen);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.8),
    new THREE.MeshBasicMaterial({ map: screenTex.tex, toneMapped: false })
  );
  screen.position.set(0, 0.7, 0.032);
  screen.userData.noCast = true;
  monitor.add(screen);

  const screenGlow = new THREE.PointLight(0x7dd3fc, 2, 3.5, 2);
  screenGlow.position.set(0, 0.7, 0.45);
  monitor.add(screenGlow);
  computer.add(monitor);

  const keyboard = new THREE.Group();
  keyboard.position.set(0.12, deskTop, -1.62);
  keyboard.add(box(0.92, 0.035, 0.3, mat(C.dark), 0, 0.0175, 0, 0.012));
  const keys = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.046, 0.02, 0.046),
    mat(0xffffff, { roughness: 0.6 }),
    43
  );
  const dummy = new THREE.Object3D();
  const keyColor = new THREE.Color(0x475569);
  const accentColor = new THREE.Color(C.grn);
  let k = 0;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 14; c++) {
      dummy.position.set(-0.39 + c * 0.06, 0.045, -0.1 + r * 0.062);
      dummy.updateMatrix();
      keys.setMatrixAt(k, dummy.matrix);
      keys.setColorAt(k, (r * 14 + c) % 9 === 4 ? accentColor : keyColor);
      k++;
    }
  }
  dummy.position.set(0, 0.045, 0.086);
  dummy.scale.set(6.5, 1, 1);
  dummy.updateMatrix();
  keys.setMatrixAt(k, dummy.matrix);
  keys.setColorAt(k, keyColor);
  keyboard.add(keys);
  computer.add(keyboard);

  computer.add(box(0.36, 0.008, 0.3, mat(C.darker, { roughness: 1 }), 0.78, deskTop + 0.004, -1.62));
  computer.add(box(0.07, 0.03, 0.11, mat(0xe2e8f0), 0.78, deskTop + 0.023, -1.62, 0.014));

  computer.add(box(0.38, 0.85, 0.8, mat(C.dark, { roughness: 0.5 }), 1.95, 0.425, -2.0, 0.02));
  const ledMat = new THREE.MeshStandardMaterial({ color: C.grn, emissive: C.grn, emissiveIntensity: 2 });
  computer.add(box(0.02, 0.6, 0.012, ledMat, 2.04, 0.45, -1.597));
  scene.add(computer);

  /* ----- Kursi ----- */
  const chair = new THREE.Group();
  chair.position.set(0.25, 0, -0.95);
  chair.rotation.y = 0.3;
  const chairMat = mat(C.steel, { roughness: 0.7 });
  chair.add(cyl(0.28, 0.3, 0.05, mat(C.dark), 0, 0.06, 0));
  chair.add(cyl(0.03, 0.03, 0.45, legMat, 0, 0.3, 0));
  chair.add(box(0.62, 0.09, 0.56, chairMat, 0, 0.56, 0, 0.04));
  chair.add(box(0.56, 0.62, 0.07, chairMat, 0, 0.95, 0.27, 0.03));
  scene.add(chair);

  /* ----- Orang yang duduk di kursi (klik → kartu profil) ----- */
  const CHAIR_YAW = chair.rotation.y;
  const skinMat = mat(0xf3cfa6, { roughness: 0.7, emissive: 0x7a5236, emissiveIntensity: 0.2 });
  const shirtMat = mat(0x16a34a, { roughness: 0.85 });
  const pantsMat = mat(0x1e293b, { roughness: 0.9 });
  const hairMat = mat(0x1c1917, { roughness: 1 });
  const eyeMat = mat(0x0f172a);

  const person = new THREE.Group();
  chair.add(person);
  person.add(box(0.36, 0.14, 0.3, pantsMat, 0, 0.68, 0.04, 0.05));
  [-1, 1].forEach((s) => {
    person.add(box(0.14, 0.14, 0.46, pantsMat, s * 0.095, 0.68, -0.15, 0.05));
    person.add(box(0.13, 0.5, 0.13, pantsMat, s * 0.095, 0.4, -0.36, 0.04));
    person.add(box(0.13, 0.08, 0.22, mat(0xf8fafc), s * 0.095, 0.05, -0.41, 0.03));
  });
  const torso = box(0.42, 0.5, 0.25, shirtMat, 0, 0.98, 0.07, 0.07);
  torso.rotation.x = -0.06;
  person.add(torso);
  person.add(cyl(0.05, 0.055, 0.08, skinMat, 0, 1.26, 0.06));

  const headPivot = new THREE.Group();
  headPivot.position.set(0, 1.28, 0.06);
  headPivot.add(box(0.25, 0.28, 0.26, skinMat, 0, 0.15, 0, 0.07));
  headPivot.add(box(0.27, 0.11, 0.28, hairMat, 0, 0.27, 0.01, 0.05));
  headPivot.add(box(0.27, 0.2, 0.08, hairMat, 0, 0.18, 0.11, 0.03));
  [-1, 1].forEach((s) => {
    headPivot.add(box(0.03, 0.035, 0.01, eyeMat, s * 0.055, 0.16, -0.131));
    headPivot.add(box(0.03, 0.06, 0.05, skinMat, s * 0.13, 0.14, 0.01));
  });
  headPivot.add(box(0.03, 0.05, 0.03, skinMat, 0, 0.11, -0.135));
  person.add(headPivot);

  // Lengan: silinder satuan yang di-scale, supaya pose bisa berubah tiap frame.
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 12);
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpDir = new THREE.Vector3();
  function setLimb(mesh, a, b, r) {
    tmpDir.subVectors(b, a);
    const len = tmpDir.length();
    mesh.position.copy(a).addScaledVector(tmpDir, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, tmpDir.divideScalar(len));
    mesh.scale.set(r, len, r);
  }
  const POSES = {
    typing: { elbow: [0.27, 0.93, -0.13], hand: [0.14, 1.04, -0.5] },
    rest: { elbow: [0.27, 0.92, 0.02], hand: [0.13, 0.78, -0.24] },
    wave: { elbow: [0.36, 1.12, -0.04], hand: [0.4, 1.42, -0.1] },
  };
  const arms = [-1, 1].map((s) => {
    const arm = {
      s,
      shoulder: new THREE.Vector3(s * 0.25, 1.18, 0.07),
      elbow: new THREE.Vector3(),
      hand: new THREE.Vector3(),
      upper: new THREE.Mesh(unitCyl, shirtMat),
      fore: new THREE.Mesh(unitCyl, shirtMat),
      palm: new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), skinMat),
    };
    person.add(arm.upper, arm.fore, arm.palm);
    return arm;
  });
  const poseVec = (p, s) => new THREE.Vector3(p[0] * s, p[1], p[2]);

  /* ----- Tanaman di pojok ----- */
  const plant = new THREE.Group();
  plant.position.set(-2.05, 0, -2.05);
  plant.add(cyl(0.22, 0.17, 0.42, mat(C.pnk), 0, 0.21, 0));
  plant.add(cyl(0.2, 0.2, 0.03, mat(0x3f2a1d, { roughness: 1 }), 0, 0.41, 0));
  const leafMat = mat(C.grn, { roughness: 0.6 });
  const leaves = [];
  for (let i = 0; i < 7; i++) {
    const pivot = new THREE.Group();
    pivot.position.y = 0.42;
    pivot.rotation.set(Math.sin(i * 2.4) * 0.35, i * 0.9, Math.cos(i * 2.4) * 0.35);
    const h = 0.55 + (i % 3) * 0.15;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.05, h, 8), leafMat);
    leaf.position.y = h / 2;
    leaf.scale.z = 0.4;
    pivot.add(leaf);
    plant.add(pivot);
    leaves.push(pivot);
  }
  scene.add(plant);

  /* ----- Lampu belajar (saklar tema) ----- */
  const lamp = new THREE.Group();
  lamp.position.set(-0.75, deskTop, -2.05);
  const lampMat = mat(C.ylw, { roughness: 0.45, metalness: 0.2 });
  const pA = new THREE.Vector3(0, 0.04, 0);
  const pJ = new THREE.Vector3(-0.06, 0.62, -0.16);
  const pH = new THREE.Vector3(0.16, 0.78, 0.18);
  const aimLocal = new THREE.Vector3(0.3, 0, 0.5);
  const aimDir = new THREE.Vector3().subVectors(aimLocal, pH).normalize();

  lamp.add(cyl(0.15, 0.16, 0.04, lampMat, 0, 0.02, 0));
  lamp.add(rod(pA, pJ, 0.018, lampMat));
  lamp.add(rod(pJ, pH, 0.018, lampMat));
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), lampMat);
  joint.position.copy(pJ);
  lamp.add(joint);

  const head = new THREE.Group();
  head.position.copy(pH);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aimDir);
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.2, 28, 1, true),
    mat(C.ylw, { roughness: 0.45, metalness: 0.2, side: THREE.DoubleSide })
  );
  shade.userData.noCast = true;
  head.add(shade);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), lampMat);
  cap.position.y = 0.1;
  cap.userData.noCast = true;
  head.add(cap);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff7e0, emissive: 0xffe2a8, emissiveIntensity: 0 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), bulbMat);
  bulb.position.y = -0.04;
  bulb.userData.noCast = true;
  head.add(bulb);
  lamp.add(head);

  const spot = new THREE.SpotLight(0xffd9a0, 0, 0, 0.8, 0.6, 2);
  spot.position.copy(pH).addScaledVector(aimDir, 0.06);
  spot.target.position.copy(aimLocal);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0005;
  spot.shadow.normalBias = 0.02;
  lamp.add(spot, spot.target);

  const lampFill = new THREE.PointLight(0xffd27a, 0, 5, 2);
  lampFill.position.copy(spot.position);
  lamp.add(lampFill);

  // Area klik tak terlihat: lengan lampu terlalu tipis untuk diklik/tap.
  const lampHitbox = box(0.5, 0.95, 0.6, new THREE.MeshBasicMaterial(), 0.05, 0.47, 0.02);
  lampHitbox.visible = false;
  lamp.add(lampHitbox);
  scene.add(lamp);

  /* ----- Pencahayaan ruangan ----- */
  const hemi = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 1);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff7ed, 0);
  sun.position.set(4, 7, 5);
  sun.target.position.set(0, 0, -0.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 20 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const moon = new THREE.DirectionalLight(0x93c5fd, 0);
  moon.position.set(-6, 4, 0.8);
  scene.add(moon);

  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.receiveShadow = true;
    obj.castShadow = !obj.userData.noCast;
  });

  const dayHemi = new THREE.Color(0xe0f2fe);
  const nightHemi = new THREE.Color(0x3b4a7a);
  const dayGlass = new THREE.Color(0xbae6fd);
  const nightGlass = new THREE.Color(0x172554);

  function applyLighting(t) {
    hemi.intensity = lerp(0.3, 1.1, t);
    hemi.color.lerpColors(nightHemi, dayHemi, t);
    sun.intensity = lerp(0, 2.2, t);
    moon.intensity = lerp(0.55, 0, t);
    spot.intensity = lerp(0, 7, t);
    lampFill.intensity = lerp(0, 0.8, t);
    bulbMat.emissiveIntensity = lerp(0, 3, t);
    screenGlow.intensity = lerp(2.2, 0.4, t);
    glassMat.color.lerpColors(nightGlass, dayGlass, t);
  }

  /* ----- Kamera: overview ↔ fokus ke monitor ----- */
  const VIEW_DIR = new THREE.Vector3(1, 0.72, 1).normalize();
  const ROOM_RADIUS = 3.6;
  const overviewTarget = new THREE.Vector3(0, 0.95, -0.2);
  const overviewPos = new THREE.Vector3();
  const screenWorld = new THREE.Vector3();
  const camRight = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), VIEW_DIR).normalize();
  const camUp = new THREE.Vector3().crossVectors(VIEW_DIR, camRight).normalize();
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  // Titik fokus kamera per mode: komputer (depan layar) & orang (orang di kiri, kartu di kanan).
  const views = {
    computer: { pos: new THREE.Vector3(), look: screenWorld },
    person: { pos: new THREE.Vector3(), look: new THREE.Vector3() },
  };

  function computeViews() {
    const vHalf = THREE.MathUtils.degToRad(camera.fov / 2);
    const hHalf = Math.atan(Math.tan(vHalf) * camera.aspect);
    overviewPos.copy(overviewTarget).addScaledVector(VIEW_DIR, ROOM_RADIUS / Math.sin(Math.min(vHalf, hHalf)));
    scene.updateMatrixWorld();
    screen.getWorldPosition(screenWorld);
    const dist = Math.max(0.5 / Math.tan(vHalf), 0.82 / Math.tan(hHalf));
    views.computer.pos.copy(screenWorld).add(new THREE.Vector3(0, 0, dist));

    // Layar sempit: kartu ada di bawah (lihat CSS), jadi orangnya digeser ke atas.
    const narrow = window.matchMedia("(max-width: 560px)").matches;
    views.person.look
      .set(chair.position.x, narrow ? 0.35 : 0.8, chair.position.z)
      .addScaledVector(camRight, narrow ? 0 : 0.8);
    views.person.pos.copy(views.person.look).addScaledVector(VIEW_DIR, 1.5 / Math.tan(vHalf));
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    computeViews();
  }

  /* ----- Interaksi: hover, klik lampu / komputer / orang ----- */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  lamp.traverse((o) => (o.userData.kind = "lamp"));
  computer.traverse((o) => (o.userData.kind = "computer"));
  chair.traverse((o) => (o.userData.kind = "person"));

  const TIPS = {
    computer: "🖥️ buka terminal",
    person: "👋 kenalan dengan Irfan",
  };

  const state = {
    light: root.getAttribute("data-theme") === "light" ? 1 : 0,
    mode: null, // null | "computer" | "person"
    view: "computer", // view kamera terakhir, dipakai juga saat kembali ke overview
    focus: 0,
    hovered: null,
    hoverLamp: 0,
    hoverPc: 0,
    hoverPerson: 0,
    press: 0,
    wave: 0,
    headYaw: 0,
    px: 0,
    py: 0,
    tx: 0,
    ty: 0,
  };

  function pick(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(scene.children, true)[0];
    return hit ? hit.object.userData.kind || null : null;
  }

  function setHover(kind, clientX, clientY) {
    state.hovered = state.mode ? null : kind;
    renderer.domElement.style.cursor = state.hovered ? "pointer" : "";
    if (!state.hovered) {
      tip.classList.remove("is-visible");
      return;
    }
    const isLight = root.getAttribute("data-theme") === "light";
    tip.textContent =
      state.hovered === "lamp" ? (isLight ? "💡 matikan lampu" : "💡 nyalakan lampu") : TIPS[state.hovered];
    const rect = container.getBoundingClientRect();
    tip.style.transform = `translate(${clientX - rect.left + 14}px, ${clientY - rect.top + 14}px)`;
    tip.classList.add("is-visible");
  }

  function enterFocus(mode) {
    state.mode = mode;
    state.view = mode;
    container.classList.add("is-focused");
    container.classList.toggle("is-person", mode === "person");
    setHover(null);
    if (mode === "computer") playScript();
    if (mode === "person") state.wave = 1;
  }

  function exitFocus() {
    if (state.mode === "computer") showIdle();
    state.mode = null;
    container.classList.remove("is-focused", "is-person");
  }

  const canvas = renderer.domElement;
  let downAt = null;

  canvas.addEventListener("pointermove", (e) => {
    const rect = canvas.getBoundingClientRect();
    state.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    state.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    if (e.pointerType === "mouse") setHover(pick(e.clientX, e.clientY), e.clientX, e.clientY);
  });

  canvas.addEventListener("pointerleave", () => {
    state.tx = 0;
    state.ty = 0;
    setHover(null);
  });

  canvas.addEventListener("pointerdown", (e) => {
    downAt = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
    downAt = null;
    const kind = pick(e.clientX, e.clientY);
    if (state.mode) {
      if (kind !== state.mode) exitFocus();
      else if (kind === "person") state.wave = 1;
      return;
    }
    if (kind === "lamp") {
      state.press = 1;
      themeToggle.click(); // main.js yang mengganti & menyimpan tema
      setHover("lamp", e.clientX, e.clientY);
    } else if (kind === "computer" || kind === "person") {
      enterFocus(kind);
    }
  });

  exitBtn.addEventListener("click", exitFocus);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.mode) exitFocus();
  });

  /* ----- Render loop (jeda saat tidak terlihat) ----- */
  const clock = new THREE.Clock();
  const FACE_YAW = Math.atan2(-VIEW_DIR.x, -VIEW_DIR.z); // kursi menghadap kamera
  const camLocal = new THREE.Vector3();
  let blinkTimer = 0;
  let elapsed = 0;

  function updatePerson(dt, turn) {
    // Kursi berputar menghadap kamera saat kartu profil dibuka.
    chair.rotation.y = lerp(CHAIR_YAW, FACE_YAW, turn);

    // Kepala menoleh ke kamera saat di-hover / diajak kenalan.
    let yawTarget = 0;
    if (state.hovered === "person" || state.mode === "person") {
      camLocal.copy(camera.position);
      person.worldToLocal(camLocal);
      yawTarget = THREE.MathUtils.clamp(Math.atan2(-camLocal.x, -camLocal.z), -1.1, 1.1);
    }
    state.headYaw = approach(state.headYaw, yawTarget, dt, 6);
    headPivot.rotation.y = state.headYaw;
    headPivot.rotation.x = lerp(0.1, 0, turn) + (reduceMotion ? 0 : Math.sin(elapsed * 1.3) * 0.03);
    torso.scale.y = 1 + (reduceMotion ? 0 : Math.sin(elapsed * 2) * 0.012);

    // Lengan: mengetik → tangan di paha; tangan kanan melambai saat menyapa.
    state.wave = Math.max(0, state.wave - dt / 2.2);
    const waveAmt = Math.min(1, state.wave * 3);
    arms.forEach((arm) => {
      const typing = poseVec(POSES.typing.elbow, arm.s);
      const typingHand = poseVec(POSES.typing.hand, arm.s);
      if (!reduceMotion) typingHand.y += Math.max(0, Math.sin(elapsed * 14 + arm.s * 1.7)) * 0.015;
      arm.elbow.lerpVectors(typing, poseVec(POSES.rest.elbow, arm.s), turn);
      arm.hand.lerpVectors(typingHand, poseVec(POSES.rest.hand, arm.s), turn);
      if (arm.s === 1 && waveAmt > 0) {
        const waveHand = poseVec(POSES.wave.hand, 1);
        if (!reduceMotion) waveHand.x += Math.sin(elapsed * 10) * 0.06;
        arm.elbow.lerp(poseVec(POSES.wave.elbow, 1), waveAmt);
        arm.hand.lerp(waveHand, waveAmt);
      }
      setLimb(arm.upper, arm.shoulder, arm.elbow, 0.055);
      setLimb(arm.fore, arm.elbow, arm.hand, 0.048);
      arm.palm.position.copy(arm.hand);
    });
  }

  function update(dt) {
    elapsed += dt;
    const lightTarget = root.getAttribute("data-theme") === "light" ? 1 : 0;
    state.light = approach(state.light, lightTarget, dt, 5);
    applyLighting(state.light);

    // Kamera
    state.focus = approach(state.focus, state.mode ? 1 : 0, dt, 3.2);
    const e = state.focus * state.focus * (3 - 2 * state.focus);
    const parallax = reduceMotion ? 0 : 1 - e;
    const view = views[state.view];
    state.px = approach(state.px, state.tx, dt, 3);
    state.py = approach(state.py, state.ty, dt, 3);
    tmpPos
      .copy(overviewPos)
      .addScaledVector(camRight, state.px * 0.9 * parallax)
      .addScaledVector(camUp, -state.py * 0.5 * parallax)
      .lerp(view.pos, e);
    tmpLook.copy(overviewTarget).lerp(view.look, e);
    camera.position.copy(tmpPos);
    camera.lookAt(tmpLook);

    // Efek hover & tekan lampu
    state.hoverLamp = approach(state.hoverLamp, state.hovered === "lamp" ? 1 : 0, dt, 12);
    state.hoverPc = approach(state.hoverPc, state.hovered === "computer" ? 1 : 0, dt, 12);
    state.hoverPerson = approach(state.hoverPerson, state.hovered === "person" ? 1 : 0, dt, 12);
    state.press = approach(state.press, 0, dt, 8);
    lamp.scale.set(1 + state.hoverLamp * 0.06, 1 + state.hoverLamp * 0.06 - state.press * 0.08, 1 + state.hoverLamp * 0.06);
    monitor.scale.setScalar(1 + state.hoverPc * 0.03);
    person.scale.setScalar(1 + state.hoverPerson * 0.03);

    updatePerson(dt, state.view === "person" ? e : 0);

    // Animasi kecil
    if (!reduceMotion) {
      ledMat.emissiveIntensity = 1.6 + Math.sin(elapsed * 2.2) * 0.8;
      leaves.forEach((leaf, i) => (leaf.rotation.x = Math.sin(i * 2.4) * 0.35 + Math.sin(elapsed * 1.2 + i) * 0.03));
    }

    blinkTimer += dt;
    if (blinkTimer > 0.5) {
      blinkTimer = 0;
      cursorOn = !cursorOn;
      screenDirty = true;
    }
    if (screenDirty) {
      screenDirty = false;
      screenTex.redraw();
    }
  }

  let running = false;
  let onScreen = true;

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    update(Math.min(clock.getDelta(), 0.05));
    renderer.render(scene, camera);
  }

  function setRunning() {
    const shouldRun = onScreen && !document.hidden;
    if (shouldRun === running) return;
    running = shouldRun;
    if (running) {
      clock.getDelta();
      frame();
    }
  }

  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    setRunning();
  }).observe(container);
  document.addEventListener("visibilitychange", setRunning);

  // Teks di kanvas memakai JetBrains Mono: gambar ulang setelah font siap.
  if (document.fonts) {
    document.fonts.load("28px 'JetBrains Mono'").then(() => {
      posterTex.redraw();
      screenDirty = true;
    });
  }

  showIdle();
  visual.classList.add("has-3d");
  resize();
  update(0);
  renderer.render(scene, camera);
  setRunning();
}

if (visual && container) init();
