const audio = document.getElementById("audio");
const fileInput = document.getElementById("fileInput");
const playBtn = document.getElementById("playBtn");
const seekBar = document.getElementById("seekBar");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const volumeBar = document.getElementById("volumeBar");
const trackNameEl = document.getElementById("trackName");
const setABtn = document.getElementById("setABtn");
const setBBtn = document.getElementById("setBBtn");
const loopToggleBtn = document.getElementById("loopToggleBtn");
const clearLoopBtn = document.getElementById("clearLoopBtn");
const loopStatusEl = document.getElementById("loopStatus");
const loopRegionEl = document.getElementById("loopRegion");
const speedBar = document.getElementById("speedBar");
const speedValueEl = document.getElementById("speedValue");

audio.preservesPitch = true;

const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const EQ_LABELS = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
const EQ_FMIN = 20;
const EQ_FMAX = 20000;
const EQ_TRACK_TOP = 14;
const EQ_LABEL_H = 18;
const eqGains = new Array(EQ_BANDS.length).fill(0);

let audioCtx = null;
let eqFilters = [];
let analyser = null;
let analyserData = null;

function ensureAudioGraph() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const srcNode = audioCtx.createMediaElementSource(audio);
    let node = srcNode;
    eqFilters = EQ_BANDS.map((freq) => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1.41;
      node.connect(filter);
      node = filter;
      return filter;
    });
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.8;
    analyserData = new Uint8Array(analyser.frequencyBinCount);
    node.connect(analyser);
    analyser.connect(audioCtx.destination);
    applyEq();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function applyEq() {
  eqFilters.forEach((filter, i) => {
    filter.gain.value = eqGains[i];
  });
}

function resetEq() {
  eqGains.fill(0);
  applyEq();
}

document.getElementById("eqResetBtn").addEventListener("click", resetEq);

const eqCanvas = document.getElementById("eqCanvas");
const eqCtx = eqCanvas.getContext("2d");
let eqDragBand = -1;

function eqFreqToX(freq, w) {
  return (Math.log(freq / EQ_FMIN) / Math.log(EQ_FMAX / EQ_FMIN)) * w;
}

function drawEq() {
  const dpr = window.devicePixelRatio || 1;
  const w = eqCanvas.clientWidth;
  const h = eqCanvas.clientHeight;
  if (w === 0) return;
  if (eqCanvas.width !== Math.round(w * dpr)) {
    eqCanvas.width = Math.round(w * dpr);
    eqCanvas.height = Math.round(h * dpr);
  }
  eqCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  eqCtx.clearRect(0, 0, w, h);

  const trackBottom = h - EQ_LABEL_H;
  const trackSpan = trackBottom - EQ_TRACK_TOP;
  const gainToY = (g) => EQ_TRACK_TOP + ((12 - g) / 24) * trackSpan;
  const zeroY = gainToY(0);

  if (analyser) {
    analyser.getByteFrequencyData(analyserData);
    const binHz = audioCtx.sampleRate / analyser.fftSize;
    eqCtx.fillStyle = "rgba(90, 140, 255, 0.22)";
    for (let x = 0; x < w; x += 2) {
      const f = EQ_FMIN * Math.pow(EQ_FMAX / EQ_FMIN, x / w);
      const bin = Math.min(analyserData.length - 1, Math.round(f / binHz));
      const v = analyserData[bin] / 255;
      const bh = v * (trackBottom - 4);
      if (bh > 0.5) eqCtx.fillRect(x, trackBottom - bh, 2, bh);
    }
  }

  eqCtx.strokeStyle = "#3a3a42";
  eqCtx.setLineDash([3, 4]);
  eqCtx.beginPath();
  eqCtx.moveTo(0, zeroY);
  eqCtx.lineTo(w, zeroY);
  eqCtx.stroke();
  eqCtx.setLineDash([]);

  EQ_BANDS.forEach((freq, i) => {
    const x = eqFreqToX(freq, w);
    const y = gainToY(eqGains[i]);

    eqCtx.strokeStyle = "#3a3a42";
    eqCtx.lineWidth = 1;
    eqCtx.beginPath();
    eqCtx.moveTo(x, EQ_TRACK_TOP);
    eqCtx.lineTo(x, trackBottom);
    eqCtx.stroke();

    if (eqGains[i] !== 0) {
      eqCtx.strokeStyle = "rgba(61, 123, 253, 0.6)";
      eqCtx.lineWidth = 2;
      eqCtx.beginPath();
      eqCtx.moveTo(x, zeroY);
      eqCtx.lineTo(x, y);
      eqCtx.stroke();
    }

    eqCtx.fillStyle = i === eqDragBand ? "#6ea0ff" : "#3d7bfd";
    eqCtx.beginPath();
    eqCtx.roundRect(x - 9, y - 4, 18, 8, 4);
    eqCtx.fill();

    if (eqGains[i] !== 0 || i === eqDragBand) {
      eqCtx.fillStyle = "#9ab8ff";
      eqCtx.font = "10px sans-serif";
      eqCtx.textAlign = "center";
      const label = `${eqGains[i] > 0 ? "+" : ""}${eqGains[i]}`;
      eqCtx.fillText(label, x, y < zeroY ? y - 8 : y + 16);
    }

    eqCtx.fillStyle = "#6a6a72";
    eqCtx.font = "10px sans-serif";
    eqCtx.textAlign = "center";
    eqCtx.fillText(EQ_LABELS[i], x, h - 5);
  });
}

function eqEventPos(e) {
  const rect = eqCanvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top, w: rect.width, h: rect.height };
}

function eqSetGainFromY(band, y, h) {
  const trackBottom = h - EQ_LABEL_H;
  const trackSpan = trackBottom - EQ_TRACK_TOP;
  let g = 12 - ((y - EQ_TRACK_TOP) / trackSpan) * 24;
  g = Math.min(12, Math.max(-12, g));
  eqGains[band] = Math.round(g * 2) / 2;
  applyEq();
}

eqCanvas.addEventListener("mousedown", (e) => {
  const { x, y, w, h } = eqEventPos(e);
  let best = -1;
  let bestDist = 16;
  EQ_BANDS.forEach((freq, i) => {
    const dist = Math.abs(eqFreqToX(freq, w) - x);
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  });
  if (best >= 0) {
    eqDragBand = best;
    eqSetGainFromY(best, y, h);
  }
});

window.addEventListener("mousemove", (e) => {
  if (eqDragBand < 0) return;
  const { y, h } = eqEventPos(e);
  eqSetGainFromY(eqDragBand, y, h);
});

window.addEventListener("mouseup", () => {
  eqDragBand = -1;
});

eqCanvas.addEventListener("dblclick", resetEq);

let seeking = false;
let objectUrl = null;
let loopA = null;
let loopB = null;
let loopEnabled = true;

function formatTime(sec) {
  if (!isFinite(sec)) return "0:00.0";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
}

function loadSource(src, name) {
  audio.src = src;
  trackNameEl.textContent = name;
  playBtn.disabled = false;
  seekBar.disabled = false;
  setABtn.disabled = false;
  setBBtn.disabled = false;
  clearLoop(false);
  buildWaveform(src);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  loadSource(objectUrl, file.name);
});

document.querySelectorAll(".sample-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    loadSource(encodeURI(btn.dataset.src), btn.dataset.src.split("/").pop());
  });
});

playBtn.addEventListener("click", togglePlay);

function togglePlay() {
  if (!audio.src) return;
  if (audio.paused) {
    ensureAudioGraph();
    audio.play();
  } else {
    audio.pause();
  }
}

audio.addEventListener("play", () => (playBtn.textContent = "⏸"));
audio.addEventListener("pause", () => (playBtn.textContent = "▶"));

audio.addEventListener("loadedmetadata", () => {
  durationEl.textContent = formatTime(audio.duration);
  updateLoopUI();
});

audio.addEventListener("timeupdate", () => {
  currentTimeEl.textContent = formatTime(audio.currentTime);
  if (!seeking && isFinite(audio.duration)) {
    seekBar.value = (audio.currentTime / audio.duration) * 1000;
  }
});

seekBar.addEventListener("input", () => {
  seeking = true;
  currentTimeEl.textContent = formatTime((seekBar.value / 1000) * audio.duration);
});
seekBar.addEventListener("change", () => {
  audio.currentTime = (seekBar.value / 1000) * audio.duration;
  seeking = false;
});

volumeBar.addEventListener("input", () => {
  setVolume(Number(volumeBar.value));
});

function setVolume(v) {
  v = Math.min(100, Math.max(0, v));
  volumeBar.value = v;
  audio.volume = v / 100;
}

const SPEED_MIN = 0.3;
const SPEED_MAX = 2;

function sliderToRate(v) {
  return SPEED_MIN * Math.pow(SPEED_MAX / SPEED_MIN, v / 1000);
}

function rateToSlider(rate) {
  return Math.round(
    (Math.log(rate / SPEED_MIN) / Math.log(SPEED_MAX / SPEED_MIN)) * 1000
  );
}

function setSpeed(rate) {
  rate = Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(rate * 100) / 100));
  audio.playbackRate = rate;
  speedBar.value = rateToSlider(rate);
  speedValueEl.textContent = `${rate.toFixed(2)}x`;
  document.querySelectorAll(".speed-preset").forEach((btn) => {
    btn.classList.toggle("active", Math.abs(Number(btn.dataset.rate) - rate) < 0.001);
  });
}

speedBar.addEventListener("input", () => {
  setSpeed(sliderToRate(Number(speedBar.value)));
});

document.querySelectorAll(".speed-preset").forEach((btn) => {
  btn.addEventListener("click", () => setSpeed(Number(btn.dataset.rate)));
});

document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" && e.target.type === "text") return;
  const step = e.shiftKey ? 0.5 : 5;
  switch (e.code) {
    case "Space":
      e.preventDefault();
      togglePlay();
      break;
    case "ArrowLeft":
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - step);
      break;
    case "ArrowRight":
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + step);
      break;
    case "ArrowUp":
      e.preventDefault();
      setVolume(Math.min(100, Number(volumeBar.value) + 5));
      break;
    case "ArrowDown":
      e.preventDefault();
      setVolume(Math.max(0, Number(volumeBar.value) - 5));
      break;
    case "Minus":
      setSpeed(audio.playbackRate / 1.05);
      break;
    case "Equal":
      setSpeed(audio.playbackRate * 1.05);
      break;
    case "Digit0":
      setSpeed(1);
      break;
    case "KeyA":
      setLoopA();
      break;
    case "KeyB":
      setLoopB();
      break;
    case "KeyL":
      toggleLoopEnabled();
      break;
    case "KeyX":
      clearLoop(true);
      break;
    case "KeyR":
      if (loopA !== null) audio.currentTime = loopA;
      break;
  }
});

function loopReady() {
  return loopA !== null && loopB !== null && loopB > loopA;
}

function setLoopA() {
  if (!audio.src) return;
  loopA = audio.currentTime;
  updateLoopUI();
}

function setLoopB() {
  if (!audio.src) return;
  loopB = audio.currentTime;
  updateLoopUI();
}

function toggleLoopEnabled() {
  if (!loopReady()) return;
  loopEnabled = !loopEnabled;
  updateLoopUI();
}

function clearLoop() {
  loopA = null;
  loopB = null;
  loopEnabled = true;
  updateLoopUI();
}

setABtn.addEventListener("click", setLoopA);
setBBtn.addEventListener("click", setLoopB);
loopToggleBtn.addEventListener("click", toggleLoopEnabled);
clearLoopBtn.addEventListener("click", clearLoop);

function updateLoopUI() {
  const ready = loopReady();
  loopToggleBtn.disabled = !ready;
  clearLoopBtn.disabled = loopA === null && loopB === null;
  loopToggleBtn.textContent = `循环: ${loopEnabled && ready ? "开" : "关"}`;
  loopToggleBtn.classList.toggle("active", loopEnabled && ready);

  if (loopA === null && loopB === null) {
    loopStatusEl.textContent = "未设置循环区间";
  } else if (!ready) {
    const aText = loopA !== null ? formatTime(loopA) : "--:--";
    const bText = loopB !== null ? formatTime(loopB) : "--:--";
    loopStatusEl.textContent = `A: ${aText}  B: ${bText}（B 需在 A 之后）`;
  } else {
    loopStatusEl.textContent = `A: ${formatTime(loopA)} → B: ${formatTime(loopB)}（${formatTime(loopB - loopA)}）`;
  }

  if (ready && isFinite(audio.duration) && audio.duration > 0) {
    const left = (loopA / audio.duration) * 100;
    const width = ((loopB - loopA) / audio.duration) * 100;
    loopRegionEl.style.display = "block";
    loopRegionEl.style.left = `${left}%`;
    loopRegionEl.style.width = `${width}%`;
    loopRegionEl.style.background = loopEnabled
      ? "rgba(61, 123, 253, 0.45)"
      : "rgba(120, 120, 130, 0.35)";
  } else {
    loopRegionEl.style.display = "none";
  }
}

function loopTick() {
  if (loopEnabled && loopReady() && !audio.paused && !seeking) {
    if (audio.currentTime >= loopB) {
      audio.currentTime = loopA;
    }
  }
  drawWaveform();
  drawEq();
  requestAnimationFrame(loopTick);
}
requestAnimationFrame(loopTick);

const waveCanvas = document.getElementById("waveform");
const waveCtx = waveCanvas.getContext("2d");
const WAVE_BUCKETS = 2000;
let wavePeaks = null;
let waveLoadingSrc = null;
let waveFailed = false;

async function buildWaveform(src) {
  wavePeaks = null;
  waveLoadingSrc = src;
  waveFailed = false;
  try {
    const buf = await fetch(src).then((r) => r.arrayBuffer());
    const decodeCtx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await decodeCtx.decodeAudioData(buf);
    decodeCtx.close();
    if (waveLoadingSrc !== src) return;
    const ch0 = decoded.getChannelData(0);
    const ch1 = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : null;
    const total = ch0.length;
    const step = Math.floor(total / WAVE_BUCKETS) || 1;
    const peaks = new Float32Array(WAVE_BUCKETS * 2);
    for (let i = 0; i < WAVE_BUCKETS; i++) {
      const start = i * step;
      const end = Math.min(start + step, total);
      let min = 1;
      let max = -1;
      for (let j = start; j < end; j++) {
        const v = ch1 ? (ch0[j] + ch1[j]) / 2 : ch0[j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      peaks[i * 2] = min;
      peaks[i * 2 + 1] = max;
    }
    wavePeaks = peaks;
  } catch (err) {
    if (waveLoadingSrc === src) {
      wavePeaks = null;
      waveFailed = true;
    }
  }
}

function drawWaveform() {
  const dpr = window.devicePixelRatio || 1;
  const w = waveCanvas.clientWidth;
  const h = waveCanvas.clientHeight;
  if (w === 0) return;
  if (waveCanvas.width !== Math.round(w * dpr)) {
    waveCanvas.width = Math.round(w * dpr);
    waveCanvas.height = Math.round(h * dpr);
  }
  waveCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  waveCtx.clearRect(0, 0, w, h);

  if (!wavePeaks) {
    waveCtx.fillStyle = "#6a6a72";
    waveCtx.font = "12px sans-serif";
    waveCtx.textAlign = "center";
    const msg = waveFailed
      ? "波形不可用（播放不受影响）"
      : waveLoadingSrc
        ? "波形加载中…"
        : "加载音频后显示波形";
    waveCtx.fillText(msg, w / 2, h / 2 + 4);
    return;
  }

  const mid = h / 2;
  waveCtx.strokeStyle = "#6f6f7c";
  waveCtx.lineWidth = 1;
  waveCtx.beginPath();
  for (let x = 0; x < w; x++) {
    const i = Math.min(
      WAVE_BUCKETS - 1,
      Math.floor((x / w) * WAVE_BUCKETS)
    );
    const min = wavePeaks[i * 2];
    const max = wavePeaks[i * 2 + 1];
    waveCtx.moveTo(x + 0.5, mid + min * (mid - 2));
    waveCtx.lineTo(x + 0.5, mid + max * (mid - 2) + 1);
  }
  waveCtx.stroke();

  if (loopReady() && isFinite(audio.duration) && audio.duration > 0) {
    const ax = (loopA / audio.duration) * w;
    const bx = (loopB / audio.duration) * w;
    waveCtx.fillStyle = loopEnabled
      ? "rgba(61, 123, 253, 0.30)"
      : "rgba(120, 120, 130, 0.20)";
    waveCtx.fillRect(ax, 0, bx - ax, h);
    waveCtx.fillStyle = loopEnabled ? "#3d7bfd" : "#8a8a94";
    waveCtx.fillRect(ax, 0, 2, h);
    waveCtx.fillRect(bx - 2, 0, 2, h);
  }

  if (isFinite(audio.duration) && audio.duration > 0) {
    const px = (audio.currentTime / audio.duration) * w;
    waveCtx.strokeStyle = "#ffffff";
    waveCtx.lineWidth = 1.5;
    waveCtx.beginPath();
    waveCtx.moveTo(px, 0);
    waveCtx.lineTo(px, h);
    waveCtx.stroke();
  }
}

let waveDragTime = null;
let waveDragMoved = false;

function waveTimeAt(e) {
  const rect = waveCanvas.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  return frac * (audio.duration || 0);
}

waveCanvas.addEventListener("mousedown", (e) => {
  if (!isFinite(audio.duration)) return;
  waveDragTime = waveTimeAt(e);
  waveDragMoved = false;
});

window.addEventListener("mousemove", (e) => {
  if (waveDragTime === null) return;
  const t = waveTimeAt(e);
  if (!waveDragMoved && Math.abs(t - waveDragTime) < 0.05) return;
  waveDragMoved = true;
  loopA = Math.min(waveDragTime, t);
  loopB = Math.max(waveDragTime, t);
  loopEnabled = true;
  updateLoopUI();
});

window.addEventListener("mouseup", (e) => {
  if (waveDragTime === null) return;
  if (!waveDragMoved) {
    audio.currentTime = waveTimeAt(e);
  }
  waveDragTime = null;
});
