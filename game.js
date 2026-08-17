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

const initialBattleArena = document.getElementById('battle-arena');
if (initialBattleArena) initialBattleArena.style.display = 'none';

// Inject only after DOM exists; function declaration is hoisted.
injectGameFixStyles();


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
    listenToGlobalScores();
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

            // Check if all players locked their cards to start battle
            let allLocked = true;
            for(let p in playersData) {
                if(playersData[p].status !== "LOCKED") allLocked = false;
            }
            // Firebase kabhi-kabhi arrays ko object ke form me return karta hai.
            // Isliye pehle normalize karke hi battle start karo.
            const readyForBattle =
                allLocked &&
                globalPlayerNames.length === 3 &&
                globalPlayerNames.every(name => getValidLockedSlots(playersData[name]).length === 5);

            if (readyForBattle) {
                startBattleAnimation(playersData);
            }
        }
    });

    // 2. Watch for cards being dealt
    let lastDealSignature = '';

    db.ref(`rooms/${roomId}/current_round`).on('value', (snap) => {
        if (!snap.exists()) return;

        const roundData = snap.val();
        const myIndex = globalPlayerNames.indexOf(playerName);
        if (myIndex < 0) return;

        const myCards = myIndex === 0
            ? roundData.p1_cards
            : (myIndex === 1 ? roundData.p2_cards : roundData.p3_cards);

        const signature = JSON.stringify(roundData);
        if (signature === lastDealSignature) return;
        lastDealSignature = signature;

        animateDeal(roundData, myCards);
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
// 6. DEAL ANIMATION + EPIC BATTLE
// ==========================================
let isBattleRunning = false;

function injectGameFixStyles() {
    if (document.getElementById('pachisa-game-fix-style')) return;
    const style = document.createElement('style');
    style.id = 'pachisa-game-fix-style';
    style.textContent = `
        #player-hand {
            position: fixed !important;
            left: 50% !important;
            bottom: 8px !important;
            transform: translateX(-50%) !important;
            z-index: 900 !important;
            width: min(96vw, 760px) !important;
            min-height: 62px !important;
            padding: 6px 8px !important;
            display: flex !important;
            flex-wrap: nowrap !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 0 !important;
            overflow: visible !important;
            background: rgba(8,28,22,.92) !important;
            border: 1px solid rgba(255,215,130,.25) !important;
            border-radius: 14px !important;
            box-shadow: 0 -8px 30px rgba(0,0,0,.38) !important;
        }
        #player-hand .card {
            width: 42px !important;
            height: 60px !important;
            min-width: 42px !important;
            min-height: 60px !important;
            margin-left: -11px !important;
            flex: 0 0 42px !important;
            position: relative !important;
            z-index: 1;
            font-size: 1rem !important;
        }
        #player-hand .card:first-child { margin-left: 0 !important; }
        #player-hand .card:hover, #player-hand .card:active { z-index: 20 !important; }
        #battle-arena {
            position: fixed !important;
            top: 3vh !important;
            left: 50% !important;
            transform: translateX(-50%) !important;
            width: min(94vw, 900px) !important;
            height: 90vh !important;
            max-height: 90vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            box-sizing: border-box !important;
            z-index: 5000 !important;
            -webkit-overflow-scrolling: touch !important;
        }
        #battle-next-btn {
            display: block !important;
            position: sticky !important;
            bottom: 4px !important;
            z-index: 50 !important;
            width: min(100%, 420px) !important;
            margin: 18px auto 4px !important;
            padding: 14px 20px !important;
            border: 0 !important;
            border-radius: 14px !important;
            background: linear-gradient(135deg,#f1c40f,#e67e22) !important;
            color: #171717 !important;
            font-size: 1rem !important;
            font-weight: 900 !important;
            cursor: pointer !important;
            box-shadow: 0 8px 25px rgba(0,0,0,.45) !important;
        }
        .pachisa-flying-card {
            position: fixed !important;
            width: 28px !important;
            height: 42px !important;
            border-radius: 5px !important;
            background: linear-gradient(135deg,#244f42,#0a241c) !important;
            border: 2px solid rgba(255,215,130,.9) !important;
            box-shadow: 0 5px 15px rgba(0,0,0,.5) !important;
            z-index: 100000 !important;
            pointer-events: none !important;
            animation: pachisaFly .55s cubic-bezier(.2,.8,.3,1) forwards !important;
        }
        .pachisa-flying-card::after {
            content: '♠♥♦♣'; position: absolute; inset: 0;
            display: flex; align-items: center; justify-content: center;
            color: #f1c40f; font-size: 10px;
        }
        @keyframes pachisaFly {
            0% { opacity:1; transform:translate(0,0) scale(.7) rotate(-12deg); }
            100% { opacity:0; transform:translate(var(--dx),var(--dy)) scale(.85) rotate(12deg); }
        }
        .card.dealing { animation: pachisaHandDeal .4s cubic-bezier(.2,.8,.3,1) both !important; }
        @keyframes pachisaHandDeal {
            0% { opacity:0; transform:translateY(-35px) scale(.65); }
            70% { opacity:1; transform:translateY(4px) scale(1.03); }
            100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @media (max-width:700px) {
            #player-hand { width:98vw !important; bottom:5px !important; padding:5px 6px !important; }
            #player-hand .card { width:29px !important; height:43px !important; min-width:29px !important; min-height:43px !important; flex-basis:29px !important; margin-left:-9px !important; font-size:.78rem !important; }
            #player-hand .card:first-child { margin-left:0 !important; }
            #battle-arena { top:2vh !important; width:94vw !important; height:94vh !important; max-height:94vh !important; padding:15px !important; }
        }
    `;
    document.head.appendChild(style);
}

function ensureBattleButton(battleArena) {
    let btn = document.getElementById('battle-next-btn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'battle-next-btn';
        btn.className = 'battle-next-btn';
        btn.type = 'button';
        battleArena.appendChild(btn);
    }
    return btn;
}

function animateDeal(roundData, myCards) {
    injectGameFixStyles();
    const table = document.getElementById('virtual-table');
    const deck = document.getElementById('deck-visual');
    const opp1 = document.getElementById('opp1-avatar');
    const opp2 = document.getElementById('opp2-avatar');
    const targets = [opp1, playerHandDiv, opp2].filter(Boolean);
    if (!table || !deck || !targets.length) { renderPlayerHand(myCards); return; }

    table.querySelectorAll('.pachisa-flying-card').forEach(el => el.remove());
    const deckRect = deck.getBoundingClientRect();
    deck.innerText = 'Dealing...';

    for (let i = 0; i < 51; i++) {
        setTimeout(() => {
            const target = targets[i % targets.length];
            const targetRect = target.getBoundingClientRect();
            const fly = document.createElement('div');
            fly.className = 'pachisa-flying-card';
            fly.style.left = `${deckRect.left + deckRect.width / 2 - 14}px`;
            fly.style.top = `${deckRect.top + deckRect.height / 2 - 21}px`;
            fly.style.setProperty('--dx', `${targetRect.left + targetRect.width/2 - (deckRect.left + deckRect.width/2)}px`);
            fly.style.setProperty('--dy', `${targetRect.top + targetRect.height/2 - (deckRect.top + deckRect.height/2)}px`);
            document.body.appendChild(fly);
            setTimeout(() => fly.remove(), 600);
        }, i * 55);
    }

    setTimeout(() => {
        renderPlayerHand(myCards);
        deck.innerText = 'Empty';
        const unusable = document.getElementById('unusable-pile');
        if (unusable) unusable.innerText = '1 Card';
    }, 51 * 55 + 250);
}

function getValidLockedSlots(playerData) {
    if (!playerData || !playerData.lockedSlots) return [];
    const raw = playerData.lockedSlots;
    const slotsData = Array.isArray(raw) ? raw : Object.keys(raw).sort((a,b) => Number(a)-Number(b)).map(k => raw[k]);
    return slotsData.map(slot => {
        if (!slot) return null;
        const rawCards = slot.cards;
        const cards = Array.isArray(rawCards)
            ? rawCards
            : (rawCards ? Object.keys(rawCards).sort((a,b)=>Number(a)-Number(b)).map(k=>rawCards[k]) : []);
        return { score: Number(slot.score || 0), cards: cards.filter(Boolean).slice(0,3) };
    }).filter(slot => slot && slot.cards.length === 3).slice(0,5);
}

function startBattleAnimation(playersData) {
    if (isBattleRunning) return;
    const normalized = {};
    const valid = globalPlayerNames.length === 3 && globalPlayerNames.every(name => {
        normalized[name] = getValidLockedSlots(playersData[name]);
        return normalized[name].length === 5;
    });
    if (!valid) {
        console.log('Battle waiting: valid 5 x 3-card locked data not available yet.');
        return;
    }

    injectGameFixStyles();
    isBattleRunning = true;
    const battleArena = document.getElementById('battle-arena');
    const battleTitle = document.getElementById('battle-title');
    const battleCards = document.getElementById('battle-cards');
    const battleWinner = document.getElementById('battle-winner');
    if (!battleArena || !battleCards || !battleTitle || !battleWinner) return;
    const nextBtn = ensureBattleButton(battleArena);
    battleArena.style.display = 'block';

    let currentSlot = 0;
    const roundPoints = {};
    globalPlayerNames.forEach(n => roundPoints[n] = 0);
    let historyHTML = '';

    function showSlot() {
        if (currentSlot >= 5) {
            battleArena.style.display = 'none';
            nextBtn.style.display = 'none';
            document.getElementById('history-content').innerHTML = historyHTML;
            updateGlobalScores(roundPoints);
            return;
        }

        let slotWinner = null;
        let highestScore = -1;
        let slotCardsHTML = '';
        battleCards.innerHTML = '';
        battleWinner.innerText = '';
        battleTitle.innerText = `Fighting: SLOT ${currentSlot + 1}`;

        globalPlayerNames.forEach(name => {
            const slotData = normalized[name][currentSlot];
            const cards = slotData.cards;
            const cardString = cards.map(c => `${rankNames[c.rank] || c.rank}${suitSymbols[c.suit]}`).join(' | ');
            battleCards.innerHTML += `
                <div class="battle-player-card">
                    <strong>${name}</strong>
                    <div class="battle-playing-cards">
                        ${cards.map(c => `<div class="battle-single-card"><span>${rankNames[c.rank] || c.rank}</span><span>${suitSymbols[c.suit]}</span></div>`).join('')}
                    </div>
                    <div class="battle-combination">${cardString}</div>
                </div>`;
            slotCardsHTML += `<div class="history-player"><strong>${name}</strong><br>${cardString}</div>`;
            if (Number(slotData.score) > highestScore) {
                highestScore = Number(slotData.score);
                slotWinner = name;
            }
        });

        roundPoints[slotWinner] += 1;
        battleWinner.innerText = `🎉 ${slotWinner} wins Slot ${currentSlot + 1}! +1 Point`;
        historyHTML += `<div style="background:#1a252f;margin-bottom:15px;padding:10px;border-radius:8px;border:1px solid #7f8c8d;"><h4 style="margin:0 0 10px;color:#f1c40f;">Slot ${currentSlot + 1} - Winner: 🎉 ${slotWinner}</h4><div class="history-row">${slotCardsHTML}</div></div>`;

        nextBtn.innerText = currentSlot === 4 ? 'Finish Round ✓' : `Next → Slot ${currentSlot + 2}`;
        nextBtn.style.display = 'block';
        battleArena.scrollTop = 0;
        currentSlot++;
    }

    nextBtn.onclick = showSlot;
    showSlot();
}

function updateGlobalScores(roundPoints) {
    // Sirf Host update push karega DB me taaki 3 guna data na badhe
    if (isRoomCreator) {
        db.ref(`rooms/${roomId}/global_scores`).once('value', snap => {
            let currentScores = snap.val() || {};
            globalPlayerNames.forEach(name => {
                currentScores[name] = (currentScores[name] || 0) + roundPoints[name];
            });
            db.ref(`rooms/${roomId}/global_scores`).set(currentScores);
        });
    }

    // Har player ki screen pe next round ki taiyari
    setTimeout(() => resetRound(), 2000);
}

// Watch Global Scores to update Floating Scoreboard UI
function listenToGlobalScores() {
    if (!roomId) return;
    db.ref(`rooms/${roomId}/global_scores`).on('value', snap => {
        if (!snap.exists()) return;
        const scores = snap.val();
        let tableHTML = `<tr><th>Player</th><th>Points</th></tr>`;
        let winner = null;
        for (let p in scores) {
            tableHTML += `<tr><td>${p}</td><td>${scores[p]}</td></tr>`;
            if (Number(scores[p]) >= 25) winner = p;
        }
        const scoreTable = document.getElementById('score-table');
        if (scoreTable) scoreTable.innerHTML = tableHTML;
        if (winner) alert(`🎉 GAME OVER! ${winner} WINS WITH 25 POINTS! 🎉`);
    });
}

function resetRound() {
    isBattleRunning = false;
    const battleArena = document.getElementById('battle-arena');
    if (battleArena) battleArena.style.display = 'none';
    const nextBtn = document.getElementById('battle-next-btn');
    if (nextBtn) nextBtn.style.display = 'none';
    playerHandDiv.innerHTML = '';
    slots.forEach((slot, i) => {
        slot.innerHTML = `Slot ${i + 1}`;
    });
    
    lockBtn.disabled = true;
    lockBtn.innerText = "Lock Cards";
    
    // Status wapas joined kardo
    db.ref(`rooms/${roomId}/players/${playerName}`).update({ status: "JOINED" });
    
    // Host naya deck fainkega
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
// Score & History Modal Logic
document.getElementById('show-score-btn').onclick = () => document.getElementById('scoreboard-modal').style.display = 'block';
document.getElementById('close-score').onclick = () => document.getElementById('scoreboard-modal').style.display = 'none';

document.getElementById('show-history-btn').onclick = () => document.getElementById('history-modal').style.display = 'block';
document.getElementById('close-history').onclick = () => document.getElementById('history-modal').style.display = 'none';
