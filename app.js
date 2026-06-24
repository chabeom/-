const SLOT_LABELS = {
  "top-left": "왼쪽 위",
  "top-right": "오른쪽 위",
  "bottom-left": "왼쪽 아래",
  "bottom-right": "오른쪽 아래",
};

const DEFAULT_PARTICIPANTS = [
  { name: "닉네임1", slot: "top-left" },
  { name: "닉네임2", slot: "top-right" },
  { name: "닉네임3", slot: "bottom-left" },
  { name: "닉네임4", slot: "bottom-right" },
];

const canvas = document.querySelector("#zoomCanvas");
const ctx = canvas.getContext("2d");
const participantList = document.querySelector("#participantList");
const participantTemplate = document.querySelector("#participantTemplate");
const meetingTitleInput = document.querySelector("#meetingTitle");
const sizePresetInput = document.querySelector("#sizePreset");
const showChromeInput = document.querySelector("#showChrome");
const showDividersInput = document.querySelector("#showDividers");
const downloadBtn = document.querySelector("#downloadBtn");
const resetBtn = document.querySelector("#resetBtn");
const refreshBtn = document.querySelector("#refreshBtn");
const canvasSizeLabel = document.querySelector("#canvasSizeLabel");

const TOPBAR_REFERENCE_SIZE = { width: 1912, height: 45 };
const TOOLBAR_REFERENCE_SIZE = { width: 1912, height: 66 };
const ZOOM_REFERENCE_SIZE = { width: 1912, height: 1122 };
const ZOOM_GRID_REFERENCE = {
  x: 74,
  y: 61,
  slotWidth: 884,
  slotHeight: 497.5,
};
const SLOT_IMAGE_Y_SHIFT = {
  "top-right": -0.05,
  "bottom-right": -0.05,
};
const BACKGROUND_BLIND = {
  blurRatio: 0.03,
  minBlur: 12,
  overlay: "rgba(0, 0, 0, 0.12)",
  maskMinWidth: 130,
  maskMaxWidth: 240,
  maskEdge: 5,
  maskGrow: 2,
  maskFeather: 1,
};
const ACTIVE_BORDER = {
  color: "#7bdc52",
  width: 1.7,
};
const topbarReferenceImage = new Image();
const toolbarReferenceImage = new Image();
let topbarReferenceReady = false;
let toolbarReferenceReady = false;

topbarReferenceImage.onload = () => {
  topbarReferenceReady = true;
  render();
};
topbarReferenceImage.src = "./assets/zoom-topbar-reference.png";

toolbarReferenceImage.onload = () => {
  toolbarReferenceReady = true;
  render();
};
toolbarReferenceImage.src = "./assets/zoom-toolbar-reference.png";

let participants = DEFAULT_PARTICIPANTS.map((person) => ({
  ...person,
  image: null,
  fileName: "",
  fit: "cover",
  backgroundBlind: false,
  activeBorder: false,
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
}));

function buildParticipantCards() {
  participantList.innerHTML = "";

  participants.forEach((person, index) => {
    const node = participantTemplate.content.firstElementChild.cloneNode(true);
    const number = node.querySelector(".participant-number");
    const photoInput = node.querySelector(".photo-input");
    const nameInput = node.querySelector(".name-input");
    const slotSelect = node.querySelector(".slot-select");
    const fitSelect = node.querySelector(".fit-select");
    const backgroundBlindInput = node.querySelector(".background-blind-input");
    const activeBorderInput = node.querySelector(".active-border-input");
    const zoomInput = node.querySelector(".zoom-input");
    const offsetXInput = node.querySelector(".offset-x-input");
    const offsetYInput = node.querySelector(".offset-y-input");

    number.textContent = `참가자 ${index + 1}`;
    nameInput.value = person.name;
    slotSelect.value = person.slot;
    fitSelect.value = person.fit;
    backgroundBlindInput.checked = person.backgroundBlind;
    activeBorderInput.checked = person.activeBorder;
    zoomInput.value = person.zoom;
    offsetXInput.value = person.offsetX;
    offsetYInput.value = person.offsetY;

    if (person.fileName) {
      node.querySelector(".file-button").firstChild.textContent = person.fileName;
    }

    photoInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      loadImageFile(file).then((image) => {
        participants[index].image = image;
        participants[index].fileName = trimFileName(file.name);
        buildParticipantCards();
        render();
      });
    });

    nameInput.addEventListener("input", (event) => {
      participants[index].name = event.target.value;
      render();
    });

    slotSelect.addEventListener("change", (event) => {
      moveParticipantToSlot(index, event.target.value);
      buildParticipantCards();
      render();
    });

    fitSelect.addEventListener("change", (event) => {
      participants[index].fit = event.target.value;
      render();
    });

    backgroundBlindInput.addEventListener("change", (event) => {
      participants[index].backgroundBlind = event.target.checked;
      render();
    });

    activeBorderInput.addEventListener("change", (event) => {
      participants[index].activeBorder = event.target.checked;
      render();
    });

    zoomInput.addEventListener("input", (event) => {
      participants[index].zoom = Number(event.target.value);
      render();
    });

    offsetXInput.addEventListener("input", (event) => {
      participants[index].offsetX = Number(event.target.value);
      render();
    });

    offsetYInput.addEventListener("input", (event) => {
      participants[index].offsetY = Number(event.target.value);
      render();
    });

    participantList.appendChild(node);
  });
}

function moveParticipantToSlot(index, slot) {
  const currentSlot = participants[index].slot;
  const otherIndex = participants.findIndex((person, personIndex) => {
    return personIndex !== index && person.slot === slot;
  });

  if (otherIndex >= 0) {
    participants[otherIndex].slot = currentSlot;
  }

  participants[index].slot = slot;
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };
    image.src = url;
  });
}

function trimFileName(name) {
  if (name.length <= 14) return name;
  const dotIndex = name.lastIndexOf(".");
  const extension = dotIndex >= 0 ? name.slice(dotIndex) : "";
  return `${name.slice(0, 10)}...${extension}`;
}

function render() {
  const [width, height] = sizePresetInput.value.split("x").map(Number);
  canvas.width = width;
  canvas.height = height;
  canvasSizeLabel.textContent = `${width} x ${height}`;

  drawBase(width, height);
  const grid = getGridRect(width, height);
  drawVideoGrid(grid);

  if (showChromeInput.checked) {
    drawTopBar(width, height);
    drawBottomToolbar(width, height);
  }
}

function drawBase(width, height) {
  ctx.fillStyle = "#111417";
  ctx.fillRect(0, 0, width, height);
}

function getGridRect(width, height) {
  if (!showChromeInput.checked) {
    const margin = Math.round(Math.min(width, height) * 0.035);
    const gridWidth = width - margin * 2;
    const slotWidth = Math.floor(gridWidth / 2);
    const slotHeight = Math.floor(slotWidth / 1.78);
    const gridHeight = slotHeight * 2;
    return {
      x: Math.round((width - slotWidth * 2) / 2),
      y: Math.round((height - gridHeight) / 2),
      slotWidth,
      slotHeight,
    };
  }

  const scaleX = width / ZOOM_REFERENCE_SIZE.width;
  const scaleY = height / ZOOM_REFERENCE_SIZE.height;

  return {
    x: ZOOM_GRID_REFERENCE.x * scaleX,
    y: ZOOM_GRID_REFERENCE.y * scaleY,
    slotWidth: ZOOM_GRID_REFERENCE.slotWidth * scaleX,
    slotHeight: ZOOM_GRID_REFERENCE.slotHeight * scaleY,
  };
}

function drawVideoGrid(grid) {
  const orderedSlots = ["top-left", "top-right", "bottom-left", "bottom-right"];
  const renderedSlots = [];

  orderedSlots.forEach((slot) => {
    const rect = getSlotRect(grid, slot);
    const person = participants.find((participant) => participant.slot === slot);
    renderedSlots.push({ rect, person });

    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.width, rect.height);
    ctx.clip();

    if (person?.image) {
      drawFittedImage(person, rect, slot);
    } else {
      drawPlaceholder(rect, SLOT_LABELS[slot]);
    }

    ctx.restore();
  });

  if (showDividersInput.checked) {
    drawGridLines(grid);
  }

  renderedSlots.forEach(({ rect, person }) => {
    if (person?.activeBorder) {
      drawActiveBorder(rect);
    }
  });

  renderedSlots.forEach(({ rect, person }) => {
    if (person?.name?.trim()) {
      drawNameTag(person.name.trim(), rect);
    }
  });
}

function getSlotRect(grid, slot) {
  const isRight = slot.endsWith("right");
  const isBottom = slot.startsWith("bottom");
  return {
    x: grid.x + (isRight ? grid.slotWidth : 0),
    y: grid.y + (isBottom ? grid.slotHeight : 0),
    width: grid.slotWidth,
    height: grid.slotHeight,
  };
}

function drawFittedImage(person, rect, slot) {
  const image = person.image;
  const naturalRatio = image.width / image.height;
  const targetRatio = rect.width / rect.height;
  const baseScale =
    person.fit === "contain"
      ? naturalRatio > targetRatio
        ? rect.width / image.width
        : rect.height / image.height
      : naturalRatio > targetRatio
        ? rect.height / image.height
        : rect.width / image.width;

  const scale = baseScale * person.zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const extraX = Math.max(0, drawWidth - rect.width);
  const extraY = Math.max(0, drawHeight - rect.height);
  const offsetX = (person.offsetX / 100) * (extraX / 2);
  const offsetY = (person.offsetY / 100) * (extraY / 2);
  const slotOffsetY = rect.height * (SLOT_IMAGE_Y_SHIFT[slot] || 0);
  const x = rect.x + (rect.width - drawWidth) / 2 + offsetX;
  const y = rect.y + (rect.height - drawHeight) / 2 + offsetY + slotOffsetY;

  ctx.fillStyle = "#111";
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  if (person.backgroundBlind) {
    drawBackgroundBlindImage(image, x, y, drawWidth, drawHeight, rect);
    return;
  }

  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawActiveBorder(rect) {
  const lineWidth = ACTIVE_BORDER.width;
  const inset = lineWidth / 2;

  ctx.save();
  ctx.strokeStyle = ACTIVE_BORDER.color;
  ctx.lineWidth = lineWidth;
  ctx.strokeRect(rect.x + inset, rect.y + inset, rect.width - lineWidth, rect.height - lineWidth);
  ctx.restore();
}

function drawBackgroundBlindImage(image, x, y, drawWidth, drawHeight, rect) {
  const blur = Math.max(BACKGROUND_BLIND.minBlur, Math.round(rect.width * BACKGROUND_BLIND.blurRatio));
  const bleed = blur * 2;
  const maskCanvas = createForegroundMask(image, x, y, drawWidth, drawHeight, rect);
  const foregroundCanvas = makeCanvas(Math.ceil(rect.width), Math.ceil(rect.height));
  const foregroundCtx = foregroundCanvas.getContext("2d");

  ctx.save();
  ctx.filter = `blur(${blur}px)`;
  ctx.drawImage(image, x - bleed, y - bleed, drawWidth + bleed * 2, drawHeight + bleed * 2);
  ctx.restore();

  ctx.fillStyle = BACKGROUND_BLIND.overlay;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  foregroundCtx.drawImage(image, x - rect.x, y - rect.y, drawWidth, drawHeight);
  foregroundCtx.globalCompositeOperation = "destination-in";
  foregroundCtx.imageSmoothingEnabled = true;
  foregroundCtx.drawImage(maskCanvas, 0, 0, foregroundCanvas.width, foregroundCanvas.height);
  ctx.drawImage(foregroundCanvas, rect.x, rect.y, rect.width, rect.height);
}

function createForegroundMask(image, x, y, drawWidth, drawHeight, rect) {
  const sampleWidth = Math.round(
    Math.min(BACKGROUND_BLIND.maskMaxWidth, Math.max(BACKGROUND_BLIND.maskMinWidth, rect.width / 3)),
  );
  const sampleHeight = Math.max(1, Math.round(sampleWidth * (rect.height / rect.width)));
  const sampleCanvas = makeCanvas(sampleWidth, sampleHeight);
  const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  const scaleX = sampleWidth / rect.width;
  const scaleY = sampleHeight / rect.height;

  sampleCtx.fillStyle = "#000";
  sampleCtx.fillRect(0, 0, sampleWidth, sampleHeight);
  sampleCtx.drawImage(
    image,
    (x - rect.x) * scaleX,
    (y - rect.y) * scaleY,
    drawWidth * scaleX,
    drawHeight * scaleY,
  );

  const imageData = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight);
  const bg = estimateBackgroundColor(imageData.data, sampleWidth, sampleHeight);
  const candidates = buildForegroundCandidates(imageData.data, sampleWidth, sampleHeight, bg);
  let mask = keepConnectedForeground(candidates, imageData.data, sampleWidth, sampleHeight, bg);

  if (!mask.some(Boolean)) {
    mask = buildFallbackForegroundMask(sampleWidth, sampleHeight);
  }

  mask = growMask(mask, sampleWidth, sampleHeight, BACKGROUND_BLIND.maskGrow);
  mask = softenMask(mask, sampleWidth, sampleHeight, BACKGROUND_BLIND.maskFeather);

  return maskToCanvas(mask, sampleWidth, sampleHeight);
}

function makeCanvas(width, height) {
  const nextCanvas = document.createElement("canvas");
  nextCanvas.width = width;
  nextCanvas.height = height;
  return nextCanvas;
}

function estimateBackgroundColor(data, width, height) {
  const edge = Math.min(BACKGROUND_BLIND.maskEdge, Math.floor(Math.min(width, height) / 4));
  const total = { r: 0, g: 0, b: 0, count: 0 };
  const samples = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isCorner =
        (x < edge * 3 || x >= width - edge * 3) && (y < edge * 3 || y >= height - edge * 3);
      const isOuterEdge = y < edge || x < edge || x >= width - edge;

      if (!isCorner && !isOuterEdge) continue;

      const index = (y * width + x) * 4;
      const sample = {
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
      };
      samples.push(sample);
      total.r += sample.r;
      total.g += sample.g;
      total.b += sample.b;
      total.count += 1;
    }
  }

  const mean = {
    r: total.r / total.count,
    g: total.g / total.count,
    b: total.b / total.count,
  };
  const meanDistance =
    samples.reduce((sum, sample) => sum + colorDistance(sample.r, sample.g, sample.b, mean), 0) /
    Math.max(1, samples.length);

  return {
    ...mean,
    luma: getLuma(mean.r, mean.g, mean.b),
    threshold: Math.max(28, Math.min(86, meanDistance * 2.1 + 26)),
  };
}

function buildForegroundCandidates(data, width, height, bg) {
  const candidates = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const pixelIndex = index * 4;
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      const distance = colorDistance(r, g, b, bg);
      const prior = getPersonPrior(x / width, y / height);
      const threshold = bg.threshold * (prior > 0.2 ? 0.58 : 1);
      const darkerThanBackground = bg.luma - getLuma(r, g, b) > 22;

      if (
        distance > threshold ||
        (prior > 0.52 && distance > bg.threshold * 0.38) ||
        (prior > 0.35 && darkerThanBackground)
      ) {
        candidates[index] = 1;
      }
    }
  }

  return candidates;
}

function keepConnectedForeground(candidates, data, width, height, bg) {
  const mask = new Uint8Array(width * height);
  const queue = [];
  let cursor = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!candidates[index] || getPersonPrior(x / width, y / height) < 0.42) continue;

      const pixelIndex = index * 4;
      const distance = colorDistance(data[pixelIndex], data[pixelIndex + 1], data[pixelIndex + 2], bg);
      if (distance < bg.threshold * 0.34) continue;

      mask[index] = 1;
      queue.push(index);
    }
  }

  while (cursor < queue.length) {
    const index = queue[cursor];
    cursor += 1;
    const x = index % width;
    const y = Math.floor(index / width);

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

        const nextIndex = ny * width + nx;
        if (mask[nextIndex] || !candidates[nextIndex]) continue;
        if (getPersonPrior(nx / width, ny / height) < 0.015) continue;

        mask[nextIndex] = 1;
        queue.push(nextIndex);
      }
    }
  }

  return mask;
}

function buildFallbackForegroundMask(width, height) {
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (getPersonPrior(x / width, y / height) > 0.34) {
        mask[y * width + x] = 1;
      }
    }
  }

  return mask;
}

function getPersonPrior(x, y) {
  const head = ellipseScore(x, y, 0.5, 0.35, 0.18, 0.22);
  const body = ellipseScore(x, y, 0.5, 0.84, 0.38, 0.44);
  const shoulder = ellipseScore(x, y, 0.5, 0.72, 0.44, 0.23);
  return Math.max(head, body, shoulder);
}

function ellipseScore(x, y, centerX, centerY, radiusX, radiusY) {
  const distance = ((x - centerX) / radiusX) ** 2 + ((y - centerY) / radiusY) ** 2;
  return Math.max(0, 1 - distance);
}

function growMask(mask, width, height, iterations) {
  let current = mask;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Uint8Array(current);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const index = y * width + x;
        if (current[index]) continue;

        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (current[(y + dy) * width + x + dx]) {
              next[index] = 1;
            }
          }
        }
      }
    }

    current = next;
  }

  return current;
}

function softenMask(mask, width, height, radius) {
  const alpha = new Uint8ClampedArray(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let count = 0;
      let total = 0;

      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

          total += mask[ny * width + nx];
          count += 1;
        }
      }

      alpha[y * width + x] = Math.round((total / count) * 255);
    }
  }

  return alpha;
}

function maskToCanvas(alpha, width, height) {
  const maskCanvas = makeCanvas(width, height);
  const maskCtx = maskCanvas.getContext("2d");
  const imageData = maskCtx.createImageData(width, height);

  for (let index = 0; index < alpha.length; index += 1) {
    const pixelIndex = index * 4;
    imageData.data[pixelIndex] = 255;
    imageData.data[pixelIndex + 1] = 255;
    imageData.data[pixelIndex + 2] = 255;
    imageData.data[pixelIndex + 3] = alpha[index];
  }

  maskCtx.putImageData(imageData, 0, 0);
  return maskCanvas;
}

function colorDistance(r, g, b, target) {
  const dr = r - target.r;
  const dg = g - target.g;
  const db = b - target.b;
  return Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11);
}

function getLuma(r, g, b) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function drawPlaceholder(rect, label) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
  gradient.addColorStop(0, "#24272d");
  gradient.addColorStop(1, "#15171b");
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  ctx.fillStyle = "#7f8a96";
  ctx.font = `${Math.max(15, Math.round(rect.width * 0.027))}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
}

function drawNameTag(name, rect) {
  ctx.save();

  const fontSize = Math.max(10, Math.round(rect.width * 0.016));
  const paddingX = Math.round(fontSize * 0.45);
  const tagHeight = Math.round(fontSize * 1.45);
  const maxWidth = rect.width - 18;
  const displayName = fitText(name, maxWidth - paddingX * 2, fontSize);

  ctx.font = `300 ${fontSize}px "Malgun Gothic", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  const textWidth = ctx.measureText(displayName).width;
  const tagWidth = Math.min(maxWidth, Math.ceil(textWidth + paddingX * 2));
  const x = rect.x + 5;
  const y = rect.y + rect.height - tagHeight - 5;

  roundedRect(x, y, tagWidth, tagHeight, Math.round(tagHeight * 0.42));
  ctx.fillStyle = "rgba(26, 28, 28, 0.53)";
  ctx.fill();

  ctx.fillStyle = "#f3f5f4";
  ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
  ctx.shadowBlur = 1;
  ctx.shadowOffsetY = 0.4;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(displayName, x + paddingX, y + tagHeight / 2 + 0.5);
  ctx.restore();
}

function fitText(text, maxWidth, fontSize) {
  ctx.font = `300 ${fontSize}px "Malgun Gothic", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  if (ctx.measureText(text).width <= maxWidth) return text;

  let next = text;
  while (next.length > 1 && ctx.measureText(`${next}...`).width > maxWidth) {
    next = next.slice(0, -1);
  }
  return `${next}...`;
}

function drawGridLines(grid) {
  const middleX = Math.round(grid.x + grid.slotWidth) + 0.5;
  const middleY = Math.round(grid.y + grid.slotHeight) + 0.5;

  ctx.strokeStyle = "#050505";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(middleX, grid.y);
  ctx.lineTo(middleX, grid.y + grid.slotHeight * 2);
  ctx.moveTo(grid.x, middleY);
  ctx.lineTo(grid.x + grid.slotWidth * 2, middleY);
  ctx.stroke();
}

function drawTopBar(width, height) {
  if (topbarReferenceReady) {
    const topbarHeight = Math.round(width * (TOPBAR_REFERENCE_SIZE.height / TOPBAR_REFERENCE_SIZE.width));
    ctx.drawImage(topbarReferenceImage, 0, 0, width, topbarHeight);
    return;
  }

  const title = meetingTitleInput.value.trim() || "Workplace";
  const scale = width / 1440;
  const fontSize = Math.max(12, Math.round(14 * scale));

  ctx.fillStyle = "#f3f4f6";
  ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(title, Math.round(1 * scale), Math.round(7 * scale));

  const iconY = Math.round(8 * scale);
  drawShield(width - Math.round(158 * scale), iconY, scale);
  drawViewIcon(width - Math.round(106 * scale), iconY, scale);
  drawFullIcon(width - Math.round(48 * scale), iconY, scale);
}

function drawTopBarTitle(title, scale) {
  const labelSize = Math.max(8, Math.round(12 * scale));
  const fontSize = Math.max(12, Math.round(18 * scale));
  const x = Math.round(2 * scale);
  const y = Math.round(1 * scale);
  const maxWidth = Math.round(320 * scale);
  let displayTitle = title;

  ctx.font = `700 ${fontSize}px Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  while (displayTitle.length > 1 && ctx.measureText(displayTitle).width > maxWidth) {
    displayTitle = displayTitle.slice(0, -1);
  }

  if (displayTitle !== title) {
    displayTitle = `${displayTitle.slice(0, Math.max(1, displayTitle.length - 3))}...`;
  }

  ctx.fillStyle = "#f0f4f6";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = `700 ${labelSize}px Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText("zoom", x, y);
  ctx.font = `700 ${fontSize}px Arial, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.fillText(displayTitle, x, y + Math.round(11 * scale));
}

function drawShield(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#48d66e";
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(17, 3);
  ctx.lineTo(16, 12);
  ctx.quadraticCurveTo(13, 19, 9, 21);
  ctx.quadraticCurveTo(5, 19, 2, 12);
  ctx.lineTo(1, 3);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#022b10";
  ctx.lineWidth = 1.7;
  ctx.beginPath();
  ctx.moveTo(5.6, 9.5);
  ctx.lineTo(8.2, 12.2);
  ctx.lineTo(12.8, 6.8);
  ctx.stroke();
  ctx.restore();
}

function drawViewIcon(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#fafafa";
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      ctx.fillRect(col * 5, row * 5, 3, 3);
    }
  }
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText("보기", 19, 9);
  ctx.restore();
}

function drawFullIcon(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 11, 9);
  ctx.strokeRect(8, 7, 11, 10);
  ctx.restore();
}

function drawBottomToolbar(width, height) {
  if (toolbarReferenceReady) {
    const toolbarHeight = Math.round(
      width * (TOOLBAR_REFERENCE_SIZE.height / TOOLBAR_REFERENCE_SIZE.width),
    );
    ctx.drawImage(toolbarReferenceImage, 0, height - toolbarHeight, width, toolbarHeight);
    return;
  }

  const scale = width / 1440;
  const barHeight = Math.max(56, Math.round(height * 0.08));
  const y = height - barHeight;

  ctx.fillStyle = "rgba(3, 3, 3, 0.96)";
  ctx.fillRect(0, y, width, barHeight);

  drawToolbarLeft(y, scale);
  drawToolbarCenter(width, y, barHeight, scale);
  drawLeaveIcon(width - Math.round(46 * scale), y + Math.round(22 * scale), scale);
}

function drawToolbarLeft(y, scale) {
  const baseY = y + Math.round(21 * scale);
  drawMic(8 * scale, baseY, scale);
  drawCaret(43 * scale, baseY + 9 * scale, scale);
  drawCamera(90 * scale, baseY + 3 * scale, scale);
  drawCaret(132 * scale, baseY + 9 * scale, scale);
}

function drawToolbarCenter(width, y, barHeight, scale) {
  const centerY = y + barHeight / 2 + 3 * scale;
  const items = [
    { dx: -160, fn: drawPeople, text: "4" },
    { dx: -75, fn: drawChat, text: "" },
    { dx: 4, fn: drawHeart, text: "" },
    { dx: 84, fn: drawShare, text: "" },
    { dx: 166, fn: drawSparkle, text: "" },
    { dx: 250, fn: drawMore, text: "" },
  ];

  items.forEach((item) => {
    const x = width / 2 + item.dx * scale;
    item.fn(x, centerY, scale);
    if (item.text) {
      ctx.fillStyle = "#e8edf2";
      ctx.font = `${Math.round(13 * scale)}px system-ui, sans-serif`;
      ctx.fillText(item.text, x + 20 * scale, centerY + 3 * scale);
      drawCaret(x + 42 * scale, centerY + 6 * scale, scale);
    }
  });
}

function drawMic(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundedRect(4, 0, 9, 18, 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.quadraticCurveTo(8, 26, 17, 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(8.5, 26);
  ctx.lineTo(8.5, 31);
  ctx.moveTo(2, 31);
  ctx.lineTo(15, 31);
  ctx.stroke();
  ctx.restore();
}

function drawCamera(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 3, 19, 15);
  ctx.beginPath();
  ctx.moveTo(19, 8);
  ctx.lineTo(29, 2);
  ctx.lineTo(29, 19);
  ctx.lineTo(19, 14);
  ctx.stroke();
  ctx.restore();
}

function drawPeople(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(8, 4, 4, 0, Math.PI * 2);
  ctx.arc(18, 7, 3.5, 0, Math.PI * 2);
  ctx.moveTo(1, 21);
  ctx.quadraticCurveTo(8, 12, 16, 21);
  ctx.moveTo(13, 21);
  ctx.quadraticCurveTo(19, 14, 25, 21);
  ctx.stroke();
  ctx.restore();
}

function drawChat(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 24, 17);
  ctx.beginPath();
  ctx.moveTo(6, 17);
  ctx.lineTo(3, 24);
  ctx.lineTo(12, 17);
  ctx.stroke();
  ctx.restore();
}

function drawHeart(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(12, 22);
  ctx.bezierCurveTo(-4, 12, 2, 0, 11, 6);
  ctx.bezierCurveTo(21, 0, 28, 12, 12, 22);
  ctx.stroke();
  ctx.restore();
}

function drawShare(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#73f398";
  roundedRect(-10, -8, 24, 21, 4);
  ctx.fill();
  ctx.strokeStyle = "#063c18";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, 7);
  ctx.lineTo(2, -2);
  ctx.moveTo(-3, 2);
  ctx.lineTo(2, -3);
  ctx.lineTo(7, 2);
  ctx.stroke();
  ctx.restore();
}

function drawSparkle(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#cfe7ff";
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(5, -3);
  ctx.lineTo(16, 2);
  ctx.lineTo(5, 7);
  ctx.lineTo(0, 18);
  ctx.lineTo(-5, 7);
  ctx.lineTo(-16, 2);
  ctx.lineTo(-5, -3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(13, -12, 3, 0, Math.PI * 2);
  ctx.arc(20, -5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMore(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#fff";
  [-5, 0, 5].forEach((dotX) => {
    ctx.beginPath();
    ctx.arc(dotX, 0, 1.6, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawLeaveIcon(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(8, 2, 4, 0, Math.PI * 2);
  ctx.moveTo(8, 8);
  ctx.lineTo(8, 18);
  ctx.moveTo(0, 13);
  ctx.lineTo(16, 13);
  ctx.moveTo(8, 18);
  ctx.lineTo(2, 29);
  ctx.moveTo(8, 18);
  ctx.lineTo(14, 29);
  ctx.stroke();
  ctx.strokeStyle = "#ff3d5a";
  ctx.strokeRect(20, 2, 6, 28);
  ctx.restore();
}

function drawCaret(x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "#9199a3";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(4, 0);
  ctx.lineTo(8, 4);
  ctx.stroke();
  ctx.restore();
}

function roundedRect(x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

meetingTitleInput.addEventListener("input", render);
sizePresetInput.addEventListener("change", render);
showChromeInput.addEventListener("change", render);
showDividersInput.addEventListener("change", render);
refreshBtn.addEventListener("click", render);

downloadBtn.addEventListener("click", () => {
  render();
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  link.download = `zoom-proof-${timestamp}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

resetBtn.addEventListener("click", () => {
  participants = DEFAULT_PARTICIPANTS.map((person) => ({
    ...person,
    image: null,
    fileName: "",
    fit: "cover",
    backgroundBlind: false,
    activeBorder: false,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
  }));
  meetingTitleInput.value = "Workplace";
  sizePresetInput.value = "1912x1122";
  showChromeInput.checked = true;
  showDividersInput.checked = true;
  buildParticipantCards();
  render();
});

buildParticipantCards();
render();
