// ==========================================
// 1. FIREBASE SETUP & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCovQYPsAMDTzdRTB657_yYzxmMK0vCPUE",
    authDomain: "pachisa-e0975.firebaseapp.com",
    databaseURL: "https://pachisa-e0975-default-rtdb.firebaseio.com",
    projectId: "pachisa-e0975",
    storageBucket: "pachisa-e0975.firebasestorage.app",
    messagingSenderId: "823456248161",
    appId: "1:823456248161:web:5858525e440f78d645d520"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

// Authenticate silently on load
auth.signInAnonymously().then(() => {
    console.log("Firebase Auth Success! Ready to Create/Join.");
}).catch((error) => console.error(error));


// ==========================================
// 2. GLOBAL VARIABLES & CONSTANTS
// ==========================================
let roomId = "";
let playerName = "";
let isRoomCreator = false; // Host identify karne ke liye
let globalPlayerNames = [];

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 11=J, 12=Q, 13=K, 14=A
const suitSymbols = { 'Spades': '♠', 'Hearts': '♥', 'Diamonds': '♦', 'Clubs': '♣' };
const rankNames = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

// UI Elements
const lobbyArea = document.getElementById('lobby-area');
const gameBoard = document.getElementById('game-board');
const playerHandDiv = document.getElementById('player-hand');
const slots = document.querySelectorAll('.slot');
const lockBtn = document.getElementById('lock-btn');
let draggedCard = null;


// ==========================================
// 3. LOBBY & ROOM MANAGEMENT
// ==========================================

// Create Room
document.getElementById('create-room-btn').addEventListener('click', () => {
    playerName = document.getElementById('playerName').value.trim() || prompt("Bhai, apna naam likho room banane ke liye:");
    if (!playerName) return;

    isRoomCreator = true; 
    roomId = Math.floor(1000 + Math.random() * 9000).toString(); 

    db.ref(`rooms/${roomId}`).set({
        status: "WAITING",
        created_at: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        enterRoom(roomId, playerName);
        alert(`Room Ban Gaya! Room ID hai: ${roomId}. Doston ko batao.`);
    });
});

// Join Room
document.getElementById('join-room-btn').addEventListener('click', () => {
    playerName = document.getElementById('playerName').value.trim();
    let enteredRoomId = document.getElementById('roomIdInput').value.trim();

    if (!playerName || !enteredRoomId) return alert("Naam aur Room ID dono zaroori hain!");

    db.ref(`rooms/${enteredRoomId}`).once('value', (snapshot) => {
        if (snapshot.exists()) {
            let roomData = snapshot.val();
            let playersCount = roomData.players ? Object.keys(roomData.players).length : 0;
            
            if (playersCount < 3) {
                enterRoom(enteredRoomId, playerName);
            } else {
                alert("Ye room full ho chuka hai (3 players max).");
            }
        } else {
            alert("Room ID galat hai! Aisa koi room nahi bana.");
        }
    });
});

function enterRoom(rId, pName) {
    roomId = rId; 
    db.ref(`rooms/${roomId}/players/${pName}`).set({ name: pName, status: "JOINED" });

    lobbyArea.style.display = "none";
    gameBoard.style.display = "block";
    document.getElementById('display-room-id').innerText = roomId;

    listenToRoomUpdates();
}

function listenToRoomUpdates() {
    // 1. Watch for players joining
    db.ref(`rooms/${roomId}/players`).on('value', (snapshot) => {
        const playersData = snapshot.val();
        if (playersData) {
            globalPlayerNames = Object.keys(playersData);
            
            // Check if room is full
            if (globalPlayerNames.length === 3 && document.getElementById('opp1-avatar').innerText === "⏳ Wait...") {
                console.log("Room full! Starting game...");
                
                // Set Avatars
                let opponents = globalPlayerNames.filter(n => n !== playerName);
                document.getElementById('opp1-avatar').innerText = opponents[0];
                document.getElementById('opp2-avatar').innerText = opponents[1];

                // Host deals cards securely
                if (isRoomCreator) {
                    let deck = shuffleDeck(generateDeck());
                    db.ref(`rooms/${roomId}/current_round`).set({
                        p1_cards: deck.splice(0, 17),
                        p2_cards: deck.splice(0, 17),
                        p3_cards: deck.splice(0, 17),
                        center_card: deck[0]
                    });
                }
            }

            // === YEH NAYA SIMPLE CHECK HAI (Strict check hata diya gaya) ===
            let allLocked = globalPlayerNames.length === 3;
            if (allLocked) {
                for (const p of globalPlayerNames) {
                    // Sirf check karo ki player hai aur uska status LOCKED hai
                    if (!playersData[p] || playersData[p].status !== "LOCKED") {
                        allLocked = false;
                        break;
                    }
                }
            }

            // Jab teeno lock kar dein, toh naya MANUAL battle function trigger karo
            if (allLocked && !isBattleRunning) {
                console.log("Sabne lock kar diya! Battle shuru...");
                startManualBattle(playersData); 
            }
        }
    });

    // 2. Watch for cards being dealt
    db.ref(`rooms/${roomId}/current_round`).on('value', (snap) => {
        if(snap.exists()){
            let roundData = snap.val();
            let deckVis = document.getElementById('deck-visual');
            if(deckVis) deckVis.innerText = "Dealing...";
            
            setTimeout(() => {
                let myIndex = globalPlayerNames.indexOf(playerName);
                let myCards = myIndex === 0 ? roundData.p1_cards : (myIndex === 1 ? roundData.p2_cards : roundData.p3_cards);
                
                renderPlayerHand(myCards);
                if(deckVis) deckVis.innerText = "Empty";
                
                let unusablePile = document.getElementById('unusable-pile');
                if(unusablePile) unusablePile.innerText = "1 Card";
            }, 1000); 
        }
    });
}


// ==========================================
// 4. DECK & GAME LOGIC
// ==========================================
function generateDeck() {
    let deck = [];
    for (let suit of SUITS) {
        for (let rank of RANKS) {
            deck.push({ suit: suit, rank: rank });
        }
    }
    return deck;
}

function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; 
    }
    return deck;
}

function getHandScore(cards) {
    cards.sort((a, b) => b.rank - a.rank);
    let c1 = cards[0], c2 = cards[1], c3 = cards[2];

    let isColor = (c1.suit === c2.suit && c2.suit === c3.suit);
    let isSequence = (c1.rank === c2.rank + 1 && c2.rank === c3.rank + 1) || (c1.rank === 14 && c2.rank === 3 && c3.rank === 2); 
    let isTrail = (c1.rank === c2.rank && c2.rank === c3.rank);
    let isPair = (c1.rank === c2.rank || c2.rank === c3.rank);

    let category = 1; 
    if (isTrail) category = 6;
    else if (isSequence && isColor) category = 5; 
    else if (isSequence) category = 4;            
    else if (isColor) category = 3;               
    else if (isPair) category = 2;                

    let val1 = c1.rank, val2 = c2.rank, val3 = c3.rank;
    if (isPair && c2.rank === c3.rank) { val1 = c2.rank; val2 = c3.rank; val3 = c1.rank; } 
    else if (isSequence && c1.rank === 14 && c2.rank === 3) { val1 = 3; val2 = 2; val3 = 14; }

    return (category * 1000000) + (val1 * 10000) + (val2 * 100) + val3;
}


// ==========================================
// 5. UI, DRAG & DROP, AND LOCKING
// ==========================================
function renderPlayerHand(cardsArray) {
    playerHandDiv.innerHTML = ''; 
    cardsArray.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.classList.add('card');
        cardEl.classList.add((card.suit === 'Hearts' || card.suit === 'Diamonds') ? 'red' : 'black');

        let displayRank = rankNames[card.rank] || card.rank;
        cardEl.innerText = `${displayRank}${suitSymbols[card.suit]}`;
        
        cardEl.dataset.suit = card.suit;
        cardEl.dataset.rank = card.rank;
        cardEl.dataset.id = `card-${index}`;

        cardEl.setAttribute('draggable', 'true');
        cardEl.addEventListener('dragstart', function() { draggedCard = this; setTimeout(() => this.style.opacity = '0.5', 0); });
        cardEl.addEventListener('dragend', function() { setTimeout(() => this.style.opacity = '1', 0); draggedCard = null; validateSlots(); });

        playerHandDiv.appendChild(cardEl);
    });
    setupDragAndDrop();
}

function setupDragAndDrop() {
    const dropZones = [...slots, playerHandDiv];
    dropZones.forEach(zone => {
        zone.addEventListener('dragover', e => e.preventDefault());
        zone.addEventListener('dragenter', e => e.preventDefault());
        zone.addEventListener('drop', function(e) {
            e.preventDefault(); e.stopPropagation(); 
            if (draggedCard) {
                if (this.classList.contains('slot')) {
                    if (this.children.length < 3) this.appendChild(draggedCard);
                } else {
                    this.appendChild(draggedCard);
                }
                draggedCard = null;
                validateSlots(); 
            }
        });
    });
}

function validateSlots() {
    let totalCardsInSlots = 0;
    slots.forEach(slot => totalCardsInSlots += slot.children.length);
    lockBtn.disabled = (totalCardsInSlots !== 15);
}

// Player locks cards
lockBtn.addEventListener('click', () => {
    let allSlotsData = [];

    slots.forEach((slot, index) => {
        let cardsInSlot = [];
        slot.querySelectorAll('.card').forEach(cardEl => {
            cardsInSlot.push({
                domElement: cardEl,
                suit: cardEl.dataset.suit,
                rank: parseInt(cardEl.dataset.rank) 
            });
        });
        allSlotsData.push({ slotIndex: index, cards: cardsInSlot, score: getHandScore(cardsInSlot) });
    });

    // Sort Strongest to Weakest
    allSlotsData.sort((a, b) => b.score - a.score);

    slots.forEach((slot, i) => {
        slot.innerHTML = `Slot ${i + 1}`; 
        allSlotsData[i].cards.forEach(cardData => slot.appendChild(cardData.domElement));
    });

    // Discard remaining 2 cards to center table
    let unusedCards = playerHandDiv.querySelectorAll('.card');
    unusedCards.forEach(card => {
        card.classList.add('discard-anim'); 
        setTimeout(() => {
            card.remove(); 
            let up = document.getElementById('unusable-pile');
            if(up) up.innerText = "3 Cards"; 
        }, 500);
    });

    lockBtn.disabled = true;
    lockBtn.innerText = "Waiting for others...";
    document.querySelectorAll('.card').forEach(card => {
        card.setAttribute('draggable', 'false');
        card.style.cursor = 'default';
    });

    // Submit to Firebase
    const formattedSlots = allSlotsData.map(slot => ({
        score: slot.score,
        cards: slot.cards.map(c => ({suit: c.suit, rank: c.rank}))
    }));

    db.ref(`rooms/${roomId}/players/${playerName}`).update({
        lockedSlots: formattedSlots,
        status: "LOCKED"
    });
});

// ==========================================
// 6. EPIC BATTLE ANIMATION & SCORING (MANUAL)
// ==========================================
let isBattleRunning = false;
let currentBattleSlot = 0;
let battlePlayersData = null;
let roundPoints = {};
let lastRoundHistoryHTML = '';

function startManualBattle(playersData) {
    if(isBattleRunning) return; 
    isBattleRunning = true;
    battlePlayersData = playersData;
    currentBattleSlot = 0;
    lastRoundHistoryHTML = '';

    globalPlayerNames.forEach(n => roundPoints[n] = 0);

    let battleArena = document.getElementById('battle-arena');
    if(battleArena) {
        battleArena.style.setProperty('display', 'flex', 'important');
        battleArena.style.flexDirection = 'column'; // Vertical align ensure karna
    }
    
    // UI SCROLLING DISABLE KARNA BATTLE KE TIME
    document.body.style.overflow = 'hidden';

    renderBattleSlot();
}

function renderBattleSlot() {
    let battleTitle = document.getElementById('battle-title');
    let battleCards = document.getElementById('battle-cards');
    let battleWinner = document.getElementById('battle-winner');
    let stepNumber = document.getElementById('battle-step-number');
    let nextBtn = document.getElementById('battle-next-btn');

    if(stepNumber) stepNumber.innerText = currentBattleSlot + 1;
    if(battleTitle) battleTitle.innerText = `Fighting: SLOT ${currentBattleSlot + 1}`;
    
    let slotWinner = null;
    let highestScore = -1;
    let slotCardsHTML = ''; 
    let arenaHTML = '';

    globalPlayerNames.forEach(name => {
        let slotData = battlePlayersData[name].lockedSlots[currentBattleSlot];
        
        let c1 = slotData.cards[0], c2 = slotData.cards[1], c3 = slotData.cards[2];
        let r1 = rankNames[c1.rank] || c1.rank, r2 = rankNames[c2.rank] || c2.rank, r3 = rankNames[c3.rank] || c3.rank;
        let s1 = suitSymbols[c1.suit], s2 = suitSymbols[c2.suit], s3 = suitSymbols[c3.suit];
        let cardString = `${r1}${s1} | ${r2}${s2} | ${r3}${s3}`;

        // Naye Premium UI Grid ke liye cards generate karna
        arenaHTML += `
            <div class="battle-player-card">
                <div class="battle-player-name">${name}</div>
                <div class="battle-playing-cards">
                    <div class="battle-single-card ${(c1.suit==='Hearts'||c1.suit==='Diamonds')?'battle-red':'battle-black'}">
                        ${r1}<span>${s1}</span>
                    </div>
                    <div class="battle-single-card ${(c2.suit==='Hearts'||c2.suit==='Diamonds')?'battle-red':'battle-black'}">
                        ${r2}<span>${s2}</span>
                    </div>
                    <div class="battle-single-card ${(c3.suit==='Hearts'||c3.suit==='Diamonds')?'battle-red':'battle-black'}">
                        ${r3}<span>${s3}</span>
                    </div>
                </div>
            </div>
        `;

        slotCardsHTML += `<div class="history-player"><strong>${name}</strong><br>${cardString}</div>`;

        if(slotData.score > highestScore) {
            highestScore = slotData.score;
            slotWinner = name;
        }
    });

    if(battleCards) battleCards.innerHTML = arenaHTML;

    // History Record karna
    lastRoundHistoryHTML += `
        <div class="history-battle-round">
            <div class="history-round-header">
                <strong>Slot ${currentBattleSlot + 1}</strong>
                <span>🎉 Winner: ${slotWinner}</span>
            </div>
            <div class="history-row">${slotCardsHTML}</div>
        </div>
    `;

    if(battleWinner) {
        battleWinner.innerHTML = `<div class="battle-result"><strong>Slot ${currentBattleSlot + 1} Winner:</strong> <span>🎉 ${slotWinner}</span></div>`;
    }
    
    roundPoints[slotWinner] += 1;

    // Button Text Update karna
    if (currentBattleSlot < 4) {
        nextBtn.innerText = `Next → Slot ${currentBattleSlot + 2}`;
    } else {
        nextBtn.innerText = "Finish Round & Show Scores";
    }
}

// ------------------------------------
// BATTLE NEXT BUTTON CLICK LISTENER
// ------------------------------------
document.getElementById('battle-next-btn').addEventListener('click', () => {
    currentBattleSlot++;
    
    if (currentBattleSlot > 4) {
        // BATTLE KHATAM
        let battleArena = document.getElementById('battle-arena');
        if(battleArena) battleArena.style.setProperty('display', 'none', 'important');
        
        // SCROLL WAPAS ON KARNA
        document.body.style.overflow = 'auto'; 
        
        document.getElementById('history-content').innerHTML = lastRoundHistoryHTML;
        updateGlobalScores(roundPoints);
    } else {
        renderBattleSlot();
    }
});

function updateGlobalScores(roundPoints) {
    if (isRoomCreator) {
        db.ref(`rooms/${roomId}/global_scores`).once('value', snap => {
            let currentScores = snap.val() || {};
            globalPlayerNames.forEach(name => {
                currentScores[name] = (currentScores[name] || 0) + roundPoints[name];
            });
            db.ref(`rooms/${roomId}/global_scores`).set(currentScores);
        });
    }
    setTimeout(() => resetRound(), 2000);
}

db.ref(`rooms/${roomId}/global_scores`).on('value', snap => {
    if(snap.exists()) {
        let scores = snap.val();
        let tableHTML = ``;
        let winner = null;

        for (let p in scores) {
            tableHTML += `<tr><td>${p}</td><td class="score-points">${scores[p]}</td></tr>`;
            if (scores[p] >= 25) winner = p;
        }
        
        let scoreTable = document.querySelector('#score-table tbody');
        if(scoreTable) scoreTable.innerHTML = tableHTML;

        if (winner) {
            alert(`🎉 GAME OVER! ${winner} WINS WITH 25 POINTS! 🎉`);
        }
    }
});

function resetRound() {
    isBattleRunning = false;
    playerHandDiv.innerHTML = '';
    slots.forEach((slot, i) => {
        slot.innerHTML = `Slot ${i + 1}`;
    });
    
    lockBtn.disabled = true;
    lockBtn.innerText = "Lock Cards";
    document.getElementById('slots-area').style.pointerEvents = 'auto'; // Slots wapas active
    
    db.ref(`rooms/${roomId}/players/${playerName}`).update({ status: "JOINED" });
    
    if(isRoomCreator) {
        setTimeout(() => {
            let deck = shuffleDeck(generateDeck());
            db.ref(`rooms/${roomId}/current_round`).set({
                p1_cards: deck.splice(0, 17),
                p2_cards: deck.splice(0, 17),
                p3_cards: deck.splice(0, 17),
                center_card: deck[0]
            });
        }, 1000);
    }
}

// ------------------------------------
// UI BUTTON FIXES
// ------------------------------------
document.getElementById('show-score-btn').onclick = () => document.getElementById('scoreboard-modal').style.display = 'block';
document.querySelector('#scoreboard-modal .modal-close').onclick = () => document.getElementById('scoreboard-modal').style.display = 'none';

document.getElementById('show-history-btn').onclick = () => document.getElementById('history-modal').style.display = 'block';
document.getElementById('close-history').onclick = () => document.getElementById('history-modal').style.display = 'none';

// Cards Lock hone par drag aur scroll band karna
lockBtn.addEventListener('click', () => {
    document.getElementById('slots-area').style.pointerEvents = 'none'; // Lock ke baad UI block
});
