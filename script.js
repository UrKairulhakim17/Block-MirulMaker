document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameGrid');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('high-score');
    const progressBar = document.getElementById('progress-bar');
    const blockContainer = document.getElementById('block-container');
    const themeSwitcher = document.getElementById('theme-switcher');
    const body = document.body;
    const pauseButton = document.getElementById('pause-button');
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    const pauseMenu = document.getElementById('pause-menu');
    const resumeButton = document.getElementById('resume-button');
    const restartButton = document.getElementById('restart-button');
    const muteButton = document.getElementById('mute-button');

    const mainMenu = document.getElementById('main-menu');
    const classicModeBtn = document.getElementById('classic-mode-btn');
    const levelModeBtn = document.getElementById('level-mode-btn');
    const header = document.querySelector('.header');
    const gameContainer = document.querySelector('.game-container');

    let animationFrameId = null;


    class AudioManager {
        constructor() {
            this.gameOverMusic = document.getElementById('game-over-music');
            this.backgroundMusic = document.getElementById('background-music');
            this.lineClearSound = document.getElementById('line-clear-sound');
            this.powerUpSound = document.getElementById('power-up-sound');
            this.explosionSound = document.getElementById('explosion-sound');
            this.isMuted = false;
            this.volume = 0.5;

            this.sounds = [this.gameOverMusic, this.backgroundMusic, this.lineClearSound, this.powerUpSound, this.explosionSound];
        }

        unlockAudio() {
            this.sounds.forEach(sound => {
                sound.play();
                sound.pause();
                sound.currentTime = 0;
            });
        }

        setVolume(volume) {
            this.volume = volume;
            if (!this.isMuted) {
                this.sounds.forEach(sound => sound.volume = volume);
            }
        }

        toggleMute() {
            this.isMuted = !this.isMuted;
            this.sounds.forEach(sound => sound.volume = this.isMuted ? 0 : this.volume);
            muteButton.textContent = this.isMuted ? 'Unmute' : 'Mute';
        }

        play(sound) {
            if (!this.isMuted) {
                sound.currentTime = 0;
                sound.play();
            }
        }

        playBgMusic() {
            if (!this.isMuted) {
                this.backgroundMusic.play().catch(error => {
                    console.error("Background music couldn't play:", error);
                });
            }
        }

        pauseBgMusic() {
            this.backgroundMusic.pause();
        }
    }

    const audioManager = new AudioManager();
    const volumeSlider = document.getElementById('volume-slider');

    volumeSlider.addEventListener('input', (e) => {
        audioManager.setVolume(e.target.value);
    });

    const GRID_SIZE = 8;
    let CELL_SIZE; 
    const PREVIEW_CELL_SIZE_BASE = 25;
    let PREVIEW_CELL_SIZE = PREVIEW_CELL_SIZE_BASE;

    const POP_ANIMATION_DURATION = 300;

    let score = 0;
    let highScore = 0;
    let grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
    let isGameOver = false;
    let isPaused = false;
    let poppingCells = [];

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
        { name: '3x1_new', shape: [[1, 1, 1]], color: COLORS[8] },
        { name: '4x1_new', shape: [[1, 1, 1, 1]], color: COLORS[9] },
        { name: '5x1_new', shape: [[1, 1, 1, 1, 1]], color: COLORS[10] },
        { name: '1x3_new', shape: [[1], [1], [1]], color: COLORS[8] },
        { name: '1x4_new', shape: [[1], [1], [1], [1]], color: COLORS[9] },
        { name: '1x5_new', shape: [[1], [1], [1], [1], [1]], color: COLORS[10] },
    ];

    let draggedBlock = null;
    let ghostBlock = null;
    let draggedBlockInfo = null;
    let currentMessage = null;

    let gameMode = null;
    let currentLevel = 0;
    const levels = [
        { targetScore: 500 },
        { targetScore: 1200 },
        { targetScore: 2000 },
        { targetScore: 3000 },
        { targetScore: 5000 },
    ];

    // --- Menu Handling ---
    classicModeBtn.addEventListener('click', () => {
        gameMode = 'classic';
        startGame();
    });

    levelModeBtn.addEventListener('click', () => {
        gameMode = 'level';
        currentLevel = 0;
        startGame();
    });
    
    backToMenuBtn.addEventListener('click', showMainMenu);

    function showMainMenu() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        header.style.display = 'none';
        gameContainer.style.display = 'none';
        pauseMenu.classList.remove('active');
        mainMenu.style.display = 'flex';
        
        audioManager.pauseBgMusic();
        
        // Reset game state
        isGameOver = true; // Set to true to stop any interaction
        isPaused = false;
    }

    function startGame() {
        mainMenu.style.display = 'none';
        header.style.display = 'flex';
        gameContainer.style.display = 'flex'; 

        if(gameMode === 'level' && !document.getElementById('level-info')) {
            const levelInfo = document.createElement('div');
            levelInfo.id = 'level-info';
            levelInfo.style.cssText = "font-size: 1.5em; margin-bottom: 10px; text-align: center;";
            document.querySelector('.score-container').prepend(levelInfo);
        }

        init();
    }


    // --- Pause Handling ---
    function pauseGame() {
        if (isGameOver) return;
        isPaused = true;
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        pauseMenu.classList.add('active');
        audioManager.pauseBgMusic();
        interact('.block').draggable(false);
    }

    function resumeGame() {
        isPaused = false;
        pauseMenu.classList.remove('active');
        audioManager.playBgMusic();
        interact('.block').draggable(true);
        animationFrameId = requestAnimationFrame(draw);
    }

    function restartGame() {
        score = 0;
        grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
        isGameOver = false;
        currentMessage = null;
        
        // In level mode, a restart should restart the current level, not go back to level 1
        if (gameMode === 'level') {
            updateLevelDisplay();
        }

        generateAvailableBlocks();
        updateScore();
        if (isPaused) {
            resumeGame();
        } else {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(draw);
        }
    }

    pauseButton.addEventListener('click', pauseGame);
    resumeButton.addEventListener('click', resumeGame);
    restartButton.addEventListener('click', restartGame);
    muteButton.addEventListener('click', () => audioManager.toggleMute());


    // --- Utilities ---
    function throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
    }

    // --- Theme Switching ---
    themeSwitcher.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        draw();
    });

    function getCssVariable(variable) {
        return getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    }

    function adjustColor(hex, percent) {
        let f = parseInt(hex.slice(1), 16),
            t = percent < 0 ? 0 : 255,
            p = percent < 0 ? percent * -1 : percent,
            R = f >> 16,
            G = (f >> 8) & 0x00ff,
            B = f & 0x0000ff;
        return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
    }

    // --- Responsive Sizing ---
    function adjustCanvasAndCellSizes() {
        const computedStyle = getComputedStyle(canvas);
        const desiredCanvasWidth = parseFloat(computedStyle.width);
        
        canvas.width = desiredCanvasWidth;
        canvas.height = desiredCanvasWidth;

        CELL_SIZE = canvas.width / GRID_SIZE;

        updateBlockContainerElements();
    }

    function updateBlockContainerElements() {
        Array.from(blockContainer.children).forEach(blockEl => {
            const shape = JSON.parse(blockEl.dataset.shape);
            blockEl.style.gridTemplateRows = `repeat(${shape.length}, ${PREVIEW_CELL_SIZE}px)`;
            blockEl.style.gridTemplateColumns = `repeat(${shape[0].length}, ${PREVIEW_CELL_SIZE}px)`;
            
            const cells = blockEl.querySelectorAll('.block-cell');
            cells.forEach(cellDiv => {
                cellDiv.style.backgroundColor = blockEl.dataset.color;
            });
        });
    }

    window.addEventListener('resize', () => {
        if (isPaused || isGameOver) return;
        adjustCanvasAndCellSizes();
        draw();
    });

    // --- Block Generation & Display ---
    function generateAvailableBlocks() {
        blockContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const blockInfo = SHAPES[Math.floor(Math.random() * SHAPES.length)];
            const blockElement = createBlockElement(blockInfo);
            blockContainer.appendChild(blockElement);
        }
    }

    function createBlockElement(blockInfo) {
        const blockElement = document.createElement('div');
        blockElement.classList.add('block');
        blockElement.style.gridTemplateRows = `repeat(${blockInfo.shape.length}, ${PREVIEW_CELL_SIZE}px)`;
        blockElement.style.gridTemplateColumns = `repeat(${blockInfo.shape[0].length}, ${PREVIEW_CELL_SIZE}px)`;
        
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
        blockElement.dataset.x = 0;
        blockElement.dataset.y = 0;
        
        return blockElement;
    }

    // --- Interact.js Drag and Drop Logic ---
    function setupInteract() {
        const handleDragMove = throttle((event) => {
            if (isGameOver || isPaused || !draggedBlockInfo) return;
            
            const canvasRect = canvas.getBoundingClientRect();
            const x = event.dragEvent.client.x - canvasRect.left;
            const y = event.dragEvent.client.y - canvasRect.top;

            const gridX = Math.floor(x / CELL_SIZE);
            const gridY = Math.floor(y / CELL_SIZE);

            if (!ghostBlock) ghostBlock = {};
            ghostBlock.shape = draggedBlockInfo.shape;
            ghostBlock.color = draggedBlockInfo.color;
            ghostBlock.x = gridX;
            ghostBlock.y = gridY;
        }, 16); // Reduced throttle time for more responsive ghost block

        interact('.block').draggable({
            inertia: true,
            autoScroll: true,
            listeners: {
                start (event) {
                    if (isGameOver || isPaused) return;
                    const target = event.target;
                    draggedBlockInfo = {
                        shape: JSON.parse(target.dataset.shape),
                        color: target.dataset.color,
                        target: target
                    };
                    target.style.zIndex = 1000;
                },
                move (event) {
                    if (isGameOver || isPaused) return;
                    const target = event.target;
                    const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                    const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                    target.style.transform = `translate(${x}px, ${y}px)`;
                    target.setAttribute('data-x', x);
                    target.setAttribute('data-y', y);
                },
                end (event) {
                    if (isGameOver || isPaused) return;
                    if (!event.relatedTarget && draggedBlockInfo) {
                        draggedBlockInfo.target.style.transition = 'transform 0.5s ease-in-out';
                        draggedBlockInfo.target.style.transform = 'translate(0px, 0px)';
                        draggedBlockInfo.target.setAttribute('data-x', 0);
                        draggedBlockInfo.target.setAttribute('data-y', 0);
                        setTimeout(() => {
                            if(draggedBlockInfo) draggedBlockInfo.target.style.transition = '';
                        }, 500);
                    }
                    if(draggedBlockInfo) {
                        draggedBlockInfo.target.style.zIndex = '';
                    }
                    ghostBlock = null;
                    draggedBlockInfo = null;
                }
            }
        });

        interact('#gameGrid').dropzone({
            accept: '.block',
            ondragenter: handleDragMove,
            ondragleave: function () {
                if (isGameOver || isPaused) return;
                ghostBlock = null;
            },
            ondrop: function (event) {
                if (isGameOver || isPaused || !draggedBlockInfo) return;
                
                const canvasRect = canvas.getBoundingClientRect();
                const dropX = event.dragEvent.client.x - canvasRect.left;
                const dropY = event.dragEvent.client.y - canvasRect.top;

                const gridX = Math.floor(dropX / CELL_SIZE);
                const gridY = Math.floor(dropY / CELL_SIZE);

                const finalGhostBlock = { 
                    shape: draggedBlockInfo.shape, 
                    color: draggedBlockInfo.color, 
                    x: gridX, 
                    y: gridY
                };

                if (isValidPlacement(finalGhostBlock)) {
                    placeBlock(finalGhostBlock);
                    draggedBlockInfo.target.remove();
                    if (blockContainer.children.length === 0) {
                        generateAvailableBlocks();
                    }
                    clearLines();
                    checkGameOver();
                } else {
                    displayMessage('Invalid placement!', 'red', 1000);
                    if (draggedBlockInfo.target) {
                        draggedBlockInfo.target.style.transition = 'transform 0.5s ease-in-out';
                        draggedBlockInfo.target.style.transform = 'translate(0px, 0px)';
                        draggedBlockInfo.target.setAttribute('data-x', 0);
                        draggedBlockInfo.target.setAttribute('data-y', 0);
                        setTimeout(() => {
                             if(draggedBlockInfo) draggedBlockInfo.target.style.transition = '';
                        }, 500);
                    }
                }
            },
            ondropmove: handleDragMove
        });
    }
    
    
    // --- Game Logic ---
    function isValidPlacement(block, checkGrid = grid) {
        const { shape, x, y } = block;
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (shape[r][c]) {
                    const gridR = y + r;
                    const gridC = x + c;
                    if (gridR < 0 || gridR >= GRID_SIZE || gridC < 0 || gridC >= GRID_SIZE) {
                        return false;
                    }
                    if (checkGrid[gridR][gridC]) {
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
        score += blocksPlaced;
        updateScore();
    }
    
    function clearLines() {
        if (isPaused) return;
        let cellsToClear = new Set();
        let rowsCleared = 0;
        let colsCleared = 0;

        for(let r = 0; r < GRID_SIZE; r++) {
            if (grid[r].every(cell => cell !== null)) {
                rowsCleared++;
                for(let c = 0; c < GRID_SIZE; c++) cellsToClear.add(`${r},${c}`);
            }
        }

        for(let c = 0; c < GRID_SIZE; c++) {
            if (grid.every(row => row[c] !== null)) {
                colsCleared++;
                for(let r = 0; r < GRID_SIZE; r++) cellsToClear.add(`${r},${c}`);
            }
        }
        
        if (cellsToClear.size > 0) {
            audioManager.play(audioManager.lineClearSound);
            const animationStartTime = Date.now();
            cellsToClear.forEach(coords => {
                const [r, c] = coords.split(',').map(Number);
                poppingCells.push({ r, c, color: grid[r][c], startTime: animationStartTime });
            });

            setTimeout(() => {
                if (isPaused) return;
                cellsToClear.forEach(coords => {
                    const [r, c] = coords.split(',').map(Number);
                    grid[r][c] = null;
                });
                poppingCells = [];

                let combo = rowsCleared + colsCleared;
                let scoreToAdd = cellsToClear.size * 20;
                if (combo >= 2) {
                    scoreToAdd *= Math.pow(2, combo - 1);
                    audioManager.play(audioManager.powerUpSound);
                }
                score += scoreToAdd;
                
                updateScore();
                if(!isGameOver) draw();

                if (combo > 1) displayMessage(`Combo x${combo}! Amazing!`, 'green');
                else if (combo === 1) displayMessage('Good Clear!', 'blue');
            }, POP_ANIMATION_DURATION);
        }
    }
    
    function displayMessage(msg, color = 'white', duration = 1500) {
        currentMessage = { text: msg, color: color, startTime: Date.now(), duration: duration };
    }

    function checkGameOver() {
        if (isPaused) return;
        
        const canAnyBlockBePlaced = (blocksToCheck) => {
            if (blocksToCheck.length === 0) return false;
            for (const blockEl of blocksToCheck) {
                const shape = JSON.parse(blockEl.dataset.shape);
                for (let r = 0; r < GRID_SIZE; r++) {
                    for (let c = 0; c < GRID_SIZE; c++) {
                        const tempBlock = { shape, x: c, y: r };
                        if (isValidPlacement(tempBlock)) return true;
                    }
                }
            }
            return false;
        };

        if (!canAnyBlockBePlaced(Array.from(blockContainer.children))) {
            isGameOver = true;
            audioManager.play(audioManager.gameOverMusic);
            if (gameMode === 'classic' && score > highScore) {
                highScore = score;
                localStorage.setItem('blockPuzzleHighScore', highScore);
                updateHighScoreDisplay();
            }
        } else {
            isGameOver = false;
        }
    }
    
    function updateScore() {
        scoreEl.textContent = score;

        if (gameMode === 'classic') {
            updateProgressBar(score, highScore > 0 ? highScore : 100);
        } else if (gameMode === 'level') {
            if(currentLevel >= levels.length) return;
            const targetScore = levels[currentLevel].targetScore;
            updateProgressBar(score, targetScore);

            if (score >= targetScore) {
                currentLevel++;
                if (currentLevel >= levels.length) {
                    displayMessage('You beat all levels!', 'gold', 5000);
                    isGameOver = true;
                } else {
                    displayMessage(`Level ${currentLevel + 1}!`, 'cyan', 2000);
                    setTimeout(() => {
                        score = 0;
                        grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
                        generateAvailableBlocks();
                        updateLevelDisplay();
                        updateScore();
                    }, 2000);
                }
            }
        }
    }

    function updateLevelDisplay() {
        const levelInfoEl = document.getElementById('level-info');
        if (levelInfoEl && gameMode === 'level' && currentLevel < levels.length) {
            levelInfoEl.innerHTML = `Level: ${currentLevel + 1} <br> Target: ${levels[currentLevel].targetScore}`;
        }
    }

    function updateHighScoreDisplay() {
        highScoreEl.textContent = highScore;
    }

    function updateProgressBar(current, target) {
        if (!progressBar || target === 0) return;
        const percentage = Math.min(100, (current / target) * 100);
        progressBar.style.width = `${percentage}%`;
    }

    // --- Drawing Functions ---
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawBackgroundGrid();
        drawGridLines();
        drawPlacedBlocks();
        drawPoppingCells();
        if (ghostBlock) drawGhostBlock();

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
                currentMessage = null;
            }
        }

        if (!isPaused && !isGameOver) {
            animationFrameId = requestAnimationFrame(draw);
        }
    }

    function drawBackgroundGrid() {
        ctx.fillStyle = getCssVariable('--grid-bg');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawGridLines() {
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

        ctx.strokeStyle = getCssVariable('--grid-lines-minor');
        ctx.lineWidth = 1;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }
    
    function drawBlockCell(x, y, color, alpha = 1.0) {
        ctx.globalAlpha = alpha;
        
        ctx.fillStyle = color;
        ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

        ctx.fillStyle = adjustColor(color, 0.2);
        ctx.fillRect(x, y, CELL_SIZE, 2);
        ctx.fillRect(x, y, 2, CELL_SIZE);

        ctx.fillStyle = adjustColor(color, -0.2);
        ctx.fillRect(x, y + CELL_SIZE - 2, CELL_SIZE, 2);
        ctx.fillRect(x + CELL_SIZE - 2, y, 2, CELL_SIZE);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x + 2, y + 2, CELL_SIZE / 3, CELL_SIZE / 3);
        
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
            const progress = Math.min(1, elapsed / POP_ANIMATION_DURATION);
            
            const easedProgress = easeOutQuad(progress);
            const alpha = 1 - easedProgress;
            const scale = 1 - easedProgress * 0.5;

            const drawSize = CELL_SIZE * scale;
            const offset = (CELL_SIZE - drawSize) / 2;

            drawBlockCell(cell.c * CELL_SIZE + offset, cell.r * CELL_SIZE + offset, cell.color, alpha);
        });
    }

    function drawGhostBlock() {
        const { shape, color, x, y } = ghostBlock;
        const isValid = isValidPlacement(ghostBlock);
        const ghostColor = isValid ? color : getCssVariable('--invalid-placement-color');

        ctx.globalAlpha = 0.5;
        shape.forEach((row, r) => {
            row.forEach((cell, c) => {
                if (cell) {
                    drawBlockCell((x + c) * CELL_SIZE, (y + r) * CELL_SIZE, ghostColor);
                }
            });
        });
        ctx.globalAlpha = 1.0;
    }

    // --- Init ---
    function init() {
        if (!body.classList.contains('dark-theme')) {
            body.classList.add('light-theme');
        }
        adjustCanvasAndCellSizes();
        
        score = 0;
        grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
        isGameOver = false;
        isPaused = false;
        currentMessage = null;
        
        if (gameMode === 'classic') {
            highScore = parseInt(localStorage.getItem('blockPuzzleHighScore') || '0');
            updateHighScoreDisplay();
            document.querySelector('.high-score-container').style.display = 'block';
            if(document.getElementById('level-info')) {
                document.getElementById('level-info').style.display = 'none';
            }
        } else if (gameMode === 'level') {
            document.querySelector('.high-score-container').style.display = 'none';
            let levelInfoEl = document.getElementById('level-info');
            if(levelInfoEl) levelInfoEl.style.display = 'block';
            updateLevelDisplay();
        }

        updateScore();
        
        audioManager.setVolume(volumeSlider.value);
        body.addEventListener('click', () => {
            audioManager.unlockAudio();
            audioManager.playBgMusic();
        }, { once: true });

        generateAvailableBlocks();
        setupInteract();
        animationFrameId = requestAnimationFrame(draw);
    }

    // Restart game listener
    canvas.addEventListener('click', () => {
        if (isGameOver) {
            restartGame();
        }
    });
});