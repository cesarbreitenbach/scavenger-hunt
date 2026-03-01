import { Game, ROUND_SIZE } from "./game.js";

const game = new Game();
let worker = null;
let isRunning = false;
let loopId = 0;
let pendingTimeout = null;

const video = document.getElementById("video");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");
const treasureEl = document.getElementById("treasure");
const scoreEl = document.getElementById("score");
const foundEl = document.getElementById("found");
const progressBar = document.getElementById("progressBar");
const detectList = document.getElementById("detectList");
const celebration = document.getElementById("celebration");
const treasureEmoji = document.getElementById("treasureEmoji");
const treasureName = document.getElementById("treasureName");
const treasurePts = document.getElementById("treasurePts");
const loadingEl = document.getElementById("loading");
const loadingMsg = document.getElementById("loadingMsg");
const scanDot = document.getElementById("scanDot");
const timerEl = document.getElementById("timer");
const timerBar = document.getElementById("timerBar");
const roundCounter = document.getElementById("roundCounter");
const celEmoji = document.getElementById("celEmoji");
const celTitle = document.getElementById("celTitle");
const celSub = document.getElementById("celSub");
const resultScreen = document.getElementById("resultScreen");
const resultScore = document.getElementById("resultScore");
const resultFound = document.getElementById("resultFound");
const resultSkipped = document.getElementById("resultSkipped");
const playAgainBtn = document.getElementById("playAgainBtn");
const skipBtn = document.getElementById("skipBtn");

function initWorker() {
  worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });

  worker.onmessage = ({ data }) => {
    if (data.type === "status") loadingMsg.textContent = data.message;

    if (data.type === "heartbeat") {
      scanDot.classList.add("active");
      setTimeout(() => scanDot.classList.remove("active"), 150);
    }

    if (data.type === "ready") {
      loadingEl.style.display = "none";
      startBtn.disabled = false;
      startBtn.textContent = "▶ INICIAR CAÇA";
      setStatus("Pronto! Toque para começar.", "ready");
    }

    if (data.type === "error") setStatus("⚠ " + data.message, "error");

    if (data.type === "prediction" && isRunning) {
      renderDetections(data.detections);
      const found = game.processDetections(data.detections);
      updateProgress(game.getBufferProgress());
      updateTimerBar(game.getTimerRatio());

      const seeingTarget = data.detections.some(
        (d) => game.currentTreasure && d.label === game.currentTreasure.label,
      );
      document
        .getElementById("crosshair")
        .classList.toggle("detecting", seeingTarget);

      if (found) showFound();
    }
  };

  worker.onerror = (e) => setStatus("⚠ Worker: " + e.message, "error");
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
}

function startLoop() {
  const myId = ++loopId;
  function tick() {
    if (!isRunning || loopId !== myId) return;
    createImageBitmap(video)
      .then((bitmap) =>
        worker.postMessage({ type: "predict", image: bitmap }, [bitmap]),
      )
      .catch(() => {});
    setTimeout(tick, 300);
  }
  tick();
}

setInterval(() => {
  if (isRunning && game.currentTreasure) {
    timerEl.textContent = game.timeLeft;
    updateTimerBar(game.getTimerRatio());
    const urgent = game.timeLeft <= 10;
    timerEl.classList.toggle("urgent", urgent);
    timerBar.classList.toggle("urgent", urgent);
  }
}, 1000);

function updateTimerBar(ratio) {
  timerBar.style.width = ratio * 100 + "%";
}

// ---- GAME FLOW ----
function startRound() {
  // Cancela qualquer celebração pendente do jogo anterior
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
    celebration.classList.remove("show");
  }

  game.startRound();
  game.onTimeUp = onTimeUp;
  scoreEl.textContent = "0";
  foundEl.textContent = "0";
  updateProgress(0);
  nextTreasure();
}

function nextTreasure() {
  if (game.isRoundOver()) {
    showResult();
    return;
  }

  const t = game.nextTreasure();
  treasureEmoji.textContent = t.emoji;
  treasureName.textContent = t.name;
  treasurePts.textContent = `+${t.pts} pt${t.pts > 1 ? "s" : ""}`;
  treasurePts.className = `pts pts-${t.pts}`;
  roundCounter.textContent = `${game.roundIndex} / ${ROUND_SIZE}`;
  updateProgress(0);

  timerEl.textContent = t.time;
  timerEl.classList.remove("urgent");
  timerBar.classList.remove("urgent");
  timerBar.style.width = "100%";
  timerBar.style.background = "";

  treasureEl.classList.add("new-treasure");
  setTimeout(() => treasureEl.classList.remove("new-treasure"), 600);

  skipBtn.style.display = "block";
}

function skipTreasure() {
  if (!isRunning || !game.currentTreasure) return;
  skipBtn.style.display = "none";
  game.stopTimer();
  game.skipped++;
  showCelebration("⏭️", "PULADO", "Próximo tesouro...", 1200);
}

function onTimeUp() {
  skipBtn.style.display = "none";
  showCelebration("⏰", "TEMPO!", "Próximo tesouro...", 1500);
}

function showFound() {
  skipBtn.style.display = "none";
  scoreEl.textContent = game.score;
  foundEl.textContent = game.found;
  scoreEl.classList.add("bump");
  setTimeout(() => scoreEl.classList.remove("bump"), 400);

  spawnConfetti();
  showCelebration(
    game.currentTreasure.emoji,
    "ENCONTROU!",
    `+${game.currentTreasure.pts} ponto${game.currentTreasure.pts > 1 ? "s" : ""}!`,
    1800,
  );
}

function showCelebration(emoji, title, sub, duration) {
  celEmoji.textContent = emoji;
  celTitle.textContent = title;
  celSub.textContent = sub;
  celebration.classList.add("show");

  pendingTimeout = setTimeout(() => {
    pendingTimeout = null;
    celebration.classList.remove("show");
    nextTreasure();
  }, duration);
}

function showResult() {
  isRunning = false;
  game.stopTimer();
  skipBtn.style.display = "none";
  resultScore.textContent = game.score;
  resultFound.textContent = `${game.found} / ${ROUND_SIZE} encontrados`;
  resultSkipped.textContent = `${game.skipped} perdidos`;
  resultScreen.classList.add("show");
}

function spawnConfetti() {
  for (let i = 0; i < 18; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.textContent = ["🎉", "⭐", "✨", "💎", "🔥", "🏅"][
      Math.floor(Math.random() * 6)
    ];
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDelay = Math.random() * 0.5 + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
}

function updateProgress(ratio) {
  progressBar.style.width = ratio * 100 + "%";
}

function renderDetections(detections) {
  if (!detections?.length) {
    detectList.innerHTML =
      '<span class="no-detect">nenhum objeto detectado</span>';
    return;
  }
  detectList.innerHTML = detections
    .slice(0, 5)
    .map((d) => {
      const isTarget =
        game.currentTreasure && d.label === game.currentTreasure.label;
      return `<span class="detect-item ${isTarget ? "target" : ""}">${d.label} <b>${d.score}%</b></span>`;
    })
    .join("");
}

function setStatus(msg, cls = "") {
  statusEl.textContent = msg;
  statusEl.className = "status " + cls;
}

startBtn.addEventListener("click", async () => {
  if (isRunning) return;
  startBtn.disabled = true;
  startBtn.textContent = "⏳ Ligando câmera...";

  try {
    await startCamera();
    isRunning = true;
    startRound();
    startLoop();
    document.getElementById("preHUD").style.display = "none";
    document.getElementById("gameHUD").style.display = "flex";
  } catch (e) {
    setStatus("⚠ Câmera: " + e.message, "error");
    startBtn.disabled = false;
    startBtn.textContent = "▶ INICIAR CAÇA";
  }
});

playAgainBtn.addEventListener("click", () => {
  resultScreen.classList.remove("show");
  isRunning = true;
  startRound();
  startLoop();
});

skipBtn.addEventListener("click", skipTreasure);

initWorker();
