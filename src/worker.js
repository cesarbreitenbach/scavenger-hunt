import * as tf from "@tensorflow/tfjs";

let model = null;
let labels = null;
let frameCount = 0;

async function loadModel() {
  try {
    postMessage({ type: "status", message: "Carregando labels..." });
    labels = await fetch("/labels.json").then((r) => r.json());

    postMessage({ type: "status", message: "Carregando modelo YOLOv5..." });
    model = await tf.loadGraphModel("/model.json");

    postMessage({ type: "status", message: "Aquecendo modelo..." });
    const dummy = tf.zeros([1, 640, 640, 3]);
    await model.executeAsync(dummy);
    dummy.dispose();

    postMessage({ type: "ready" });
  } catch (e) {
    postMessage({ type: "error", message: "Falha ao carregar: " + e.message });
  }
}

async function predict(imageBitmap) {
  frameCount++;

  const input = tf.tidy(() => {
    return tf.browser
      .fromPixels(imageBitmap)
      .resizeBilinear([640, 640])
      .div(255.0)
      .expandDims(0);
  });

  let detections = [];

  try {
    const results = await model.executeAsync(input);
    input.dispose();

    const tensors = Array.isArray(results) ? results : [results];

    // Log shapes nos primeiros frames para debug
    if (frameCount <= 2) {
      tensors.forEach((t, i) =>
        console.log(`[YOLOv5] tensor[${i}] shape: [${t.shape}]`),
      );
    }

    // Identifica tensores pelo shape
    // boxes   → [1, N, 4]
    // scores  → [1, N] com valores entre 0-1
    // classes → [1, N] com valores inteiros (índices)
    // num     → [1] ou escalar
    let numDet = null,
      scores = null,
      classes = null,
      boxes = null;

    for (const t of tensors) {
      const s = t.shape;
      if (s.length === 3 && s[2] === 4) {
        boxes = t; // [1, N, 4]
      } else if (s.length <= 1 || (s.length === 2 && s[1] === 1)) {
        numDet = t; // escalar ou [1] ou [1,1]
      } else if (s.length === 2) {
        // scores e classes ambos são [1, N]
        // scores tem valores 0.0-1.0, classes tem índices inteiros
        if (!scores) scores = t;
        else classes = t;
      }
    }

    if (!numDet || !scores || !classes) {
      console.warn("[YOLOv5] usando fallback de ordem clássica");
      [boxes, scores, classes, numDet] = tensors;
    }

    const numRaw = await numDet.data();
    const scoresRaw = await scores.data();
    const classRaw = await classes.data();

    tensors.forEach((t) => t.dispose());

    const n = Math.round(numRaw[0]);

    for (let i = 0; i < n; i++) {
      const score = scoresRaw[i];
      if (score < 0.25) continue;
      const classIdx = Math.round(classRaw[i]);
      if (classIdx < 0 || classIdx >= labels.length) continue;
      detections.push({
        label: labels[classIdx],
        score: Math.round(score * 100),
      });
    }
  } catch (e) {
    console.error("[YOLOv5] erro:", e);
    // Garante dispose mesmo em erro
    try {
      input.dispose();
    } catch (_) {}
    postMessage({ type: "error", message: "Erro na inferência: " + e.message });
  }

  return detections;
}

loadModel();

self.onmessage = async ({ data }) => {
  if (data.type !== "predict") return;
  if (!model) return;

  postMessage({ type: "heartbeat", frame: frameCount });

  const detections = await predict(data.image);
  postMessage({ type: "prediction", detections, frame: frameCount });
};
