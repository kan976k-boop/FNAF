// =============================================
// OYUN DEĞİŞKENLERİ
// =============================================
let gameActive = false;
let power = 100;
let currentHour = 0;
let currentNight = 1;
let leftDoorClosed = false;
let rightDoorClosed = false;
let leftLightOn = false;
let rightLightOn = false;
let monitorOpen = false;
let selectedCamera = 1;
let doorCloseCount = 0;
let lightUseCount = 0;
let gameStartTime = 0;

// Animatronikler: pos = oda indexi (0-5)
// A=Freddy: 0→1→2(sol kapı), B=Bonnie: 4→1→3(sağ kapı), C=Chica: 5→4→1→3(sağ)
let animatronicA = { pos: 0, active: false, name: 'FREDDY' };
let animatronicB = { pos: 4, active: false, name: 'BONNIE' };
let animatronicC = { pos: 5, active: false, name: 'CHİCA' };

const pathA = [0, 1, 2];
const pathB = [4, 1, 3];
const pathC = [5, 4, 1, 3];

let gameOverTriggered = false;
let powerInterval = null, hourInterval = null, aiInterval = null;

// =============================================
// WEB AUDIO - AMBİYANS SESLERİ
// =============================================
let audioCtx = null;
let ambianceNode = null, heartbeatNode = null;

function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    startAmbiance();
  } catch(e) {
    document.getElementById('audio-status').textContent = '🔇 SES DEVRE DIŞI';
  }
}

function startAmbiance() {
  if (!audioCtx) return;
  // Düşük frekanslı uğultu
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(55, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(60, audioCtx.currentTime + 4);
  osc.frequency.linearRampToValueAtTime(52, audioCtx.currentTime + 8);

  filter.type = 'lowpass';
  filter.frequency.value = 200;

  gain.gain.setValueAtTime(0.04, audioCtx.currentTime);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  ambianceNode = { osc, gain };

  // Periyodik uğultu değişimi
  setInterval(() => {
    if (!audioCtx || !gameActive) return;
    const f = 50 + Math.random() * 20;
    osc.frequency.linearRampToValueAtTime(f, audioCtx.currentTime + 2);
  }, 4000);
}

function playDoorSound(close) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(close ? 180 : 220, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(close ? 80 : 300, audioCtx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.35);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.35);
}

function playLightSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

function playAlertSound() {
  if (!audioCtx) return;
  [0, 0.15, 0.3].forEach(t => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime + t);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + t + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(audioCtx.currentTime + t);
    osc.stop(audioCtx.currentTime + t + 0.1);
  });
}

function playJumpscareSound() {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(100, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(2000, audioCtx.currentTime + 0.3);
  osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.8);
  gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.8);
}

function startHeartbeatAudio() {
  if (!audioCtx || heartbeatNode) return;
  const beat = () => {
    if (!gameActive) { heartbeatNode = null; return; }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 60;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
    heartbeatNode = setTimeout(beat, 650);
  };
  beat();
}

function stopHeartbeatAudio() {
  if (heartbeatNode) { clearTimeout(heartbeatNode); heartbeatNode = null; }
}

// =============================================
// HIGHSCORE (localStorage)
// =============================================
function getBestNight() {
  try { return parseInt(localStorage.getItem('fnaf_best_night') || '0'); } catch(e) { return 0; }
}
function setBestNight(n) {
  try { localStorage.setItem('fnaf_best_night', String(n)); } catch(e) {}
}
function updateHighscoreDisplay() {
  const best = getBestNight();
  const el = document.getElementById('highscore-display');
  if (el) el.textContent = best > 0 ? `EN İYİ: GECE ${best} TAMAMLANDI` : 'EN İYİ SKOR: --';
}
function unlockNightButtons() {
  const best = getBestNight();
  if (best >= 1) document.getElementById('night-btn-2')?.classList.remove('locked');
  if (best >= 2) document.getElementById('night-btn-3')?.classList.remove('locked');
}

// =============================================
// STATIK GÜRÜLTÜ CANVAS
// =============================================
function initNoise() {
  const canvas = document.getElementById('noise-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  function drawNoise() {
    if (!gameActive) { requestAnimationFrame(drawNoise); return; }
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255 | 0;
      data[i] = v; data[i+1] = v; data[i+2] = v;
      data[i+3] = Math.random() * 55 | 0;
    }
    ctx.putImageData(imageData, 0, 0);
    requestAnimationFrame(drawNoise);
  }
  drawNoise();
}

// =============================================
// SVG ODA GÖRÜNTÜLERİ
// =============================================
function renderRoomSahne() {
  return `<svg viewBox="0 0 660 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:brightness(0.75) contrast(1.1)">
    <rect width="660" height="300" fill="#050a08"/>
    <rect y="220" width="660" height="80" fill="#0a0e0a"/>
    <line x1="0" y1="220" x2="660" y2="220" stroke="#1a2a1a" stroke-width="2"/>
    <rect x="80" y="140" width="500" height="80" fill="#080e08"/>
    <rect x="80" y="138" width="500" height="5" fill="#152015"/>
    <rect x="0" y="0" width="80" height="220" fill="#100808"/>
    <rect x="580" y="0" width="80" height="220" fill="#100808"/>
    <!-- Sahne ışıkları -->
    <ellipse cx="200" cy="140" rx="30" ry="8" fill="#ffee8808"/>
    <ellipse cx="460" cy="140" rx="30" ry="8" fill="#ffee8808"/>
    <circle cx="160" cy="20" r="8" fill="#ffee8820"/>
    <circle cx="330" cy="10" r="8" fill="#ffee8820"/>
    <circle cx="500" cy="20" r="8" fill="#ffee8820"/>
    <!-- Banner -->
    <rect x="160" y="25" width="340" height="30" fill="#0a100a" stroke="#152015" stroke-width="1"/>
    <text x="330" y="46" fill="#1a2a1a" font-size="14" font-family="monospace" text-anchor="middle">★ FAZBEAR ENTERTAİNMENT ★</text>
    <!-- Mikrofon -->
    <line x1="330" y1="140" x2="330" y2="80" stroke="#0d150d" stroke-width="4"/>
    <circle cx="330" cy="75" r="12" fill="#0d150d" stroke="#152015" stroke-width="1"/>
    <!-- Masa -->
    <rect x="220" y="185" width="220" height="35" fill="#0a100a" stroke="#152015" stroke-width="1"/>
  </svg>`;
}

function renderRoomSahneArka() {
  return `<svg viewBox="0 0 660 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:brightness(0.65) contrast(1.15)">
    <rect width="660" height="300" fill="#040607"/>
    <rect y="200" width="660" height="100" fill="#080a08"/>
    <rect x="50" y="160" width="60" height="50" fill="#0a0c0a" stroke="#121512" stroke-width="1"/>
    <rect x="120" y="175" width="45" height="35" fill="#0a0c0a" stroke="#121512" stroke-width="1"/>
    <rect x="550" y="155" width="70" height="55" fill="#0a0c0a" stroke="#121512" stroke-width="1"/>
    <rect x="380" y="140" width="80" height="70" fill="#0a0c0a" stroke="#121512" stroke-width="1"/>
    <!-- Raflar -->
    <line x1="0" y1="100" x2="200" y2="100" stroke="#151a15" stroke-width="3"/>
    <line x1="0" y1="70" x2="200" y2="70" stroke="#151a15" stroke-width="3"/>
    <rect x="10" y="70" width="30" height="30" fill="#0a0c0a"/>
    <rect x="50" y="70" width="20" height="30" fill="#0a0c0a"/>
    <!-- Direk -->
    <line x1="200" y1="0" x2="200" y2="200" stroke="#0d120d" stroke-width="3"/>
    <line x1="460" y1="0" x2="460" y2="200" stroke="#0d120d" stroke-width="3"/>
    <!-- Animatronik kafası -->
    <ellipse cx="330" cy="135" rx="32" ry="27" fill="#0d0707" stroke="#1a0a0a" stroke-width="1"/>
    <circle cx="315" cy="127" r="9" fill="#0a0303"/>
    <circle cx="345" cy="127" r="9" fill="#0a0303"/>
    <circle cx="315" cy="127" r="4" fill="#330000" opacity="0.7"/>
    <circle cx="345" cy="127" r="4" fill="#330000" opacity="0.7"/>
    <path d="M308 150 Q330 162 352 150" stroke="#150505" stroke-width="2" fill="none"/>
    <text x="330" y="195" fill="#0a1a0a" font-size="10" text-anchor="middle" font-family="monospace">BAKIMDA</text>
  </svg>`;
}

function renderRoomKoridor(side) {
  const flip = side === 'sag' ? 'transform="scale(-1,1) translate(-660,0)"' : '';
  return `<svg viewBox="0 0 660 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:brightness(0.6) contrast(1.2)">
    <g ${flip}>
    <rect width="660" height="300" fill="#030608"/>
    <polygon points="0,0 660,0 500,300 160,300" fill="#05090e"/>
    <polygon points="0,0 200,0 160,300 0,300" fill="#040607"/>
    <line x1="0" y1="0" x2="160" y2="300" stroke="#0d150d" stroke-width="1"/>
    <line x1="200" y1="0" x2="160" y2="300" stroke="#0d150d" stroke-width="1"/>
    <line x1="660" y1="0" x2="500" y2="300" stroke="#0d150d" stroke-width="1"/>
    <!-- Zemin ızgarası -->
    <line x1="160" y1="300" x2="280" y2="150" stroke="#0a100a" stroke-width="1" opacity="0.5"/>
    <line x1="320" y1="300" x2="330" y2="140" stroke="#0a100a" stroke-width="1" opacity="0.5"/>
    <line x1="500" y1="300" x2="380" y2="150" stroke="#0a100a" stroke-width="1" opacity="0.5"/>
    <!-- Lamba -->
    <rect x="290" y="0" width="80" height="15" fill="#0d150d"/>
    <polygon points="300,15 312,65 348,65 360,15" fill="#0a120a"/>
    <ellipse cx="330" cy="65" rx="30" ry="8" fill="#ffee8810"/>
    <!-- Uzak kapı çerçevesi -->
    <rect x="295" y="100" width="70" height="110" fill="#030506" stroke="#0a150a" stroke-width="1"/>
    </g>
  </svg>`;
}

function renderRoomMutfak() {
  return `<svg viewBox="0 0 660 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:brightness(0.65) contrast(1.2) hue-rotate(10deg)">
    <rect width="660" height="300" fill="#030a04"/>
    <rect y="220" width="660" height="80" fill="#040a05"/>
    <!-- Karo zemin -->
    <line x1="0" y1="220" x2="660" y2="220" stroke="#0d1a0d" stroke-width="1"/>
    <line x1="165" y1="220" x2="165" y2="300" stroke="#060d06" stroke-width="1"/>
    <line x1="330" y1="220" x2="330" y2="300" stroke="#060d06" stroke-width="1"/>
    <line x1="495" y1="220" x2="495" y2="300" stroke="#060d06" stroke-width="1"/>
    <!-- Tezgah -->
    <rect x="0" y="165" width="220" height="60" fill="#050a05"/>
    <rect x="440" y="165" width="220" height="60" fill="#050a05"/>
    <!-- Dolaplar -->
    <rect x="0" y="0" width="660" height="85" fill="#040a04"/>
    <line x1="110" y1="0" x2="110" y2="85" stroke="#060d06" stroke-width="1"/>
    <line x1="220" y1="0" x2="220" y2="85" stroke="#060d06" stroke-width="1"/>
    <line x1="440" y1="0" x2="440" y2="85" stroke="#060d06" stroke-width="1"/>
    <line x1="550" y1="0" x2="550" y2="85" stroke="#060d06" stroke-width="1"/>
    <!-- Pota/tencereler -->
    <ellipse cx="100" cy="165" rx="42" ry="16" fill="#0a100a" stroke="#0d150d" stroke-width="1"/>
    <ellipse cx="190" cy="165" rx="32" ry="13" fill="#0a100a" stroke="#0d150d" stroke-width="1"/>
    <ellipse cx="560" cy="165" rx="42" ry="16" fill="#0a100a" stroke="#0d150d" stroke-width="1"/>
    <!-- Pizza kutusu -->
    <rect x="255" y="100" width="150" height="85" fill="#0a0e05" stroke="#111808" stroke-width="1"/>
    <line x1="330" y1="100" x2="330" y2="185" stroke="#111808" stroke-width="1"/>
    <line x1="255" y1="142" x2="405" y2="142" stroke="#111808" stroke-width="1"/>
    <text x="330" y="132" fill="#0e1a06" font-size="9" text-anchor="middle" font-family="monospace">FREDDY'S PIZZA</text>
    <text x="330" y="165" fill="#0a1205" font-size="8" text-anchor="middle" font-family="monospace">OPEN 24H</text>
    <!-- Ses tespiti -->
    <text x="330" y="260" fill="#051205" font-size="9" text-anchor="middle" font-family="monospace">[ GÜRÜLTÜ TESPİT EDİLDİ ]</text>
  </svg>`;
}

function renderRoomArkaOda() {
  return `<svg viewBox="0 0 660 300" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;filter:brightness(0.5) contrast(1.3)">
    <rect width="660" height="300" fill="#020404"/>
    <rect y="200" width="660" height="100" fill="#030505"/>
    <!-- Yedek parça kasaları -->
    <rect x="80" y="75" width="90" height="125" rx="4" fill="#040806" stroke="#080e08" stroke-width="1"/>
    <rect x="490" y="80" width="90" height="120" rx="4" fill="#040806" stroke="#080e08" stroke-width="1"/>
    <rect x="200" y="120" width="60" height="80" rx="3" fill="#040806" stroke="#080e08" stroke-width="1"/>
    <rect x="400" y="130" width="60" height="70" rx="3" fill="#040806" stroke="#080e08" stroke-width="1"/>
    <!-- Duvardaki gizemli gözler -->
    <circle cx="260" cy="140" r="5" fill="#001800" opacity="0.9"/>
    <circle cx="400" cy="140" r="5" fill="#001800" opacity="0.9"/>
    <circle cx="260" cy="140" r="2" fill="#00aa00" opacity="0.5"/>
    <circle cx="400" cy="140" r="2" fill="#00aa00" opacity="0.5"/>
    <!-- Hasar görmüş kablo -->
    <path d="M0 120 Q100 115 150 130 Q180 140 200 120" stroke="#080e08" stroke-width="2" fill="none"/>
    <path d="M660 90 Q560 95 510 110 Q480 120 460 100" stroke="#080e08" stroke-width="2" fill="none"/>
    <!-- "ÇIKMAZ" işareti -->
    <rect x="280" y="60" width="100" height="25" fill="#080808" stroke="#151515" stroke-width="1"/>
    <text x="330" y="78" fill="#2a0000" font-size="10" text-anchor="middle" font-family="monospace">ÇIKMAZ</text>
    <text x="330" y="260" fill="#030803" font-size="9" text-anchor="middle" font-family="monospace">ERİŞİM KAPALI - YETKİ GEREKLİ</text>
    <!-- Karanlıkta belirsiz şekil -->
    <ellipse cx="330" cy="155" rx="28" ry="35" fill="#030805" opacity="0.6"/>
    <circle cx="320" cy="143" r="6" fill="#001500" opacity="0.7"/>
    <circle cx="340" cy="143" r="6" fill="#001500" opacity="0.7"/>
  </svg>`;
}

// =============================================
// EKRAN BAŞLATMA
// =============================================
function showNightSelect() {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('night-select-screen').classList.remove('hidden');
  updateHighscoreDisplay();
  unlockNightButtons();
}

function startGame(night = 1) {
  currentNight = night;
  document.getElementById('night-select-screen').classList.add('hidden');
  document.getElementById('start-screen').classList.add('hidden');
  gameActive = true;
  gameStartTime = Date.now();
  doorCloseCount = 0;
  lightUseCount = 0;
  initNoise();
  initAudio();
  startNight();
  showPhoneMessage();
}

function showPhoneMessage() {
  const msgs = [
    '📞 Merhaba! Burada önceki bekçi. Animatronikler gece farklı davranıyor... Kapıları kapat, ışıkları kullan, gücü idareli tut. İyi şanslar.',
    '📞 Gece 2... Şimdi daha agresifler. Özellikle mutfağı izle. Chica orada dolaşıyor. Ve ses duyarsan... kaçacak yer yok.',
    '📞 Gece 3. Neredeyse hiç güvenli kamera kalmadı. İçgüdülerine güven. Ve... özür dilerim.'
  ];
  const phone = document.getElementById('phone-msg');
  phone.textContent = msgs[Math.min(currentNight - 1, msgs.length - 1)];
  phone.classList.add('show');
  setTimeout(() => phone.classList.remove('show'), 9000);
}

function startNight() {
  power = 100;
  currentHour = 0;
  leftDoorClosed = false;
  rightDoorClosed = false;
  monitorOpen = false;
  gameOverTriggered = false;
  animatronicA = { pos: 0, active: false, name: 'FREDDY' };
  animatronicB = { pos: 4, active: false, name: 'BONNIE' };
  animatronicC = { pos: 5, active: false, name: 'CHİCA' };

  document.getElementById('night-display').textContent = `GECE ${currentNight} / SAAT 1`;

  powerInterval = setInterval(drainPower, 500);
  hourInterval = setInterval(advanceHour, 45000);
  // Gece zorluğuna göre AI hızı
  const aiSpeed = [7000, 5000, 3500][Math.min(currentNight - 1, 2)];
  aiInterval = setInterval(moveAnimatronics, aiSpeed);

  updateCameraView();
  updateClock();
  updateCamDots();
}

// =============================================
// GÜÇ SİSTEMİ
// =============================================
function drainPower() {
  if (!gameActive || gameOverTriggered) return;
  let drain = 0.18;
  if (leftDoorClosed) drain += 0.38;
  if (rightDoorClosed) drain += 0.38;
  if (leftLightOn) drain += 0.22;
  if (rightLightOn) drain += 0.22;
  if (monitorOpen) drain += 0.12;
  // Gece zorluğu güç tüketimini artırır
  drain *= (1 + (currentNight - 1) * 0.15);

  power = Math.max(0, power - drain);
  updatePowerDisplay();
  updateUsageDisplay(Math.ceil(drain / 0.18));
  if (power <= 0) powerOutage();
}

function updatePowerDisplay() {
  const p = Math.round(power);
  const el = document.getElementById('power-value');
  const bar = document.getElementById('power-bar');
  el.textContent = p + '%';
  bar.style.width = p + '%';
  if (p > 50) {
    el.className = 'hud-value';
    bar.style.background = 'linear-gradient(90deg, #00ff41, #33ff33)';
    bar.style.boxShadow = '0 0 8px rgba(0,255,65,0.5)';
  } else if (p > 25) {
    el.className = 'hud-value warning';
    bar.style.background = 'linear-gradient(90deg, #ff8c00, #ffaa33)';
    bar.style.boxShadow = '0 0 8px rgba(255,140,0,0.5)';
  } else {
    el.className = 'hud-value critical';
    bar.style.background = 'linear-gradient(90deg, #ff2222, #ff4444)';
    bar.style.boxShadow = '0 0 8px rgba(255,0,0,0.5)';
  }
}

function updateUsageDisplay(level) {
  for (let i = 1; i <= 5; i++) {
    const dot = document.getElementById('dot-' + i);
    if (dot) dot.className = 'usage-dot' + (i <= level ? ' on' : '');
  }
}

// =============================================
// SAAT
// =============================================
const hourLabels = ['12:00 AM','1:00 AM','2:00 AM','3:00 AM','4:00 AM','5:00 AM','6:00 AM'];

function advanceHour() {
  if (!gameActive || gameOverTriggered) return;
  currentHour++;
  updateClock();
  if (currentHour >= 6) winGame();
}

function updateClock() {
  document.getElementById('clock').textContent = hourLabels[Math.min(currentHour, 6)];
  document.getElementById('night-display').textContent = `GECE ${currentNight} / SAAT ${currentHour + 1}`;
}

// =============================================
// GÜÇ KESİNTİSİ
// =============================================
function powerOutage() {
  gameActive = false;
  clearAllIntervals();
  document.getElementById('power-outage-overlay').classList.add('fading');
  // Ampulü söndür
  document.getElementById('ceiling-light').style.opacity = '0';
  document.getElementById('ceiling-light-glow').style.opacity = '0';
  showAlert('!! GÜÇ KESİLDİ !!');
  setTimeout(() => triggerJumpscare(), 4000);
}

// =============================================
// KAPI
// =============================================
function toggleDoor(side) {
  if (!gameActive || power <= 0) return;
  playDoorSound(side === 'left' ? !leftDoorClosed : !rightDoorClosed);
  if (side === 'left') {
    leftDoorClosed = !leftDoorClosed;
    document.getElementById('left-door').classList.toggle('closed', leftDoorClosed);
    const btn = document.getElementById('left-door-btn');
    btn.classList.toggle('active', leftDoorClosed);
    btn.textContent = leftDoorClosed ? 'KAPALI' : 'KAPI';
    if (leftDoorClosed) doorCloseCount++;
  } else {
    rightDoorClosed = !rightDoorClosed;
    document.getElementById('right-door').classList.toggle('closed', rightDoorClosed);
    const btn = document.getElementById('right-door-btn');
    btn.classList.toggle('active', rightDoorClosed);
    btn.textContent = rightDoorClosed ? 'KAPALI' : 'KAPI';
    if (rightDoorClosed) doorCloseCount++;
  }
}

// =============================================
// IŞIK
// =============================================
function toggleLight(side, on) {
  if (!gameActive || power <= 0) return;
  if (on) { playLightSound(); lightUseCount++; }
  if (side === 'left') {
    leftLightOn = on;
    document.getElementById('left-light-effect').classList.toggle('lit', on);
    document.getElementById('left-light-btn').classList.toggle('light-active', on);
    if (on) checkAnimatronicVisibility('left');
    else document.getElementById('left-animatronic').classList.remove('visible');
  } else {
    rightLightOn = on;
    document.getElementById('right-light-effect').classList.toggle('lit', on);
    document.getElementById('right-light-btn').classList.toggle('light-active', on);
    if (on) checkAnimatronicVisibility('right');
    else document.getElementById('right-animatronic').classList.remove('visible');
  }
}

function checkAnimatronicVisibility(side) {
  const leftAnim = document.getElementById('left-animatronic');
  const rightAnim = document.getElementById('right-animatronic');
  if (side === 'left') {
    const present = animatronicA.pos === 2 || animatronicB.pos === 2 || animatronicC.pos === 2;
    leftAnim.classList.toggle('visible', present);
    if (present) { showAlert(`!! SOL TARAFTA ${getCorridorAnimName('left')} !!`); playAlertSound(); }
  } else {
    const present = animatronicA.pos === 3 || animatronicB.pos === 3 || animatronicC.pos === 3;
    rightAnim.classList.toggle('visible', present);
    if (present) { showAlert(`!! SAĞ TARAFTA ${getCorridorAnimName('right')} !!`); playAlertSound(); }
  }
}

function getCorridorAnimName(side) {
  if (side === 'left') {
    if (animatronicA.pos === 2) return 'FREDDY';
    if (animatronicB.pos === 2) return 'BONNIE';
    if (animatronicC.pos === 2) return 'CHİCA';
  } else {
    if (animatronicA.pos === 3) return 'FREDDY';
    if (animatronicB.pos === 3) return 'BONNIE';
    if (animatronicC.pos === 3) return 'CHİCA';
  }
  return 'BİLİNMEYEN';
}

// =============================================
// MONİTÖR
// =============================================
function toggleMonitor() {
  monitorOpen = !monitorOpen;
  document.getElementById('monitor-screen').classList.toggle('open', monitorOpen);
  document.getElementById('monitor-bar-text').textContent = monitorOpen ? '▼ MONİTÖR ▼' : '▲ MONİTÖR ▲';
  if (monitorOpen) updateCameraView();
}

function selectCamera(n) {
  selectedCamera = n;
  for (let i = 1; i <= 6; i++) {
    document.getElementById('cam-btn-' + i)?.classList.toggle('active', i === n);
  }
  updateCameraView();
}

const cameraRooms = {
  1: { label: 'CAM 1A - SAHNE', svg: null },
  2: { label: 'CAM 1B - SAHNE ARKA', svg: null },
  3: { label: 'CAM 1C - SOL KORİDOR', svg: null },
  4: { label: 'CAM 2A - SAĞ KORİDOR', svg: null },
  5: { label: 'CAM 3 - MUTFAK', svg: null },
  6: { label: 'CAM 4B - ARKA ODA', svg: null }
};

const roomRenderers = [
  null,
  renderRoomSahne,
  renderRoomSahneArka,
  () => renderRoomKoridor('sol'),
  () => renderRoomKoridor('sag'),
  renderRoomMutfak,
  renderRoomArkaOda
];

function updateCameraView() {
  const room = cameraRooms[selectedCamera];
  if (!room) return;
  document.getElementById('cam-label').textContent = room.label;
  const now = new Date();
  const ts = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  document.getElementById('cam-timestamp').textContent = 'REC ● ' + ts;

  const entity = document.getElementById('cam-entity');
  const roomSvg = roomRenderers[selectedCamera]?.() || '';
  const camPosMap = {1:0,2:1,3:2,4:3,5:4,6:5};
  const camPos = camPosMap[selectedCamera];
  const aHere = animatronicA.pos === camPos;
  const bHere = animatronicB.pos === camPos;
  const cHere = animatronicC.pos === camPos;
  let overlays = '';
  if (aHere) overlays += getAnimatronicCamSvg('A', -60);
  if (bHere) overlays += getAnimatronicCamSvg('B', 0);
  if (cHere) overlays += getAnimatronicCamSvg('C', 60);
  entity.innerHTML = roomSvg + (overlays ? `<div style="position:absolute;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">${overlays}</div>` : '');
}

function getAnimatronicCamSvg(type, offsetX) {
  const colors = { A: ['#ff3300','#cc0000'], B: ['#3333ff','#0000cc'], C: ['#ffaa00','#cc8800'] };
  const [c1, c2] = colors[type] || ['#ff0000','#cc0000'];
  return `<svg viewBox="0 0 160 220" style="width:80px;height:110px;position:absolute;left:calc(50% + ${offsetX}px);transform:translateX(-50%);opacity:0.75;filter:brightness(0.5) contrast(2);">
    <ellipse cx="80" cy="80" rx="50" ry="55" fill="#0a0505"/>
    <circle cx="58" cy="70" r="14" fill="${c2}" opacity="0.8"/>
    <circle cx="102" cy="70" r="14" fill="${c2}" opacity="0.8"/>
    <circle cx="58" cy="70" r="6" fill="${c1}"/>
    <circle cx="102" cy="70" r="6" fill="${c1}"/>
    <path d="M45 105 Q80 125 115 105" stroke="#1a0000" stroke-width="3" fill="none"/>
    <ellipse cx="80" cy="155" rx="38" ry="50" fill="#080505"/>
  </svg>`;
}

// =============================================
// ANİMATRONİK KONUM NOKTALARI (KAMERA HARİTASI)
// =============================================
const animPosToCam = {0:1, 1:2, 2:3, 3:4, 4:5, 5:6};

function updateCamDots() {
  // Tüm dot'ları temizle
  document.querySelectorAll('.anim-dot').forEach(d => d.remove());

  const addDot = (pos, cls) => {
    const camId = animPosToCam[pos];
    const btn = document.getElementById('cam-btn-' + camId);
    if (!btn) return;
    const dot = document.createElement('span');
    dot.className = `anim-dot ${cls}`;
    btn.appendChild(dot);
  };

  if (animatronicA.active || animatronicA.pos !== 0) addDot(animatronicA.pos, 'anim-dot-a');
  if (animatronicB.active || animatronicB.pos !== 4) addDot(animatronicB.pos, 'anim-dot-b');
  if (animatronicC.active || animatronicC.pos !== 5) addDot(animatronicC.pos, 'anim-dot-c');
}

// =============================================
// ANİMATRONİK YZ
// =============================================
function getMoveProbability() {
  const base = [0.1, 0.18, 0.28][Math.min(currentNight - 1, 2)];
  return base + currentHour * 0.04;
}

function moveAnimatronics() {
  if (!gameActive || gameOverTriggered) return;
  const prob = getMoveProbability();

  // Animatronik A (Freddy)
  if (!animatronicA.active && Math.random() < prob * 0.6) animatronicA.active = true;
  if (animatronicA.active && Math.random() < prob) {
    const idx = pathA.indexOf(animatronicA.pos);
    if (idx < pathA.length - 1) animatronicA.pos = pathA[idx + 1];
    if (animatronicA.pos === 2) checkDoorAttack('left', 'A');
  }

  // Animatronik B (Bonnie)
  if (!animatronicB.active && Math.random() < prob) animatronicB.active = true;
  if (animatronicB.active && Math.random() < prob) {
    const idx = pathB.indexOf(animatronicB.pos);
    if (idx < pathB.length - 1) animatronicB.pos = pathB[idx + 1];
    if (animatronicB.pos === 3) checkDoorAttack('right', 'B');
  }

  // Animatronik C (Chica) - Gece 2'den aktif
  if (currentNight >= 2) {
    if (!animatronicC.active && Math.random() < prob * 0.8) animatronicC.active = true;
    if (animatronicC.active && Math.random() < prob) {
      const idx = pathC.indexOf(animatronicC.pos);
      if (idx < pathC.length - 1) animatronicC.pos = pathC[idx + 1];
      if (animatronicC.pos === 3) checkDoorAttack('right', 'C');
    }
  }

  if (monitorOpen) updateCameraView();
  updateCamDots();
  updateStatusAndHeartbeat();
}

function checkDoorAttack(side, animId) {
  const doorClosed = side === 'left' ? leftDoorClosed : rightDoorClosed;
  if (!doorClosed) {
    setTimeout(() => {
      if (!gameOverTriggered && gameActive) triggerJumpscare();
    }, 1200);
  } else {
    // Geri döner
    const delay = 7000 + Math.random() * 5000;
    setTimeout(() => {
      if (animId === 'A') { animatronicA.pos = pathA[0]; animatronicA.active = false; }
      else if (animId === 'B') { animatronicB.pos = pathB[0]; animatronicB.active = false; }
      else { animatronicC.pos = pathC[0]; animatronicC.active = false; }
      updateCamDots();
    }, delay);
  }
}

function updateStatusAndHeartbeat() {
  const leftAnim = document.getElementById('left-animatronic');
  const rightAnim = document.getElementById('right-animatronic');
  if (!leftLightOn) leftAnim.classList.remove('visible');
  if (!rightLightOn) rightAnim.classList.remove('visible');

  const status = document.getElementById('status-text');
  const heartbeat = document.getElementById('heartbeat');
  const atLeft = animatronicA.pos === 2 || animatronicB.pos === 2 || animatronicC.pos === 2;
  const atRight = animatronicA.pos === 3 || animatronicB.pos === 3 || animatronicC.pos === 3;

  if (atLeft || atRight) {
    status.textContent = '!! TEHLİKE !!';
    status.className = 'hud-value critical';
    heartbeat.classList.add('show');
    startHeartbeatAudio();
  } else if (animatronicA.active || animatronicB.active || animatronicC.active) {
    status.textContent = 'HAREKET VAR';
    status.className = 'hud-value warning';
    heartbeat.classList.remove('show');
    stopHeartbeatAudio();
  } else {
    status.textContent = 'NORMAL';
    status.className = 'hud-value';
    heartbeat.classList.remove('show');
    stopHeartbeatAudio();
  }
}

// =============================================
// UYARI
// =============================================
function showAlert(text) {
  const alert = document.getElementById('alert-banner');
  alert.textContent = text;
  alert.classList.add('show');
  setTimeout(() => alert.classList.remove('show'), 3000);
}

// =============================================
// JUMPSCARE
// =============================================
function triggerJumpscare() {
  if (gameOverTriggered) return;
  gameOverTriggered = true;
  gameActive = false;
  clearAllIntervals();
  stopHeartbeatAudio();
  playJumpscareSound();

  const js = document.getElementById('jumpscare');
  js.classList.add('show');
  let flicker = 0;
  const fi = setInterval(() => {
    js.style.background = flicker % 2 === 0 ? '#ff0000' : '#000';
    flicker++;
    if (flicker > 10) { clearInterval(fi); js.style.background = '#000'; }
  }, 70);

  setTimeout(() => {
    js.classList.remove('show');
    document.getElementById('game-over').classList.add('show');
  }, 2200);
}

// =============================================
// KAZANMA
// =============================================
function winGame() {
  if (gameOverTriggered) return;
  gameOverTriggered = true;
  gameActive = false;
  clearAllIntervals();
  stopHeartbeatAudio();

  // Highscore güncelle
  const best = getBestNight();
  if (currentNight > best) setBestNight(currentNight);

  // İstatistikleri doldur
  document.getElementById('stat-night').textContent = `GECE ${currentNight}`;
  document.getElementById('stat-power').textContent = Math.round(power) + '%';
  document.getElementById('stat-doors').textContent = doorCloseCount;
  document.getElementById('stat-lights').textContent = lightUseCount;
  document.getElementById('stat-best').textContent = `GECE ${Math.max(getBestNight(), currentNight)}`;

  // Sonraki gece butonu
  const nextBtn = document.getElementById('next-night-btn');
  if (currentNight >= 3) {
    nextBtn.textContent = '🏆 TÜMÜNÜ BİTİRDİN!';
    nextBtn.style.borderColor = '#ffaa00';
    nextBtn.style.color = '#ffaa00';
    nextBtn.onclick = goToMenu;
  }

  document.getElementById('win-screen').classList.add('show');
}

function goNextNight() {
  if (currentNight < 3) {
    resetUI();
    startGame(currentNight + 1);
    document.getElementById('win-screen').classList.remove('show');
  }
}

function goToMenu() {
  resetUI();
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('game-over').classList.remove('show');
  document.getElementById('start-screen').classList.remove('hidden');
}

// =============================================
// YENİDEN BAŞLATMA
// =============================================
function restartGame() {
  resetUI();
  startGame(currentNight);
}

function resetUI() {
  power = 100;
  currentHour = 0;
  leftDoorClosed = false; rightDoorClosed = false;
  leftLightOn = false; rightLightOn = false;
  monitorOpen = false; selectedCamera = 1;
  gameOverTriggered = false; gameActive = false;

  document.getElementById('game-over').classList.remove('show');
  document.getElementById('win-screen').classList.remove('show');
  document.getElementById('jumpscare').classList.remove('show');
  document.getElementById('left-door').classList.remove('closed');
  document.getElementById('right-door').classList.remove('closed');
  document.getElementById('left-door-btn').classList.remove('active');
  document.getElementById('right-door-btn').classList.remove('active');
  document.getElementById('left-door-btn').textContent = 'KAPI';
  document.getElementById('right-door-btn').textContent = 'KAPI';
  document.getElementById('left-animatronic').classList.remove('visible');
  document.getElementById('right-animatronic').classList.remove('visible');
  document.getElementById('monitor-screen').classList.remove('open');
  document.getElementById('monitor-bar-text').textContent = '▲ MONİTÖR ▲';
  document.getElementById('status-text').textContent = 'NORMAL';
  document.getElementById('status-text').className = 'hud-value';
  document.getElementById('power-bar').style.width = '100%';
  document.getElementById('power-value').textContent = '100%';
  document.getElementById('power-value').className = 'hud-value';
  document.getElementById('heartbeat').classList.remove('show');
  document.getElementById('power-outage-overlay').classList.remove('fading');
  document.getElementById('ceiling-light').style.opacity = '1';
  document.getElementById('ceiling-light-glow').style.opacity = '1';
  document.querySelectorAll('.anim-dot').forEach(d => d.remove());
  stopHeartbeatAudio();
}

function clearAllIntervals() {
  clearInterval(powerInterval);
  clearInterval(hourInterval);
  clearInterval(aiInterval);
}

// =============================================
// KLAVYE
// =============================================
document.addEventListener('keydown', (e) => {
  if (!gameActive) return;
  switch(e.key.toLowerCase()) {
    case 'a': toggleDoor('left'); break;
    case 'd': toggleDoor('right'); break;
    case 'q': toggleLight('left', true); break;
    case 'e': toggleLight('right', true); break;
    case 'm': toggleMonitor(); break;
  }
});

document.addEventListener('keyup', (e) => {
  if (!gameActive) return;
  if (e.key.toLowerCase() === 'q') toggleLight('left', false);
  if (e.key.toLowerCase() === 'e') toggleLight('right', false);
});

// =============================================
// KAMERA TIMESTAMP
// =============================================
setInterval(() => {
  if (monitorOpen) {
    const now = new Date();
    const ts = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
    const el = document.getElementById('cam-timestamp');
    if (el) el.textContent = 'REC ● ' + ts;
  }
}, 1000);

// =============================================
// RESIZE
// =============================================
window.addEventListener('resize', () => {
  const canvas = document.getElementById('noise-canvas');
  if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
});
