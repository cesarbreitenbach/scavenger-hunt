import { Game, ROUND_SIZE } from "./game.js";

const game = new Game();
let worker = null;
let isRunning = false;

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

    if (data.type === "error") {
      setStatus("⚠ " + data.message, "error");
    }

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
  if (!isRunning) return;
  createImageBitmap(video)
    .then((bitmap) => {
      worker.postMessage({ type: "predict", image: bitmap }, [bitmap]);
    })
    .catch(() => {});
  setTimeout(startLoop, 300);
}

function updateTimerUI() {
  if (!game.currentTreasure) return;
  timerEl.textContent = game.timeLeft;
  updateTimerBar(game.getTimerRatio());

  if (game.timeLeft <= 10) {
    timerEl.classList.add("urgent");
    timerBar.classList.add("urgent");
  } else {
    timerEl.classList.remove("urgent");
    timerBar.classList.remove("urgent");
  }
}

setInterval(() => {
  if (isRunning && game.currentTreasure) updateTimerUI();
}, 1000);

function updateTimerBar(ratio) {
  timerBar.style.width = ratio * 100 + "%";
}

function startRound() {
  game.startRound();
  game.onTimeUp = onTimeUp;
  scoreEl.textContent = "0";
  foundEl.textContent = "0";
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
  updateTimerUI();

  treasureEl.classList.add("new-treasure");
  setTimeout(() => treasureEl.classList.remove("new-treasure"), 600);
}

function onTimeUp() {
  celEmoji.textContent = "⏰";
  celTitle.textContent = "TEMPO!";
  celSub.textContent = `Próximo tesouro...`;
  celebration.classList.add("show");
  setTimeout(() => {
    celebration.classList.remove("show");
    nextTreasure();
  }, 1500);
}

function showFound() {
  scoreEl.textContent = game.score;
  foundEl.textContent = game.found;
  scoreEl.classList.add("bump");
  setTimeout(() => scoreEl.classList.remove("bump"), 400);

  celEmoji.textContent = game.currentTreasure.emoji;
  celTitle.textContent = "ENCONTROU!";
  celSub.textContent = `+${game.currentTreasure.pts} ponto${game.currentTreasure.pts > 1 ? "s" : ""}!`;
  celebration.classList.add("show");

  spawnConfetti();

  setTimeout(() => {
    celebration.classList.remove("show");
    nextTreasure();
  }, 1800);
}

function showResult() {
  isRunning = false;
  game.stopTimer();
  resultScore.textContent = game.score;
  resultFound.textContent = `${game.found} / ${ROUND_SIZE} encontrados`;
  resultSkipped.textContent = `${game.skipped} perdidos por tempo`;
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
    setStatus("IA ativa — encontre o tesouro!", "ready");
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

initWorker();
