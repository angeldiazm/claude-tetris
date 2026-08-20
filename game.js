'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#000080', // J - navy
  '#ffb74d', // L - orange
  '#f06292', // X - pink
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // X - rosa (hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const SKINS = {
  retro:  { colors: COLORS },
  neon:   { colors: ['#000000','#00fff2','#faff00','#c800ff','#00ff6a','#ff004c','#3d5cff','#ff9500','#ff00c8'] },
  pastel: { colors: ['#000000','#a8dadc','#fff1a8','#d9b8e8','#b8e8c1','#f4a8a8','#c3c9f7','#f7cba8','#f2a8d4'] },
  pixel:  { colors: COLORS },
};
const VALID_SKINS = ['retro', 'neon', 'pastel', 'pixel'];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

const skinSelect = document.getElementById('skin-select');
const sidebarLeaderboardEl = document.getElementById('sidebar-leaderboard');
const overlayLeaderboardEl = document.getElementById('overlay-leaderboard');
const resetLeaderboardBtn = document.getElementById('reset-leaderboard-btn');
const nameEntryEl = document.getElementById('lb-name-entry');
const nameInputEl = document.getElementById('lb-name-input');
const nameSubmitBtn = document.getElementById('lb-name-submit');

const pauseOverlay = document.getElementById('pause-overlay');
const pauseMainEl = document.getElementById('pause-main');
const pauseControlsEl = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const viewControlsBtn = document.getElementById('view-controls-btn');
const backToPauseBtn = document.getElementById('back-to-pause-btn');
const startLevelSelect = document.getElementById('start-level-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, sessionMaxCombo, startLevel, currentSkin, pauseView, pendingEntry;

const THEME_KEY = 'tetris-theme';

function applyTheme(theme) {
  document.body.classList.toggle('light-theme', theme === 'light');
  themeToggleBtn.textContent = theme === 'light' ? '🌙 Modo oscuro' : '☀️ Modo claro';
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

function toggleTheme() {
  const isLight = document.body.classList.contains('light-theme');
  const nextTheme = isLight ? 'dark' : 'light';
  applyTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
}

const SKIN_KEY = 'tetris-skin';

function applySkin(skin) {
  currentSkin = skin;
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixel');
  document.body.classList.add(`skin-${skin}`);
  skinSelect.value = skin;
  localStorage.setItem(SKIN_KEY, skin);
  if (board) draw();
  if (next) drawNext();
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(VALID_SKINS.includes(saved) ? saved : 'retro');
}

const START_LEVEL_KEY = 'tetris-start-level';
const MAX_START_LEVEL = 15;

function populateStartLevelOptions() {
  for (let i = 1; i <= MAX_START_LEVEL; i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = String(i);
    startLevelSelect.appendChild(opt);
  }
}

function applyStartLevel(lvl) {
  startLevel = Math.min(MAX_START_LEVEL, Math.max(1, lvl));
  startLevelSelect.value = String(startLevel);
  localStorage.setItem(START_LEVEL_KEY, String(startLevel));
}

function initStartLevel() {
  populateStartLevelOptions();
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  applyStartLevel(Number.isFinite(saved) ? saved : 1);
}

const LEADERBOARD_KEY = 'tetris-leaderboard';
const BEST_STATS_KEY = 'tetris-best-stats';

function loadLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY)) || [];
  } catch {
    return [];
  }
}

function saveLeaderboard(list) {
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(list));
}

function loadBestStats() {
  try {
    return JSON.parse(localStorage.getItem(BEST_STATS_KEY)) || { maxCombo: 0, maxLines: 0 };
  } catch {
    return { maxCombo: 0, maxLines: 0 };
  }
}

function saveBestStats(stats) {
  localStorage.setItem(BEST_STATS_KEY, JSON.stringify(stats));
}

function resetLeaderboard() {
  localStorage.removeItem(LEADERBOARD_KEY);
  renderLeaderboard();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderLeaderboard(highlightEntry) {
  const list = loadLeaderboard();
  const stats = loadBestStats();
  const rowsHtml = list.length
    ? list.map(e => `<li class="${highlightEntry && e.date === highlightEntry.date ? 'lb-current' : ''}">
         <span class="lb-name">${escapeHtml(e.name)}</span>
         <span class="lb-score">${e.score.toLocaleString()}</span>
       </li>`).join('')
    : '<li class="lb-empty">Sin registros</li>';
  const html = `<ul class="lb-list">${rowsHtml}</ul>
    <p class="lb-stats">Mejor combo: ${stats.maxCombo} · Máx. líneas: ${stats.maxLines}</p>`;
  sidebarLeaderboardEl.innerHTML = html;
  overlayLeaderboardEl.innerHTML = html;
}

function submitLeaderboardName() {
  if (!pendingEntry) return;
  const name = (nameInputEl.value.trim() || 'AAA').slice(0, 12);
  const list = loadLeaderboard();
  list.push({ name, ...pendingEntry });
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, 5);
  saveLeaderboard(list);
  const savedEntry = list.find(e => e.date === pendingEntry.date);
  nameEntryEl.classList.add('hidden');
  renderLeaderboard(savedEntry);
  pendingEntry = null;
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++;
    sessionMaxCombo = Math.max(sessionMaxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0;
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlockRetro(context, x, y, colorIndex, size, alpha) {
  const color = SKINS.retro.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawBlockNeon(context, x, y, colorIndex, size, alpha) {
  const color = SKINS.neon.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.shadowColor = color;
  context.shadowBlur = 12;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

function drawBlockPastel(context, x, y, colorIndex, size, alpha) {
  const color = SKINS.pastel.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.beginPath();
  context.roundRect(x * size + 1, y * size + 1, size - 2, size - 2, 6);
  context.fill();
  context.fillStyle = 'rgba(255,255,255,0.25)';
  context.beginPath();
  context.roundRect(x * size + 1, y * size + 1, size - 2, 4, [6, 6, 0, 0]);
  context.fill();
  context.globalAlpha = 1;
}

function shadeColor(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amount = Math.round(255 * percent / 100);
  let r = Math.min(255, Math.max(0, (num >> 16) + amount));
  let g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  let b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawBlockPixel(context, x, y, colorIndex, size, alpha) {
  const color = SKINS.pixel.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  const sub = (size - 2) / 2;
  const light = shadeColor(color, 18);
  const dark = shadeColor(color, -18);
  const swap = (x + y) % 2 === 0;
  context.fillStyle = swap ? light : dark;
  context.fillRect(x * size + 1, y * size + 1, sub, sub);
  context.fillRect(x * size + 1 + sub, y * size + 1 + sub, sub, sub);
  context.fillStyle = swap ? dark : light;
  context.fillRect(x * size + 1 + sub, y * size + 1, sub, sub);
  context.fillRect(x * size + 1, y * size + 1 + sub, sub, sub);
  context.globalAlpha = 1;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  switch (currentSkin) {
    case 'neon': drawBlockNeon(context, x, y, colorIndex, size, alpha); break;
    case 'pastel': drawBlockPastel(context, x, y, colorIndex, size, alpha); break;
    case 'pixel': drawBlockPixel(context, x, y, colorIndex, size, alpha); break;
    default: drawBlockRetro(context, x, y, colorIndex, size, alpha);
  }
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-line').trim();
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const stats = loadBestStats();
  stats.maxCombo = Math.max(stats.maxCombo, sessionMaxCombo);
  stats.maxLines = Math.max(stats.maxLines, lines);
  saveBestStats(stats);

  const lb = loadLeaderboard();
  const qualifies = lb.length < 5 || score > lb[lb.length - 1].score;
  pendingEntry = qualifies ? { score, lines, date: new Date().toISOString() } : null;
  nameEntryEl.classList.toggle('hidden', !qualifies);
  nameInputEl.value = '';

  renderLeaderboard();
  overlay.classList.remove('hidden');
}

function openPauseMenu() {
  paused = true;
  cancelAnimationFrame(animId);
  pauseView = 'main';
  pauseMainEl.classList.remove('hidden');
  pauseControlsEl.classList.add('hidden');
  pauseOverlay.classList.remove('hidden');
}

function closePauseMenu() {
  paused = false;
  pauseOverlay.classList.add('hidden');
  lastTime = performance.now();
  loop(lastTime);
}

function togglePause() {
  if (gameOver) return;
  if (paused) closePauseMenu(); else openPauseMenu();
}

function showPauseControls() {
  pauseView = 'controls';
  pauseMainEl.classList.add('hidden');
  pauseControlsEl.classList.remove('hidden');
}

function showPauseMain() {
  pauseView = 'main';
  pauseControlsEl.classList.add('hidden');
  pauseMainEl.classList.remove('hidden');
}

function loop(ts) {
  if (gameOver) return;
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  combo = 0;
  sessionMaxCombo = 0;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (paused && pauseView === 'controls') { showPauseMain(); return; }
    togglePause();
    return;
  }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
themeToggleBtn.addEventListener('click', toggleTheme);
skinSelect.addEventListener('change', e => applySkin(e.target.value));
resetLeaderboardBtn.addEventListener('click', resetLeaderboard);
nameSubmitBtn.addEventListener('click', submitLeaderboardName);
nameInputEl.addEventListener('keydown', e => { if (e.key === 'Enter') submitLeaderboardName(); });
resumeBtn.addEventListener('click', closePauseMenu);
pauseRestartBtn.addEventListener('click', init);
viewControlsBtn.addEventListener('click', showPauseControls);
backToPauseBtn.addEventListener('click', showPauseMain);
startLevelSelect.addEventListener('change', e => applyStartLevel(parseInt(e.target.value, 10)));

initTheme();
initSkin();
initStartLevel();
renderLeaderboard();
init();
