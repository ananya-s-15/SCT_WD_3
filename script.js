/**
 * TicTacPro v2 — Game Logic (Premium Edition)
 *
 * Features:
 *  - PvP & PvC modes with Easy / Hard / Unbeatable AI (Minimax + α-β)
 *  - CSS-drawn X and O marks (no text characters)
 *  - Ghost hover preview of current player's mark
 *  - Win detection, draw detection, animated win-line SVG
 *  - Undo last move (full move history stack)
 *  - Move counter (Move N/9)
 *  - Game statistics: total games, X win rate, current win streak
 *  - Score tracking with custom player names
 *  - Sound effects via Web Audio API with mute toggle
 *  - Confetti explosion on win
 *  - 3D tilt parallax on board hover
 *  - Staggered entrance animations
 *  - Keyboard controls (R=reset, Z=undo, Enter/Space=play)
 */

'use strict';

/* =============================================
   Constants
   ============================================= */

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const WIN_LINE_COORDS = {
  '0,1,2': [0.17, 0.17, 2.83, 0.17],
  '3,4,5': [0.17, 1.00, 2.83, 1.00],
  '6,7,8': [0.17, 1.83, 2.83, 1.83],
  '0,3,6': [0.17, 0.17, 0.17, 1.83],
  '1,4,7': [1.00, 0.17, 1.00, 1.83],
  '2,5,8': [1.83, 0.17, 1.83, 1.83],
  '0,4,8': [0.17, 0.17, 1.83, 1.83],
  '2,4,6': [1.83, 0.17, 0.17, 1.83],
};

const PLAYER = { X: 'x', O: 'o' };
const MODE   = { PVP: 'pvp', PVC: 'pvc' };
const DIFF   = { EASY: 'easy', HARD: 'hard', UNBEAT: 'unbeat' };

const WIN_MESSAGES = {
  x: ['Brilliant move!', 'Flawless victory!', 'X marks the win!', 'Unstoppable!', 'What a play!'],
  o: ['Incredible!', 'O dominates!', 'Outstanding play!', 'Well played!', 'Masterful!'],
  ai: ['The machine prevails.', 'Resistance is futile.', 'Try again, human!', 'AI supremacy.'],
  draw: ["Nobody blinks first.", "A battle of equals!", "So close, yet so far!", "Stalemate!"],
};

/* =============================================
   Game State
   ============================================= */
const state = {
  board:          Array(9).fill(null),
  currentPlayer:  PLAYER.X,
  mode:           MODE.PVP,
  difficulty:     DIFF.EASY,
  gameOver:       false,
  scores:         { x: 0, o: 0, draw: 0 },
  moveHistory:    [],        // [{index, player}] for undo
  moveCount:      0,
  totalGames:     0,
  currentStreak:  0,
  lastWinner:     null,
};

/* =============================================
   Audio System (Web Audio API)
   ============================================= */
let audioCtx = null;
let isMuted = false;

function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  if (isMuted) return;
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function playSound(type) {
  if (isMuted) return;
  if (type === 'x') {
    playTone(523, 0.08, 'sine', 0.18);
    setTimeout(() => playTone(659, 0.06, 'sine', 0.12), 50);
  } else if (type === 'o') {
    playTone(392, 0.08, 'triangle', 0.18);
    setTimeout(() => playTone(330, 0.06, 'triangle', 0.12), 50);
  } else if (type === 'win') {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => playTone(f, 0.2, 'triangle', 0.2 - i * 0.03), i * 100);
    });
  } else if (type === 'draw') {
    playTone(330, 0.15, 'sawtooth', 0.08);
    setTimeout(() => playTone(294, 0.2, 'sawtooth', 0.06), 120);
  } else if (type === 'undo') {
    playTone(440, 0.06, 'sine', 0.1);
  }
}

function fireConfetti(winner) {
  if (typeof confetti === 'undefined') return;
  const colors = winner === 'x' ? ['#ff5f8f', '#d946ef', '#fbbf24'] : ['#38d9ff', '#818cf8', '#fbbf24'];

  // Burst from both sides
  confetti({
    particleCount: 60, spread: 55, origin: { x: 0.2, y: 0.6 },
    colors, zIndex: 1000, gravity: 1.2
  });
  confetti({
    particleCount: 60, spread: 55, origin: { x: 0.8, y: 0.6 },
    colors, zIndex: 1000, gravity: 1.2
  });
  // Center burst delayed
  setTimeout(() => {
    confetti({
      particleCount: 80, spread: 100, origin: { y: 0.55 },
      colors, zIndex: 1000, startVelocity: 40
    });
  }, 200);
}

/* =============================================
   DOM References
   ============================================= */
const cells          = document.querySelectorAll('.cell');
const statusIcon     = document.getElementById('statusIcon');
const statusText     = document.getElementById('statusText');
const statusDot      = document.getElementById('statusDot');
const moveCounter    = document.getElementById('moveCounter');
const scoreXVal      = document.getElementById('scoreXVal');
const scoreOVal      = document.getElementById('scoreOVal');
const scoreDrawVal   = document.getElementById('scoreDrawVal');
const scoreXCard     = document.getElementById('scoreX');
const scoreOCard     = document.getElementById('scoreO');
const resetBtn       = document.getElementById('resetBtn');
const clearBtn       = document.getElementById('clearBtn');
const undoBtn        = document.getElementById('undoBtn');
const modePvP        = document.getElementById('modePvP');
const modePvC        = document.getElementById('modePvC');
const diffSelector   = document.getElementById('difficultySelector');
const diffBtns       = document.querySelectorAll('.diff-btn');
const modalOverlay   = document.getElementById('modalOverlay');
const modalEmoji     = document.getElementById('modalEmoji');
const modalTitle     = document.getElementById('modalTitle');
const modalSub       = document.getElementById('modalSub');
const modalStats     = document.getElementById('modalStats');
const modalGlow      = document.getElementById('modalGlow');
const modalPlayAgain = document.getElementById('modalPlayAgain');
const modalClose     = document.getElementById('modalClose');
const winLineSvg     = document.getElementById('winLineSvg');
const winLine        = document.getElementById('winLine');
const muteBtn        = document.getElementById('muteBtn');
const nameXInput     = document.getElementById('nameX');
const nameOInput     = document.getElementById('nameO');
const boardWrapper   = document.querySelector('.board-wrapper');
const boardEl        = document.getElementById('board');
const statTotalGames = document.getElementById('statTotalGames');
const statWinRate    = document.getElementById('statWinRate');
const statStreak     = document.getElementById('statStreak');

/* =============================================
   Helper: Player Names
   ============================================= */
function getNameX() { return nameXInput.value.trim() || 'Player X'; }
function getNameO() { return state.mode === MODE.PVC ? 'Computer' : (nameOInput.value.trim() || 'Player O'); }

/* =============================================
   Display / UI
   ============================================= */
function setStatus(type, message) {
  const iconMap = {
    'x':    { text: '✕', cls: 'x-turn' },
    'o':    { text: '○', cls: 'o-turn' },
    'draw': { text: '—', cls: 'draw'   },
    'win':  { text: '★', cls: 'win'    },
  };
  const { text, cls } = iconMap[type] ?? iconMap['x'];
  statusIcon.textContent = text;
  statusIcon.className = `status-icon ${cls}`;
  statusText.textContent = message;
  statusDot.className = `status-dot ${cls}`;
}

function updateMoveCounter() {
  const moves = state.board.filter(c => c !== null).length;
  moveCounter.textContent = state.gameOver ? 'Game Over' : `Move ${moves + 1}/9`;
}

function highlightActiveCard(player) {
  scoreXCard.classList.toggle('active-player', player === 'x');
  scoreOCard.classList.toggle('active-player', player === 'o');
}

function bumpScore(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function updateBoardTurnClass() {
  boardEl.classList.remove('x-turn', 'o-turn');
  if (!state.gameOver) {
    boardEl.classList.add(`${state.currentPlayer}-turn`);
  }
}

/** Create CSS-drawn mark element for a cell */
function createMarkElement(player) {
  if (player === 'x') {
    const div = document.createElement('div');
    div.className = 'css-x';
    div.innerHTML = '<span></span><span></span>';
    return div;
  } else {
    const div = document.createElement('div');
    div.className = 'css-o';
    return div;
  }
}

function renderBoard() {
  cells.forEach((cell, i) => {
    const val = state.board[i];
    // Clear existing marks
    cell.innerHTML = '';
    cell.className = 'cell';
    cell.setAttribute('aria-pressed', val ? 'true' : 'false');
    cell.setAttribute('aria-label',
      `Row ${Math.floor(i / 3) + 1}, Column ${(i % 3) + 1}${val ? ': ' + val.toUpperCase() : ''}`
    );
    if (val) {
      cell.classList.add(val, 'played');
      cell.appendChild(createMarkElement(val));
    }
    if (state.gameOver || val) {
      cell.classList.add('disabled');
    }
  });
  updateBoardTurnClass();
  updateMoveCounter();
  updateUndoBtn();
}

function updateUndoBtn() {
  undoBtn.disabled = state.moveHistory.length === 0 || state.gameOver;
}

function updateStats() {
  statTotalGames.textContent = state.totalGames;
  const total = state.scores.x + state.scores.o + state.scores.draw;
  const rate = total > 0 ? Math.round((state.scores.x / total) * 100) : 0;
  statWinRate.textContent = `${rate}%`;
  statStreak.textContent = state.currentStreak;
}

/* =============================================
   Win-Line SVG
   ============================================= */
function drawWinLine(combo) {
  const key = combo.join(',');
  const coords = WIN_LINE_COORDS[key];
  if (!coords) return;

  const [x1, y1, x2, y2] = coords;
  winLine.setAttribute('x1', x1);
  winLine.setAttribute('y1', y1);
  winLine.setAttribute('x2', x2);
  winLine.setAttribute('y2', y2);

  const len = Math.hypot(x2 - x1, y2 - y1);
  winLine.style.strokeDasharray  = len;
  winLine.style.strokeDashoffset = len;

  winLineSvg.classList.add('visible');
  requestAnimationFrame(() => {
    winLine.style.transition = 'stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1)';
    winLine.style.strokeDashoffset = '0';
  });
}

function clearWinLine() {
  winLineSvg.classList.remove('visible');
  winLine.style.transition = 'none';
  winLine.style.strokeDashoffset = winLine.style.strokeDasharray;
}

/* =============================================
   Core Game Logic
   ============================================= */
function checkWin(board, player) {
  for (const line of WIN_LINES) {
    if (line.every(i => board[i] === player)) {
      return { won: true, line };
    }
  }
  return { won: false, line: null };
}

function checkDraw(board) {
  return board.every(cell => cell !== null);
}

function handleCellClick(index) {
  if (state.gameOver) return;
  if (state.board[index]) return;
  if (state.mode === MODE.PVC && state.currentPlayer === PLAYER.O) return;
  makeMove(index, state.currentPlayer);
}

function makeMove(index, player) {
  state.board[index] = player;
  state.moveHistory.push({ index, player });
  state.moveCount++;
  playSound(player);
  renderBoard();

  const { won, line } = checkWin(state.board, player);
  if (won) { endGame('win', player, line); return; }
  if (checkDraw(state.board)) { endGame('draw', null, null); return; }

  state.currentPlayer = player === PLAYER.X ? PLAYER.O : PLAYER.X;
  updateTurnStatus();

  if (state.mode === MODE.PVC && state.currentPlayer === PLAYER.O) {
    disableBoard();
    setTimeout(aiMove, 450);
  }
}

function updateTurnStatus() {
  const isX = state.currentPlayer === PLAYER.X;
  const label = state.mode === MODE.PVC && !isX
    ? 'Computer is thinking…'
    : `${isX ? getNameX() : getNameO()}'s turn`;
  setStatus(state.currentPlayer, label);
  highlightActiveCard(state.currentPlayer);
  updateBoardTurnClass();
}

function disableBoard() {
  cells.forEach(cell => {
    if (!state.board[Number(cell.dataset.index)]) cell.classList.add('disabled');
  });
}

function enableBoard() {
  cells.forEach(cell => {
    if (!state.board[Number(cell.dataset.index)] && !state.gameOver) cell.classList.remove('disabled');
  });
}

function endGame(result, winner, winCombo) {
  state.gameOver = true;
  state.totalGames++;
  highlightActiveCard(null);
  boardEl.classList.remove('x-turn', 'o-turn');

  if (result === 'win') {
    winCombo.forEach(i => cells[i].classList.add('winning'));
    drawWinLine(winCombo);

    state.scores[winner]++;
    const scoreEl = winner === 'x' ? scoreXVal : scoreOVal;
    scoreEl.textContent = state.scores[winner];
    bumpScore(scoreEl);

    // Streak
    if (state.lastWinner === winner) {
      state.currentStreak++;
    } else {
      state.currentStreak = 1;
      state.lastWinner = winner;
    }

    const winnerName = winner === 'x' ? getNameX() : getNameO();
    const isAI = state.mode === MODE.PVC && winner === PLAYER.O;
    const msgs = isAI ? WIN_MESSAGES.ai : WIN_MESSAGES[winner];
    const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
    const title = isAI ? 'AI Wins!' : `${winnerName} Wins!`;

    playSound('win');
    fireConfetti(winner);
    updateStats();
    updateMoveCounter();

    setStatus('win', title);
    setTimeout(() => {
      const emoji = winner === 'x' ? '🎉' : isAI ? '🤖' : '🎊';
      const glowClass = winner === 'x' ? 'x-glow' : 'o-glow';
      const statLine = `${state.moveCount} moves · Streak: ${state.currentStreak}`;
      showModal(emoji, title, randomMsg, statLine, glowClass);
    }, 750);

  } else {
    state.scores.draw++;
    scoreDrawVal.textContent = state.scores.draw;
    bumpScore(scoreDrawVal);
    state.currentStreak = 0;
    state.lastWinner = null;

    const msgs = WIN_MESSAGES.draw;
    const randomMsg = msgs[Math.floor(Math.random() * msgs.length)];
    playSound('draw');
    updateStats();
    updateMoveCounter();

    setStatus('draw', "It's a Draw!");
    setTimeout(() => {
      showModal('🤝', "It's a Draw!", randomMsg, `${state.moveCount} moves`, 'draw-glow');
    }, 500);
  }
}

/* =============================================
   Undo
   ============================================= */
function undoLastMove() {
  if (state.moveHistory.length === 0 || state.gameOver) return;

  // In PvC mode, undo both the AI's move and the player's move
  if (state.mode === MODE.PVC && state.moveHistory.length >= 2) {
    const aiMove = state.moveHistory.pop();
    state.board[aiMove.index] = null;
    const playerMove = state.moveHistory.pop();
    state.board[playerMove.index] = null;
    state.currentPlayer = PLAYER.X;
    state.moveCount -= 2;
  } else if (state.mode === MODE.PVP) {
    const lastMove = state.moveHistory.pop();
    state.board[lastMove.index] = null;
    state.currentPlayer = lastMove.player;
    state.moveCount--;
  } else {
    // PvC with only 1 move (player's first move)
    const lastMove = state.moveHistory.pop();
    state.board[lastMove.index] = null;
    state.currentPlayer = PLAYER.X;
    state.moveCount--;
  }

  playSound('undo');
  clearWinLine();
  renderBoard();
  updateTurnStatus();
}

/* =============================================
   AI Logic
   ============================================= */
function aiMove() {
  const empty = state.board.map((v, i) => v === null ? i : null).filter(i => i !== null);
  if (empty.length === 0 || state.gameOver) return;

  let chosenIndex;
  switch (state.difficulty) {
    case DIFF.EASY:   chosenIndex = aiRandom(empty); break;
    case DIFF.HARD:   chosenIndex = aiHard(empty);   break;
    case DIFF.UNBEAT: chosenIndex = aiMinimax(state.board, PLAYER.O).index; break;
  }

  enableBoard();
  makeMove(chosenIndex, PLAYER.O);
}

function aiRandom(empty) {
  return empty[Math.floor(Math.random() * empty.length)];
}

function aiHard(empty) {
  for (const i of empty) { const t = [...state.board]; t[i] = PLAYER.O; if (checkWin(t, PLAYER.O).won) return i; }
  for (const i of empty) { const t = [...state.board]; t[i] = PLAYER.X; if (checkWin(t, PLAYER.X).won) return i; }
  if (empty.includes(4)) return 4;
  const corners = [0, 2, 6, 8].filter(c => empty.includes(c));
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)];
  return aiRandom(empty);
}

function aiMinimax(board, player, alpha = -Infinity, beta = Infinity) {
  const { won: xWon } = checkWin(board, PLAYER.X);
  const { won: oWon } = checkWin(board, PLAYER.O);
  if (oWon) return { score: 10, index: null };
  if (xWon) return { score: -10, index: null };
  if (checkDraw(board)) return { score: 0, index: null };

  const isMax = player === PLAYER.O;
  let best = { score: isMax ? -Infinity : Infinity, index: null };

  for (let i = 0; i < 9; i++) {
    if (board[i] !== null) continue;
    board[i] = player;
    const result = aiMinimax(board, player === PLAYER.O ? PLAYER.X : PLAYER.O, alpha, beta);
    board[i] = null;
    result.index = i;
    if (isMax) {
      if (result.score > best.score) best = result;
      alpha = Math.max(alpha, best.score);
    } else {
      if (result.score < best.score) best = result;
      beta = Math.min(beta, best.score);
    }
    if (beta <= alpha) break;
  }
  return best;
}

/* =============================================
   Modal
   ============================================= */
function showModal(emoji, title, sub, stats, glowClass) {
  modalEmoji.textContent = emoji;
  modalTitle.textContent = title;
  modalSub.textContent   = sub;
  modalStats.textContent = stats || '';
  modalGlow.className    = `modal-glow ${glowClass || ''}`;
  modalOverlay.classList.remove('hidden');
}

function hideModal() {
  modalOverlay.classList.add('hidden');
}

/* =============================================
   Game Reset
   ============================================= */
function resetGame() {
  state.board         = Array(9).fill(null);
  state.currentPlayer = PLAYER.X;
  state.gameOver      = false;
  state.moveHistory   = [];
  state.moveCount     = 0;

  clearWinLine();
  hideModal();
  renderBoard();
  updateTurnStatus();
  updateStats();
}

function clearScores() {
  state.scores        = { x: 0, o: 0, draw: 0 };
  state.totalGames    = 0;
  state.currentStreak = 0;
  state.lastWinner    = null;
  scoreXVal.textContent    = '0';
  scoreOVal.textContent    = '0';
  scoreDrawVal.textContent = '0';
  resetGame();
}

/* =============================================
   Event Listeners
   ============================================= */

// Board — delegated clicks
boardEl.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  handleCellClick(Number(cell.dataset.index));
});

// Keyboard
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if ((e.key === 'Enter' || e.key === ' ') && document.activeElement.classList.contains('cell')) {
    e.preventDefault();
    handleCellClick(Number(document.activeElement.dataset.index));
  }
  if (e.key === 'r' || e.key === 'R') resetGame();
  if ((e.key === 'z' || e.key === 'Z') && !e.ctrlKey) undoLastMove();
});

// Mode buttons
[modePvP, modePvC].forEach(btn => {
  btn.addEventListener('click', () => {
    const m = btn.dataset.mode;
    state.mode = m === 'pvp' ? MODE.PVP : MODE.PVC;
    modePvP.classList.toggle('active', m === 'pvp');
    modePvP.setAttribute('aria-pressed', m === 'pvp');
    modePvC.classList.toggle('active', m === 'pvc');
    modePvC.setAttribute('aria-pressed', m === 'pvc');
    diffSelector.classList.toggle('hidden', m === 'pvp');
    if (m === 'pvc') {
      nameOInput.value = 'Computer';
      nameOInput.disabled = true;
    } else {
      nameOInput.value = 'Player O';
      nameOInput.disabled = false;
    }
    resetGame();
  });
});

// Difficulty buttons
diffBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const d = btn.dataset.diff;
    state.difficulty = d === 'easy' ? DIFF.EASY : d === 'hard' ? DIFF.HARD : DIFF.UNBEAT;
    diffBtns.forEach(b => {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', b === btn);
    });
    resetGame();
  });
});

// Action buttons
resetBtn.addEventListener('click', resetGame);
clearBtn.addEventListener('click', clearScores);
undoBtn.addEventListener('click', undoLastMove);
modalPlayAgain.addEventListener('click', resetGame);
modalClose.addEventListener('click', hideModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(); });

// Mute toggle
muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  muteBtn.classList.toggle('muted', isMuted);
  muteBtn.setAttribute('aria-pressed', isMuted);
});

// 3D tilt on board
boardWrapper.addEventListener('mousemove', (e) => {
  const rect = boardWrapper.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top) / rect.height - 0.5;
  boardEl.style.transform = `rotateX(${y * -10}deg) rotateY(${x * 10}deg)`;
});
boardWrapper.addEventListener('mouseleave', () => {
  boardEl.style.transform = 'rotateX(0) rotateY(0)';
});

// Name inputs → update status
nameXInput.addEventListener('input', () => { if (!state.gameOver) updateTurnStatus(); });
nameOInput.addEventListener('input', () => { if (!state.gameOver) updateTurnStatus(); });

/* =============================================
   SVG Gradient Injection
   ============================================= */
function injectSvgDefs() {
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="winGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#f97316"/>
    </linearGradient>
  `;
  winLineSvg.prepend(defs);
}

/* =============================================
   Initialization
   ============================================= */
function init() {
  injectSvgDefs();
  renderBoard();
  updateTurnStatus();
  updateStats();
  console.log('%c✕ TicTacPro v2 loaded', 'color:#ff5f8f;font-weight:700;font-size:14px');
}

init();
