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


// ==========================================
// AUTHENTICATION
// ==========================================

auth.signInAnonymously()
    .then(() => {
        console.log("Firebase Auth Success! Ready to Create/Join.");
    })
    .catch(error => {
        console.error("Firebase Auth Error:", error);
    });


// ==========================================
// 2. GLOBAL VARIABLES & CONSTANTS
// ==========================================

let roomId = "";
let playerName = "";
let isRoomCreator = false;

let globalPlayerNames = [];

let isBattleRunning = false;

let draggedCard = null;

let lastAnnouncedWinner = null;


// ==========================================
// CARD CONSTANTS
// ==========================================

const SUITS = [
    "Spades",
    "Hearts",
    "Diamonds",
    "Clubs"
];

const RANKS = [
    2, 3, 4, 5, 6, 7, 8, 9, 10,
    11, 12, 13, 14
];

const suitSymbols = {

    Spades: "♠",
    Hearts: "♥",
    Diamonds: "♦",
    Clubs: "♣"

};

const rankNames = {

    11: "J",
    12: "Q",
    13: "K",
    14: "A"

};


// ==========================================
// UI ELEMENTS
// ==========================================

const lobbyArea =
    document.getElementById("lobby-area");

const gameBoard =
    document.getElementById("game-board");

const playerHandDiv =
    document.getElementById("player-hand");

const slots =
    document.querySelectorAll(".slot");

const lockBtn =
    document.getElementById("lock-btn");


// ==========================================
// 3. CREATE ROOM
// ==========================================

document
    .getElementById("create-room-btn")
    .addEventListener("click", () => {

        playerName =
            document
                .getElementById("playerName")
                .value
                .trim();

        if (!playerName) {

            playerName =
                prompt(
                    "Bhai, apna naam likho room banane ke liye:"
                );

        }

        if (!playerName) return;

        isRoomCreator = true;

        roomId =
            Math
                .floor(
                    1000 +
                    Math.random() * 9000
                )
                .toString();

        db.ref(`rooms/${roomId}`)
            .set({

                status: "WAITING",

                created_at:
                    firebase.database.ServerValue.TIMESTAMP

            })
            .then(() => {

                enterRoom(
                    roomId,
                    playerName
                );

                alert(
                    `Room Ban Gaya! Room ID hai: ${roomId}. Doston ko batao.`
                );

            });

    });


// ==========================================
// 4. JOIN ROOM
// ==========================================

document
    .getElementById("join-room-btn")
    .addEventListener("click", () => {

        playerName =
            document
                .getElementById("playerName")
                .value
                .trim();

        const enteredRoomId =
            document
                .getElementById("roomIdInput")
                .value
                .trim();

        if (
            !playerName ||
            !enteredRoomId
        ) {

            alert(
                "Naam aur Room ID dono zaroori hain!"
            );

            return;
        }

        db.ref(`rooms/${enteredRoomId}`)
            .once("value", snapshot => {

                if (!snapshot.exists()) {

                    alert(
                        "Room ID galat hai! Aisa koi room nahi bana."
                    );

                    return;
                }

                const roomData =
                    snapshot.val();

                const playersCount =
                    roomData.players
                        ? Object.keys(
                            roomData.players
                        ).length
                        : 0;

                if (playersCount < 3) {

                    isRoomCreator = false;

                    enterRoom(
                        enteredRoomId,
                        playerName
                    );

                } else {

                    alert(
                        "Ye room full ho chuka hai (3 players max)."
                    );

                }

            });

    });


// ==========================================
// 5. ENTER ROOM
// ==========================================

function enterRoom(
    rId,
    pName
) {

    roomId = rId;

    playerName = pName;

    db.ref(
        `rooms/${roomId}/players/${playerName}`
    )
        .set({

            name: playerName,

            status: "JOINED"

        });


    lobbyArea.style.display = "none";

    gameBoard.style.display = "block";

    document
        .getElementById("display-room-id")
        .innerText = roomId;


    // Room listeners
    listenToRoomUpdates();

    // IMPORTANT:
    // Scoreboard listener starts AFTER roomId exists
    listenToGlobalScores();

}


// ==========================================
// 6. ROOM LISTENERS
// ==========================================

function listenToRoomUpdates() {


    // ======================================
    // PLAYERS WATCHER
    // ======================================

    db.ref(
        `rooms/${roomId}/players`
    )
        .on("value", snapshot => {

            const playersData =
                snapshot.val();

            if (!playersData) return;


            globalPlayerNames =
                Object.keys(playersData);


            // ==================================
            // ROOM FULL
            // ==================================

            if (
                globalPlayerNames.length === 3 &&
                document
                    .getElementById("opp1-avatar")
                    .innerText === "⏳ Wait..."
            ) {

                console.log(
                    "Room full! Starting game..."
                );


                // ==================================
                // SET OPPONENTS
                // ==================================

                const opponents =
                    globalPlayerNames.filter(
                        n => n !== playerName
                    );


                document
                    .getElementById("opp1-avatar")
                    .innerText =
                    opponents[0] || "Player 2";


                document
                    .getElementById("opp2-avatar")
                    .innerText =
                    opponents[1] || "Player 3";


                // ==================================
                // HOST DEALS CARDS
                // ==================================

                if (isRoomCreator) {

                    const deck =
                        shuffleDeck(
                            generateDeck()
                        );


                    // INITIAL SCORES

                    db.ref(
                        `rooms/${roomId}/global_scores`
                    )
                        .set({

                            [globalPlayerNames[0]]: 0,

                            [globalPlayerNames[1]]: 0,

                            [globalPlayerNames[2]]: 0

                        });


                    // DEAL 17-17-17

                    db.ref(
                        `rooms/${roomId}/current_round`
                    )
                        .set({

                            p1_cards:
                                deck.splice(0, 17),

                            p2_cards:
                                deck.splice(0, 17),

                            p3_cards:
                                deck.splice(0, 17),

                            center_card:
                                deck[0]

                        });

                }

            }


            // ==================================
            // CHECK ALL PLAYERS LOCKED
            // ==================================

            let allLocked = true;


            for (
                const p in playersData
            ) {

                if (
                    playersData[p].status !==
                    "LOCKED"
                ) {

                    allLocked = false;

                }

            }


            if (
                allLocked &&
                globalPlayerNames.length === 3
            ) {

                startBattleAnimation(
                    playersData
                );

            }

        });


    // ======================================
    // CURRENT ROUND LISTENER
    // ======================================

    db.ref(
        `rooms/${roomId}/current_round`
    )
        .on("value", snap => {

            if (!snap.exists()) return;


            const roundData =
                snap.val();


            const deckVis =
                document.getElementById(
                    "deck-visual"
                );


            if (deckVis) {

                deckVis.innerText =
                    "Dealing...";

            }


            setTimeout(() => {

                const myIndex =
                    globalPlayerNames.indexOf(
                        playerName
                    );


                let myCards;


                if (myIndex === 0) {

                    myCards =
                        roundData.p1_cards;

                }

                else if (myIndex === 1) {

                    myCards =
                        roundData.p2_cards;

                }

                else if (myIndex === 2) {

                    myCards =
                        roundData.p3_cards;

                }


                if (!myCards) return;


                renderPlayerHand(
                    myCards
                );


                if (deckVis) {

                    deckVis.innerText =
                        "Empty";

                }


                const unusablePile =
                    document.getElementById(
                        "unusable-pile"
                    );


                if (unusablePile) {

                    unusablePile.innerText =
                        "1 Card";

                }

            }, 1000);

        });

}


// ==========================================
// 7. DECK
// ==========================================

function generateDeck() {

    const deck = [];


    for (const suit of SUITS) {

        for (const rank of RANKS) {

            deck.push({

                suit: suit,

                rank: rank

            });

        }

    }


    return deck;

}


// ==========================================
// SHUFFLE
// ==========================================

function shuffleDeck(deck) {

    for (
        let i = deck.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );


        [
            deck[i],
            deck[j]
        ] =
        [
            deck[j],
            deck[i]
        ];

    }


    return deck;

}


// ==========================================
// 8. THREE CARD HAND SCORE
// ==========================================

function getHandScore(cards) {

    if (!cards || cards.length !== 3) {

        return 0;

    }


    const sorted =
        [...cards].sort(
            (a, b) =>
                b.rank - a.rank
        );


    const c1 = sorted[0];

    const c2 = sorted[1];

    const c3 = sorted[2];


    // ======================================
    // COLOR
    // ======================================

    const isColor =
        c1.suit === c2.suit &&
        c2.suit === c3.suit;


    // ======================================
    // SEQUENCE
    // ======================================

    const normalSequence =
        c1.rank === c2.rank + 1 &&
        c2.rank === c3.rank + 1;


    // A-2-3
    const aceLowSequence =
        c1.rank === 14 &&
        c2.rank === 3 &&
        c3.rank === 2;


    const isSequence =
        normalSequence ||
        aceLowSequence;


    // ======================================
    // TRAIL
    // ======================================

    const isTrail =
        c1.rank === c2.rank &&
        c2.rank === c3.rank;


    // ======================================
    // PAIR
    // ======================================

    const isPair =
        c1.rank === c2.rank ||
        c2.rank === c3.rank ||
        c1.rank === c3.rank;


    // ======================================
    // CATEGORY
    //
    // Trail       = 6
    // Pure Seq    = 5
    // Sequence    = 4
    // Color       = 3
    // Pair        = 2
    // High Card    = 1
    // ======================================

    let category = 1;


    if (isTrail) {

        category = 6;

    }

    else if (
        isSequence &&
        isColor
    ) {

        category = 5;

    }

    else if (isSequence) {

        category = 4;

    }

    else if (isColor) {

        category = 3;

    }

    else if (isPair) {

        category = 2;

    }


    // ======================================
    // VALUE
    // ======================================

    let val1 = c1.rank;

    let val2 = c2.rank;

    let val3 = c3.rank;


    // PAIR
    if (
        isPair &&
        c2.rank === c3.rank
    ) {

        val1 = c2.rank;

        val2 = c3.rank;

        val3 = c1.rank;

    }

    else if (
        isPair &&
        c1.rank === c2.rank
    ) {

        val1 = c1.rank;

        val2 = c2.rank;

        val3 = c3.rank;

    }


    // A-2-3 LOW SEQUENCE
    if (
        isSequence &&
        c1.rank === 14 &&
        c2.rank === 3
    ) {

        val1 = 3;

        val2 = 2;

        val3 = 14;

    }


    return (
        category * 1000000
    )
    +
    (
        val1 * 10000
    )
    +
    (
        val2 * 100
    )
    +
    val3;

}


// ==========================================
// 9. RENDER PLAYER HAND
// ==========================================

// ==========================================
// RENDER PLAYER HAND
// ==========================================
//
// Cards:
// 1. One-by-one deal animation
// 2. Automatically grouped by suit
// 3. Spades -> Hearts -> Diamonds -> Clubs
//
// ==========================================

// ==========================================
// RENDER PLAYER HAND
// SIMPLE COMPACT HORIZONTAL HAND
// ==========================================

function renderPlayerHand(cardsArray) {
    playerHandDiv.innerHTML = '';

    cardsArray.forEach((card, index) => {

        const cardEl =
            document.createElement('div');

        cardEl.classList.add('card');

        cardEl.classList.add(
            (
                card.suit === 'Hearts' ||
                card.suit === 'Diamonds'
            )
                ? 'red'
                : 'black'
        );

        let displayRank =
            rankNames[card.rank] ||
            card.rank;

        cardEl.innerText =
            `${displayRank}${suitSymbols[card.suit]}`;

        cardEl.dataset.suit =
            card.suit;

        cardEl.dataset.rank =
            card.rank;

        cardEl.dataset.id =
            `card-${index}`;

        cardEl.setAttribute(
            'draggable',
            'true'
        );


        // ORIGINAL DRAG FEEL
        cardEl.addEventListener(
            'dragstart',
            function () {

                draggedCard = this;

                setTimeout(
                    () => {
                        this.style.opacity = '0.5';
                    },
                    0
                );

            }
        );


        cardEl.addEventListener(
            'dragend',
            function () {

                setTimeout(
                    () => {
                        this.style.opacity = '1';
                    },
                    0
                );

                draggedCard = null;

                validateSlots();

            }
        );


        playerHandDiv.appendChild(
            cardEl
        );

    });


    setupDragAndDrop();
}
// ==========================================
// 10. DRAG & DROP
// ==========================================

// ==========================================
// DRAG & DROP
// ==========================================

function setupDragAndDrop() {

    const dropZones = [
        ...slots,
        playerHandDiv
    ];

    dropZones.forEach(
        zone => {

            zone.addEventListener(
                'dragover',
                e => e.preventDefault()
            );

            zone.addEventListener(
                'dragenter',
                e => e.preventDefault()
            );

            zone.addEventListener(
                'drop',
                function(e) {

                    e.preventDefault();

                    e.stopPropagation();


                    if (draggedCard) {

                        if (
                            this.classList.contains(
                                'slot'
                            )
                        ) {

                            if (
                                this.children.length < 3
                            ) {

                                this.appendChild(
                                    draggedCard
                                );

                            }

                        }

                        else {

                            this.appendChild(
                                draggedCard
                            );

                        }


                        draggedCard = null;

                        validateSlots();

                    }

                }
            );

        }
    );
}

// ==========================================
// 11. VALIDATE SLOTS
// ==========================================

function validateSlots() {

    let totalCardsInSlots = 0;


    slots.forEach(
        slot => {

            totalCardsInSlots +=
                slot.children.length;

        }
    );


    lockBtn.disabled =
        totalCardsInSlots !== 15;

}


// ==========================================
// 12. LOCK CARDS
// ==========================================

lockBtn.addEventListener(
    "click",
    () => {

        const allSlotsData = [];


        slots.forEach(
            (slot, index) => {

                const cardsInSlot = [];


                slot
                    .querySelectorAll(".card")
                    .forEach(
                        cardEl => {

                            cardsInSlot.push({

                                domElement:
                                    cardEl,

                                suit:
                                    cardEl.dataset.suit,

                                rank:
                                    parseInt(
                                        cardEl.dataset.rank
                                    )

                            });

                        }
                    );


                allSlotsData.push({

                    slotIndex:
                        index,

                    cards:
                        cardsInSlot,

                    score:
                        getHandScore(
                            cardsInSlot
                        )

                });

            }
        );


        // ======================================
        // SORT STRONGEST -> WEAKEST
        // ======================================

        allSlotsData.sort(
            (a, b) =>
                b.score - a.score
        );


        slots.forEach(
            (slot, i) => {

                slot.innerHTML =
                    `Slot ${i + 1}`;


                allSlotsData[i]
                    .cards
                    .forEach(
                        cardData => {

                            slot.appendChild(
                                cardData.domElement
                            );

                        }
                    );

            }
        );


        // ======================================
        // DISCARD REMAINING 2 CARDS
        // ======================================

        const unusedCards =
            playerHandDiv
                .querySelectorAll(
                    ".card"
                );


        unusedCards.forEach(
            card => {

                card.classList.add(
                    "discard-anim"
                );


                setTimeout(
                    () => {

                        card.remove();


                        const up =
                            document.getElementById(
                                "unusable-pile"
                            );


                        if (up) {

                            up.innerText =
                                "3 Cards";

                        }

                    },
                    500
                );

            }
        );


        lockBtn.disabled = true;

        lockBtn.innerText =
            "Waiting for others...";


        document
            .querySelectorAll(".card")
            .forEach(
                card => {

                    card.setAttribute(
                        "draggable",
                        "false"
                    );

                    card.style.cursor =
                        "default";

                }
            );


        // ======================================
        // SEND DATA TO FIREBASE
        // ======================================

        const formattedSlots =
            allSlotsData.map(
                slot => ({

                    score:
                        slot.score,

                    cards:
                        slot.cards.map(
                            c => ({

                                suit:
                                    c.suit,

                                rank:
                                    c.rank

                            })
                        )

                })
            );


        db.ref(
            `rooms/${roomId}/players/${playerName}`
        )
            .update({

                lockedSlots:
                    formattedSlots,

                status:
                    "LOCKED"

            });

    }
);


// ==========================================
// 13. BATTLE ANIMATION
// ==========================================

// ==========================================
// 13. MANUAL BATTLE SYSTEM
// ==========================================
//
// Ab fight automatic timer se nahi chalegi.
//
// User NEXT button dabayega.
// Firebase battle_state ke through
// 3 players ko same slot/same result dikhega.
//
// ==========================================

let battleListenerAttached = false;

let battleHistoryHTML = "";

let battleFinishedHandled = false;


// ==========================================
// START BATTLE
// ==========================================

function startBattleAnimation(playersData) {

    if (isBattleRunning) return;

    isBattleRunning = true;

    battleFinishedHandled = false;

    battleHistoryHTML = "";


    const battleArena =
        document.getElementById("battle-arena");

    const battleTitle =
        document.getElementById("battle-title");

    const battleCards =
        document.getElementById("battle-cards");

    const battleWinner =
        document.getElementById("battle-winner");

    const nextBtn =
        document.getElementById("battle-next-btn");


    if (battleArena) {

        battleArena.style.display = "block";

    }


    // ======================================
    // ATTACH FIREBASE BATTLE LISTENER
    // ======================================

    if (!battleListenerAttached) {

        battleListenerAttached = true;


        db.ref(
            `rooms/${roomId}/battle_state`
        )
        .on(
            "value",
            snapshot => {

                const battleState =
                    snapshot.val();


                // No battle yet
                if (!battleState) {

                    return;

                }


                // ==================================
                // GAME FINISHED
                // ==================================

                if (
                    battleState.status ===
                    "FINISHED"
                ) {

                    if (battleArena) {

                        battleArena.style.display =
                            "none";

                    }


                    // Prevent duplicate score update
                    if (
                        battleFinishedHandled
                    ) {

                        return;

                    }


                    battleFinishedHandled =
                        true;


                    // ==================================
                    // CALCULATE ALL 5 WINNERS
                    // ==================================

                    const roundPoints = {};


                    globalPlayerNames.forEach(
                        name => {

                            roundPoints[name] =
                                0;

                        }
                    );


                    for (
                        let slotIndex = 0;
                        slotIndex < 5;
                        slotIndex++
                    ) {

                        let winner = null;

                        let highestScore = -1;


                        globalPlayerNames.forEach(
                            name => {

                                const slotData =
                                    playersData[name]
                                        .lockedSlots[
                                            slotIndex
                                        ];


                                if (!slotData) return;


                                if (
                                    slotData.score >
                                    highestScore
                                ) {

                                    highestScore =
                                        slotData.score;

                                    winner =
                                        name;

                                }

                            }
                        );


                        if (winner) {

                            roundPoints[winner] += 1;

                        }

                    }


                    // ==================================
                    // HISTORY SAVE
                    // ==================================

                    const historyContent =
                        document.getElementById(
                            "history-content"
                        );


                    if (historyContent) {

                        historyContent.innerHTML =
                            battleHistoryHTML;

                    }


                    // ==================================
                    // UPDATE SCORE
                    // ==================================

                    updateGlobalScores(
                        roundPoints
                    );


                    return;

                }


                // ==================================
                // CURRENT SLOT
                // ==================================

                const currentSlot =
                    Number(
                        battleState.slot || 0
                    );


                renderBattleSlot(
                    playersData,
                    currentSlot
                );


            }
        );

    }


    // ======================================
    // HOST INITIALIZES BATTLE
    // ======================================

    if (isRoomCreator) {

        db.ref(
            `rooms/${roomId}/battle_state`
        )
        .once(
            "value",
            snapshot => {

                const existingState =
                    snapshot.val();


                // Agar already battle running hai
                if (
                    existingState &&
                    existingState.status ===
                    "PLAYING"
                ) {

                    return;

                }


                db.ref(
                    `rooms/${roomId}/battle_state`
                )
                .set({

                    status: "PLAYING",

                    slot: 0

                });

            }
        );

    }


    // ======================================
    // NEXT BUTTON
    // ======================================

    if (nextBtn) {

        nextBtn.onclick =
            () => {

                nextBattleSlot();

            };

    }

}


// ==========================================
// RENDER CURRENT BATTLE SLOT
// ==========================================

function renderBattleSlot(
    playersData,
    currentSlot
) {

    const battleTitle =
        document.getElementById(
            "battle-title"
        );


    const battleCards =
        document.getElementById(
            "battle-cards"
        );


    const battleWinner =
        document.getElementById(
            "battle-winner"
        );


    const nextBtn =
        document.getElementById(
            "battle-next-btn"
        );


    const stepNumber =
        document.getElementById(
            "battle-step-number"
        );


    if (battleTitle) {

        battleTitle.innerText =
            `SLOT ${currentSlot + 1}`;

    }


    if (stepNumber) {

        stepNumber.innerText =
            currentSlot + 1;

    }


    if (battleCards) {

        battleCards.innerHTML =
            "";

    }


    if (battleWinner) {

        battleWinner.innerHTML =
            "";

    }


    // ======================================
    // FIND SLOT WINNER
    // ======================================

    let slotWinner = null;

    let highestScore = -1;


    let slotCardsHTML = "";


    globalPlayerNames.forEach(
        name => {

            const slotData =
                playersData[name]
                    .lockedSlots[
                        currentSlot
                    ];


            if (
                !slotData ||
                !slotData.cards
            ) {

                return;

            }


            const c1 =
                slotData.cards[0];

            const c2 =
                slotData.cards[1];

            const c3 =
                slotData.cards[2];


            const r1 =
                rankNames[c1.rank] ||
                c1.rank;

            const r2 =
                rankNames[c2.rank] ||
                c2.rank;

            const r3 =
                rankNames[c3.rank] ||
                c3.rank;


            const s1 =
                suitSymbols[c1.suit];

            const s2 =
                suitSymbols[c2.suit];

            const s3 =
                suitSymbols[c3.suit];


            const cardString =
                `${r1}${s1} ${r2}${s2} ${r3}${s3}`;


            // ==================================
            // FIND WINNER
            // ==================================

            if (
                slotData.score >
                highestScore
            ) {

                highestScore =
                    slotData.score;

                slotWinner =
                    name;

            }


            // ==================================
            // BATTLE CARD UI
            // ==================================

            if (battleCards) {

                battleCards.innerHTML += `

                    <div
                        class="battle-player-card"
                    >

                        <div
                            class="battle-player-name"
                        >

                            ${name}

                        </div>


                        <div
                            class="battle-playing-cards"
                        >

                            <div
                                class="
                                    battle-single-card
                                    ${
                                        (
                                            c1.suit ===
                                            "Hearts" ||
                                            c1.suit ===
                                            "Diamonds"
                                        )
                                            ? "red"
                                            : "black"
                                    }
                                "
                            >
                                ${r1}
                                <span>${s1}</span>
                            </div>


                            <div
                                class="
                                    battle-single-card
                                    ${
                                        (
                                            c2.suit ===
                                            "Hearts" ||
                                            c2.suit ===
                                            "Diamonds"
                                        )
                                            ? "red"
                                            : "black"
                                    }
                                "
                            >
                                ${r2}
                                <span>${s2}</span>
                            </div>


                            <div
                                class="
                                    battle-single-card
                                    ${
                                        (
                                            c3.suit ===
                                            "Hearts" ||
                                            c3.suit ===
                                            "Diamonds"
                                        )
                                            ? "red"
                                            : "black"
                                    }
                                "
                            >
                                ${r3}
                                <span>${s3}</span>
                            </div>

                        </div>


                        <div
                            class="battle-combination"
                        >

                            ${cardString}

                        </div>

                    </div>

                `;

            }


            // ==================================
            // HISTORY
            // ==================================

            slotCardsHTML += `

                <div class="history-player">

                    <strong>
                        ${name}
                    </strong>

                    <br>

                    <span>
                        ${cardString}
                    </span>

                </div>

            `;

        }
    );


    // ======================================
    // SHOW WINNER
    // ======================================

    if (battleWinner) {

        battleWinner.innerHTML = `

            <div class="battle-result">

                🏆

                <strong>
                    ${slotWinner}
                </strong>

                wins this round

                <span>
                    +1 POINT
                </span>

            </div>

        `;

    }


    // ======================================
    // ADD TO HISTORY
    // ======================================

    battleHistoryHTML += `

        <div class="history-battle-round">

            <div class="history-round-header">

                <strong>
                    SLOT ${currentSlot + 1}
                </strong>

                <span>
                    🏆 ${slotWinner}
                </span>

            </div>


            <div class="history-row">

                ${slotCardsHTML}

            </div>

        </div>

    `;


    // ======================================
    // NEXT BUTTON
    // ======================================

    if (nextBtn) {

        if (currentSlot < 4) {

            nextBtn.innerHTML =
                `NEXT → SLOT ${currentSlot + 2}`;

        }

        else {

            nextBtn.innerHTML =
                "🏁 FINISH ROUND";

        }

    }

}


// ==========================================
// NEXT BATTLE SLOT
// ==========================================

function nextBattleSlot() {

    const battleRef =
        db.ref(
            `rooms/${roomId}/battle_state`
        );


    battleRef.transaction(
        currentState => {

            if (!currentState) {

                return currentState;

            }


            if (
                currentState.status !==
                "PLAYING"
            ) {

                return currentState;

            }


            const currentSlot =
                Number(
                    currentState.slot || 0
                );


            // ==================================
            // LAST SLOT
            // ==================================

            if (
                currentSlot >= 4
            ) {

                return {

                    ...currentState,

                    status: "FINISHED",

                    slot: 4

                };

            }


            // ==================================
            // NEXT SLOT
            // ==================================

            return {

                ...currentState,

                slot:
                    currentSlot + 1

            };

        }
    );

}

// ==========================================
// 14. UPDATE GLOBAL SCORES
// ==========================================

function updateGlobalScores(
    roundPoints
) {

    // Only host updates global score.
    // Otherwise 3 players would each add the points.

    if (isRoomCreator) {

        db.ref(
            `rooms/${roomId}/global_scores`
        )
            .once(
                "value",
                snap => {

                    const currentScores =
                        snap.val() || {};


                    globalPlayerNames.forEach(
                        name => {

                            currentScores[name] =
                                Number(
                                    currentScores[name] ||
                                    0
                                )
                                +
                                Number(
                                    roundPoints[name] ||
                                    0
                                );

                        }
                    );


                    db.ref(
                        `rooms/${roomId}/global_scores`
                    )
                        .set(
                            currentScores
                        );

                }
            );

    }


    setTimeout(
        () => {

            resetRound();

        },

        2000
    );

}


// ==========================================
// 15. GLOBAL SCOREBOARD LISTENER
// ==========================================

function listenToGlobalScores() {

    if (!roomId) return;


    db.ref(
        `rooms/${roomId}/global_scores`
    )
        .on(
            "value",
            snap => {

                const scores =
                    snap.val() || {};


                // ==================================
                // FIND LEADER
                // ==================================

                const scoreValues =
                    globalPlayerNames.map(
                        name =>
                            Number(
                                scores[name] ||
                                0
                            )
                    );


                const maxScore =
                    scoreValues.length
                        ? Math.max(
                            ...scoreValues
                        )
                        : 0;


                // ==================================
                // SCORE TABLE
                // ==================================

                let tableHTML = "";


                globalPlayerNames.forEach(
                    name => {

                        const points =
                            Number(
                                scores[name] ||
                                0
                            );


                        const progress =
                            Math.min(
                                100,
                                (
                                    points / 25
                                ) * 100
                            );


                        const isLeader =
                            points === maxScore &&
                            points > 0;


                        tableHTML += `

                            <tr
                                class="
                                    ${
                                        isLeader
                                            ? "score-leader"
                                            : ""
                                    }
                                "
                            >

                                <td>

                                    <div
                                        class="score-player-name"
                                    >

                                        <span
                                            class="player-dot"
                                        ></span>

                                        ${name}

                                        ${
                                            isLeader
                                                ? `
                                                    <span
                                                        class="leader-badge"
                                                    >
                                                        LEADER
                                                    </span>
                                                `
                                                : ""
                                        }

                                    </div>


                                    <div
                                        class="mini-progress"
                                    >

                                        <span
                                            style="
                                                width:${progress}%
                                            "
                                        ></span>

                                    </div>

                                </td>


                                <td
                                    class="score-points"
                                >

                                    ${points}

                                    <small>
                                        /25
                                    </small>

                                </td>

                            </tr>

                        `;

                    }
                );


                const scoreTable =
                    document.getElementById(
                        "score-table"
                    );


                if (scoreTable) {

                    scoreTable.innerHTML = `

                        <thead>

                            <tr>

                                <th>
                                    PLAYER
                                </th>

                                <th>
                                    POINTS
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            ${tableHTML}

                        </tbody>

                    `;

                }


                // ==================================
                // LIVE SCOREBOARD
                // ==================================

                const liveScoreboard =
                    document.getElementById(
                        "live-scoreboard"
                    );


                if (liveScoreboard) {

                    let liveHTML = "";


                    globalPlayerNames.forEach(
                        name => {

                            const points =
                                Number(
                                    scores[name] ||
                                    0
                                );


                            liveHTML += `

                                <div
                                    class="live-score-player"
                                >

                                    <span>
                                        ${name}
                                    </span>

                                    <strong>
                                        ${points}
                                    </strong>

                                </div>

                            `;

                        }
                    );


                    liveScoreboard.innerHTML =
                        liveHTML;

                }


                // ==================================
                // WINNER CHECK
                // ==================================

                const winner =
                    globalPlayerNames.find(
                        name =>
                            Number(
                                scores[name] ||
                                0
                            ) >= 25
                    );


                if (
                    winner &&
                    lastAnnouncedWinner !== winner
                ) {

                    lastAnnouncedWinner =
                        winner;


                    alert(
                        `🎉 GAME OVER! ${winner} WINS WITH 25 POINTS! 🎉`
                    );

                }

            }
        );

}


// ==========================================
// 16. RESET ROUND
// ==========================================

function resetRound() {

    isBattleRunning =
        false;
db.ref(
        `rooms/${roomId}/battle_state`
    ).remove();

    playerHandDiv.innerHTML =
        "";


    slots.forEach(
        (slot, i) => {

            slot.innerHTML =
                `Slot ${i + 1}`;

        }
    );


    lockBtn.disabled =
        true;


    lockBtn.innerText =
        "Lock Cards";


    // ======================================
    // PLAYER STATUS BACK TO JOINED
    // ======================================

    db.ref(
        `rooms/${roomId}/players/${playerName}`
    )
        .update({

            status:
                "JOINED"

        });


    // ======================================
    // HOST DEALS NEXT ROUND
    // ======================================

    if (isRoomCreator) {

        db.ref(
            `rooms/${roomId}/global_scores`
        )
            .once(
                "value",
                scoreSnap => {

                    const scores =
                        scoreSnap.val() || {};


                    // ==================================
                    // CHECK GAME WINNER
                    // ==================================

                    const winner =
                        globalPlayerNames.find(
                            name =>
                                Number(
                                    scores[name] ||
                                    0
                                ) >= 25
                        );


                    if (winner) {

                        lockBtn.innerText =
                            `${winner} WINS!`;

                        return;

                    }


                    // ==================================
                    // DEAL NEXT ROUND
                    // ==================================

                    setTimeout(
                        () => {

                            const deck =
                                shuffleDeck(
                                    generateDeck()
                                );


                            db.ref(
                                `rooms/${roomId}/current_round`
                            )
                                .set({

                                    p1_cards:
                                        deck.splice(
                                            0,
                                            17
                                        ),

                                    p2_cards:
                                        deck.splice(
                                            0,
                                            17
                                        ),

                                    p3_cards:
                                        deck.splice(
                                            0,
                                            17
                                        ),

                                    center_card:
                                        deck[0]

                                });

                        },

                        1000
                    );

                }
            );

    }

}


// ==========================================
// 17. SCOREBOARD MODAL
// ==========================================

const showScoreBtn =
    document.getElementById(
        "show-score-btn"
    );


const closeScoreBtn =
    document.getElementById(
        "close-score"
    );


const scoreboardModal =
    document.getElementById(
        "scoreboard-modal"
    );


if (showScoreBtn) {

    showScoreBtn.onclick = () => {

        if (scoreboardModal) {

            scoreboardModal.style.display =
                "block";

        }

    };

}


if (closeScoreBtn) {

    closeScoreBtn.onclick = () => {

        if (scoreboardModal) {

            scoreboardModal.style.display =
                "none";

        }

    };

}


// ==========================================
// 18. HISTORY MODAL
// ==========================================

const showHistoryBtn =
    document.getElementById(
        "show-history-btn"
    );


const closeHistoryBtn =
    document.getElementById(
        "close-history"
    );


const historyModal =
    document.getElementById(
        "history-modal"
    );


if (showHistoryBtn) {

    showHistoryBtn.onclick = () => {

        if (historyModal) {

            historyModal.style.display =
                "block";

        }

    };

}


if (closeHistoryBtn) {

    closeHistoryBtn.onclick = () => {

        if (historyModal) {

            historyModal.style.display =
                "none";

        }

    };

}


// ==========================================
// 19. CLOSE MODALS ON OUTSIDE CLICK
// ==========================================

window.addEventListener(
    "click",
    event => {

        if (
            event.target ===
            scoreboardModal
        ) {

            scoreboardModal.style.display =
                "none";

        }


        if (
            event.target ===
            historyModal
        ) {

            historyModal.style.display =
                "none";

        }

    }
);
