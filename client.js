class BingoClient {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.playerName = '';
        this.gameRoom = '';
        this.gameState = {
            gameType: null,
            boardId: 1,
            markedNumbers: new Set(),
            calledNumbers: [],
            isHost: false,
            balance: 0,
            stake: 25
        };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupBoardSelection();
        this.updateStatus('Connecting...');
        this.connect();
    }

    connect() {
        // Replace with your Deno Deploy URL
        const wsUrl = 'wss://your-app.deno.dev';
        // For local testing: 'ws://localhost:8080'
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.updateStatus('Connected', true);
                this.reconnectAttempts = 0;
                console.log('Connected to server');
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onclose = () => {
                this.updateStatus('Disconnected', false);
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Connection failed:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            
            this.updateStatus(`Reconnecting in ${delay/1000}s...`, false);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            this.updateStatus('Connection failed. Please refresh.', false);
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    handleMessage(data) {
        switch (data.type) {
            case 'player_joined':
                this.handlePlayerJoined(data);
                break;
            case 'game_started':
                this.handleGameStarted(data);
                break;
            case 'number_called':
                this.handleNumberCalled(data);
                break;
            case 'player_marked':
                this.handlePlayerMarked(data);
                break;
            case 'player_won':
                this.handlePlayerWon(data);
                break;
            case 'room_update':
                this.handleRoomUpdate(data);
                break;
            case 'error':
                this.showNotification(data.message);
                break;
            case 'authenticated':
                this.handleAuthenticated(data);
                break;
        }
    }

    handleAuthenticated(data) {
        this.playerId = data.playerId;
        this.playerName = data.playerName;
        this.gameRoom = data.room;
        this.gameState.isHost = data.isHost;
        
        document.getElementById('playerName').value = this.playerName;
        document.getElementById('gameCode').value = this.gameRoom;
        
        showPage(1);
        this.updateRoomInfo();
    }

    handlePlayerJoined(data) {
        this.updateOnlineCount(data.players);
        this.showNotification(`${data.playerName} ገብቷል`);
    }

    handleGameStarted(data) {
        this.gameState.gameType = data.gameType;
        this.gameState.calledNumbers = data.calledNumbers || [];
        this.generateGameBoard();
        this.updateCalledNumbersDisplay();
        showPage(3);
    }

    handleNumberCalled(data) {
        this.gameState.calledNumbers.push(data.number);
        this.updateCalledNumbersDisplay();
        
        // Check if we have this number
        const cell = document.querySelector(`[data-number="${data.number}"]`);
        if (cell && !cell.classList.contains('marked')) {
            cell.classList.add('highlight');
            setTimeout(() => cell.classList.remove('highlight'), 1000);
        }
    }

    handlePlayerMarked(data) {
        if (data.playerId === this.playerId) return;
        
        const cell = document.querySelector(`[data-number="${data.number}"]`);
        if (cell) {
            cell.classList.add('marked');
        }
    }

    handlePlayerWon(data) {
        document.getElementById('winnerName').textContent = data.playerName;
        document.getElementById('winPattern').textContent = data.pattern;
        document.getElementById('displayWinAmount').textContent = `${data.amount} ብር`;
        document.getElementById('winnerNotification').style.display = 'block';
        
        if (data.playerId === this.playerId) {
            this.gameState.balance += data.amount;
            this.updateFinance();
        }
        
        // Play win sound
        new Audio('https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3').play();
    }

    handleRoomUpdate(data) {
        this.updateOnlineCount(data.players);
        this.updateMembersList(data.players);
    }

    updateStatus(message, isConnected = false) {
        const statusEl = document.getElementById('statusText');
        const container = document.getElementById('connectionStatus');
        
        statusEl.textContent = message;
        container.className = `connection-status ${isConnected ? 'connected' : 'disconnected'}`;
    }

    updateOnlineCount(players) {
        document.getElementById('onlineCount').textContent = `${players.length} ተጫዋቾች`;
    }

    updateRoomInfo() {
        document.getElementById('roomInfo').textContent = `ክፍል: ${this.gameRoom}`;
    }

    updateMembersList(players) {
        const list = document.getElementById('membersList');
        list.innerHTML = '';
        
        players.forEach(player => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="member-name">${player.name}</td>
                <td>${player.stake || 25} ብር</td>
                <td>${player.isHost ? 'አስተናጋጅ' : 'ተጫዋች'}</td>
            `;
            list.appendChild(row);
        });
    }

    updateCalledNumbersDisplay() {
        const bar = document.getElementById('calledNumbersBar');
        bar.innerHTML = '';
        
        this.gameState.calledNumbers.slice(-8).forEach(num => {
            const span = document.createElement('span');
            span.className = 'called-number amharic-text';
            span.textContent = num;
            bar.appendChild(span);
        });
    }

    updateFinance() {
        document.getElementById('totalPayment').value = `${this.gameState.stake} ብር`;
        document.getElementById('totalWon').value = `${this.gameState.balance} ብር`;
        document.getElementById('currentBalance').value = `${this.gameState.balance} ብር`;
    }

    // UI Functions
    login() {
        const name = document.getElementById('loginName').value.trim();
        const password = document.getElementById('loginPassword').value.trim();
        const room = document.getElementById('gameRoom').value;
        
        if (!name || !password) {
            this.showNotification('እባክዎ ስም እና የይለፍ ቃል ያስገቡ');
            return;
        }
        
        if (password !== 'asse2123') {
            this.showNotification('የተሳሳት የይለፍ ቃል');
            return;
        }
        
        this.send({
            type: 'login',
            name: name,
            password: password,
            room: room
        });
    }

    confirmRegistration() {
        const stake = parseInt(document.getElementById('playerStake').value);
        const boardId = parseInt(document.getElementById('boardSelect').value);
        const gameType = this.gameState.gameType;
        
        this.gameState.stake = stake;
        this.gameState.boardId = boardId;
        
        this.send({
            type: 'join_game',
            gameType: gameType,
            stake: stake,
            boardId: boardId
        });
    }

    toggleMark(cell, number) {
        if (this.gameState.markedNumbers.has(number)) {
            cell.classList.remove('marked');
            this.gameState.markedNumbers.delete(number);
        } else {
            cell.classList.add('marked');
            this.gameState.markedNumbers.add(number);
            
            this.send({
                type: 'mark_number',
                number: number
            });
            
            this.checkForWin();
        }
    }

    checkForWin() {
        // Check patterns based on game type
        // This is simplified - implement full pattern checking
        const winPatterns = this.getWinPatterns();
        
        for (const pattern of winPatterns) {
            if (this.checkPattern(pattern)) {
                this.send({
                    type: 'declare_win',
                    pattern: pattern
                });
                break;
            }
        }
    }

    getWinPatterns() {
        const patterns = {
            '75ball': ['row', 'column', 'diagonal', 'four-corners', 'full-house'],
            '90ball': ['one-line', 'two-lines', 'full-house'],
            '30ball': ['full-house'],
            '50ball': ['row', 'column', 'diagonal', 'four-corners'],
            'pattern': ['x-pattern', 'frame', 'postage-stamp'],
            'coverall': ['full-board']
        };
        return patterns[this.gameState.gameType] || [];
    }

    checkPattern(pattern) {
        // Implement pattern checking logic
        // This is a placeholder
        return this.gameState.markedNumbers.size >= 5;
    }

    leaveGame() {
        this.send({ type: 'leave_game' });
        showPage(0);
        this.gameState.markedNumbers.clear();
    }

    showNotification(message) {
        document.getElementById('notificationText').textContent = message;
        document.getElementById('notification').style.display = 'block';
    }

    setupEventListeners() {
        document.getElementById('nextBtn').onclick = () => {
            if (this.gameState.gameType) showPage(2);
            else this.showNotification('እባክዎ የቦርድ ዓይነት ይምረጡ');
        };
        
        document.getElementById('confirmBtn').onclick = () => this.confirmRegistration();
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.leaveGame();
            }
        });
    }

    setupBoardSelection() {
        const boardTypes = [
            { id: '75ball', name: '75-ቢንጎ', icon: '🎯', desc: '5×5 ከBINGO' },
            { id: '90ball', name: '90-ቢንጎ', icon: '🇬🇧', desc: '9×3 ፈጣን' },
            { id: '30ball', name: '30-ቢንጎ', icon: '⚡', desc: '3×3 ፍጥነት' },
            { id: '50ball', name: '50-ቢንጎ', icon: '🎲', desc: '5×5 ከBINGO' },
            { id: 'pattern', name: 'ንድፍ ቢንጎ', icon: '✨', desc: 'ተጠቀም ንድፍ' },
            { id: 'coverall', name: 'ሙሉ ቤት', icon: '🏆', desc: 'ሁሉንም ምልክት ያድርጉ' }
        ];
        
        const grid = document.getElementById('boardTypeGrid');
        boardTypes.forEach(type => {
            const card = document.createElement('div');
            card.className = 'board-type-card';
            card.innerHTML = `
                <div class="board-type-icon">${type.icon}</div>
                <div class="board-type-title amharic-text">${type.name}</div>
                <div class="board-type-desc amharic-text">${type.desc}</div>
            `;
            card.onclick = () => {
                document.querySelectorAll('.board-type-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.gameState.gameType = type.id;
            };
            grid.appendChild(card);
        });
    }

    generateGameBoard() {
        // Use the existing board generation logic
        // This would be adapted from your original code
        const board = document.getElementById('gameBoard');
        const header = document.getElementById('gameHeader');
        
        // Simplified board generation
        board.innerHTML = `<div class="board-placeholder amharic-text">የጨዋታ ቦርድ በቅርቡ ይጫናል...</div>`;
        header.textContent = `${this.gameState.gameType} - ቦርድ ${this.gameState.boardId}`;
        
        // In reality, generate the full board based on game type
        setTimeout(() => {
            this.generateBoardByType();
        }, 500);
    }

    generateBoardByType() {
        // Implement board generation based on game type
        // This would be your existing board generation code
    }
}

// Global functions for UI
function showPage(pageNum) {
    document.querySelectorAll('.page-container').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(`page${pageNum}`).classList.add('active');
}

function hideNotification() {
    document.getElementById('notification').style.display = 'none';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function continueGame() {
    document.getElementById('winnerNotification').style.display = 'none';
}

function showMembers() {
    // Request members list from server
    bingoClient.send({ type: 'get_members' });
    document.getElementById('membersModal').style.display = 'block';
}

function showPotentialWin() {
    // Calculate based on stake
    const stake = bingoClient.gameState.stake;
    const potential = Math.floor(0.8 * 90 * stake * 0.97);
    alert(`ሊሸነፍ የሚችል: ${potential} ብር`);
}

// Initialize client when page loads
let bingoClient;
window.addEventListener('DOMContentLoaded', () => {
    bingoClient = new BingoClient();
});