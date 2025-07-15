# tournament-app/src/main.py

def main():
    players = []
    while True:
        name = input("Enter player name (or 'done' to finish): ")
        if name.lower() == 'done':
            break
        players.append({'name': name, 'wins': 0, 'points': 0})

    tournament = Tournament(players)
    tournament.run()

class Tournament:
    def __init__(self, players):
        self.players = players

    def run(self):
        while len(self.players) >= 4:
            self.create_teams()
            self.conduct_matches()
            self.display_results()

    def create_teams(self):
        self.teams = [
            (self.players[0], self.players[2]),
            (self.players[1], self.players[3])
        ]

    def conduct_matches(self):
        print("Lag 1:", self.teams[0][0]['name'], "og", self.teams[0][1]['name'])
        print("Lag 2:", self.teams[1][0]['name'], "og", self.teams[1][1]['name'])
        winner = input("Hvilket lag vant? (1/2): ")
        points1 = int(input("Poeng til lag 1: "))
        points2 = int(input("Poeng til lag 2: "))

        # Legg til poeng til alle spillere
        for player in self.teams[0]:
            player['points'] += points1
        for player in self.teams[1]:
            player['points'] += points2

        # Øk wins for vinnerlaget
        if winner == "1":
            for player in self.teams[0]:
                player['wins'] += 1
        elif winner == "2":
            for player in self.teams[1]:
                player['wins'] += 1
            # Oppdater kun vinnerlaget og poeng

    def simulate_match(self, team):
        # Placeholder for match simulation logic
        return 1  # Assume team wins

    def calculate_points(self, wins):
        return wins * 10  # Example point calculation

    def display_results(self):
        sorted_players = sorted(self.players, key=lambda x: (-x['wins'], -x['points']))
        print("Current standings:")
        for player in sorted_players:
            print(f"{player['name']}: Wins: {player['wins']}, Points: {player['points']}")

if __name__ == "__main__":
    main()