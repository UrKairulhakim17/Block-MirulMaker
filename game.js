document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameGrid');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('high-score'); // New element
    const blockContainer = document.getElementById('block-container');
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;

    const GRID_SIZE = 8;
    // CELL_SIZE will be calculated dynamically
    let CELL_SIZE; 
    const PREVIEW_CELL_SIZE_BASE = 25; // Base size, can be adjusted for responsiveness
    let PREVIEW_CELL_SIZE = PREVIEW_CELL_SIZE_BASE;

    const POP_ANIMATION_DURATION = 300; // milliseconds

    let score = 0;
    let highScore = 0; // New high score variable
    let grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    let isGameOver = false;
    let poppingCells = []; // Stores cells currently in pop animation

    // Added more colors for new blocks
    const COLORS = ['#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF', '#9E22FF', '#FF00A0', '#00FFFF', '#FFD700', '#FF4500']; 
    const SHAPES = [
        { name: '1x1', shape: [[1]], color: COLORS[0] },
        { name: '1x2', shape: [[1, 1]], color: COLORS[1] },
        { name: '2x1', shape: [[1], [1]], color: COLORS[1] },
        { name: '1x3', shape: [[1, 1, 1]], color: COLORS[2] },
        { name: '3x1', shape: [[1], [1], [1]], color: COLORS[2] },
        { name: '2x2', shape: [[1, 1], [1, 1]], color: COLORS[3] },
        { name: 'S', shape: [[0, 1, 1], [1, 1, 0]], color: COLORS[4] },
        { name: 'Z', shape: [[1, 1, 0], [0, 1, 1]], color: COLORS[4] },
        { name: 'T', shape: [[1, 1, 1], [0, 1, 0]], color: COLORS[5] },
        { name: 'L', shape: [[1, 0], [1, 0], [1, 1]], color: COLORS[6] },
        { name: 'J', shape: [[0, 1], [0, 1], [1, 1]], color: COLORS[6] },
        { name: '3x3', shape: [[1, 1, 1], [1, 1, 1], [1, 1, 1]], color: COLORS[7] },
        { name: '3x1_new', shape: [[1, 1, 1]], color: COLORS[8] }, // New 3x1 block (horizontal)
        { name: '4x1_new', shape: [[1, 1, 1, 1]], color: COLORS[9] }, // New 4x1 block (horizontal)
        { name: '5x1_new', shape: [[1, 1, 1, 1, 1]], color: COLORS[10] }, // New 5x1 block (horizontal)
        { name: '1x3_new', shape: [[1], [1], [1]], color: COLORS[8] }, // New 3x1 block (vertical)
        { name: '1x4_new', shape: [[1], [1], [1], [1]], color: COLORS[9] }, // New 4x1 block (vertical)
        { name: '1x5_new', shape: [[1], [1], [1], [1], [1]], color: COLORS[10] }, // New 5x1 block (vertical)
    ];

    let draggedBlock = null;
    let ghostBlock = null;
    let isDragging = false; // Added for touch events
    let currentMessage = null; // {text: "msg", color: "col", startTime: Date.now()}

    // --- Theme Switching ---
    themeSwitcher.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        adjustCanvasAndCellSizes(); // Recalculate sizes on theme change as well
        draw(); // Redraw canvas with new theme colors
    });

    function getCssVariable(variable) {
        return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    }

    // Helper to adjust color for 3D effect
    function adjustColor(hex, percent) {
        let f = parseInt(hex.slice(1), 16),
            t = percent < 0 ? 0 : 255,
            p = percent < 0 ? percent * -1 : percent,
            R = f >> 16,
            G = (f >> 8) & 0x00ff,
            B = (f >> 8) & 0x0000ff;
        return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
    }

    // Helper to get coordinates from mouse or touch events
    function getEventCoords(e) {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    // --- Responsive Sizing ---
    function adjustCanvasAndCellSizes() {
        // Get the computed width from CSS after layout, ensuring responsiveness
        const computedStyle = getComputedStyle(canvas);
        const desiredCanvasWidth = parseFloat(computedStyle.width);
        
        canvas.width = desiredCanvasWidth;
        canvas.height = desiredCanvasWidth; // Keep it square

        CELL_SIZE = canvas.width / GRID_SIZE;

        // Adjust PREVIEW_CELL_SIZE dynamically if needed, or keep fixed
        // For now, it remains fixed but can be scaled if preview blocks also need to be very responsive
        // PREVIEW_CELL_SIZE = CELL_SIZE / 2; // Example for dynamic scaling
        
        // Re-render blocks in container to adjust to new PREVIEW_CELL_SIZE if it were dynamic
        // generateAvailableBlocks() would need to be called, but doing so would reset the player's choices
        // For now, only adjust if PREVIEW_CELL_SIZE itself becomes dynamic.
        updateBlockContainerElements(); // Updates styles based on PREVIEW_CELL_SIZE
    }

    // This function updates the block elements in the container with potentially new PREVIEW_CELL_SIZE
    function updateBlockContainerElements() {
        Array.from(blockContainer.children).forEach(blockEl => {
            const shape = JSON.parse(blockEl.dataset.shape);
            blockEl.style.gridTemplateRows = `repeat(${shape.length}, ${PREVIEW_CELL_SIZE}px)`;
            blockEl.style.gridTemplateColumns = `repeat(${shape[0].length}, ${PREVIEW_CELL_SIZE}px)`;
            
            // Re-apply background colors to block-cells within blockElement
            const cells = blockEl.querySelectorAll('.block-cell');
            cells.forEach(cellDiv => {
                cellDiv.style.backgroundColor = blockEl.dataset.color; // Ensure color is set, good for theme changes
            });
        });
    }

    window.addEventListener('resize', () => {
        adjustCanvasAndCellSizes();
        draw();
    });

    // --- Block Generation & Display ---
    function generateAvailableBlocks() {
        blockContainer.innerHTML = ''; // Clear existing blocks
        for (let i = 0; i < 3; i++) {
            const blockInfo = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            const blockElement = createBlockElement(blockInfo);
            blockContainer.appendChild(blockElement);
        }
        checkGameOver();
    }

    function createBlockElement(blockInfo) {
        const blockElement = document.createElement('div');
        blockElement.classList.add('block');
        blockElement.style.gridTemplateRows = `repeat(${blockInfo.shape.length}, ${PREVIEW_CELL_SIZE}px)`;
        blockElement.style.gridTemplateColumns = `repeat(${blockInfo.shape[0].length}, ${PREVIEW_CELL_SIZE}px)`;
        blockElement.draggable = true;

        blockInfo.shape.forEach(row => {
            row.forEach(cell => {
                const cellDiv = document.createElement('div');
                if (cell) {
                    cellDiv.classList.add('block-cell');
                    cellDiv.style.backgroundColor = blockInfo.color;
                }
                blockElement.appendChild(cellDiv);
            });
        });

        blockElement.dataset.shape = JSON.stringify(blockInfo.shape);
        blockElement.dataset.color = blockInfo.color;
        
        blockElement.addEventListener('dragstart', (e) => {
            if (isGameOver) {
                e.preventDefault(); // Prevent dragging if game is over
                return;
            }
            draggedBlock = e.target;
            setTimeout(() => e.target.style.opacity = '0.5', 0);
        });

        blockElement.addEventListener('dragend', (e) => {
            draggedBlock = null;
            ghostBlock = null;
            e.target.style.opacity = '1';
            draw();
        });

        // Touch event listeners for mobile dragging
        blockElement.addEventListener('touchstart', (e) => {
            if (isGameOver) {
                e.preventDefault();
                return;
            }
            e.preventDefault(); // Prevent scrolling
            isDragging = true;
            draggedBlock = e.target;
            // Set opacity after a slight delay to ensure the event propagates
            setTimeout(() => e.target.style.opacity = '0.5', 0);
            
            // Initial ghost block position calculation for touchstart
            const coords = getEventCoords(e);
            const rect = canvas.getBoundingClientRect();
            const x = coords.x;
            const y = coords.y;

            const gridX = Math.floor(x / CELL_SIZE);
            const gridY = Math.floor(y / CELL_SIZE);

            const shape = JSON.parse(draggedBlock.dataset.shape);
            const color = draggedBlock.dataset.color;

            ghostBlock = { shape, color, x: gridX, y: gridY };
            draw();
        });


        return blockElement;
    }

    // --- Drag and Drop Logic ---
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!draggedBlock || isGameOver) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const gridX = Math.floor(x / CELL_SIZE);
        const gridY = Math.floor(y / CELL_SIZE);

        const shape = JSON.parse(draggedBlock.dataset.shape);
        const color = draggedBlock.dataset.color;

        ghostBlock = { shape, color, x: gridX, y: gridY };
        draw(); // Redraw to show the ghost
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        // Mouse drop logic
        if (!draggedBlock || !ghostBlock || isGameOver) return;

        if (isValidPlacement(ghostBlock)) {
            placeBlock(ghostBlock);
            draggedBlock.remove();
            if (blockContainer.children.length === 0) {
                generateAvailableBlocks();
            }
            clearLines();
            checkGameOver();
        }
        ghostBlock = null;
        if (draggedBlock) { // Ensure draggedBlock is not null before accessing style
            draggedBlock.style.opacity = '1';
        }
        draggedBlock = null;
        draw();
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent scrolling
        if (!isDragging || !draggedBlock || isGameOver) return;

        const coords = getEventCoords(e);
        const gridX = Math.floor(coords.x / CELL_SIZE);
        const gridY = Math.floor(coords.y / CELL_SIZE);

        const shape = JSON.parse(draggedBlock.dataset.shape);
        const color = draggedBlock.dataset.color;

        ghostBlock = { shape, color, x: gridX, y: gridY };
        draw();
    });

    canvas.addEventListener('touchend', (e) => {
        if (!isDragging || !draggedBlock || !ghostBlock || isGameOver) {
            // Reset opacity if a drag was initiated but not successfully dropped
            if (draggedBlock) {
                draggedBlock.style.opacity = '1';
            }
            isDragging = false;
            draggedBlock = null;
            ghostBlock = null;
            draw();
            return;
        }

        if (isValidPlacement(ghostBlock)) {
            placeBlock(ghostBlock);
            // Ensure draggedBlock is still in the DOM before trying to remove it
            if (draggedBlock && draggedBlock.parentNode) {
                draggedBlock.remove();
            }
            if (blockContainer.children.length === 0) {
                generateAvailableBlocks();
            }
            clearLines();
            checkGameOver();
        } else {
            // If placement is invalid, give feedback (e.g., shake, message)
            displayMessage('Invalid placement!', 'red', 1000);
        }
        
        if (draggedBlock) { // Reset opacity of the original block
            draggedBlock.style.opacity = '1';
        }
        isDragging = false;
        draggedBlock = null;
        ghostBlock = null;
        draw();
    });
    
    // --- Game Logic ---
    function isValidPlacement(block, checkGrid = grid) {
        const { shape, x, y } = block;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const gridR = y + r;
                    const gridC = x + c;
                    if (gridR < 0 || gridR >= GRID_SIZE || gridC < 0 || gridC >= GRID_SIZE || checkGrid[gridR][gridC]) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    function placeBlock(block) {
        const { shape, color, x, y } = block;
        let blocksPlaced = 0;
        shape.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) {
                    grid[y + r][x + c] = color;
                    blocksPlaced++;
                }
            });
        });
        score += blocksPlaced; // Each placed block cell contributes to score
        updateScore();
    }
    
    function clearLines() {
        let cellsClearedCount = 0;
        let cellsToClear = new Set(); // To store unique "r,c" coordinates
        let rowsCleared = 0;
        let colsCleared = 0;

        // Check for full rows
        for(let r = 0; r < GRID_SIZE; r++) {
            if (grid[r].every(cell => cell !== null)) {
                rowsCleared++;
                for(let c = 0; c < GRID_SIZE; c++) {
                    cellsToClear.add(`${r},${c}`);
                }
            }
        }

        // Check for full columns
        for(let c = 0; c < GRID_SIZE; c++) {
            let colFull = true;
            for(let r = 0; r < GRID_SIZE; r++) {
                if (grid[r][c] === null) {
                    colFull = false;
                    break;
                }
            }
            if (colFull) {
                colsCleared++;
                for(let r = 0; r < GRID_SIZE; r++) {
                    cellsToClear.add(`${r},${c}`);
                }
            }
        }
        
        // Mark cells for popping animation
        if (cellsToClear.size > 0) {
            const animationStartTime = Date.now();
            cellsToClear.forEach(coords => {
                const [r, c] = coords.split(',').map(Number);
                poppingCells.push({ r, c, color: grid[r][c], startTime: animationStartTime });
            });

            setTimeout(() => {
                cellsToClear.forEach(coords => {
                    const [r, c] = coords.split(',').map(Number);
                    grid[r][c] = null;
                });
                cellsClearedCount = cellsToClear.size;
                poppingCells = []; // Clear popping cells after animation

                score += cellsClearedCount * 20; // 20 points per cleared cell
                updateScore();
                draw(); // Final redraw after cells are null

                // Combo and encouragement messages
                if (rowsCleared + colsCleared > 1) {
                    displayMessage(`Combo x${rowsCleared + colsCleared}! Amazing!`, 'green');
                } else if (rowsCleared + colsCleared === 1) {
                    displayMessage('Good Clear!', 'blue');
                }
            }, POP_ANIMATION_DURATION);
        }
    }
    
    let messageTimeout;
    function displayMessage(msg, color = 'white', duration = 1500) {
        currentMessage = { text: msg, color: color, startTime: Date.now(), duration: duration };
        // We don't call draw() here, it's called by requestAnimationFrame in the main loop
    }


    function checkGameOver() {
        console.log("checkGameOver() called.");
        const availableBlocks = Array.from(blockContainer.children);
        console.log(`Available blocks in container: ${availableBlocks.length}`);

        if (availableBlocks.length === 0) {
            console.log("No blocks in container, returning.");
            return; 
        }

        let anyBlockCanBePlaced = false;
        for (const blockEl of availableBlocks) {
            const shape = JSON.parse(blockEl.dataset.shape);
            const color = blockEl.dataset.color;
            console.log(`Checking block: ${blockEl.dataset.name || 'Unnamed'} (Shape: ${JSON.stringify(shape)})`);

            for (let r = 0; r < GRID_SIZE; r++) {
                for (let c = 0; c < GRID_SIZE; c++) {
                    const tempBlock = { shape, color, x: c, y: r };
                    if (isValidPlacement(tempBlock)) {
                        console.log(`  -> Valid placement found at (${c}, ${r}) for this block.`);
                        anyBlockCanBePlaced = true;
                        break;
                    }
                }
                if (anyBlockCanBePlaced) break;
            }
            if (anyBlockCanBePlaced) break;
        }

        if (!anyBlockCanBePlaced) {
            console.log("No valid placements found for any available block. GAME OVER.");
            isGameOver = true;
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('blockPuzzleHighScore', highScore);
                updateHighScoreDisplay();
            }
            // The GAME OVER message is drawn directly in the draw() loop
            // The debug console logs will still be there for verification
        } else {
            console.log("Valid placements still possible. Game continues.");
        }
    }
    
    function updateScore() {
        scoreEl.textContent = score;
    }

    function updateHighScoreDisplay() {
        highScoreEl.textContent = highScore;
    }

    // --- Drawing Functions ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackgroundGrid(); // Draw grid background
        drawGridLines();
        drawPlacedBlocks();
        drawPoppingCells(); // Draw cells currently popping
        if (ghostBlock) {
            drawGhostBlock();
        }

        if (isGameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.fillRect(0, canvas.height / 2 - 40, canvas.width, 80);
            ctx.fillStyle = 'white';
            ctx.font = '30px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 10);
            ctx.font = '16px Arial';
            ctx.fillText('Click to Restart', canvas.width / 2, canvas.height / 2 + 20);
        } else if (currentMessage) {
            const elapsed = Date.now() - currentMessage.startTime;
            if (elapsed < currentMessage.duration) {
                const alpha = 1 - (elapsed / currentMessage.duration);
                ctx.globalAlpha = alpha;
                ctx.fillStyle = currentMessage.color;
                ctx.font = 'bold 30px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(currentMessage.text, canvas.width / 2, canvas.height / 2 + 50);
                ctx.globalAlpha = 1.0;
            } else {
                currentMessage = null; // Clear message after duration
            }
        }
        requestAnimationFrame(draw); // Keep the main draw loop running
    }

    function drawBackgroundGrid() {
        ctx.fillStyle = getCssVariable('--grid-bg');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawGridLines() {
        // Draw major grid lines
        ctx.strokeStyle = getCssVariable('--grid-lines-major');
        ctx.lineWidth = 2; 
        for (let i = 0; i <= GRID_SIZE; i++) {
            ctx.beginPath();
            ctx.moveTo(i * CELL_SIZE, 0);
            ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * CELL_SIZE);
            ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
            ctx.stroke();
        }

        // Draw minor grid lines (cell separators)
        ctx.strokeStyle = getCssVariable('--grid-lines-minor');
        ctx.lineWidth = 1;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                ctx.beginPath();
                ctx.moveTo(c * CELL_SIZE + CELL_SIZE, r * CELL_SIZE);
                ctx.lineTo(c * CELL_SIZE + CELL_SIZE, (r + 1) * CELL_SIZE);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(c * CELL_SIZE, r * CELL_SIZE + CELL_SIZE);
                ctx.lineTo((c + 1) * CELL_SIZE, r * CELL_SIZE + CELL_SIZE);
                ctx.stroke();
            }
        }
    }
    
    // Function to draw a single cell with 3D effect
    function drawBlockCell(x, y, color, alpha = 1.0) {
        ctx.globalAlpha = alpha;
        
        // Main face
        ctx.fillStyle = color;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        // Highlights (top and left)
        ctx.fillStyle = adjustColor(color, 0.2); // Lighter
        ctx.fillRect(x, y, CELL_SIZE, 2); // Top highlight
        ctx.fillRect(x, y, 2, CELL_SIZE); // Left highlight

        // Shadows (bottom and right)
        ctx.fillStyle = adjustColor(color, -0.2); // Darker
        ctx.fillRect(x, y + CELL_SIZE - 2, CELL_SIZE, 2); // Bottom shadow
        ctx.fillRect(x + CELL_SIZE - 2, y, 2, CELL_SIZE); // Right shadow

        // Shiny effect: a small transparent white rectangle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; // White with transparency
        ctx.fillRect(x + 2, y + 2, CELL_SIZE / 3, CELL_SIZE / 3); // Top-left shine
        
        ctx.globalAlpha = 1.0;
    }


    function drawPlacedBlocks() {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                if (grid[r][c]) {
                    drawBlockCell(c * CELL_SIZE, r * CELL_SIZE, grid[r][c]);
                }
            }
        }
    }
    
    function drawPoppingCells() {
        const currentTime = Date.now();
        poppingCells.forEach(cell => {
            const elapsed = currentTime - cell.startTime;
            const progress = elapsed / POP_ANIMATION_DURATION;
            
            if (progress < 1) {
                const alpha = 1 - progress; // Fade out
                const scale = 1 - progress * 0.5; // Shrink slightly

                const drawSize = CELL_SIZE * scale;
                const offset = (CELL_SIZE - drawSize) / 2;

                drawBlockCell(cell.c * CELL_SIZE + offset, cell.r * CELL_SIZE + offset, cell.color, alpha);
            }
        });
        // Important: requestAnimationFrame(draw) is now in the main draw loop
        // If poppingCells is not empty, ensure draw() is called again.
        // This is handled by the main requestAnimationFrame(draw) at the end of draw().
    }

    function drawGhostBlock() {
        const { shape, color, x, y } = ghostBlock;
        const isValid = isValidPlacement(ghostBlock);
        // Use the block's color, or a specific invalid color
        const ghostColor = isValid ? color : getCssVariable('--invalid-placement-color');

        shape.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) {
                    // Draw ghost cells with transparency and the determined color
                    drawBlockCell((x + c) * CELL_SIZE, (y + r) * CELL_SIZE, ghostColor, 0.5);
                }
            });
        });
    }

    // --- Init ---
    function init() {
        // Set initial theme to light if no preference
        if (!body.classList.contains('dark-theme')) {
            body.classList.add('light-theme');
        }
        adjustCanvasAndCellSizes(); // Initial sizing
        isGameOver = false; // Ensure game is not over on init
        
        // Load high score
        highScore = parseInt(localStorage.getItem('blockPuzzleHighScore') || '0');
        updateHighScoreDisplay();

        draw();
        generateAvailableBlocks();
    }

    // Restart game listener
    canvas.addEventListener('click', () => {
        if (isGameOver) {
            score = 0;
            grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
            isGameOver = false;
            currentMessage = null; // Clear any lingering messages
            generateAvailableBlocks();
            updateScore();
            // No need to call draw() here, requestAnimationFrame will pick it up
        }
    });

    init();
});