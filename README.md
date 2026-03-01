# ⚓ Scavenger Hunt (Caça ao Tesouro) — AI Object Detection Game

Jogo de caça a objetos usando **YOLOv5s + TensorFlow.js**.  
Abra no celular, saia pela casa e encontre os tesouros antes do tempo acabar!

---

## ⚙️ Setup

### 1. Instale as dependências

```bash
npm install
```

### 2. Rode o servidor com HTTPS

```bash
npm run dev
```

Vai aparecer algo assim:

```
  ➜  Local:   https://localhost:5173/
  ➜  Network: https://192.168.x.x:5173/   ← use esse no celular!
```

### 3. Abra no celular

- Conecte o celular na mesma rede Wi-Fi do PC
- Acesse `https://192.168.x.x:5173` no browser
- **Aceite o aviso de certificado** (é seguro, é só o cert local)
- Permita a câmera quando pedir
- Toque em **"INICIAR CAÇA"** e saia caçando!

> O modelo já está incluso na pasta `public/` — não é necessário nenhuma configuração adicional.

---

## 🎮 Como jogar

- A cada rodada, **5 tesouros** são sorteados aleatoriamente
- O nome do objeto aparece na tela — aponte a câmera para encontrá-lo
- Cada objeto tem um **timer individual** — se o tempo acabar, passa pro próximo!
- A barra de progresso confirma a detecção — mantenha o objeto na câmera por alguns frames
- **Pontuação por dificuldade:**
  - 🔵 Fácil (sofá, TV, geladeira...): +1 pt
  - 🟡 Médio (laptop, celular, teclado...): +2 pts
  - 🔴 Difícil (tesoura, vaso, escova...): +3 pts
- Ao fim da rodada, veja sua pontuação total e quantos tesouros perdeu por tempo

---

## 🧠 Arquitetura

```
Celular (browser)
  ├── <video> — stream da câmera traseira
  ├── createImageBitmap() — captura frames (~3 fps)
  └── Web Worker
        ├── TensorFlow.js
        ├── YOLOv5s (model.json + .bin)
        └── Retorna detecções → lógica do jogo → UI
```

O worker roda em thread separada, mantendo a UI fluida mesmo durante a inferência.

---

## 🤖 Sobre o modelo

O modelo usado é o **YOLOv5s** (small), treinado no dataset **COCO** com 80 classes de objetos do cotidiano. Os pesos foram convertidos do formato PyTorch (`.pt`) para TensorFlow.js usando o `tensorflowjs_converter`.

| Modelo              | Tamanho | Precisão (mAP) |
| ------------------- | ------- | -------------- |
| YOLOv5n             | ~7 MB   | 28%            |
| **YOLOv5s** (atual) | ~28 MB  | **37%**        |

Para converter uma versão mais recente do modelo:

```bash
# Dentro da pasta yolov5 com o venv ativado
python export.py --weights yolov5s.pt --include tfjs

# Converter manualmente se necessário
~/yolo-env/bin/tensorflowjs_converter \
  --input_format=tf_frozen_model \
  --output_node_names='Identity,Identity_1,Identity_2,Identity_3' \
  yolov5s.pb \
  yolov5s_web_model
```

---

## 🛠️ Stack

- [TensorFlow.js](https://www.tensorflow.org/js) — inferência no browser
- [YOLOv5](https://github.com/ultralytics/yolov5) — detecção de objetos em tempo real
- [Vite](https://vitejs.dev/) — dev server com HTTPS
- Web Workers API — inferência em thread separada
