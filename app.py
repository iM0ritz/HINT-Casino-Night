from flask import Flask, render_template, request, jsonify, session, redirect, url_for
import random

app = Flask(__name__)

# TODO: Add calculation for buy in
# TODO: Add dopamine (e.g. for jackpot add overlay that counts up winnings while flashing lights)

# --- SECURITY SETTINGS ---
# A secret key is required by Flask to encrypt the session cookies. 
app.secret_key = "4758737527f9e7368890104f054968d6"
ADMIN_PIN = "6767" # The hardcoded PIN to access the admin page

# --- 1. GLOBAL STATE MANAGEMENT ---
# This dictionary tracks the live state of all 3 laptops.
# Status can be: "locked", "unlocked" (playing), or "finished" (out of spins).
slots_state = {
    1: {"status": "locked", "spins_left": 0, "bet": 0, "winnings": 0},
    2: {"status": "locked", "spins_left": 0, "bet": 0, "winnings": 0},
    3: {"status": "locked", "spins_left": 0, "bet": 0, "winnings": 0}
}

# --- 2. GAME MATH & PROBABILITIES ---
# The payouts (Multiplier per coin bet)
PAYOUTS = {
    "A": 75, # Jackpot
    "B": 15, # Medium
    "C": 2   # Frequent
}

# Unbalanced Reel Math (Weights are percentages)
# Reels 1 & 2 (The Tease Reels)
REELS_1_2_SYMBOLS = ["A", "B", "C"]
REELS_1_2_WEIGHTS = [20, 25, 55]

# Reel 3 (The Heartbreaker Reel)
REEL_3_SYMBOLS = ["A", "B", "C"]
REEL_3_WEIGHTS = [10, 30, 60]


# --- 3. PAGE ROUTES (HTML) ---
@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        if request.form.get('pin') == ADMIN_PIN:
            session['logged_in'] = True
            return redirect(url_for('admin_page'))
        else:
            error = "Invalid PIN. Try again."
    return render_template('login.html', error=error)

@app.route('/admin')
def admin_page():
    # If the admin isn't logged in, redirect them to the login screen
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    return render_template('admin.html')

@app.route('/slot/<int:slot_id>')
def slot_page(slot_id):
    if slot_id not in slots_state:
        return "Invalid Slot ID. Please use 1, 2, or 3.", 404
    return render_template('slot.html', slot_id=slot_id)


# --- 4. ADMIN API ENDPOINTS ---
@app.route('/api/admin/state', methods=['GET'])
def get_admin_state():
    # Allows the admin page to poll and see the live status of all slots
    return jsonify(slots_state)

@app.route('/api/admin/buyin', methods=['POST'])
def admin_buyin():
    data = request.json
    slot_id = int(data.get('slot_id'))
    
    if slot_id in slots_state:
        slots_state[slot_id]["status"] = "unlocked"
        slots_state[slot_id]["spins_left"] = int(data.get('spins'))
        slots_state[slot_id]["bet"] = int(data.get('bet'))
        slots_state[slot_id]["winnings"] = 0 # Reset winnings for new game
        return jsonify({"success": True})
    return jsonify({"error": "Invalid slot ID"}), 400

@app.route('/api/admin/cashout', methods=['POST'])
def admin_cashout():
    data = request.json
    slot_id = int(data.get('slot_id'))
    
    if slot_id in slots_state:
        # Reset the machine for the next player
        slots_state[slot_id]["status"] = "locked"
        slots_state[slot_id]["spins_left"] = 0
        slots_state[slot_id]["bet"] = 0
        slots_state[slot_id]["winnings"] = 0
        return jsonify({"success": True})
    return jsonify({"error": "Invalid slot ID"}), 400


# --- 5. SLOT MACHINE API ENDPOINTS ---
@app.route('/api/slot/<int:slot_id>/state', methods=['GET'])
def get_slot_state(slot_id):
    # Allows the individual slot laptop to poll and see if it's unlocked
    if slot_id in slots_state:
        return jsonify(slots_state[slot_id])
    return jsonify({"error": "Invalid slot ID"}), 404

@app.route('/api/slot/<int:slot_id>/spin', methods=['POST'])
def spin_slot(slot_id):
    if slot_id not in slots_state:
        return jsonify({"error": "Invalid slot ID"}), 400

    slot = slots_state[slot_id]

    # Security check: Make sure they are allowed to spin
    if slot["status"] != "unlocked" or slot["spins_left"] <= 0:
        return jsonify({"error": "Machine is locked or out of spins"}), 403

    # Deduct a spin
    slot["spins_left"] -= 1

    # Server-Side RNG: Roll the reels using our specific weights
    r1 = random.choices(REELS_1_2_SYMBOLS, weights=REELS_1_2_WEIGHTS, k=1)[0]
    r2 = random.choices(REELS_1_2_SYMBOLS, weights=REELS_1_2_WEIGHTS, k=1)[0]
    r3 = random.choices(REEL_3_SYMBOLS, weights=REEL_3_WEIGHTS, k=1)[0]

    result_symbols = [r1, r2, r3]
    win_amount = 0

    # Check for a win (3 of a kind)
    if r1 == r2 == r3:
        win_amount = slot["bet"] * PAYOUTS[r1]
        slot["winnings"] += win_amount

    # If spins hit 0, change status so the laptop knows to show the "Cashout" screen
    if slot["spins_left"] == 0:
        slot["status"] = "finished"

    # Send the results back to the frontend for animation
    return jsonify({
        "success": True,
        "symbols": result_symbols,
        "win_amount": win_amount,
        "total_winnings": slot["winnings"],
        "spins_left": slot["spins_left"],
        "status": slot["status"]
    })

if __name__ == '__main__':
    # host='0.0.0.0' is crucial! It allows the 3 laptops to connect to the Admin computer over Wi-Fi
    app.run(host='0.0.0.0', port=5000, debug=True)