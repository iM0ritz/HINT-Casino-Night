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

async function spinReels() {
    isSpinning = true;
    document.getElementById("spin-button").disabled = true;
    document.getElementById("win-message").innerHTML = "&nbsp;"; 

    // Reset all reels to the default grey border while spinning
    document.getElementById("reel-1").className = "reel";
    document.getElementById("reel-2").className = "reel";
    document.getElementById("reel-3").className = "reel";

    const spinSpeed = 75; 
    let spin1 = setInterval(() => document.getElementById("img-1").src = getRandomSymbol(), spinSpeed);
    let spin2 = setInterval(() => document.getElementById("img-2").src = getRandomSymbol(), spinSpeed);
    let spin3 = setInterval(() => document.getElementById("img-3").src = getRandomSymbol(), spinSpeed);

    try {
        const response = await fetch(`/api/slot/${currentSlotId}/spin`, { method: 'POST' });
        const result = await response.json();

        if (result.error) {
            alert(result.error);
            clearInterval(spin1); clearInterval(spin2); clearInterval(spin3);
            isSpinning = false;
            return;
        }

        let stopTime1 = 1000;  
        let stopTime2 = 2000; 
        let stopTime3 = 3000; 

        if (result.symbols[0] === "B" && result.symbols[1] === "B") {
            stopTime3 += 500; 
        }

        if (result.symbols[0] === "A" && result.symbols[1] === "A") {
            stopTime3 += 1500; 
        }

        // Stop Reel 1
        setTimeout(() => {
            clearInterval(spin1);
            document.getElementById("img-1").src = ASSETS[result.symbols[0]];
            // NEW: Add the dynamic border color class
            document.getElementById("reel-1").classList.add(BORDER_CLASSES[result.symbols[0]]);
        }, stopTime1);

        // Stop Reel 2
        setTimeout(() => {
            clearInterval(spin2);
            document.getElementById("img-2").src = ASSETS[result.symbols[1]];
            // NEW: Add the dynamic border color class
            document.getElementById("reel-2").classList.add(BORDER_CLASSES[result.symbols[1]]);
        }, stopTime2);

        // Stop Reel 3 and finish game
        setTimeout(() => {
            clearInterval(spin3);
            document.getElementById("img-3").src = ASSETS[result.symbols[2]];
            document.getElementById("reel-3").classList.add(BORDER_CLASSES[result.symbols[2]]);

            if (result.win_amount > 0) {
                let winText = "";
                if (result.symbols[0] === "A") {
                    winText = `JAAACKPOT!<br>+${result.win_amount} COINS`;
                } else if (result.symbols[0] === "B") {
                    winText = `BIG WIN!<br>+${result.win_amount} COINS`;
                } else {
                    winText = `WIN!<br>+${result.win_amount} COINS`;
                }
                document.getElementById("win-message").innerHTML = winText;
            }

            // Define what happens AFTER a spin finishes (or after a jackpot ends)
            const finishSpinRoutine = () => {
                // Update stats
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
                // It's a jackpot! Turn off autospin and trigger the epic animation.
                if (isAutoSpinning) toggleAutoSpin();
                playJackpotRollup(result.win_amount, finishSpinRoutine);
            } else {
                // Normal win or loss, finish immediately
                finishSpinRoutine();
            }
        }, stopTime3);

    } catch (error) {
        console.error("Error during spin:", error);
        clearInterval(spin1); clearInterval(spin2); clearInterval(spin3);
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