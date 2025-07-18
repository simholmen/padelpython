from flask import Flask, render_template_string, request, redirect, url_for
from player import Player
from tournament import Tournament
from flask import render_template

app = Flask(__name__)
tournament = Tournament()


@app.route("/")
def index():
    return render_template("index.html", players=tournament.players)

@app.route("/add", methods=["POST"])
def add_player():
    name = request.form["name"]
    tournament.add_players(Player(name))
    return redirect(url_for("index"))

@app.route("/remove", methods=["POST"])
def remove_player():
    name = request.form["name"]
    tournament.players = [p for p in tournament.players if p.name != name]
    return redirect(url_for("index"))

@app.route("/start_round", methods=["GET", "POST"])
def start_round():
    matches = []
    num_players = len(tournament.players)
    num_full_groups = num_players // 4
    remainder = num_players % 4
    extra_match = None

    # Prepare matches
    for i in range(0, num_full_groups * 4, 4):
        p1, p2, p3, p4 = tournament.players[i], tournament.players[i+1], tournament.players[i+2], tournament.players[i+3]
        matches.append({
            "team1": f"{p1.name} & {p3.name}",
            "team2": f"{p2.name} & {p4.name}",
            "idx": i // 4
        })

    # Håndetering av runde hvis det er 1 spiller igjen
    walkover_player = None
    if remainder == 1:
        walkover_player = tournament.players[-1]

    # Håndetering av runde hvis det er 2 spiller igjen
    if remainder == 2:
        p1, p2 = tournament.players[-2], tournament.players[-1]
        extra_match = {"p1": p1.name, "p2": p2.name}

    elif remainder == 3:
        walkover_player = tournament.players[-1]
        p1, p2 = tournament.players[-3], tournament.players[-2]
        extra_match = {"p1": p1.name, "p2": p2.name}

    if request.method == "POST":
        # Process submitted results for 2v2 matches
        for match in matches:
            winner = request.form.get(f"winner_{match['idx']}")
            score1 = int(request.form.get(f"score1_{match['idx']}"))
            score2 = int(request.form.get(f"score2_{match['idx']}"))
            # Team 1: idx*4 and idx*4+2, Team 2: idx*4+1 and idx*4+3
            p1 = tournament.players[match['idx']*4]
            p2 = tournament.players[match['idx']*4+1]
            p3 = tournament.players[match['idx']*4+2]
            p4 = tournament.players[match['idx']*4+3]
            if winner == "1":
                p1.add_win()
                p3.add_win()
                p1.add_winnerscore(score2)
                p3.add_winnerscore(score2)
                p2.add_looserscore(score2)
                p4.add_looserscore(score2)
            elif winner == "2":
                p2.add_win()
                p4.add_win()
                p2.add_winnerscore(score1)
                p4.add_winnerscore(score1)
                p1.add_looserscore(score1)
                p3.add_looserscore(score1)

        # Process extra match
        if extra_match:
            winner = request.form.get("winner_extra")
            score1 = int(request.form.get("score1_extra"))
            score2 = int(request.form.get("score2_extra"))
            if winner == "1":
                tournament.players[-2].add_win()
                tournament.players[-2].add_winnerscore(score2)
                tournament.players[-1].add_looserscore(score2)
            elif winner == "2":
                tournament.players[-1].add_win()
                tournament.players[-1].add_winnerscore(score1)
                tournament.players[-2].add_looserscore(score1)
        if walkover_player:
            walkover_player.add_win()
        tournament.sort_players()
        return redirect(url_for("index"))

    return render_template("round.html", matches=matches, extra_match=extra_match, walkover_player=walkover_player)

if __name__ == "__main__":
    app.run(debug=True)