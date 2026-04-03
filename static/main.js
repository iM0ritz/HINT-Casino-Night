// Map the server's A, B, C to your actual file paths
const ASSETS = {
    "A": "/static/assets/HINT_Logo.png",
    "B": "/static/assets/HiEd_Logo.png",
    "C": "/static/assets/HIKE_Logo.png"
};
const ALL_SYMBOLS = ["A", "B", "C"];

let isSpinning = false;
let machineStatus = "locked";

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

    const overlay = document.getElementById("locked-overlay");
    const spinBtn = document.getElementById("spin-button");
    const overlayText = document.getElementById("overlay-text");

    if (state.status === "locked") {
        overlay.style.display = "flex";
        overlayText.innerText = "MACHINE LOCKED";
        overlayText.style.color = "var(--accent-red)";
        spinBtn.disabled = true;
    } else if (state.status === "finished") {
        overlay.style.display = "flex";
        overlayText.innerText = "OUT OF SPINS!";
        overlayText.style.color = "var(--accent-orange)";
        spinBtn.disabled = true;
    } else {
        // Unlocked state
        overlay.style.display = "none";
        spinBtn.disabled = false;
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

async function spinReels() {
    isSpinning = true;
    document.getElementById("spin-button").disabled = true;
    document.getElementById("win-message").innerText = "";

    // 1. Start the visual animation
    const visualSpin = setInterval(() => {
        document.getElementById("img-1").src = ASSETS[ALL_SYMBOLS[Math.floor(Math.random() * 3)]];
        document.getElementById("img-2").src = ASSETS[ALL_SYMBOLS[Math.floor(Math.random() * 3)]];
        document.getElementById("img-3").src = ASSETS[ALL_SYMBOLS[Math.floor(Math.random() * 3)]];
    }, 100);

    // 2. Fetch the actual math result from the secure Python server
    try {
        const response = await fetch(`/api/slot/${currentSlotId}/spin`, { method: 'POST' });
        const result = await response.json();

        if (result.error) {
            alert(result.error);
            clearInterval(visualSpin);
            isSpinning = false;
            return;
        }

        // 3. Stop the animation after 1.5 seconds and show the real result
        setTimeout(() => {
            clearInterval(visualSpin);
            
            // Set final images
            document.getElementById("img-1").src = ASSETS[result.symbols[0]];
            document.getElementById("img-2").src = ASSETS[result.symbols[1]];
            document.getElementById("img-3").src = ASSETS[result.symbols[2]];

            // Display win message if applicable
            if (result.win_amount > 0) {
                document.getElementById("win-message").innerText = `WINNER! +${result.win_amount} COINS`;
            }

            // Update stats visually right away
            document.getElementById("spins-display").innerText = result.spins_left;
            document.getElementById("winnings-display").innerText = result.total_winnings;

            isSpinning = false;
            
            // Re-enable button if they still have spins
            if (result.status === "unlocked") {
                document.getElementById("spin-button").disabled = false;
            } else {
                fetchState(); // Force a state update to show the "Finished" overlay
            }
            
        }, 1500); // 1.5 seconds of suspense!

    } catch (error) {
        console.error("Error during spin:", error);
        clearInterval(visualSpin);
        isSpinning = false;
    }
}