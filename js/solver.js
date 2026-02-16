/**
 * Purenrupu (Pure Loop) Solver
 *
 * Rules
 * -----
 * 1. Draw a single closed loop that passes through every **unshaded** cell
 *    exactly once.
 * 2. The loop travels only horizontally and vertically (no diagonals).
 * 3. **Shaded** cells are obstacles — the loop must NOT enter them.
 * 4. The loop must form a single continuous closed loop.
 *
 * Approach
 * --------
 * Constraint-propagation + back-tracking search.
 *
 * Each *unshaded* cell has exactly two of the four edges
 * {up, down, left, right} that connect to neighbouring unshaded cells.
 * Shaded cells are excluded entirely.  We model the puzzle as choosing,
 * for every unshaded cell, which pair of edges forms part of the loop,
 * subject to:
 *   • Edges may only connect to neighbouring **unshaded** cells.
 *   • Neighbouring cells must agree on shared edges.
 *   • The result must be a single connected loop visiting every unshaded cell.
 */

// ---------------------------------------------------------------------------
// Direction helpers
// ---------------------------------------------------------------------------

const DIR = {
    UP:    0,
    RIGHT: 1,
    DOWN:  2,
    LEFT:  3,
};

const DIR_NAME = ['up', 'right', 'down', 'left'];

const OPPOSITE = [DIR.DOWN, DIR.LEFT, DIR.UP, DIR.RIGHT];

const DR = [-1, 0, 1, 0];
const DC = [0, 1, 0, -1];

/**
 * All possible pairs of directions a cell can use.
 * Index into DIR constants.  6 possible pairs from 4 directions.
 */
const ALL_PAIRS = [
    [DIR.UP,    DIR.RIGHT],
    [DIR.UP,    DIR.DOWN],    // straight vertical
    [DIR.UP,    DIR.LEFT],
    [DIR.RIGHT, DIR.DOWN],
    [DIR.RIGHT, DIR.LEFT],    // straight horizontal
    [DIR.DOWN,  DIR.LEFT],
];

// (Shaded cells have no pairs — they are not part of the loop.)

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

class PurenrupuSolver {
    /**
     * @param {number} rows
     * @param {number} cols
     * @param {boolean[][]} shaded  shaded[r][c] === true → shaded cell
     */
    constructor(rows, cols, shaded) {
        this.rows = rows;
        this.cols = cols;
        this.shaded = shaded;

        // Count unshaded cells — the loop must visit exactly this many.
        let count = 0;
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++)
                if (!shaded[r][c]) count++;
        this.unshadedCount = count;
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * Solve the puzzle.
     * @returns {Set<string>[][] | null}  For each cell a set of direction
     *          names the loop passes through, or null if unsolvable.
     */
    solve() {
        // candidates[r][c] = array of valid [dirA, dirB] pairs
        const candidates = this._initCandidates();

        // Propagate and search
        if (!this._propagate(candidates)) return null;
        const result = this._search(candidates);
        if (!result) return null;

        return this._toDirectionSets(result);
    }

    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /**
     * Build initial candidate lists.
     * Shaded cells get zero candidates (excluded from the loop).
     * Unshaded cells get all direction pairs whose neighbours are
     * in-bounds AND unshaded.
     */
    _initCandidates() {
        const { rows, cols, shaded } = this;
        const candidates = Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => [])
        );

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (shaded[r][c]) continue;         // shaded → no candidates
                for (const pair of ALL_PAIRS) {
                    if (this._pairFitsGrid(r, c, pair)) {
                        candidates[r][c].push(pair);
                    }
                }
            }
        }
        return candidates;
    }

    /**
     * Check that both directions lead to an in-bounds **unshaded**
     * neighbour (shaded cells are walls).
     */
    _pairFitsGrid(r, c, pair) {
        for (const d of pair) {
            const nr = r + DR[d];
            const nc = c + DC[d];
            if (nr < 0 || nr >= this.rows || nc < 0 || nc >= this.cols) {
                return false;
            }
            if (this.shaded[nr][nc]) {
                return false;                       // neighbour is shaded
            }
        }
        return true;
    }

    // -----------------------------------------------------------------------
    // Constraint Propagation
    // -----------------------------------------------------------------------

    /**
     * Arc-consistency style propagation.
     * If a cell has only one candidate, force its neighbours to agree.
     * Returns false if any cell ends up with zero candidates.
     */
    _propagate(candidates) {
        const { rows, cols, shaded } = this;
        let changed = true;

        while (changed) {
            changed = false;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (shaded[r][c]) continue;      // skip shaded cells
                    const cands = candidates[r][c];
                    if (cands.length === 0) return false;
                    if (cands.length !== 1) continue;

                    const [dA, dB] = cands[0];

                    // For each direction NOT used by this cell, the neighbour
                    // in that direction must NOT connect back.
                    for (let d = 0; d < 4; d++) {
                        const nr = r + DR[d];
                        const nc = c + DC[d];
                        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                        if (shaded[nr][nc]) continue;  // shaded neighbour

                        const opp = OPPOSITE[d];
                        const before = candidates[nr][nc].length;

                        if (d === dA || d === dB) {
                            // This cell USES direction d → neighbour MUST
                            // have the opposite direction in its pair.
                            candidates[nr][nc] = candidates[nr][nc].filter(
                                p => p.includes(opp)
                            );
                        } else {
                            // This cell does NOT use direction d → neighbour
                            // must NOT connect back.
                            candidates[nr][nc] = candidates[nr][nc].filter(
                                p => !p.includes(opp)
                            );
                        }

                        if (candidates[nr][nc].length === 0) return false;
                        if (candidates[nr][nc].length < before) changed = true;
                    }
                }
            }
        }
        return true;
    }

    // -----------------------------------------------------------------------
    // Search (back-tracking with propagation)
    // -----------------------------------------------------------------------

    /**
     * Deep-copy candidates grid.
     */
    _copyCandidates(candidates) {
        return candidates.map(row => row.map(c => c.slice()));
    }

    /**
     * Pick the unfixed cell with the fewest candidates (MRV heuristic).
     * Returns [r, c] or null if all are fixed.
     */
    _pickCell(candidates) {
        let best = null;
        let bestLen = Infinity;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.shaded[r][c]) continue;
                const len = candidates[r][c].length;
                if (len > 1 && len < bestLen) {
                    bestLen = len;
                    best = [r, c];
                }
            }
        }
        return best;
    }

    /**
     * Recursive backtracking search.
     * @returns {number[][][]|null}  Solved candidates (each cell has one pair).
     */
    _search(candidates) {
        const cell = this._pickCell(candidates);
        if (!cell) {
            // All cells fixed — validate single loop
            return this._isSingleLoop(candidates) ? candidates : null;
        }

        const [r, c] = cell;
        for (const pair of candidates[r][c]) {
            const copy = this._copyCandidates(candidates);
            copy[r][c] = [pair];
            if (this._propagate(copy)) {
                const result = this._search(copy);
                if (result) return result;
            }
        }
        return null;
    }

    // -----------------------------------------------------------------------
    // Validation: single loop check
    // -----------------------------------------------------------------------

    /**
     * After every cell has exactly one pair, verify the edges form one loop
     * covering all cells.
     */
    _isSingleLoop(candidates) {
        const { rows, cols, shaded, unshadedCount } = this;

        // Build adjacency from the fixed pairs
        const visited = Array.from({ length: rows }, () =>
            Array(cols).fill(false)
        );

        // Find the first unshaded cell to start traversal
        let startR = -1, startC = -1;
        outer:
        for (let r = 0; r < rows; r++)
            for (let c = 0; c < cols; c++)
                if (!shaded[r][c]) { startR = r; startC = c; break outer; }

        if (startR === -1) return false;  // no unshaded cells

        let r = startR, c = startC;
        let prevDir = -1;
        let count = 0;

        while (true) {
            if (visited[r][c]) break;
            visited[r][c] = true;
            count++;

            const [dA, dB] = candidates[r][c][0];
            let nextDir;
            if (prevDir === -1) {
                nextDir = dA;
            } else {
                const cameFrom = OPPOSITE[prevDir];
                nextDir = (dA === cameFrom) ? dB : dA;
            }

            prevDir = nextDir;
            r += DR[nextDir];
            c += DC[nextDir];
        }

        return count === unshadedCount && r === startR && c === startC;
    }

    // -----------------------------------------------------------------------
    // Output conversion
    // -----------------------------------------------------------------------

    /**
     * Convert solved candidates to Set<string>[][] for the UI.
     */
    _toDirectionSets(candidates) {
        return candidates.map((row, r) =>
            row.map((cell, c) => {
                if (this.shaded[r][c]) return null;  // shaded → no path
                const [dA, dB] = cell[0];
                return new Set([DIR_NAME[dA], DIR_NAME[dB]]);
            })
        );
    }
}
