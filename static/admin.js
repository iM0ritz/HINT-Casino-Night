// Poll the server every 1 second (1000ms)
setInterval(fetchState, 1000);

// Fetch the current state immediately on load
fetchState();

async function fetchState() {
    try {
        const response = await fetch('/api/admin/state');
        
        // If the session expired or unauthorized, redirect to login
        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        const data = await response.json();
        updateUI(data);
    } catch (error) {
        console.error("Error fetching state:", error);
    }
}

function updateUI(data) {
    for (let slot = 1; slot <= 3; slot++) {
        const state = data[slot];
        
        // Update live numbers
        document.getElementById(`spins-left-${slot}`).innerText = state.spins_left;
        document.getElementById(`winnings-${slot}`).innerText = state.winnings;

        // Update status badge
        const badge = document.getElementById(`status-${slot}`);
        badge.innerText = state.status.toUpperCase();
        
        // Remove old status classes and add the current one
        badge.className = `status-badge status-${state.status}`;

        // Get all the elements for this specific slot
        const card = document.getElementById(`card-${slot}`);
        const buyinBtn = document.getElementById(`btn-buyin-${slot}`);
        const cashoutBtn = document.getElementById(`btn-cashout-${slot}`);
        const betInput = document.getElementById(`bet-${slot}`);
        const spinsInput = document.getElementById(`spins-${slot}`);

        if (state.status === 'locked') {
            card.style.borderColor = "var(--accent-red)";
            buyinBtn.disabled = false;
            cashoutBtn.disabled = true;
            betInput.disabled = false;
            spinsInput.disabled = false;
        } else if (state.status === 'unlocked') {
            card.style.borderColor = "var(--accent-green)";
            buyinBtn.disabled = true;
            cashoutBtn.disabled = false;
            betInput.disabled = true;
            spinsInput.disabled = true;
        } else if (state.status === 'finished') {
            card.style.borderColor = "var(--accent-orange)";
            buyinBtn.disabled = true;
            cashoutBtn.disabled = false; 
            betInput.disabled = true;
            spinsInput.disabled = true;
        }
    }
}

// Dynamically calculate the cost of a buy-in and enforce maximum limits
function calculateTotal(slotId) {
    const betInput = document.getElementById(`bet-${slotId}`);
    const spinsInput = document.getElementById(`spins-${slotId}`);
    const totalDisplay = document.getElementById(`total-cost-${slotId}`);

    if (betInput && spinsInput && totalDisplay) {
        if (parseInt(betInput.value) > 100000) {
            betInput.value = 100000;
        }
        if (parseInt(spinsInput.value) > 100) {
            spinsInput.value = 100;
        }

        // Parse the inputs for the math (default to 0 if empty)
        const betValue = parseInt(betInput.value) || 0;
        const spinsValue = parseInt(spinsInput.value) || 0;
        
        totalDisplay.innerText = betValue * spinsValue;
    }
}

async function buyIn(slotId) {
    const bet = document.getElementById(`bet-${slotId}`).value;
    const spins = document.getElementById(`spins-${slotId}`).value;

    if (!bet || !spins || bet <= 0 || spins <= 0) {
        alert("Please enter valid bet and spin amounts.");
        return;
    }

    try {
        const response = await fetch('/api/admin/buyin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slot_id: slotId, bet: bet, spins: spins })
        });
        
        if (response.ok) {
            fetchState(); // Instantly update UI without waiting for next poll
        } else {
            alert("Error unlocking machine.");
        }
    } catch (error) {
        console.error("Error during buy-in:", error);
    }
}

async function cashOut(slotId) {
    if (confirm(`Did you cash out Slot ${slotId}?`)) {
        try {
            const response = await fetch('/api/admin/cashout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slot_id: slotId })
            });
            
            if (response.ok) {
                fetchState(); 
            } else {
                alert("Error cashing out machine.");
            }
        } catch (error) {
            console.error("Error during cashout:", error);
        }
    }
}