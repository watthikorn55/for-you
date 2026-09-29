// ชื่อไฟล์รูปดอกไม้ (ไฟล์ไหนหาไม่เจอ โค้ดจะข้ามให้เอง
// ถ้าไม่เจอสักไฟล์ โค้ดจะวาดดอกไม้ให้เองแทน)
const IMAGES = [
  'flowers/f1.png',
  'flowers/f2.png',
  'flowers/f3.png',
  'flowers/f4.png'
];

// ตรวจเครื่องช้า/มือถือ แล้วลดภาระอัตโนมัติ
const LOW = innerWidth < 900 || (navigator.hardwareConcurrency || 8) <= 6;
const MAX_IMG = LOW ? 280 : 400;
const DENSITY = LOW ? 0.75 : 1;

// จังหวะเวลา (มิลลิวินาที) ปรับได้ตรงนี้
const T_BLOOM_DONE = 2600;   // ดอกไม้บานครบ
const T_FADE_START = 3000;   // เริ่มจางหาย
const T_FADE_END   = 3900;   // จางหมด แล้วลบทิ้ง
const T_MESSAGE    = 3400;   // ข้อความขึ้น

const garden  = document.getElementById('garden');
const message = document.getElementById('message');
const gift    = document.getElementById('gift-section');
const box     = document.querySelector('.gift-box');
const bg      = document.querySelector('.bg');

// โหลดรูป -> ย่อขนาดด้วย canvas
const VALID = [];
function loadShrunk(src) {
  return new Promise(done => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, MAX_IMG / Math.max(im.naturalWidth, im.naturalHeight));
      const w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(im, 0, 0, w, h);
      cv.toBlob(blob => {
        const url = blob ? URL.createObjectURL(blob) : src;
        const small = new Image();
        small.src = url;
        small.decode().catch(() => {}).then(() => { VALID.push(url); done(); });
      }, 'image/webp', 0.92);
    };
    im.onerror = () => { console.warn('โหลดรูปไม่ได้:', src); done(); };
    im.src = src;
  });
}
const imagesReady = Promise.all(IMAGES.map(loadShrunk));

// ===== ดอกไม้สำรอง: วาดเองด้วย canvas (ใช้เมื่อไม่มีไฟล์รูป) =====
function makeFlower(petal, mid, n) {
  const c = document.createElement('canvas'); c.width = c.height = 240;
  const g = c.getContext('2d'); g.translate(120, 120);
  for (let i = 0; i < n; i++) {
    g.save(); g.rotate(i * 6.283 / n);
    const gr = g.createRadialGradient(0, -55, 5, 0, -55, 55);
    gr.addColorStop(0, mid); gr.addColorStop(1, petal);
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, -55, 26, 55, 0, 0, 6.283); g.fill(); g.restore();
  }
  g.fillStyle = '#f3c76a'; g.beginPath(); g.arc(0, 0, 16, 0, 6.283); g.fill();
  return c.toDataURL('image/png');
}
function fallbackFlowers() {
  VALID.push(
    makeFlower('#ff8fab', '#ffe0e9', 8), makeFlower('#e0526f', '#ffb3c1', 6),
    makeFlower('#ffb38a', '#fff0dc', 7), makeFlower('#f7a8d0', '#ffffff', 9)
  );
}

function bloomGarden() {
  const W = innerWidth, H = innerHeight;

  const r0 = box.getBoundingClientRect();
  const ox = r0.left + r0.width / 2, oy = r0.top + r0.height / 2;
  const maxDist = Math.max(
    Math.hypot(ox, oy), Math.hypot(W - ox, oy),
    Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy)
  );

  const bouquet = document.createElement('div');
  bouquet.id = 'bouquet';

  const MAXSIZE = 320;
  const area = W * H;

 const LAYERS = [
  { n: 6,  mul: 2.1,  jit: .25, z: 0    },
  { n: 10, mul: 1.95, jit: .30, z: 1000 },
  { n: 15, mul: 1.8,  jit: .30, z: 2000 }
];

  const items = [];
  LAYERS.forEach((L, li) => {
    const sp = Math.min(Math.sqrt(area / (L.n * DENSITY)), MAXSIZE / L.mul);
    const rowH = sp * 0.866;
    let row = 0;
    for (let y = -sp * .5 + li * rowH * .4; y < H + sp * .5; y += rowH, row++) {
      let col = 0;
      const startX = -sp * .5 + (row % 2 ? sp / 2 : 0) - li * sp * .33;
      for (let x = startX; x < W + sp * .5; x += sp, col++) {
        const jx = x + (Math.random() - .5) * 2 * sp * L.jit;
        const jy = y + (Math.random() - .5) * 2 * sp * L.jit;
        const size = sp * L.mul * (0.85 + Math.random() * 0.3);
        items.push({
          x: jx, y: jy, size,
          d: Math.hypot(jx - ox, jy - oy),
          z: L.z + Math.floor(Math.random() * 900),
          idx: col + row * 2 + li * 3
        });
      }
    }
  });

  function pickImage(idx) {
    if (Math.random() < 0.25) return VALID[Math.floor(Math.random() * VALID.length)];
    return VALID[idx % VALID.length];
  }

  const frag = document.createDocumentFragment();
  items.forEach(it => {
    const el = document.createElement('div');
    el.className = 'flower';
    el.innerHTML = `<img src="${pickImage(it.idx)}" alt="" draggable="false">`;
    el.style.width = el.style.height = it.size + 'px';
    el.style.left = (it.x - it.size / 2) + 'px';
    el.style.top  = (it.y - it.size / 2) + 'px';
    el.style.zIndex = it.z;
    el.style.setProperty('--r', (Math.random() * 360) + 'deg');
    el.style.setProperty('--d', (0.3 + (it.d / (maxDist * 1.1)) * 1.3) + 's');
    frag.appendChild(el);
  });
  bouquet.appendChild(frag);
  garden.appendChild(bouquet);
  garden.classList.add('pink');

  requestAnimationFrame(() => requestAnimationFrame(() => bouquet.classList.add('go')));

  setTimeout(() => bouquet.classList.add('done'), T_BLOOM_DONE);

  setTimeout(() => {
    bouquet.classList.add('fadeout');
    garden.classList.remove('pink');
    garden.classList.add('clear');
  }, T_FADE_START);

  setTimeout(() => bouquet.remove(), T_FADE_END);
}

// ===== ฝุ่นทอง + หัวใจดาวตก =====
const fx = document.getElementById('fx'), ctx = fx.getContext('2d');
let P = [], F = [], S = [], fxRunning = false, nextShoot = 0;

const HUES = [345, 350, 42, 38, 330];   // กุหลาบเข้ม / ทอง / ไวน์

// ปรับความถี่/จำนวนดาวตกตรงนี้
const MAX_SHOOT   = LOW ? 9 : 18;        // จำนวนดาวตกบนจอพร้อมกันสูงสุด
const SHOOT_GAP   = [350, 650];          // เว้นช่วงยิงชุดถัดไป (ต่ำสุด, สุ่มเพิ่ม) มิลลิวินาที
const BURST_CHANCE = .35;                // โอกาสยิงเป็นชุดพร้อมกัน
const BURST_SIZE   = [2, 3];             // ขนาดชุด (ต่ำสุด, สุ่มเพิ่ม) => 2-4 ดวง

function sizeFx() {
  const d = Math.min(devicePixelRatio || 1, 2);
  fx.width = innerWidth * d; fx.height = innerHeight * d;
  ctx.setTransform(d, 0, 0, d, 0, 0);
}

// วาดรูปหัวใจ (s = ความกว้างโดยประมาณ)
function heart(x, y, s, rot) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s / 20, s / 20);
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-14, -2, -8, -14, 0, -6);
  ctx.bezierCurveTo(8, -14, 14, -2, 0, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ฝุ่นทอง
function mkDust(init) {
  return {
    x: Math.random() * innerWidth,
    y: init ? Math.random() * innerHeight : innerHeight + 10,
    r: Math.random() * 2.2 + .6,
    vy: .25 + Math.random() * .7,
    vx: (Math.random() - .5) * .3,
    ph: Math.random() * 6.28,
    hue: Math.random() < .75 ? 42 : 335
  };
}

// หัวใจลอยขึ้นช้า ๆ (ชั้นหลัง)
function mkFloat(init) {
  return {
    x: Math.random() * innerWidth,
    y: init ? Math.random() * innerHeight : innerHeight + 30,
    s: 10 + Math.random() * 16,
    vy: .3 + Math.random() * .5,
    ph: Math.random() * 6.28,
    rot: (Math.random() - .5) * .6,
    hue: HUES[Math.floor(Math.random() * HUES.length)]
  };
}

// หัวใจดาวตก พุ่งเฉียงลงซ้าย พร้อมหางแสง
function mkShoot() {
  const fromTop = Math.random() < .65;
  const sp = 6 + Math.random() * 6;
  const ang = (Math.PI * .72) + (Math.random() - .5) * .4;
  return {
    x: fromTop ? innerWidth * (.15 + Math.random() * 1) : innerWidth + 40,
    y: fromTop ? -40 : innerHeight * Math.random() * .7,
    vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
    s: 14 + Math.random() * 24,
    rot: Math.random() * 6.28, spin: (Math.random() - .5) * .08,
    hue: HUES[Math.floor(Math.random() * HUES.length)],
    trail: []
  };
}

// ยิงหลายดวง (กระจายตำแหน่งให้ดูเป็นฝูง)
function launch(n) {
  for (let k = 0; k < n && S.length < MAX_SHOOT; k++) {
    const p = mkShoot();
    p.x += Math.random() * 220;
    p.y -= Math.random() * 220;
    S.push(p);
  }
}

function tick(t) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, innerWidth, innerHeight);

  // 1) หัวใจลอยชั้นหลัง
  F.forEach((p, i) => {
    p.y -= p.vy; p.ph += .02; p.x += Math.sin(p.ph) * .5;
    if (p.y < -40) F[i] = mkFloat(false);
    const a = .18 + .22 * Math.abs(Math.sin(p.ph * 1.3));
    ctx.fillStyle = `hsla(${p.hue},70%,60%,${a})`;
    heart(p.x, p.y, p.s, p.rot + Math.sin(p.ph) * .25);
  });

  // 2) ฝุ่นทอง
  ctx.globalCompositeOperation = 'lighter';
  P.forEach((p, i) => {
    p.y -= p.vy; p.ph += .05; p.x += p.vx + Math.sin(p.ph) * .25;
    if (p.y < -10) P[i] = mkDust(false);
    const a = .3 + .7 * Math.abs(Math.sin(p.ph));
    ctx.fillStyle = `hsla(${p.hue},75%,68%,${a * .18})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 3.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = `hsla(${p.hue},85%,78%,${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
  });

  // 3) หัวใจดาวตก
  if (t > nextShoot) {
    if (Math.random() < BURST_CHANCE) {
      launch(BURST_SIZE[0] + Math.floor(Math.random() * BURST_SIZE[1]));
    } else {
      launch(1);
    }
    nextShoot = t + SHOOT_GAP[0] + Math.random() * SHOOT_GAP[1];
  }
  for (let i = S.length - 1; i >= 0; i--) {
    const p = S[i];
    p.x += p.vx; p.y += p.vy; p.rot += p.spin;
    p.trail.push({ x: p.x, y: p.y, r: p.rot });
    if (p.trail.length > (LOW ? 14 : 24)) p.trail.shift();

    // หางแสง
    ctx.globalCompositeOperation = 'lighter';
    const n = p.trail.length;
    p.trail.forEach((q, k) => {
      const f = k / n;
      ctx.fillStyle = `hsla(${p.hue},85%,65%,${f * .35})`;
      heart(q.x, q.y, p.s * (.25 + f * .7), q.r);
    });

    // รัศมีเรืองรอบตัว
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 2.4);
    g.addColorStop(0, `hsla(${p.hue},90%,70%,.55)`);
    g.addColorStop(1, `hsla(${p.hue},90%,60%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 2.4, 0, 6.283); ctx.fill();

    // ตัวหัวใจ
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `hsl(${p.hue},88%,72%)`;
    heart(p.x, p.y, p.s, p.rot);
    ctx.fillStyle = 'rgba(255,240,215,.75)';
    heart(p.x, p.y, p.s * .45, p.rot);

    if (p.x < -140 || p.y > innerHeight + 140) S.splice(i, 1);
  }

  requestAnimationFrame(tick);
}

function startFX() {
  if (fxRunning) return;
  fxRunning = true; sizeFx();
  bg.classList.add('show');                       // ให้หัวใจดวงใหญ่ปรากฏ
  P = Array.from({ length: LOW ? 45 : 90 }, () => mkDust(true));
  F = Array.from({ length: LOW ? 10 : 20 }, () => mkFloat(true));
  S = [];
  launch(LOW ? 5 : 8);                            // ฝูงแรกให้เห็นทันที
  nextShoot = performance.now() + 500;
  requestAnimationFrame(tick);
}
addEventListener('resize', () => { if (fxRunning) sizeFx(); });

// ===== เอฟเฟกต์หวาน ๆ ตอนคลิก/แตะ: หัวใจ+ประกายฟุ้ง =====
const SWEET = ['💖', '💗', '💕', '✨', '🌸', '💝', '⭐'];
function burst(x, y, n) {
  const ring = document.createElement('div');
  ring.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:20px;height:20px;margin:-10px;border-radius:50%;border:2px solid #ffb3c6;pointer-events:none;z-index:99`;
  document.body.appendChild(ring);
  ring.animate([{ transform: 'scale(.4)', opacity: 1 }, { transform: 'scale(4)', opacity: 0 }],
    { duration: 650, easing: 'ease-out' }).onfinish = () => ring.remove();
  for (let i = 0; i < n; i++) {
    const el = document.createElement('span');
    const a = Math.random() * 6.283, d = 40 + Math.random() * (n > 9 ? 170 : 90);
    el.textContent = SWEET[Math.floor(Math.random() * SWEET.length)];
    el.style.cssText = `position:fixed;left:${x}px;top:${y}px;font-size:${14 + Math.random() * 16}px;pointer-events:none;z-index:99`;
    document.body.appendChild(el);
    el.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d - 40}px)) scale(1.2) rotate(${(Math.random() - .5) * 90}deg)`, opacity: 0 }
    ], { duration: 800 + Math.random() * 600, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => el.remove();
  }
}
addEventListener('pointerdown', e => burst(e.clientX, e.clientY, 7));

// ===== เพลงกล่องดนตรีน่ารัก ๆ (สร้างเสียงเองด้วยโค้ด ไม่ต้องมีไฟล์เสียง) =====
let AC, master, musicOn = false;
const STEP = .36;   // ความเร็วเพลง (ยิ่งน้อยยิ่งเร็ว)
const MEL  = [76,79,84,79,76,79,81,79, 76,81,84,81,76,81,79,76,
              77,81,84,81,77,81,79,77, 74,79,83,79,74,79,72,0];
const BASS = [48, 45, 41, 43];
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function pluck(f, t, dur, vol) {
  [[1, vol], [2, vol * .25]].forEach(([mult, v]) => {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.value = f * mult;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + .01);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  });
}
function playPhrase() {
  const t0 = AC.currentTime + .05;
  MEL.forEach((m, i) => { if (m) pluck(hz(m), t0 + i * STEP, 1.2, .16); });
  BASS.forEach((m, b) => pluck(hz(m), t0 + b * 8 * STEP, 2.6, .2));
  setTimeout(playPhrase, MEL.length * STEP * 1000 - 60);
}
function startMusic() {
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = .9; master.connect(AC.destination);
    musicOn = true; playPhrase();
    const b = document.getElementById('mute'); b.style.display = 'block';
    b.onclick = e => {
      e.stopPropagation(); musicOn = !musicOn;
      master.gain.value = musicOn ? .9 : 0;
      b.textContent = musicOn ? '🔊' : '🔇';
    };
  } catch (e) { console.warn(e); }
}

// ===== ปุ่มเปิดคำอวยพร =====
document.getElementById('wishBtn').addEventListener('click', e => {
  const r = e.currentTarget.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, 26);
  setTimeout(() => burst(innerWidth / 2, innerHeight / 2, 22), 250);
  e.currentTarget.style.display = 'none';
  document.getElementById('wish').classList.add('show');
});

// ===== กดเปิดกล่องของขวัญ =====
gift.addEventListener('click', e => {
  gift.classList.add('open');
  startMusic();
  burst(e.clientX, e.clientY, 18);
  imagesReady.then(() => {
    if (!VALID.length) fallbackFlowers();   // ไม่มีไฟล์รูป -> ใช้ดอกไม้ที่วาดเอง
    try { bloomGarden(); } catch (err) { console.error(err); }
  });
  setTimeout(() => message.classList.add('show'), T_MESSAGE);
  setTimeout(startFX, T_FADE_START);
  setTimeout(() => gift.style.display = 'none', 1300);
}, { once: true });