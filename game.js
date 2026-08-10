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
// Card logic constants
const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
// 11 = J, 12 = Q, 13 = K, 14 = A
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; 

function generateDeck() {
    let deck = [];
    for (let suit of SUITS) {
        for (let rank of RANKS) {
            deck.push({ suit: suit, rank: rank });
        }
    }
    return deck;
}

// Fisher-Yates Algorithm for perfect shuffle
function shuffleDeck(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; // Swap
    }
    return deck;
}

function dealCards() {
    let deck = shuffleDeck(generateDeck());
    
    // 1 card unused chhodna hai (side me rakhna hai)
    let unusedCard = deck.pop(); 

    // 17 cards per player
    let players = {
        player1: deck.splice(0, 17),
        player2: deck.splice(0, 17),
        player3: deck.splice(0, 17)
    };

    console.log("Cards Dealt Successfully!");
    console.log("Player 1 Hand:", players.player1);
    
    return players;
}

// Game initialize karte hain
let gameHands = dealCards();
// --- PREVIOUS CODE (generateDeck, dealCards) LIVES ABOVE THIS ---

// UI Constants
const playerHandDiv = document.getElementById('player-hand');
const slots = document.querySelectorAll('.slot');
const lockBtn = document.getElementById('lock-btn');

// Card Data Formatters
const suitSymbols = { 'Spades': '♠', 'Hearts': '♥', 'Diamonds': '♦', 'Clubs': '♣' };
const rankNames = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

let draggedCard = null;

// 1. Render Cards to UI
function renderPlayerHand(cardsArray) {
    playerHandDiv.innerHTML = ''; // Clear board
    
    cardsArray.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.classList.add('card');
        
        // Define color based on suit
        if(card.suit === 'Hearts' || card.suit === 'Diamonds') {
            cardEl.classList.add('red');
        } else {
            cardEl.classList.add('black');
        }

        // Get Display Name (e.g., if 11 then J, else stringify number)
        let displayRank = rankNames[card.rank] || card.rank;
        cardEl.innerText = `${displayRank}${suitSymbols[card.suit]}`;
        
        // Store data inside DOM element for later extraction
        cardEl.dataset.suit = card.suit;
        cardEl.dataset.rank = card.rank;
        cardEl.dataset.id = `card-${index}`;

        // DRAG EVENTS
        cardEl.setAttribute('draggable', 'true');
        
        cardEl.addEventListener('dragstart', function(e) {
            draggedCard = this;
            setTimeout(() => this.style.opacity = '0.5', 0); // Visual feedback
        });

        cardEl.addEventListener('dragend', function() {
            setTimeout(() => this.style.opacity = '1', 0);
            draggedCard = null;
            validateSlots(); // Check if we can enable the Lock Button
        });

        playerHandDiv.appendChild(cardEl);
    });
}

// 2. Setup Drop Zones (Slots & Hand)
function setupDragAndDrop() {
    const dropZones = [...slots, playerHandDiv];

    dropZones.forEach(zone => {
        // Mobile ko drop zone samjhane ke liye dragover aur dragenter dono chahiye
        zone.addEventListener('dragover', function(e) {
            e.preventDefault(); 
        });
        
        zone.addEventListener('dragenter', function(e) {
            e.preventDefault(); // <-- MOBILE KE LIYE ZAROORI
        });

        zone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation(); // <-- MOBILE DOUBLE DROP BUG FIX
            
            if (draggedCard) {
                if (this.classList.contains('slot')) {
                    if (this.children.length < 3) {
                        this.appendChild(draggedCard);
                    }
                } else {
                    // Wapas player hand me daalna
                    this.appendChild(draggedCard);
                }
                draggedCard = null;
                validateSlots(); // Lock button check karne ke liye
            }
        });
    });
}
// 3. Validation: Lock button tabhi chalega jab 15 cards exactly 5 slots me honge
function validateSlots() {
    let totalCardsInSlots = 0;
    
    slots.forEach(slot => {
        totalCardsInSlots += slot.children.length;
    });

    // 5 slots * 3 cards = 15
    if (totalCardsInSlots === 15) {
        lockBtn.disabled = false;
    } else {
        lockBtn.disabled = true;
    }
}

// Init Setup
renderPlayerHand(gameHands.player1);
setupDragAndDrop();
// --- YEH CODE game.js KE SABSE NEECHE PASTE KAREIN ---

// 1. Hand Score Calculator
function getHandScore(cards) {
    // Rank ke hisaab se descending sort (High to Low)
    cards.sort((a, b) => b.rank - a.rank);
    let c1 = cards[0], c2 = cards[1], c3 = cards[2];

    let isColor = (c1.suit === c2.suit && c2.suit === c3.suit);
    let isSequence = (c1.rank === c2.rank + 1 && c2.rank === c3.rank + 1) || 
                     (c1.rank === 14 && c2.rank === 3 && c3.rank === 2); // A-2-3 special sequence
    
    let isTrail = (c1.rank === c2.rank && c2.rank === c3.rank);
    let isPair = (c1.rank === c2.rank || c2.rank === c3.rank);

    let category = 1; // High card default
    
    if (isTrail) category = 6;
    else if (isSequence && isColor) category = 5; // Pure Sequence
    else if (isSequence) category = 4;            // Sequence
    else if (isColor) category = 3;               // Color
    else if (isPair) category = 2;                // Pair

    let val1 = c1.rank, val2 = c2.rank, val3 = c3.rank;
    
    // Pair me tie-breaker ke liye paired cards ko priority do
    if (isPair && c2.rank === c3.rank) {
        val1 = c2.rank; val2 = c3.rank; val3 = c1.rank; 
    } else if (isSequence && c1.rank === 14 && c2.rank === 3) {
        val1 = 3; val2 = 2; val3 = 14;
    }

    // Mathematical weight for sorting
    return (category * 1000000) + (val1 * 10000) + (val2 * 100) + val3;
}

// 2. Lock Button Event Listener
lockBtn.addEventListener('click', () => {
    let allSlotsData = [];

    // Har slot me jao aur wahan rakhe cards ka DOM element aur data extract karo
    slots.forEach((slot, index) => {
        let cardsInSlot = [];
        let cardElements = slot.querySelectorAll('.card');
        
        cardElements.forEach(cardEl => {
            cardsInSlot.push({
                domElement: cardEl, // HTML element ko sath rakhein taaki wapas append kar sakein
                suit: cardEl.dataset.suit,
                rank: parseInt(cardEl.dataset.rank) // String ko number me convert karna zaroori hai
            });
        });

        // Group ka overall score nikal lo
        let groupScore = getHandScore(cardsInSlot);
        allSlotsData.push({
            slotIndex: index,
            cards: cardsInSlot,
            score: groupScore
        });
    });

    // Score ke basis par Highest se Lowest sort karo (Strongest hand pehle aayega)
    allSlotsData.sort((a, b) => b.score - a.score);

    // Ab visually HTML slots ko clear karke sorted elements ko wapas daalo
    slots.forEach((slot, i) => {
        slot.innerHTML = `Slot ${i + 1}`; // Purana content clean karo
        
        // Sorted array me se strong cards uthao aur yahan append karo
        allSlotsData[i].cards.forEach(cardData => {
            slot.appendChild(cardData.domElement);
        });
    });

    // Button ko disable karo aur visual cue do ki cards lock ho gaye
    lockBtn.disabled = true;
    lockBtn.innerText = "Cards Locked!";
    lockBtn.style.backgroundColor = "#e67e22";

    // Cards ko un-draggable bana do taaki lock ke baad player change na kar sake
    document.querySelectorAll('.card').forEach(card => {
        card.setAttribute('draggable', 'false');
        card.style.cursor = 'default';
    });

    console.log("Groups Sorted by Strength:", allSlotsData);
    
    // YAHAN SE FIRBASE KO DATA BHEJNE KA LOGIC TRIGGER HOGA
});
// Global Variables
let roomId = "";
let playerName = "";

// Firebase Initialize (Aapka purana config yahan rahega)
// firebase.initializeApp(firebaseConfig);
// const db = firebase.database();
// const auth = firebase.auth();

// UI Elements
const lobbyArea = document.getElementById('lobby-area');
const gameBoard = document.getElementById('game-board');

// 1. Authenticate silently on load
auth.signInAnonymously().then(() => {
    console.log("Firebase Auth Success! Ready to Create/Join.");
}).catch((error) => console.error(error));

// 2. CREATE ROOM Logic
document.getElementById('create-room-btn').addEventListener('click', () => {
    // Agar box mein naam hai toh wo le lo, warna popup se pooch lo
    playerName = document.getElementById('playerName').value.trim() || prompt("Bhai, apna naam likho room banane ke liye:");
    
    if (!playerName) return; // Agar cancel kar diya toh wapas jao

    roomId = Math.floor(1000 + Math.random() * 9000).toString(); 

    db.ref(`rooms/${roomId}`).set({
        status: "WAITING",
        created_at: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        enterRoom(roomId, playerName);
        alert(`Room Ban Gaya! Room ID hai: ${roomId}. Doston ko batao.`);
    });
});

// 3. JOIN ROOM Logic
document.getElementById('join-room-btn').addEventListener('click', () => {
    playerName = document.getElementById('playerName').value.trim();
    let enteredRoomId = document.getElementById('roomIdInput').value.trim();

    if (!playerName || !enteredRoomId) return alert("Naam aur Room ID dono zaroori hain!");

    // Check karo room exist karta hai ya nahi
    db.ref(`rooms/${enteredRoomId}`).once('value', (snapshot) => {
        if (snapshot.exists()) {
            let roomData = snapshot.val();
            let playersCount = roomData.players ? Object.keys(roomData.players).length : 0;
            
            // Pachisa me 3 players ki limit hoti hai
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

// 4. Enter Room & Shift UI
function enterRoom(rId, pName) {
    roomId = rId; // Set global variable
    
    // Player ko room node me add karo
    db.ref(`rooms/${roomId}/players/${pName}`).set({
        name: pName,
        status: "JOINED"
    });

    // Lobby chupao, Game Board dikhao
    lobbyArea.style.display = "none";
    gameBoard.style.display = "block";
    document.getElementById('display-room-id').innerText = roomId;

    // Room listen karna shuru karo (Opponents ke liye)
    listenToRoomUpdates();
}

// 5. Room Listeners (Kaun kaun aaya hai dekho)
function listenToRoomUpdates() {
    db.ref(`rooms/${roomId}/players`).on('value', (snapshot) => {
        const playersData = snapshot.val();
        if (playersData) {
            let count = Object.keys(playersData).length;
            console.log(`Players in room: ${count}/3`, playersData);
            
            // Yahan se aap apna purana dealCards() ya UI updates chala sakte ho jab count === 3 ho jaye
            if (count === 3) {
                console.log("Room full! Start dealing cards.");
                // alert("All players joined! Game starting...");
                // dealCards(); <-- Ye function chalao
            }
        }
    });
}
function compareAllPlayers(playersData) {
    // playersData mein teeno players ke slots hain
    // Ab aap step-by-step slots compare karke points assign kar sakte hain
    // Isko UI par display karne ke liye ek 'Result' popup dikha do.
}
