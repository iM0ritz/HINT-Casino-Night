// Map the server's A, B, C to your actual file paths
const ASSETS = {
    "A": "/static/assets/HINT_Logo.png",
    "B": "/static/assets/HiEd_Logo.png",
    "C": "/static/assets/HIKE_Logo.png"
};
const ALL_SYMBOLS = ["A", "B", "C"];

let isSpinning = false;
let machineStatus = "locked";
let isAutoSpinning = false;
let autoSpinTimeout = null;
let currentSymbols = ["A", "A", "A"];

// Poll the server every 1 second to check for unlocked/cashout states
setInterval(fetchState, 1000);
fetchState();

async function fetchState() {
    // If we are currently in the middle of a spin animation, don't interrupt it
    if (isSpinning) return; 

    try {
        const response = await fetch(`/api/slot/${currentSlotId}/state`);
        const state = await response.json();
        
        updateUI(state);
    } catch (error) {
        console.error("Error fetching state:", error);
    }
}

function updateUI(state) {
    machineStatus = state.status;
    
    document.getElementById("bet-display").innerText = state.bet; 
    document.getElementById("spins-display").innerText = state.spins_left;
    document.getElementById("winnings-display").innerText = state.winnings;

    // Use the bet if active, otherwise default to 0 for a locked machine
    const currentBet = state.bet > 0 ? state.bet : 0; 
    document.getElementById("pay-jackpot").innerText = `3x = ${currentBet * 75} (75x)`;
    document.getElementById("pay-medium").innerText = `3x = ${currentBet * 15} (15x)`;
    document.getElementById("pay-frequent").innerText = `3x = ${currentBet * 2} (2x)`;

    const overlay = document.getElementById("locked-overlay");
    const spinBtn = document.getElementById("spin-button");
    const autoBtn = document.getElementById("autospin-button");
    const overlayText = document.getElementById("overlay-text");
    const overlaySubtext = document.getElementById("overlay-subtext");

    if (state.status === "locked") {
        overlay.style.display = "flex";
        overlayText.innerText = "MACHINE LOCKED";
        overlayText.style.color = "var(--accent-red)";
        overlaySubtext.innerText = "Please see the Admin to Buy-In.";
        spinBtn.disabled = true;
        autoBtn.disabled = true;
        if (isAutoSpinning) toggleAutoSpin();
    } else if (state.status === "finished") {
        overlay.style.display = "flex";
        overlayText.innerText = "OUT OF SPINS!";
        overlayText.style.color = "var(--accent-orange)";
        overlaySubtext.innerText = "Please see the Admin to collect your winnings!";
        spinBtn.disabled = true;
        autoBtn.disabled = true;
        if (isAutoSpinning) toggleAutoSpin();
    } else {
        // Unlocked state
        overlay.style.display = "none";
        spinBtn.disabled = false;
        autoBtn.disabled = false;
        if (isAutoSpinning) {
            spinBtn.disabled = true;
        } else {
            spinBtn.disabled = false;
        }
    }
}

// Allow Spacebar to trigger the spin
document.addEventListener("keydown", function(event) {
    if (event.code === "Space") {
        event.preventDefault(); // Prevent page scrolling
        if (!isSpinning && machineStatus === "unlocked") {
            spinReels();
        }
    }
});

// Helper function to pick a random visual symbol while spinning
let lastSymbolKey = "";
function getRandomSymbol() {
    const availableSymbols = ALL_SYMBOLS.filter(sym => sym !== lastSymbolKey);
    const randomPick = availableSymbols[Math.floor(Math.random() * availableSymbols.length)];
    lastSymbolKey = randomPick;
    return ASSETS[randomPick];
}

function toggleAutoSpin() {
    isAutoSpinning = !isAutoSpinning;
    const autoBtn = document.getElementById("autospin-button");
    const spinBtn = document.getElementById("spin-button");
    
    if (isAutoSpinning) {
        autoBtn.classList.add("active");
        autoBtn.innerText = "AUTO ON";
        spinBtn.disabled = true; // Disable manual spin while auto is running
        
        // If not currently spinning, start the loop immediately
        if (!isSpinning && machineStatus === "unlocked") {
            spinReels();
        }
    } else {
        autoBtn.classList.remove("active");
        autoBtn.innerText = "AUTO OFF";
        if (!isSpinning && machineStatus === "unlocked") {
            spinBtn.disabled = false; // Re-enable manual spin
        }
        if (autoSpinTimeout) clearTimeout(autoSpinTimeout);
    }
}

const BORDER_CLASSES = {
    "A": "reel-gold",    // Jackpot
    "B": "reel-silver",  // Medium
    "C": "reel-bronze"   // Frequent
};

// Helper function to handle the physical sliding of the reel strip
function animateStrip(stripId, targetSymbol, duration, extraSpins) {
    const strip = document.getElementById(stripId);
    const reelIndex = parseInt(stripId.split('-')[1]) - 1; // Gets 0, 1, or 2
    const currentSymbolKey = currentSymbols[reelIndex];

    // 1. Build the strip: Start with what is currently on screen to avoid jumping
    let stripHTML = `<img src="${ASSETS[currentSymbolKey]}" class="symbol-img">`;
    
    // 2. Add a bunch of random symbols to create the "blur" effect
    const numBlurSymbols = 15 + extraSpins; // Reels 2 and 3 get more blur symbols to spin longer
    for (let i = 0; i < numBlurSymbols; i++) {
        stripHTML += `<img src="${getRandomSymbol()}" class="symbol-img">`;
    }
    
    // 3. Add the actual target symbol at the very bottom
    stripHTML += `<img src="${ASSETS[targetSymbol]}" class="symbol-img">`;

    // Reset the strip instantly to the top
    strip.innerHTML = stripHTML;
    strip.style.transition = "none";
    strip.style.transform = "translateY(0)";

    // Force the browser to register the reset before animating
    void strip.offsetHeight; 

    // Calculate how far down to pull the strip (200px height per symbol)
    const targetY = -(numBlurSymbols + 1) * 200; 

    // 4. Trigger the physical slide! (The bezier curve adds a slight mechanical bounce at the end)
    strip.style.transition = `transform ${duration}ms cubic-bezier(0.1, 0.8, 0.2, 1.05)`;
    strip.style.transform = `translateY(${targetY}px)`;
}


async function spinReels() {
    isSpinning = true;
    document.getElementById("spin-button").disabled = true;
    
    const winMsg = document.getElementById("win-message");
    winMsg.classList.remove("show"); 
    setTimeout(() => {
        if (isSpinning) winMsg.innerHTML = "&nbsp;"; 
    }, 400);

    document.getElementById("reel-1").className = "reel";
    document.getElementById("reel-2").className = "reel";
    document.getElementById("reel-3").className = "reel";

    try {
        const response = await fetch(`/api/slot/${currentSlotId}/spin`, { method: 'POST' });
        const result = await response.json();

        if (result.error) {
            alert(result.error);
            isSpinning = false;
            return;
        }

        let stopTime1 = 1500;  
        let stopTime2 = 2500; 
        let stopTime3 = 3500; 

        // Base amount of extra symbols to create the blur
        let extraSpins1 = 0;
        let extraSpins2 = 10;
        let extraSpins3 = 20;

        // Anticipation Tease Logic: Add both TIME and SYMBOLS to keep speed constant!
        if (result.symbols[0] === "B" && result.symbols[1] === "B") {
            stopTime3 += 1500; // Add 1.5 seconds of suspense
            extraSpins3 += 25; // Add 25 more symbols so it spins just as fast
        }
        if (result.symbols[0] === "A" && result.symbols[1] === "A") {
            stopTime3 += 3000; // Add 3 full seconds of suspense for a Jackpot tease
            extraSpins3 += 50; // Add 50 more symbols
        }

        if (result.symbols[0] !== result.symbols[1]) {
            stopTime3 -= 500;
        }

        // Start the physical spin animations!
        animateStrip('strip-1', result.symbols[0], stopTime1, extraSpins1);
        animateStrip('strip-2', result.symbols[1], stopTime2, extraSpins2);
        animateStrip('strip-3', result.symbols[2], stopTime3, extraSpins3);

        // Turn on the glowing borders the exact moment each reel lands
        setTimeout(() => document.getElementById("reel-1").classList.add(BORDER_CLASSES[result.symbols[0]]), stopTime1);
        setTimeout(() => document.getElementById("reel-2").classList.add(BORDER_CLASSES[result.symbols[1]]), stopTime2);

        // Final reel stops
        setTimeout(() => {
            document.getElementById("reel-3").classList.add(BORDER_CLASSES[result.symbols[2]]);

            // Save what just landed so the next spin starts correctly
            currentSymbols = result.symbols;

            if (result.win_amount > 0) {
                let winText = "";
                if (result.symbols[0] === "A") winText = `JAAACKPOT!<br>+${result.win_amount} COINS`;
                else if (result.symbols[0] === "B") winText = `BIG WIN!<br>+${result.win_amount} COINS`;
                else winText = `WIN!<br>+${result.win_amount} COINS`;
                document.getElementById("win-message").innerHTML = winText;
                void winMsg.offsetWidth; 
                winMsg.classList.add("show");
            }

            const finishSpinRoutine = () => {
                document.getElementById("spins-display").innerText = result.spins_left;
                document.getElementById("winnings-display").innerText = result.total_winnings;

                if (result.status === "unlocked") {
                    isSpinning = false;
                    
                    if (isAutoSpinning) {
                        let delay = 500; 
                        if (result.win_amount > 0) {
                            if (result.symbols[0] === "C") delay = 1500;
                            else if (result.symbols[0] === "B") delay = 2500;
                        }
                        
                        autoSpinTimeout = setTimeout(() => {
                            if (isAutoSpinning && machineStatus === "unlocked") spinReels();
                        }, delay);
                    } else {
                        document.getElementById("spin-button").disabled = false;
                    }
                } else {
                    setTimeout(() => { isSpinning = false; fetchState(); }, 3000);
                }
            };

            // INTERCEPT THE JACKPOT
            if (result.win_amount > 0 && result.symbols[0] === "A") {
                if (isAutoSpinning) toggleAutoSpin();
                playJackpotRollup(result.win_amount, finishSpinRoutine);
            } else {
                finishSpinRoutine();
            }

        }, stopTime3);

    } catch (error) {
        console.error("Error during spin:", error);
        isSpinning = false;
    }
}

// --- JACKPOT ANIMATION LOGIC ---
function playJackpotRollup(winAmount, onCompleteCallback) {
    const overlay = document.getElementById("jackpot-overlay");
    const counter = document.getElementById("jackpot-counter");
    const coinContainer = document.getElementById("coin-container");
    const layout = document.querySelector(".game-layout"); 
    const continueText = document.getElementById("jackpot-continue"); // NEW
    
    if (!overlay || !counter || !coinContainer) {
        console.error("JACKPOT ERROR: Missing HTML elements!");
        onCompleteCallback(); 
        return; 
    }

    // Setup & Show Overlay
    overlay.classList.remove("hidden");
    counter.classList.remove("jackpot-pop");
    if (continueText) continueText.classList.add("hidden"); // Ensure it's hidden at start
    if (layout) layout.classList.add("rumble"); 
    
    let startTime = null;
    const duration = 5000;
    
    // Start Coin Fountain
    let coinInterval = setInterval(() => {
        const coin = document.createElement("div");
        coin.classList.add("falling-coin");
        coin.style.left = Math.random() * 100 + "vw"; 
        coin.style.animationDuration = (Math.random() * 1 + 1.5) + "s";
        coinContainer.appendChild(coin);
        setTimeout(() => coin.remove(), 2500); 
    }, 50); 

    // The Number Roll-Up Animation
    function updateCounter(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        counter.innerText = Math.floor(progress * winAmount);
        
        // Scale up to 3.5x size
        counter.style.transform = `scale(${1 + (progress * 2.5)})`;

        if (progress < 1) {
            requestAnimationFrame(updateCounter); 
        } else {
            // THE CLIMAX
            clearInterval(coinInterval); 
            if (layout) layout.classList.remove("rumble"); 
            counter.innerText = winAmount; 
            counter.classList.add("jackpot-pop"); 
            
            // Show the "Press Space" text
            if (continueText) continueText.classList.remove("hidden");

            // Create a specific listener just to close the overlay
            const spaceToCloseListener = function(event) {
                if (event.code === "Space") {
                    event.preventDefault(); // Stop page scrolling
                    
                    // Remove this listener so it doesn't fire again
                    document.removeEventListener("keydown", spaceToCloseListener);
                    
                    // Hide the overlay and clean up
                    overlay.classList.add("hidden");
                    counter.style.transform = "scale(1)"; 
                    counter.classList.remove("jackpot-pop");
                    coinContainer.innerHTML = ""; 
                    
                    // Tell the game to finish the spin and unlock the buttons!
                    onCompleteCallback(); 
                }
            };
            
            // Attach the listener
            document.addEventListener("keydown", spaceToCloseListener);
        }
    }
    
    requestAnimationFrame(updateCounter);
}