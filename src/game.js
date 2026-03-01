export const TREASURES = [
  { label: "bottle", emoji: "🍶", pts: 1, name: "Garrafa", time: 30 },
  { label: "cup", emoji: "☕", pts: 1, name: "Xícara", time: 30 },
  { label: "chair", emoji: "🪑", pts: 1, name: "Cadeira", time: 30 },
  { label: "tv", emoji: "📺", pts: 1, name: "TV", time: 25 },
  { label: "bed", emoji: "🛏️", pts: 1, name: "Cama", time: 25 },
  { label: "sink", emoji: "🚿", pts: 1, name: "Pia", time: 25 },
  { label: "refrigerator", emoji: "🧊", pts: 1, name: "Geladeira", time: 25 },
  { label: "bowl", emoji: "🥣", pts: 1, name: "Tigela", time: 30 },
  { label: "couch", emoji: "🛋️", pts: 1, name: "Sofá", time: 40 },

  { label: "laptop", emoji: "💻", pts: 2, name: "Laptop", time: 35 },
  { label: "clock", emoji: "🕐", pts: 2, name: "Relógio", time: 40 },
  { label: "book", emoji: "📚", pts: 2, name: "Livro", time: 35 },
  { label: "cell phone", emoji: "📱", pts: 2, name: "Celular", time: 30 },
  { label: "keyboard", emoji: "⌨️", pts: 2, name: "Teclado", time: 30 },
  { label: "remote", emoji: "🎮", pts: 2, name: "Controle", time: 35 },
  { label: "mouse", emoji: "🖱️", pts: 2, name: "Mouse", time: 35 },
  { label: "microwave", emoji: "📦", pts: 2, name: "Microondas", time: 30 },
  { label: "backpack", emoji: "🎒", pts: 2, name: "Mochila", time: 35 },
  { label: "suitcase", emoji: "🧳", pts: 2, name: "Mala", time: 35 },

  { label: "potted plant", emoji: "🪴", pts: 3, name: "Planta", time: 45 },
  {
    label: "teddy bear",
    emoji: "🧸",
    pts: 3,
    name: "Urso de Pelúcia",
    time: 45,
  },
  { label: "banana", emoji: "🍌", pts: 3, name: "Banana", time: 40 },
];

export const ROUND_SIZE = 5;

export class Game {
  constructor() {
    this.score = 0;
    this.found = 0;
    this.skipped = 0;
    this.currentTreasure = null;
    this.detectionBuffer = [];
    this.BUFFER_SIZE = 3;
    this.CONFIDENCE = 20;

    this.timeLeft = 0;
    this.timerInterval = null;
    this.onTimeUp = null;

    this.roundItems = [];
    this.roundIndex = 0;
  }

  startRound() {
    const shuffled = [...TREASURES].sort(() => Math.random() - 0.5);
    this.roundItems = shuffled.slice(0, ROUND_SIZE);
    this.roundIndex = 0;
    this.score = 0;
    this.found = 0;
    this.skipped = 0;
  }

  nextTreasure() {
    this.stopTimer();
    this.detectionBuffer = [];
    if (this.roundIndex >= this.roundItems.length) return null;
    this.currentTreasure = this.roundItems[this.roundIndex];
    this.roundIndex++;
    this.startTimer(this.currentTreasure.time);
    return this.currentTreasure;
  }

  startTimer(seconds) {
    this.timeLeft = seconds;
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      if (this.timeLeft <= 0) {
        this.stopTimer();
        this.skipped++;
        if (this.onTimeUp) this.onTimeUp();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  processDetections(detections) {
    if (!this.currentTreasure) return false;
    const target = this.currentTreasure.label;
    const found = detections.find(
      (d) => d.label === target && d.score >= this.CONFIDENCE,
    );

    if (found) {
      this.detectionBuffer.push(found);
    } else {
      this.detectionBuffer = [];
    }

    if (this.detectionBuffer.length >= this.BUFFER_SIZE) {
      this.stopTimer();
      this.score += this.currentTreasure.pts;
      this.found++;
      this.detectionBuffer = [];
      return true;
    }
    return false;
  }

  getBufferProgress() {
    return this.detectionBuffer.length / this.BUFFER_SIZE;
  }

  isRoundOver() {
    return this.roundIndex >= this.roundItems.length;
  }

  getTimerRatio() {
    if (!this.currentTreasure) return 1;
    return this.timeLeft / this.currentTreasure.time;
  }
}
