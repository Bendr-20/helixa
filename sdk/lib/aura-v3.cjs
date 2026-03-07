var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var aura_exports = {};
__export(aura_exports, {
  generateAura: () => generateAura,
  getAuraRarity: () => getAuraRarity
});
module.exports = __toCommonJS(aura_exports);
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = s * 1664525 + 1013904223 & 4294967295;
    return (s >>> 0) / 4294967295;
  };
}
const FRAMEWORK_SHAPES = {
  eliza: { faceRadius: 0.42, baseHue: 280 },
  openclaw: { faceRadius: 0.4, baseHue: 150 },
  langchain: { faceRadius: 0.41, baseHue: 200 },
  crewai: { faceRadius: 0.39, baseHue: 30 },
  autogpt: { faceRadius: 0.41, baseHue: 0 },
  bankr: { faceRadius: 0.41, baseHue: 45 },
  virtuals: { faceRadius: 0.42, baseHue: 320 },
  custom: { faceRadius: 0.4, baseHue: 60 }
};
const ALIGNMENT_SHIFT = {
  "lawful-good": 0,
  "neutral-good": 10,
  "chaotic-good": 20,
  "lawful-neutral": -10,
  "true-neutral": 0,
  "chaotic-neutral": 30,
  "lawful-evil": -20,
  "neutral-evil": -30,
  "chaotic-evil": -40
};
function getRarity(points, mutationCount) {
  const score = points + mutationCount * 50;
  if (score >= 1e3) return "legendary";
  if (score >= 500) return "epic";
  if (score >= 200) return "rare";
  return "common";
}
const RARITY_COLORS = {
  common: { label: "Common", borderOpacity: 0 },
  rare: { label: "Rare", borderOpacity: 0.3 },
  epic: { label: "Epic", borderOpacity: 0.5 },
  legendary: { label: "Legendary", borderOpacity: 0.7 }
};
const EYE_TYPES = [
  "round",
  "diamond",
  "slit",
  "hollow",
  "cross",
  "square",
  "dot",
  "scanner",
  "void",
  "nova"
];
function getEyeType(specialization, rng, rarity) {
  const specMap = {
    "researcher": 0,
    "trader": 1,
    "guardian": 2,
    "oracle": 3,
    "creator": 4,
    "operator": 5,
    "analyst": 0,
    "defi": 1,
    "security": 2,
    "social": 6,
    "infrastructure": 5,
    "governance": 3
  };
  let base = specMap[specialization] !== void 0 ? specMap[specialization] : Math.floor(rng() * 7);
  if (rarity === "legendary" && rng() < 0.6) base = 9;
  else if (rarity === "epic" && rng() < 0.4) base = 7 + Math.floor(rng() * 2);
  else if (rarity === "rare" && rng() < 0.25) base = 7;
  return base;
}
function drawEye(grid, G, ex, ey, eyeR, eyeType) {
  switch (eyeType) {
    case 0:
      for (let dy = -eyeR + 1; dy <= eyeR - 1; dy++)
        for (let dx = -eyeR + 1; dx <= eyeR - 1; dx++)
          if (Math.abs(dx) + Math.abs(dy) <= eyeR) {
            if (ey + dy >= 0 && ey + dy < G && ex + dx >= 0 && ex + dx < G)
              grid[ey + dy][ex + dx] = 2;
          }
      break;
    case 1:
      for (let d = 0; d <= eyeR; d++) {
        if (ey - d >= 0) grid[ey - d][ex] = 2;
        if (ey + d < G) grid[ey + d][ex] = 2;
        if (ex - d >= 0) grid[ey][ex - d] = 2;
        if (ex + d < G) grid[ey][ex + d] = 2;
      }
      break;
    case 2:
      for (let dx = -eyeR; dx <= eyeR; dx++)
        if (ex + dx >= 0 && ex + dx < G) grid[ey][ex + dx] = 2;
      break;
    case 3:
      for (let dy = -eyeR; dy <= eyeR; dy++)
        for (let dx = -eyeR; dx <= eyeR; dx++)
          if (dx * dx + dy * dy <= eyeR * eyeR) {
            if (ey + dy >= 0 && ey + dy < G && ex + dx >= 0 && ex + dx < G)
              grid[ey + dy][ex + dx] = 2;
          }
      grid[ey][ex] = 0;
      break;
    case 4:
      for (let d = 0; d <= eyeR; d++) {
        if (ey - d >= 0) grid[ey - d][ex] = 2;
        if (ey + d < G) grid[ey + d][ex] = 2;
        if (ex - d >= 0) grid[ey][ex - d] = 2;
        if (ex + d < G) grid[ey][ex + d] = 2;
      }
      for (let d = 1; d <= eyeR - 1; d++) {
        if (ey - d >= 0 && ex - d >= 0) grid[ey - d][ex - d] = 2;
        if (ey - d >= 0 && ex + d < G) grid[ey - d][ex + d] = 2;
        if (ey + d < G && ex - d >= 0) grid[ey + d][ex - d] = 2;
        if (ey + d < G && ex + d < G) grid[ey + d][ex + d] = 2;
      }
      break;
    case 5:
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -eyeR + 1; dx <= eyeR - 1; dx++)
          if (ey + dy >= 0 && ey + dy < G && ex + dx >= 0 && ex + dx < G)
            grid[ey + dy][ex + dx] = 2;
      break;
    case 6:
      grid[ey][ex] = 2;
      if (ex + 1 < G) grid[ey][ex + 1] = 2;
      break;
    case 7:
      for (let dx = -eyeR - 1; dx <= eyeR + 1; dx++)
        if (ex + dx >= 0 && ex + dx < G) grid[ey][ex + dx] = 2;
      if (ey - 1 >= 0) grid[ey - 1][ex] = 2;
      if (ey + 1 < G) grid[ey + 1][ex] = 2;
      break;
    case 8:
      for (let dy = -eyeR - 1; dy <= eyeR + 1; dy++)
        for (let dx = -eyeR - 1; dx <= eyeR + 1; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist <= eyeR + 1 && dist >= eyeR - 0.5) {
            if (ey + dy >= 0 && ey + dy < G && ex + dx >= 0 && ex + dx < G)
              grid[ey + dy][ex + dx] = 2;
          }
        }
      break;
    case 9:
      for (let d = 0; d <= eyeR + 1; d++) {
        if (ey - d >= 0) grid[ey - d][ex] = 2;
        if (ey + d < G) grid[ey + d][ex] = 2;
        if (ex - d >= 0) grid[ey][ex - d] = 2;
        if (ex + d < G) grid[ey][ex + d] = 2;
        if (ey - d >= 0 && ex - d >= 0) grid[ey - d][ex - d] = 2;
        if (ey - d >= 0 && ex + d < G) grid[ey - d][ex + d] = 2;
        if (ey + d < G && ex - d >= 0) grid[ey + d][ex - d] = 2;
        if (ey + d < G && ex + d < G) grid[ey + d][ex + d] = 2;
      }
      grid[ey][ex] = 4;
      break;
  }
}
const MOUTH_TYPES = [
  "line",
  "smile",
  "smirk",
  "open",
  "dot",
  "frown",
  "zigzag",
  "fangs",
  "grin",
  "vortex"
];
function getMouthType(commStyle, rng, rarity) {
  const commMap = {
    "formal": 0,
    "casual": 1,
    "snarky": 2,
    "verbose": 3,
    "minimal": 4,
    "analytical": 0,
    "friendly": 1,
    "blunt": 5,
    "cryptic": 6,
    "diplomatic": 0
  };
  let base = commMap[commStyle] !== void 0 ? commMap[commStyle] : Math.floor(rng() * 7);
  if (rarity === "legendary" && rng() < 0.6) base = 9;
  else if (rarity === "epic" && rng() < 0.4) base = 7 + Math.floor(rng() * 2);
  else if (rarity === "rare" && rng() < 0.25) base = 7 + Math.floor(rng() * 2);
  return base;
}
function drawMouth(grid, G, cx, mouthY, mW, mouthType) {
  switch (mouthType) {
    case 0:
      for (let dx = -mW + 1; dx <= mW - 1; dx++) {
        const mx = Math.round(cx + dx);
        if (mx >= 0 && mx < G) grid[mouthY][mx] = 1;
      }
      break;
    case 1:
      for (let dx = -mW; dx <= mW; dx++) {
        const mx = Math.round(cx + dx);
        const curve = Math.round(0.3 * (dx * dx) / (mW || 1));
        const my = mouthY + curve;
        if (mx >= 0 && mx < G && my >= 0 && my < G) grid[my][mx] = 1;
        if (my + 1 < G && Math.abs(dx) < mW - 1 && mx >= 0 && mx < G) grid[my + 1][mx] = 1;
      }
      break;
    case 2:
      for (let dx = -mW; dx <= mW; dx++) {
        const mx = Math.round(cx + dx);
        const curve = dx > 0 ? Math.round(-0.2 * (dx * dx) / (mW || 1)) : Math.round(0.1 * (dx * dx) / (mW || 1));
        const my = mouthY + curve;
        if (mx >= 0 && mx < G && my >= 0 && my < G) grid[my][mx] = 1;
      }
      break;
    case 3:
      for (let dy = -1; dy <= 2; dy++)
        for (let dx = -mW + 1; dx <= mW - 1; dx++) {
          const mx = Math.round(cx + dx);
          const my = mouthY + dy;
          if (mx >= 0 && mx < G && my >= 0 && my < G) {
            if (dy === -1 || dy === 2 || Math.abs(dx) === mW - 1)
              grid[my][mx] = 1;
          }
        }
      break;
    case 4:
      grid[mouthY][Math.round(cx)] = 1;
      if (Math.round(cx) + 1 < G) grid[mouthY][Math.round(cx) + 1] = 1;
      break;
    case 5:
      for (let dx = -mW; dx <= mW; dx++) {
        const mx = Math.round(cx + dx);
        const curve = Math.round(-0.25 * (dx * dx) / (mW || 1));
        const my = mouthY + curve;
        if (mx >= 0 && mx < G && my >= 0 && my < G) grid[my][mx] = 1;
      }
      break;
    case 6:
      for (let dx = -mW + 1; dx <= mW - 1; dx++) {
        const mx = Math.round(cx + dx);
        const my = mouthY + (dx % 2 === 0 ? 0 : 1);
        if (mx >= 0 && mx < G && my >= 0 && my < G) grid[my][mx] = 1;
      }
      break;
    case 7:
      for (let dx = -mW + 1; dx <= mW - 1; dx++) {
        const mx = Math.round(cx + dx);
        if (mx >= 0 && mx < G) grid[mouthY][mx] = 1;
      }
      const fangL = Math.round(cx - mW * 0.5);
      const fangR = Math.round(cx + mW * 0.5);
      if (mouthY + 1 < G && fangL >= 0) grid[mouthY + 1][fangL] = 1;
      if (mouthY + 2 < G && fangL >= 0) grid[mouthY + 2][fangL] = 1;
      if (mouthY + 1 < G && fangR < G) grid[mouthY + 1][fangR] = 1;
      if (mouthY + 2 < G && fangR < G) grid[mouthY + 2][fangR] = 1;
      break;
    case 8:
      for (let dx = -mW - 1; dx <= mW + 1; dx++) {
        const mx = Math.round(cx + dx);
        const curve = Math.round(0.2 * (dx * dx) / (mW || 1));
        const my = mouthY + curve;
        if (mx >= 0 && mx < G && my >= 0 && my < G) grid[my][mx] = 1;
      }
      for (let dx = -mW + 1; dx <= mW - 1; dx += 2) {
        const mx = Math.round(cx + dx);
        if (mx >= 0 && mx < G && mouthY - 1 >= 0) grid[mouthY - 1][mx] = 1;
      }
      break;
    case 9:
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.sqrt(dx * dx + dy * dy);
          const mx = Math.round(cx + dx);
          const my = mouthY + dy;
          if (dist >= 1.2 && dist <= 2.2) {
            if (mx >= 0 && mx < G && my >= 0 && my < G) grid[my][mx] = 1;
          }
        }
      break;
  }
}
function buildPalette(address, riskTolerance, alignment) {
  const hash = simpleHash(address || "0x0");
  let hue = (hash % 360 + (ALIGNMENT_SHIFT[alignment] || 0) + 360) % 360;
  const sat = Math.max(30, Math.min(100, 65 + (riskTolerance - 5) * 5));
  return {
    primary: `hsl(${hue}, ${sat}%, 55%)`,
    secondary: `hsl(${(hue + 35) % 360}, ${sat - 10}%, 45%)`,
    accent: `hsl(${(hue + 180) % 360}, ${Math.min(100, sat + 10)}%, 60%)`,
    accentBright: `hsl(${(hue + 180) % 360}, ${Math.min(100, sat + 20)}%, 80%)`,
    glow: `hsl(${hue}, ${sat}%, 55%)`,
    hue,
    sat
  };
}
function generateAura(agentData, size = 400) {
  const G = 25;
  const cs = size / G;
  const address = agentData.agentAddress || agentData.address || "0x0000";
  const framework = agentData.framework || "custom";
  const name = agentData.name || "Agent";
  const traitCount = agentData.traitCount || 0;
  const mutationCount = agentData.mutationCount || 0;
  const soulbound = agentData.soulbound || false;
  const points = agentData.points || 0;
  const generation = agentData.generation || 0;
  const quirks = agentData.quirks || "";
  const humor = agentData.humor || "";
  const values = agentData.values || "";
  const origin = agentData.origin || "";
  const mission = agentData.mission || "";
  const credScore = agentData.credScore || 0;
  const humorMap = {
    "dry": "analytical",
    "sarcastic": "reactive",
    "dark": "volatile",
    "absurd": "creative",
    "wholesome": "empathetic",
    "wit": "analytical"
  };
  const humorKey = Object.keys(humorMap).find((k) => humor.toLowerCase().includes(k));
  const temperament = agentData.temperament || (humorKey ? humorMap[humorKey] : "analytical");
  const commStyle = agentData.communicationStyle || "formal";
  const riskTolerance = agentData.riskTolerance || 5;
  const autonomyLevel = agentData.autonomyLevel || 5;
  const alignmentFromV2 = riskTolerance >= 7 ? autonomyLevel >= 7 ? "chaotic-good" : "neutral-good" : riskTolerance <= 3 ? autonomyLevel >= 7 ? "lawful-neutral" : "lawful-good" : "true-neutral";
  const alignment = agentData.alignment || alignmentFromV2;
  const specHints = {
    "build": "engineer",
    "ship": "engineer",
    "code": "engineer",
    "research": "researcher",
    "analyze": "researcher",
    "data": "researcher",
    "trade": "trader",
    "defi": "trader",
    "yield": "trader",
    "art": "artist",
    "creat": "artist",
    "design": "artist",
    "guard": "guardian",
    "secur": "guardian",
    "protect": "guardian",
    "social": "diplomat",
    "connect": "diplomat",
    "communit": "diplomat"
  };
  const combined = (quirks + " " + values + " " + mission).toLowerCase();
  const specKey = Object.keys(specHints).find((k) => combined.includes(k));
  const specialization = agentData.specialization || (specKey ? specHints[specKey] : "researcher");
  const v2Seed = quirks + humor + values + origin;
  const seed = simpleHash(address + name + framework + temperament + alignment + specialization + riskTolerance + autonomyLevel + v2Seed);
  const rng = seededRandom(seed);
  const fwStyle = FRAMEWORK_SHAPES[framework] || FRAMEWORK_SHAPES.custom;
  const colors = buildPalette(address, riskTolerance, alignment);
  const cx = G / 2, cy = G / 2;
  const fR = G * fwStyle.faceRadius;
  const rarity = getRarity(points, mutationCount);
  const grid = Array.from({ length: G }, () => Array(G).fill(0));
  function qr(sx, sy) {
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 7; x++)
        if (y === 0 || y === 6 || x === 0 || x === 6 || y >= 2 && y <= 4 && x >= 2 && x <= 4) {
          if (sy + y < G && sx + x < G) grid[sy + y][sx + x] = 1;
        }
  }
  qr(0, 0);
  qr(G - 7, 0);
  qr(0, G - 7);
  for (let angle = 0; angle < 360; angle += 2) {
    const rad = angle * Math.PI / 180;
    for (let thickness = 0; thickness < 2; thickness++) {
      const r = fR - thickness * 0.5 + Math.sin(angle * 3 * Math.PI / 180) * 0.6;
      const fx = Math.round(cx + Math.cos(rad) * r);
      const fy = Math.round(cy + Math.sin(rad) * r);
      if (fx >= 0 && fx < G && fy >= 0 && fy < G) grid[fy][fx] = 1;
    }
  }
  const eyeY = Math.round(cy - fR * 0.2);
  const leftEX = Math.round(cx - fR * 0.35);
  const rightEX = Math.round(cx + fR * 0.35);
  const eyeR = Math.min(3, 2 + Math.floor(traitCount / 6));
  const eyeType = getEyeType(specialization, rng, rarity);
  drawEye(grid, G, leftEX, eyeY, eyeR, eyeType);
  drawEye(grid, G, rightEX, eyeY, eyeR, eyeType);
  const mouthY = Math.round(cy + fR * 0.3);
  const mW = Math.round(fR * 0.5);
  const mouthType = getMouthType(commStyle, rng, rarity);
  drawMouth(grid, G, cx, mouthY, mW, mouthType);
  const noseY = Math.round(cy + fR * 0.05);
  grid[noseY][Math.round(cx)] = 1;
  if (noseY + 1 < G) grid[noseY + 1][Math.round(cx)] = 1;
  const symmetry = 1 - autonomyLevel / 10;
  const densityMap = {
    analytical: 0.18,
    creative: 0.22,
    aggressive: 0.28,
    cautious: 0.12,
    chaotic: 0.3
  };
  const density = densityMap[temperament] || 0.2;
  const fillDensity = density + mutationCount * 0.01;
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      if (grid[y][x] !== 0) continue;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= fR * 0.9 || dist < 1) continue;
      const nearEye = Math.abs(x - leftEX) <= eyeR + 1 && Math.abs(y - eyeY) <= eyeR + 1 || Math.abs(x - rightEX) <= eyeR + 1 && Math.abs(y - eyeY) <= eyeR + 1;
      const nearMouth = Math.abs(y - mouthY) <= 2 && Math.abs(x - Math.round(cx)) <= mW;
      if (nearEye || nearMouth) continue;
      let fill = false;
      const mirrorX = Math.round(2 * cx - x);
      switch (temperament) {
        case "analytical":
          fill = (x % 3 === 0 || y % 3 === 0) && rng() < fillDensity;
          break;
        case "creative":
          fill = rng() < fillDensity * (0.5 + 0.5 * Math.sin(x * 0.8 + y * 0.6));
          break;
        case "aggressive":
          fill = rng() < fillDensity && (x + y) % 2 === 0;
          break;
        case "cautious":
          fill = dist < fR * 0.45 && rng() < fillDensity * 1.5;
          break;
        case "chaotic":
          fill = rng() < fillDensity * (0.3 + rng() * 0.7);
          break;
        default:
          fill = rng() < fillDensity;
      }
      if (fill) {
        grid[y][x] = rng() < 0.12 ? 3 : 1;
        if (rng() < symmetry && mirrorX >= 0 && mirrorX < G && grid[y][mirrorX] === 0)
          grid[y][mirrorX] = grid[y][x];
      }
    }
  }
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      if (grid[y][x] !== 0) continue;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= fR + 1) continue;
      if (rng() < 0.12 + mutationCount * 8e-3) grid[y][x] = 1;
    }
  }
  const svgNS = "http://www.w3.org/2000/svg";
  const uid = "a" + simpleHash(address + name).toString(36);
  let defs = "";
  if (rarity === "rare" || rarity === "epic" || rarity === "legendary") {
    defs += `<linearGradient id="${uid}_pg" x1="0%" y1="0%" x2="100%" y2="100%">`;
    defs += `<stop offset="0%" stop-color="${colors.primary}"/>`;
    defs += `<stop offset="100%" stop-color="${colors.secondary}"/>`;
    defs += `</linearGradient>`;
    defs += `<linearGradient id="${uid}_ag" x1="0%" y1="100%" x2="100%" y2="0%">`;
    defs += `<stop offset="0%" stop-color="${colors.accent}"/>`;
    defs += `<stop offset="100%" stop-color="${colors.accentBright}"/>`;
    defs += `</linearGradient>`;
  }
  if (rarity === "epic" || rarity === "legendary") {
    defs += `<linearGradient id="${uid}_chrome" x1="0%" y1="0%" x2="100%" y2="100%">`;
    defs += `<stop offset="0%" stop-color="hsl(${colors.hue}, ${colors.sat}%, 85%)"/>`;
    defs += `<stop offset="30%" stop-color="hsl(${colors.hue}, ${colors.sat}%, 55%)"/>`;
    defs += `<stop offset="50%" stop-color="hsl(${colors.hue}, ${colors.sat}%, 90%)"/>`;
    defs += `<stop offset="70%" stop-color="hsl(${colors.hue}, ${colors.sat}%, 50%)"/>`;
    defs += `<stop offset="100%" stop-color="hsl(${colors.hue}, ${colors.sat}%, 80%)"/>`;
    defs += `</linearGradient>`;
  }
  if (rarity === "legendary") {
    defs += `<filter id="${uid}_glow"><feGaussianBlur stdDeviation="2" result="blur"/>`;
    defs += `<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
    defs += `<linearGradient id="${uid}_iris" x1="0%" y1="0%" x2="100%" y2="0%">`;
    defs += `<stop offset="0%" stop-color="hsl(${colors.hue}, 100%, 70%)">`;
    defs += `<animate attributeName="stop-color" values="hsl(${colors.hue},100%,70%);hsl(${(colors.hue + 120) % 360},100%,70%);hsl(${(colors.hue + 240) % 360},100%,70%);hsl(${colors.hue},100%,70%)" dur="4s" repeatCount="indefinite"/></stop>`;
    defs += `<stop offset="50%" stop-color="hsl(${(colors.hue + 60) % 360}, 100%, 75%)">`;
    defs += `<animate attributeName="stop-color" values="hsl(${(colors.hue + 60) % 360},100%,75%);hsl(${(colors.hue + 180) % 360},100%,75%);hsl(${(colors.hue + 300) % 360},100%,75%);hsl(${(colors.hue + 60) % 360},100%,75%)" dur="4s" repeatCount="indefinite"/></stop>`;
    defs += `<stop offset="100%" stop-color="hsl(${(colors.hue + 120) % 360}, 100%, 70%)">`;
    defs += `<animate attributeName="stop-color" values="hsl(${(colors.hue + 120) % 360},100%,70%);hsl(${(colors.hue + 240) % 360},100%,70%);hsl(${colors.hue},100%,70%);hsl(${(colors.hue + 120) % 360},100%,70%)" dur="4s" repeatCount="indefinite"/></stop>`;
    defs += `</linearGradient>`;
  }
  function cellColor(cellType) {
    if (rarity === "legendary") {
      if (cellType === 4) return `url(#${uid}_iris)`;
      if (cellType === 2) return `url(#${uid}_ag)`;
      if (cellType === 3) return `url(#${uid}_chrome)`;
      return `url(#${uid}_chrome)`;
    }
    if (rarity === "epic") {
      if (cellType === 2) return `url(#${uid}_ag)`;
      if (cellType === 3) return `url(#${uid}_chrome)`;
      return `url(#${uid}_chrome)`;
    }
    if (rarity === "rare") {
      if (cellType === 2) return `url(#${uid}_ag)`;
      return `url(#${uid}_pg)`;
    }
    if (cellType === 2) return colors.accent;
    if (cellType === 3) return colors.secondary;
    if (cellType === 4) return colors.accentBright;
    return colors.primary;
  }
  let svg = `<svg xmlns="${svgNS}" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`;
  if (defs) svg += `<defs>${defs}</defs>`;
  svg += `<rect width="${size}" height="${size}" fill="#0a0a0a"/>`;
  if (rarity === "legendary") {
    svg += `<rect x="2" y="2" width="${size - 4}" height="${size - 4}" rx="4" fill="none" stroke="url(#${uid}_iris)" stroke-width="3" opacity="0.8"/>`;
  }
  if (rarity === "epic") {
    svg += `<rect x="3" y="3" width="${size - 6}" height="${size - 6}" rx="3" fill="none" stroke="url(#${uid}_chrome)" stroke-width="2" opacity="0.5"/>`;
  }
  if (rarity === "rare") {
    svg += `<rect x="4" y="4" width="${size - 8}" height="${size - 8}" rx="2" fill="none" stroke="url(#${uid}_pg)" stroke-width="1.5" opacity="0.35"/>`;
  }
  if (soulbound)
    svg += `<circle cx="${size / 2}" cy="${size / 2}" r="${(fR + 1.5) * cs}" fill="none" stroke="#b388ff" stroke-width="1.5" opacity="0.25" stroke-dasharray="4 3"/>`;
  const glowBase = { common: 0.03, rare: 0.06, epic: 0.1, legendary: 0.15 }[rarity];
  const glowI = Math.min(0.25, glowBase + points * 2e-4);
  svg += `<circle cx="${size / 2}" cy="${size / 2}" r="${fR * cs}" fill="${colors.glow}" opacity="${glowI}"/>`;
  if (rarity === "legendary") {
    svg += `<circle cx="${size / 2}" cy="${size / 2}" r="${(fR + 3) * cs}" fill="${colors.accent}" opacity="0.04"/>`;
  }
  if (["trader", "oracle", "guardian", "operator"].includes(specialization) || rarity === "epic" || rarity === "legendary") {
    const gr = cs * (eyeR + 2);
    const eGlowOp = rarity === "legendary" ? 0.2 : rarity === "epic" ? 0.15 : 0.1;
    svg += `<circle cx="${leftEX * cs + cs / 2}" cy="${eyeY * cs + cs / 2}" r="${gr}" fill="${colors.accent}" opacity="${eGlowOp}"/>`;
    svg += `<circle cx="${rightEX * cs + cs / 2}" cy="${eyeY * cs + cs / 2}" r="${gr}" fill="${colors.accent}" opacity="${eGlowOp}"/>`;
  }
  for (let g = 0; g < Math.min(generation, 3); g++) {
    const gr = (fR + 2 + g * 0.8) * cs;
    svg += `<circle cx="${size / 2}" cy="${size / 2}" r="${gr}" fill="none" stroke="${colors.secondary}" stroke-width="0.5" opacity="0.15"/>`;
  }
  const legendaryEyeFilter = rarity === "legendary" ? ` filter="url(#${uid}_glow)"` : "";
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) {
      if (!grid[y][x]) continue;
      const px = x * cs, py = y * cs;
      const color = cellColor(grid[y][x]);
      const r = cs * 0.1;
      const isEyeCell = grid[y][x] === 2 || grid[y][x] === 4;
      const filter = isEyeCell ? legendaryEyeFilter : "";
      svg += `<rect x="${px}" y="${py}" width="${cs}" height="${cs}" rx="${r}" fill="${color}"${filter}/>`;
    }
  }
  if (rarity !== "common") {
    const badgeColors = { rare: "#4fc3f7", epic: "#ce93d8", legendary: "#ffd54f" };
    const badgeColor = badgeColors[rarity];
    const badgeLabel = RARITY_COLORS[rarity].label;
    svg += `<text x="${size - 6}" y="14" text-anchor="end" fill="${badgeColor}" font-family="monospace" font-size="8" font-weight="bold" opacity="0.8">${badgeLabel}</text>`;
  }
  svg += `<text x="${size / 2}" y="${size - 6}" text-anchor="middle" fill="${colors.primary}" font-family="monospace" font-size="10" opacity="0.6">${name}</text>`;
  svg += `</svg>`;
  return svg;
}
function getAuraRarity(points, mutationCount) {
  return getRarity(points, mutationCount);
}
module.exports = { generateAura, getAuraRarity };
