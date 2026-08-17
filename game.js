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

            // Start battle ONLY when all 3 players have valid 5 groups
            let allLocked = globalPlayerNames.length === 3;
            let validBattleData = allLocked;

            if (allLocked) {
                for (const p of globalPlayerNames) {
                    const playerData = playersData[p];

                    if (!playerData || playerData.status !== "LOCKED") {
                        allLocked = false;
                        validBattleData = false;
                        break;
                    }

                    if (!Array.isArray(playerData.lockedSlots) || playerData.lockedSlots.length !== 5) {
                        validBattleData = false;
                        break;
                    }

                    for (let i = 0; i < 5; i++) {
                        const group = playerData.lockedSlots[i];
                        if (!group || !Array.isArray(group.cards) || group.cards.length !== 3) {
                            validBattleData = false;
                            break;
                        }
                    }

                    if (!validBattleData) break;
                }
            }

            if (allLocked && validBattleData && !isBattleRunning) {
                console.log("All 3 players have valid 5 groups. Starting battle...");
                startBattleAnimation(playersData);
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
            }, 1000); // 1 second dealing animation delay
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
// 6. EPIC BATTLE ANIMATION & SCORING
// ==========================================
let isBattleRunning = false;

function startBattleAnimation(playersData) {
    if(isBattleRunning) return; 
    isBattleRunning = true;

    let battleArena = document.getElementById('battle-arena');
    let battleTitle = document.getElementById('battle-title');
    let battleCards = document.getElementById('battle-cards');
    let battleWinner = document.getElementById('battle-winner');
    
    if(battleArena) battleArena.style.display = 'block';
    
    let currentSlot = 0;
    let roundPoints = {};
    globalPlayerNames.forEach(n => roundPoints[n] = 0);

    // YEH VARIABLE HISTORY STORE KAREGA
    let lastRoundHistoryHTML = ''; 

    let battleInterval = setInterval(() => {
        if(currentSlot > 4) {
            clearInterval(battleInterval);
            if(battleArena) battleArena.style.display = 'none';
            
            // BATTLE KHATAM HONE PAR HISTORY MODAL MEIN DATA DAAL DO
            document.getElementById('history-content').innerHTML = lastRoundHistoryHTML;
            
            updateGlobalScores(roundPoints); 
            return;
        }

        let slotWinner = null;
        let highestScore = -1;
        let slotCardsHTML = ''; // History ke liye is round ke cards

        if(battleCards) battleCards.innerHTML = ''; 
        if(battleTitle) battleTitle.innerText = `Fighting: SLOT ${currentSlot + 1}`;

        globalPlayerNames.forEach(name => {
            let slotData = playersData[name].lockedSlots[currentSlot];
            
            // J, Q, K, A format karna
            let c1 = slotData.cards[0], c2 = slotData.cards[1], c3 = slotData.cards[2];
            let r1 = rankNames[c1.rank] || c1.rank, r2 = rankNames[c2.rank] || c2.rank, r3 = rankNames[c3.rank] || c3.rank;
            let s1 = suitSymbols[c1.suit], s2 = suitSymbols[c2.suit], s3 = suitSymbols[c3.suit];

            let cardString = `${r1}${s1} | ${r2}${s2} | ${r3}${s3}`;

            // Screen par fight dikhana
            if(battleCards) {
                battleCards.innerHTML += `<div style="display:inline-block; margin: 15px; padding:10px; background:#fff; color:#000; border-radius:5px;">
                    <strong>${name}</strong><br>${cardString}
                </div>`;
            }

            // History panel ke liye row banana
            slotCardsHTML += `<div class="history-player"><strong>${name}</strong><br>${cardString}</div>`;

            if(slotData.score > highestScore) {
                highestScore = slotData.score;
                slotWinner = name;
            }
        });

        // Is slot ki history record karna
        lastRoundHistoryHTML += `
            <div style="background: #1a252f; margin-bottom: 15px; padding: 10px; border-radius: 8px; border: 1px solid #7f8c8d;">
                <h4 style="margin: 0 0 10px 0; color: #f1c40f;">Slot ${currentSlot + 1} - Winner: 🎉 ${slotWinner}</h4>
                <div class="history-row">${slotCardsHTML}</div>
            </div>
        `;

        if(battleWinner) battleWinner.innerText = `🎉 ${slotWinner} wins Slot ${currentSlot + 1}!`;
        roundPoints[slotWinner] += 1;
        
        currentSlot++;
    }, 3000); 
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
db.ref(`rooms/${roomId}/global_scores`).on('value', snap => {
    if(snap.exists()) {
        let scores = snap.val();
        let tableHTML = `<tr><th>Player</th><th>Points</th></tr>`;
        let winner = null;

        for (let p in scores) {
            tableHTML += `<tr><td>${p}</td><td>${scores[p]}</td></tr>`;
            if (scores[p] >= 25) winner = p;
        }
        
        let scoreTable = document.getElementById('score-table');
        if(scoreTable) scoreTable.innerHTML = tableHTML;

        if (winner) {
            alert(`🎉 GAME OVER! ${winner} WINS WITH 25 POINTS! 🎉`);
            // Yahan se aap game ko pura reset kara sakte hain
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
