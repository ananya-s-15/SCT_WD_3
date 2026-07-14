// All 8 winning lines: 3 rows, 3 columns, 2 diagonals
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

/**
 * Checks all 8 winning lines and returns 'X', 'O', or null.
 * A full board with no winner is a draw (returns null).
 */
function checkWinner(board) {
  for (const [a, b, c] of LINES) {
    // If all three cells in a line match and aren't empty, that player wins
    if (board[a] && board[a] === board[b] && board[b] === board[c]) {
      return board[a]; // 'X' or 'O'
    }
  }
  return null;
}

/**
 * Returns the index (0-8) of the cell the computer ('O') should play next.
 * Priority: win → block → center → corner → any remaining cell.
 */
function getComputerMove(board) {

  // Helper: returns the empty cell index that would let `player` complete a line, or -1
  function findWinningCell(player) {
    for (const [a, b, c] of LINES) {
      const cells = [board[a], board[b], board[c]];
      // Line has two of `player` and one empty → that empty cell wins/blocks
      if (cells.filter(v => v === player).length === 2 &&
          cells.filter(v => v === null).length === 1) {
        if (board[a] === null) return a;
        if (board[b] === null) return b;
        return c;
      }
    }
    return -1;
  }

  // 1. If 'O' can win this turn, play that cell
  const winCell = findWinningCell('O');
  if (winCell !== -1) return winCell;

  // 2. If 'X' would win next turn, block that cell
  const blockCell = findWinningCell('X');
  if (blockCell !== -1) return blockCell;

  // 3. If the center is free, take it
  if (board[4] === null) return 4;

  // 4. If any corner is free, take one
  const corners = [0, 2, 6, 8];
  const freeCorner = corners.find(i => board[i] === null);
  if (freeCorner !== undefined) return freeCorner;

  // 5. Play any remaining free cell (edges: 1, 3, 5, 7)
  return board.findIndex(cell => cell === null);
}
