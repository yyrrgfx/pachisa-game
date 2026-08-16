// ==========================================
// 1. FIREBASE SETUP & INITIALIZATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyCovQYPsAMDTzdRTB657_yZxmMK0vCPUE",
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

auth.signInAnonymously().then(() => {
    console.log("Firebase Auth Success! Ready to Create/Join.");
}).catch((error) => console.error(error));


// ==========================================
// 2. GLOBAL VARIABLES & CONSTANTS
// ==========================================
let roomId = "";
let playerName = "";
let isRoomCreator = false;
let globalPlayerNames = [];

const SUITS = ['Spades', 'Hearts', 'Diamonds', 'Clubs'];
const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const suitSymbols = {
    Spades: '♠',
    Hearts: '♥',
    Diamonds: '♦',
    Clubs: '♣'
};

const rankNames = {
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A'
};

const lobbyArea = document.getElementById('lobby-area');
const gameBoard = document.getElementById('game-board');
const playerHandDiv = document.getElementById('player-hand');
const slots = document.querySelectorAll('.slot');
const lockBtn = document.getElementById('lock-btn');

let draggedCard = null;


// ==========================================
// 3. LOBBY & ROOM MANAGEMENT
// ==========================================

document.getElementById('create-room-btn').addEventListener('click', () => {

    playerName =
        document.getElementById('playerName').value.trim() ||
        prompt("Bhai, apna naam likho room banane ke liye:");

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


document.getElementById('join-room-btn').addEventListener('click', () => {

    playerName = document.getElementById('playerName').value.trim();

    let enteredRoomId =
        document.getElementById('roomIdInput').value.trim();

    if (!playerName || !enteredRoomId) {
        return alert("Naam aur Room ID dono zaroori hain!");
    }

    db.ref(`rooms/${enteredRoomId}`).once('value', (snapshot) => {

        if (snapshot.exists()) {

            let roomData = snapshot.val();

            let playersCount =
                roomData.players
                    ? Object.keys(roomData.players).length
                    : 0;

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

    db.ref(`rooms/${roomId}/players/${pName}`).set({
        name: pName,
        status: "JOINED"
    });

    lobbyArea.style.display = "none";
    gameBoard.style.display = "block";

    document.getElementById('display-room-id').innerText = roomId;

    listenToRoomUpdates();
    listenToGlobalScores();
}


// ==========================================
// ROOM LISTENERS
// ==========================================

function listenToRoomUpdates() {

    db.ref(`rooms/${roomId}/players`).on('value', (snapshot) => {

        const playersData = snapshot.val();

        if (!playersData) return;

        globalPlayerNames = Object.keys(playersData);


        // ==========================================
        // ROOM FULL
        // ==========================================

        if (
            globalPlayerNames.length === 3 &&
            document.getElementById('opp1-avatar').innerText === "⏳ Wait..."
        ) {

            console.log("Room full! Starting game...");

            let opponents =
                globalPlayerNames.filter(n => n !== playerName);

            document.getElementById('opp1-avatar').innerText =
                opponents[0];

            document.getElementById('opp2-avatar').innerText =
                opponents[1];


            // HOST DEALS
            if (isRoomCreator) {

                let deck = shuffleDeck(generateDeck());

                db.ref(`rooms/${roomId}/global_scores`).set({

                    [globalPlayerNames[0]]: 0,
                    [globalPlayerNames[1]]: 0,
                    [globalPlayerNames[2]]: 0

                });


                db.ref(`rooms/${roomId}/current_round`).set({

                    p1_cards: deck.splice(0, 17),
                    p2_cards: deck.splice(0, 17),
                    p3_cards: deck.splice(0, 17),

                    center_card: deck[0]

                });

            }

        }


        // ==========================================
        // ALL PLAYERS LOCKED
        // ==========================================

        let allLocked = true;

        for (let p in playersData) {

            if (playersData[p].status !== "LOCKED") {
                allLocked = false;
            }

        }

        if (
            allLocked &&
            globalPlayerNames.length === 3
        ) {

            startBattleAnimation(playersData);

        }

    });


    // ==========================================
    // DEALING ANIMATION
    // ==========================================

    let lastDealSignature = '';


    function animateDealToAllPlayers(roundData, myCards) {

        const table =
            document.getElementById('virtual-table');

        const deck =
            document.getElementById('deck-visual');


        if (!table || !deck) {

            renderPlayerHand(myCards);

            return;
        }


        table
            .querySelectorAll('.flying-deal-card')
            .forEach(el => el.remove());


        const targets = [

            document.getElementById('opp1-avatar'),

            document.getElementById('opp2-avatar'),

            document.querySelector(
                '.avatar:not(#opp1-avatar):not(#opp2-avatar)'
            )

        ].filter(Boolean);


        const localTarget = playerHandDiv;


        const allTargets = [

            targets[0],
            localTarget,
            targets[1]

        ].filter(Boolean);


        const deckRect =
            deck.getBoundingClientRect();


        // 51 CARDS TOTAL
        // 17 - 17 - 17
        const totalCards = 51;

        const interval = 65;


        for (let i = 0; i < totalCards; i++) {

            setTimeout(() => {

                const target =
                    allTargets[i % allTargets.length];

                if (!target) return;


                const targetRect =
                    target.getBoundingClientRect();


                const card =
                    document.createElement('div');

                card.className =
                    'flying-deal-card';


                card.style.left =
                    `${deckRect.left + deckRect.width / 2 - 14}px`;

                card.style.top =
                    `${deckRect.top + deckRect.height / 2 - 20}px`;


                const dx =
                    targetRect.left +
                    targetRect.width / 2 -
                    (deckRect.left + deckRect.width / 2);


                const dy =
                    targetRect.top +
                    targetRect.height / 2 -
                    (deckRect.top + deckRect.height / 2);


                card.style.setProperty(
                    '--deal-x',
                    `${dx}px`
                );

                card.style.setProperty(
                    '--deal-y',
                    `${dy}px`
                );


                table.appendChild(card);


                setTimeout(() => {

                    card.remove();

                }, 650);


            }, i * interval);

        }


        // Actual player cards appear after dealing
        setTimeout(() => {

            renderPlayerHand(myCards);

        }, totalCards * interval + 250);

    }


    // ==========================================
    // CURRENT ROUND LISTENER
    // ==========================================

    db.ref(`rooms/${roomId}/current_round`)
        .on('value', (snap) => {

            if (!snap.exists()) return;


            let roundData = snap.val();


            let deckVis =
                document.getElementById('deck-visual');


            if (deckVis) {
                deckVis.innerText = "Dealing...";
            }


            const myIndex =
                globalPlayerNames.indexOf(playerName);


            const myCards =
                myIndex === 0
                    ? roundData.p1_cards
                    : (
                        myIndex === 1
                            ? roundData.p2_cards
                            : roundData.p3_cards
                    );


            const signature =
                JSON.stringify({

                    p1: roundData.p1_cards,
                    p2: roundData.p2_cards,
                    p3: roundData.p3_cards,
                    center: roundData.center_card

                });


            if (signature === lastDealSignature) {
                return;
            }


            lastDealSignature = signature;


            animateDealToAllPlayers(
                roundData,
                myCards
            );


            setTimeout(() => {

                if (deckVis) {
                    deckVis.innerText = "Empty";
                }


                const unusablePile =
                    document.getElementById(
                        'unusable-pile'
                    );


                if (unusablePile) {
                    unusablePile.innerText =
                        "1 Card";
                }

            }, 4000);

        });

}
// ==========================================
// 4. DECK & GAME LOGIC
// ==========================================

function generateDeck() {

    let deck = [];

    for (let suit of SUITS) {

        for (let rank of RANKS) {

            deck.push({
                suit: suit,
                rank: rank
            });

        }

    }

    return deck;
}


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
        ] = [
            deck[j],
            deck[i]
        ];

    }

    return deck;
}


function getHandScore(cards) {

    cards.sort(
        (a, b) => b.rank - a.rank
    );


    let c1 = cards[0];
    let c2 = cards[1];
    let c3 = cards[2];


    let isColor =
        c1.suit === c2.suit &&
        c2.suit === c3.suit;


    let isSequence =
        (
            c1.rank === c2.rank + 1 &&
            c2.rank === c3.rank + 1
        ) ||
        (
            c1.rank === 14 &&
            c2.rank === 3 &&
            c3.rank === 2
        );


    let isTrail =
        c1.rank === c2.rank &&
        c2.rank === c3.rank;


    let isPair =
        c1.rank === c2.rank ||
        c2.rank === c3.rank;


    let category = 1;


    if (isTrail) {

        category = 6;

    } else if (
        isSequence &&
        isColor
    ) {

        category = 5;

    } else if (isSequence) {

        category = 4;

    } else if (isColor) {

        category = 3;

    } else if (isPair) {

        category = 2;

    }


    let val1 = c1.rank;
    let val2 = c2.rank;
    let val3 = c3.rank;


    if (
        isPair &&
        c2.rank === c3.rank
    ) {

        val1 = c2.rank;
        val2 = c3.rank;
        val3 = c1.rank;

    } else if (
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
    ) +
    (
        val1 * 10000
    ) +
    (
        val2 * 100
    ) +
    val3;

}


// ==========================================
// 5. UI, DRAG & DROP
// ==========================================

function renderPlayerHand(cardsArray) {

    playerHandDiv.innerHTML = '';


    cardsArray.forEach(
        (card, index) => {

            const cardEl =
                document.createElement('div');


            cardEl.classList.add(
                'card',
                'dealing'
            );


            cardEl.classList.add(

                (
                    card.suit === 'Hearts' ||
                    card.suit === 'Diamonds'
                )
                    ? 'red'
                    : 'black'

            );


            const displayRank =
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


            // DRAG START
            cardEl.addEventListener(
                'dragstart',
                function () {

                    draggedCard = this;

                    setTimeout(() => {

                        this.style.opacity =
                            '0.5';

                    }, 0);

                }
            );


            // DRAG END
            cardEl.addEventListener(
                'dragend',
                function () {

                    setTimeout(() => {

                        this.style.opacity =
                            '1';

                    }, 0);


                    draggedCard = null;

                    validateSlots();

                }
            );


            // Hand card arrival animation
            cardEl.style.animationDelay =
                `${index * 75}ms`;


            playerHandDiv.appendChild(
                cardEl
            );

        }
    );


    setupDragAndDrop();

}


// ==========================================
// DRAG & DROP
// ==========================================

function setupDragAndDrop() {

    const dropZones = [
        ...slots,
        playerHandDiv
    ];


    dropZones.forEach(zone => {

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
            function (e) {

                e.preventDefault();
                e.stopPropagation();


                if (!draggedCard) return;


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

                } else {

                    this.appendChild(
                        draggedCard
                    );

                }


                draggedCard = null;

                validateSlots();

            }
        );

    });

}


// ==========================================
// VALIDATE SLOTS
// ==========================================

function validateSlots() {

    let totalCardsInSlots = 0;


    slots.forEach(slot => {

        totalCardsInSlots +=
            slot.children.length;

    });


    lockBtn.disabled =
        totalCardsInSlots !== 15;

}


// ==========================================
// LOCK CARDS
// ==========================================

lockBtn.addEventListener(
    'click',
    () => {

        let allSlotsData = [];


        slots.forEach(
            (slot, index) => {

                let cardsInSlot = [];


                slot
                    .querySelectorAll('.card')
                    .forEach(cardEl => {

                        cardsInSlot.push({

                            domElement: cardEl,

                            suit:
                                cardEl.dataset.suit,

                            rank:
                                parseInt(
                                    cardEl.dataset.rank
                                )

                        });

                    });


                allSlotsData.push({

                    slotIndex: index,

                    cards: cardsInSlot,

                    score:
                        getHandScore(
                            cardsInSlot
                        )

                });

            }
        );


        // Strongest -> Weakest
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


        // Remaining cards discard
        let unusedCards =
            playerHandDiv
                .querySelectorAll('.card');


        unusedCards.forEach(card => {

            card.classList.add(
                'discard-anim'
            );


            setTimeout(() => {

                card.remove();


                let up =
                    document.getElementById(
                        'unusable-pile'
                    );


                if (up) {
                    up.innerText =
                        "3 Cards";
                }

            }, 500);

        });


        lockBtn.disabled = true;

        lockBtn.innerText =
            "Waiting for others...";


        document
            .querySelectorAll('.card')
            .forEach(card => {

                card.setAttribute(
                    'draggable',
                    'false'
                );

                card.style.cursor =
                    'default';

            });


        const formattedSlots =
            allSlotsData.map(
                slot => ({

                    score: slot.score,

                    cards:
                        slot.cards.map(
                            c => ({

                                suit: c.suit,
                                rank: c.rank

                            })
                        )

                })
            );


        db.ref(
            `rooms/${roomId}/players/${playerName}`
        ).update({

            lockedSlots:
                formattedSlots,

            status:
                "LOCKED"

        });

    }
);
// ==========================================
// 6. BATTLE UI HELPERS
// ==========================================

// NEXT button + responsive battle UI
// JS khud create karega agar HTML me button nahi hai.

function ensureBattleUI() {

    let battleArena =
        document.getElementById(
            'battle-arena'
        );


    if (!battleArena) {
        return null;
    }


    // ==========================================
    // CREATE NEXT BUTTON
    // ==========================================

    let nextBtn =
        document.getElementById(
            'battle-next-btn'
        );


    if (!nextBtn) {

        nextBtn =
            document.createElement(
                'button'
            );


        nextBtn.id =
            'battle-next-btn';


        nextBtn.className =
            'battle-next-btn';


        nextBtn.type =
            'button';


        nextBtn.innerText =
            'Next → Slot 2';


        battleArena.appendChild(
            nextBtn
        );

    }


    // ==========================================
    // STEP INDICATOR
    // ==========================================

    if (
        !document.getElementById(
            'battle-step-number'
        )
    ) {

        const title =
            document.getElementById(
                'battle-title'
            );


        if (title) {

            const step =
                document.createElement(
                    'span'
                );


            step.id =
                'battle-step-number';


            step.style.display =
                'none';


            title.parentNode.insertBefore(
                step,
                title.nextSibling
            );

        }

    }


    // ==========================================
    // INJECT RESPONSIVE CSS
    // ==========================================

    if (
        !document.getElementById(
            'pachisa-battle-fix-style'
        )
    ) {

        const style =
            document.createElement(
                'style'
            );


        style.id =
            'pachisa-battle-fix-style';


        style.textContent = `

            /* ==========================================
               BATTLE PANEL
            ========================================== */

            #battle-arena {

                position: fixed !important;

                top: 3vh !important;

                left: 50% !important;

                transform:
                    translateX(-50%) !important;

                width:
                    min(94vw, 900px) !important;

                height:
                    90vh !important;

                max-height:
                    90vh !important;

                box-sizing:
                    border-box !important;

                z-index:
                    9999 !important;

                display:
                    flex !important;

                flex-direction:
                    column !important;

                overflow-y:
                    auto !important;

                overflow-x:
                    hidden !important;

                -webkit-overflow-scrolling:
                    touch !important;

                padding:
                    18px !important;

            }


            /* ==========================================
               BATTLE CARDS
            ========================================== */

            #battle-arena #battle-cards {

                flex:
                    0 0 auto !important;

                min-height:
                    0 !important;

                overflow:
                    visible !important;

                width:
                    100% !important;

            }


            /* ==========================================
               NEXT BUTTON
            ========================================== */

            #battle-next-btn,
            #battle-arena .battle-next-btn {

                display:
                    block !important;

                flex-shrink:
                    0 !important;

                position:
                    sticky !important;

                bottom:
                    0 !important;

                z-index:
                    50 !important;

                width:
                    100% !important;

                max-width:
                    430px !important;

                margin:
                    12px auto 4px !important;

                padding:
                    15px 20px !important;

                border:
                    none !important;

                border-radius:
                    15px !important;

                background:
                    linear-gradient(
                        135deg,
                        #f1c40f,
                        #e67e22
                    ) !important;

                color:
                    #161616 !important;

                font-size:
                    1rem !important;

                font-weight:
                    900 !important;

                cursor:
                    pointer !important;

                box-shadow:
                    0 8px 25px
                    rgba(0,0,0,.45) !important;

            }


            /* ==========================================
               FLYING DEAL CARD
            ========================================== */

            .flying-deal-card {

                position:
                    fixed !important;

                width:
                    28px !important;

                height:
                    40px !important;

                border-radius:
                    5px !important;

                background:
                    linear-gradient(
                        135deg,
                        #17202a,
                        #34495e
                    ) !important;

                border:
                    2px solid
                    rgba(255,255,255,.8)
                    !important;

                box-shadow:
                    0 5px 15px
                    rgba(0,0,0,.45)
                    !important;

                z-index:
                    100000 !important;

                pointer-events:
                    none !important;

                animation:
                    pachisaFlyCard
                    .58s
                    cubic-bezier(.18,.82,.28,1)
                    forwards !important;

                transform-origin:
                    center center !important;

            }


            .flying-deal-card::after {

                content:
                    '★' !important;

                position:
                    absolute !important;

                inset:
                    0 !important;

                display:
                    flex !important;

                align-items:
                    center !important;

                justify-content:
                    center !important;

                color:
                    #f1c40f !important;

                font-size:
                    15px !important;

            }


            /* ==========================================
               FLYING ANIMATION
            ========================================== */

            @keyframes pachisaFlyCard {

                0% {

                    opacity: 1;

                    transform:
                        translate(0,0)
                        scale(.75)
                        rotate(-20deg);

                }


                55% {

                    opacity: 1;

                    transform:
                        translate(
                            calc(var(--deal-x) * .55),
                            calc(var(--deal-y) * .55)
                        )
                        scale(1.05)
                        rotate(8deg);

                }


                100% {

                    opacity: 0;

                    transform:
                        translate(
                            var(--deal-x),
                            var(--deal-y)
                        )
                        scale(.7)
                        rotate(18deg);

                }

            }


            /* ==========================================
               PLAYER HAND CARD DEAL
            ========================================== */

            .card.dealing {

                animation:
                    pachisaHandCard
                    .42s
                    cubic-bezier(.2,.8,.3,1)
                    both !important;

            }


            @keyframes pachisaHandCard {

                0% {

                    opacity: 0;

                    transform:
                        translateY(-35px)
                        scale(.55)
                        rotate(-10deg);

                }


                70% {

                    opacity: 1;

                    transform:
                        translateY(5px)
                        scale(1.04)
                        rotate(2deg);

                }


                100% {

                    opacity: 1;

                    transform:
                        translateY(0)
                        scale(1)
                        rotate(0);

                }

            }


            /* ==========================================
               MOBILE
            ========================================== */

            @media (max-width: 700px) {

                #battle-arena {

                    top:
                        2vh !important;

                    width:
                        94vw !important;

                    height:
                        94vh !important;

                    max-height:
                        94vh !important;

                    padding:
                        12px !important;

                    border-radius:
                        18px !important;

                }


                #battle-arena #battle-cards {

                    display:
                        grid !important;

                    grid-template-columns:
                        1fr !important;

                    gap:
                        10px !important;

                }


                #battle-next-btn,
                #battle-arena .battle-next-btn {

                    min-height:
                        52px !important;

                    font-size:
                        .95rem !important;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    return nextBtn;
}


// ==========================================
// 7. EPIC BATTLE ANIMATION & SCORING
// ==========================================

let isBattleRunning = false;


function startBattleAnimation(
    playersData
) {

    if (isBattleRunning) {
        return;
    }


    isBattleRunning = true;


    const battleArena =
        document.getElementById(
            'battle-arena'
        );


    const battleTitle =
        document.getElementById(
            'battle-title'
        );


    const battleCards =
        document.getElementById(
            'battle-cards'
        );


    const battleWinner =
        document.getElementById(
            'battle-winner'
        );


    if (!battleArena) {
        return;
    }


    const nextBtn =
        ensureBattleUI();


    battleArena.style.display =
        'flex';


    let currentSlot = 0;


    const roundPoints = {};


    globalPlayerNames.forEach(
        name => {

            roundPoints[name] =
                0;

        }
    );


    let lastRoundHistoryHTML =
        '';


    // ==========================================
    // SHOW CURRENT SLOT
    // ==========================================

    function showBattleSlot() {

        if (currentSlot >= 5) {

            finishBattle();

            return;

        }


        let slotWinner = null;

        let highestScore = -1;

        let slotCardsHTML = '';


        if (battleCards) {

            battleCards.innerHTML =
                '';

        }


        if (battleWinner) {

            battleWinner.innerHTML =
                '';

        }


        if (battleTitle) {

            battleTitle.innerText =
                `Fighting: SLOT ${currentSlot + 1}`;

        }


        const stepNumber =
            document.getElementById(
                'battle-step-number'
            );


        if (stepNumber) {

            stepNumber.innerText =
                String(
                    currentSlot + 1
                );

        }


        // ==========================================
        // SHOW ALL 3 PLAYERS
        // ==========================================

        globalPlayerNames.forEach(
            name => {

                const playerData =
                    playersData[name];


                const slotData =
                    playerData &&
                    playerData.lockedSlots
                        ? playerData.lockedSlots[
                            currentSlot
                        ]
                        : null;


                if (
                    !slotData ||
                    !slotData.cards ||
                    slotData.cards.length < 3
                ) {

                    return;

                }


                const cards =
                    slotData.cards;


                const cardHTML =
                    cards.map(card => {

                        const rank =
                            rankNames[card.rank] ||
                            card.rank;


                        const suit =
                            suitSymbols[card.suit] ||
                            '';


                        const red =
                            card.suit === 'Hearts' ||
                            card.suit === 'Diamonds';


                        return `
                            <div class="battle-single-card ${red ? 'battle-red' : 'battle-black'}">

                                <span>${rank}</span>

                                <span>${suit}</span>

                            </div>
                        `;

                    }).join('');


                const cardString =
                    cards.map(card => {

                        return (
                            rankNames[card.rank] ||
                            card.rank
                        ) +
                        (
                            suitSymbols[card.suit] ||
                            ''
                        );

                    }).join(' | ');


                if (battleCards) {

                    battleCards.innerHTML += `

                        <div class="battle-player-card">

                            <div class="battle-player-name">
                                ${name}
                            </div>

                            <div class="battle-playing-cards">

                                ${cardHTML}

                            </div>

                            <div class="battle-combination">

                                ${cardString}

                            </div>

                        </div>

                    `;

                }


                slotCardsHTML += `

                    <div class="history-player">

                        <strong>${name}</strong>
                        <br>
                        ${cardString}

                    </div>

                `;


                const score =
                    Number(
                        slotData.score || 0
                    );


                if (
                    score > highestScore
                ) {

                    highestScore =
                        score;

                    slotWinner =
                        name;

                }

            }
        );


        if (!slotWinner) {
            return;
        }


        // ==========================================
        // HISTORY
        // ==========================================

        lastRoundHistoryHTML += `

            <div class="history-battle-round">

                <div class="history-round-header">

                    <strong>
                        Slot ${currentSlot + 1}
                    </strong>

                    <span>
                        Winner: 🎉 ${slotWinner}
                    </span>

                </div>

                <div class="history-row">

                    ${slotCardsHTML}

                </div>

            </div>

        `;


        // ==========================================
        // POINT
        // ==========================================

        roundPoints[slotWinner] += 1;


        if (battleWinner) {

            battleWinner.innerHTML = `

                <div class="battle-result">

                    🎉

                    <strong>
                        ${slotWinner}
                    </strong>

                    <span>
                        +1 Point
                    </span>

                </div>

            `;

        }


        // ==========================================
        // NEXT BUTTON
        // ==========================================

        if (nextBtn) {

            nextBtn.style.display =
                'block';


            nextBtn.innerText =
                currentSlot === 4
                    ? 'Finish Round ✓'
                    : `Next → Slot ${currentSlot + 2}`;

        }


        currentSlot++;


        // Scroll panel to top
        battleArena.scrollTop = 0;

    }


    // ==========================================
    // FINISH BATTLE
    // ==========================================

    function finishBattle() {

        if (nextBtn) {

            nextBtn.style.display =
                'none';

        }


        if (battleArena) {

            battleArena.style.display =
                'none';

        }


        const historyContent =
            document.getElementById(
                'history-content'
            );


        if (historyContent) {

            historyContent.innerHTML =
                lastRoundHistoryHTML;

        }


        updateGlobalScores(
            roundPoints
        );

    }


    // ==========================================
    // NEXT BUTTON CLICK
    // ==========================================

    if (nextBtn) {

        nextBtn.onclick =
            showBattleSlot;


        nextBtn.style.display =
            'block';

    }


    // FIRST SLOT
    showBattleSlot();

}
// ==========================================
// 8. GLOBAL SCORE UPDATE
// ==========================================

function updateGlobalScores(
    roundPoints
) {

    if (isRoomCreator) {

        db.ref(
            `rooms/${roomId}/global_scores`
        ).once(
            'value',
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
                ).set(
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
// 9. GLOBAL SCORE LISTENER
// ==========================================

let lastAnnouncedWinner = null;


function listenToGlobalScores() {

    if (!roomId) {
        return;
    }


    db.ref(
        `rooms/${roomId}/global_scores`
    ).on(
        'value',
        snap => {

            const scores =
                snap.val() || {};


            const values =
                globalPlayerNames.map(
                    name =>
                        Number(
                            scores[name] || 0
                        )
                );


            const maxScore =
                values.length
                    ? Math.max(...values)
                    : 0;


            const rows =
                globalPlayerNames.map(
                    name => {

                        const points =
                            Number(
                                scores[name] ||
                                0
                            );


                        const progress =
                            Math.min(
                                100,
                                (points / 25) *
                                100
                            );


                        const leader =
                            points === maxScore &&
                            points > 0;


                        return `

                            <tr
                                class="${leader ? 'score-leader' : ''}"
                            >

                                <td>

                                    <div class="score-player-name">

                                        <span class="player-dot"></span>

                                        ${name}

                                        ${
                                            leader
                                                ? '<span class="leader-badge">LEADER</span>'
                                                : ''
                                        }

                                    </div>


                                    <div class="mini-progress">

                                        <span
                                            style="width:${progress}%"
                                        ></span>

                                    </div>

                                </td>


                                <td class="score-points">

                                    ${points}

                                    <small>
                                        /25
                                    </small>

                                </td>

                            </tr>

                        `;

                    }
                ).join('');


            const table =
                document.getElementById(
                    'score-table'
                );


            if (table) {

                table.innerHTML = `

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

                        ${rows}

                    </tbody>

                `;

            }


            const live =
                document.getElementById(
                    'live-scoreboard'
                );


            if (live) {

                live.innerHTML =
                    globalPlayerNames.map(
                        name => `

                            <div
                                class="live-score-player"
                            >

                                <span>
                                    ${name}
                                </span>

                                <strong>
                                    ${
                                        Number(
                                            scores[name] ||
                                            0
                                        )
                                    }
                                </strong>

                            </div>

                        `
                    ).join('');

            }


            // ==========================================
            // GAME OVER
            // ==========================================

            const winner =
                globalPlayerNames.find(
                    name =>
                        Number(
                            scores[name] || 0
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
// 10. RESET ROUND
// ==========================================

function resetRound() {

    isBattleRunning =
        false;


    playerHandDiv.innerHTML =
        '';


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


    // Player status reset
    db.ref(
        `rooms/${roomId}/players/${playerName}`
    ).update({

        status:
            "JOINED"

    });


    // HOST STARTS NEXT ROUND
    if (isRoomCreator) {

        db.ref(
            `rooms/${roomId}/global_scores`
        ).once(
            'value',
            scoreSnap => {

                const scores =
                    scoreSnap.val() || {};


                const winner =
                    globalPlayerNames.find(
                        name =>
                            Number(
                                scores[name] || 0
                            ) >= 25
                    );


                if (winner) {

                    document.getElementById(
                        'lock-btn'
                    ).innerText =
                        `${winner} WINS!`;

                    return;

                }


                setTimeout(
                    () => {

                        let deck =
                            shuffleDeck(
                                generateDeck()
                            );


                        db.ref(
                            `rooms/${roomId}/current_round`
                        ).set({

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
// 11. SCORE MODAL
// ==========================================

document.getElementById(
    'show-score-btn'
).onclick = () => {

    document.getElementById(
        'scoreboard-modal'
    ).style.display =
        'block';

};


document.getElementById(
    'close-score'
).onclick = () => {

    document.getElementById(
        'scoreboard-modal'
    ).style.display =
        'none';

};


// ==========================================
// 12. HISTORY MODAL
// ==========================================

document.getElementById(
    'show-history-btn'
).onclick = () => {

    document.getElementById(
        'history-modal'
    ).style.display =
        'block';

};


document.getElementById(
    'close-history'
).onclick = () => {

    document.getElementById(
        'history-modal'
    ).style.display =
        'none';

};
