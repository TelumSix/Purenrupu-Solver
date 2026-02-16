/**
 * Purenrupu (Pure Loop) Solver – UI & Application Logic
 *
 * Manages the interactive grid, user input, and rendering of the
 * solved loop path.  Delegates solving to solver.js (PurenrupuSolver).
 */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {number} */ let numRows = 6;
/** @type {number} */ let numCols = 5;

/**
 * 2-D grid: grid[r][c] === true  → shaded cell
 *                       === false → unshaded cell
 * @type {boolean[][]}
 */
let grid = [];

/**
 * Solution produced by the solver.
 * Each cell stores a Set of directions ('up','down','left','right')
 * indicating which edges the loop crosses.
 * null when no solution has been computed.
 * @type {Set<string>[][] | null}
 */
let solution = null;

// ---------------------------------------------------------------------------
// DOM References
// ---------------------------------------------------------------------------

const rowsInput       = document.getElementById('rows');
const colsInput       = document.getElementById('cols');
const btnCreate       = document.getElementById('btn-create');
const btnSolve        = document.getElementById('btn-solve');
const btnClear        = document.getElementById('btn-clear');
const btnReset        = document.getElementById('btn-reset');
const gridContainer   = document.getElementById('grid-container');
const statusText      = document.getElementById('status-text');

// ---------------------------------------------------------------------------
// Grid Creation
// ---------------------------------------------------------------------------

function createGrid() {
    numRows = parseInt(rowsInput.value, 10) || 5;
    numCols = parseInt(colsInput.value, 10) || 5;

    grid = Array.from({ length: numRows }, () =>
        Array.from({ length: numCols }, () => false)
    );
    solution = null;
    setStatus('');
    renderGrid();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderGrid() {
    gridContainer.innerHTML = '';

    const table = document.createElement('div');
    table.classList.add('grid');
    table.style.gridTemplateColumns = `repeat(${numCols}, 44px)`;
    table.style.gridTemplateRows    = `repeat(${numRows}, 44px)`;

    for (let r = 0; r < numRows; r++) {
        for (let c = 0; c < numCols; c++) {
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.classList.add(grid[r][c] ? 'shaded' : 'unshaded');
            cell.dataset.row = r;
            cell.dataset.col = c;

            cell.addEventListener('click', () => toggleCell(r, c));

            // Draw solution path segments if available (not for shaded cells)
            if (solution && solution[r][c]) {
                const dirs = solution[r][c];
                drawPath(cell, dirs);
            }

            table.appendChild(cell);
        }
    }

    gridContainer.appendChild(table);
}

/**
 * Draw loop path segments inside a cell.
 * @param {HTMLElement} cell
 * @param {Set<string>} dirs  e.g. {'up','right'}
 */
function drawPath(cell, dirs) {
    if (dirs.size === 0) return;

    // For each direction, create a half-segment reaching from that edge to
    // the center.  A center dot connects them.
    for (const d of dirs) {
        const seg = document.createElement('div');
        seg.classList.add('path', d);          // up | down | left | right
        cell.appendChild(seg);
    }

    // Center dot
    const dot = document.createElement('div');
    dot.classList.add('path', 'center');
    cell.appendChild(dot);
}

// ---------------------------------------------------------------------------
// Interaction
// ---------------------------------------------------------------------------

function toggleCell(r, c) {
    grid[r][c] = !grid[r][c];
    solution = null;
    setStatus('');
    renderGrid();
}

function clearSolution() {
    solution = null;
    setStatus('');
    renderGrid();
}

function resetGrid() {
    grid = Array.from({ length: numRows }, () =>
        Array.from({ length: numCols }, () => false)
    );
    solution = null;
    setStatus('');
    renderGrid();
}

// ---------------------------------------------------------------------------
// Solving
// ---------------------------------------------------------------------------

function solve() {
    setStatus('Solving…', 'working');

    // Use requestAnimationFrame so the status text renders before
    // we start the (potentially blocking) solver.
    requestAnimationFrame(() => {
        setTimeout(() => {
            try {
                const solver = new PurenrupuSolver(numRows, numCols, grid);
                const result = solver.solve();

                if (result) {
                    solution = result;
                    setStatus('Solution found!', 'success');
                } else {
                    solution = null;
                    setStatus('No solution exists for this configuration.', 'error');
                }
            } catch (err) {
                console.error(err);
                setStatus('Solver error: ' + err.message, 'error');
            }
            renderGrid();
        }, 30);
    });
}

// ---------------------------------------------------------------------------
// Status Helper
// ---------------------------------------------------------------------------

function setStatus(msg, cls) {
    statusText.textContent = msg;
    statusText.className = cls || '';
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------

btnCreate.addEventListener('click', createGrid);
btnSolve.addEventListener('click', solve);
btnClear.addEventListener('click', clearSolution);
btnReset.addEventListener('click', resetGrid);

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

createGrid();

