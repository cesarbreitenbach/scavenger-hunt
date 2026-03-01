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

    // Ordem confirmada pela análise do grafo do modelo:
    // Identity   [0] → boxes   [1, N, 4]  (coordenadas)
    // Identity_1 [1] → scores  [1, N]     (Max das probabilidades)
    // Identity_2 [2] → classes [1, N]     (ArgMax = índice da classe)
    // Identity_3 [3] → num     [1]        (Shape do resultado NMS)
    const [boxesTensor, scoresTensor, classesTensor, numTensor] = tensors;

    // Extrai dados e descarta tensores imediatamente
    const [scoresData, classesData, numData] = await Promise.all([
      scoresTensor.data(),
      classesTensor.data(),
      numTensor.data(),
    ]);

    tensors.forEach((t) => t.dispose());

    const n = Math.round(numData[0]);

    for (let i = 0; i < n; i++) {
      const score = scoresData[i];
      if (score < 0.25) continue;
      const classIdx = Math.round(classesData[i]);
      if (classIdx < 0 || classIdx >= labels.length) continue;
      detections.push({
        label: labels[classIdx],
        score: Math.round(score * 100),
      });
    }
  } catch (e) {
    console.error("[YOLOv5] erro:", e);
    try {
      input.dispose();
    } catch (_) {}
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
