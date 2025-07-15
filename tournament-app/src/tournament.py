class Tournament:
    def __init__(self):
        self.players = []
        self.teams = []

    def add_player(self, player):
        self.players.append(player)

    def create_teams(self):
        if len(self.players) < 4:
            raise ValueError("Not enough players to form teams.")
        self.teams = [
            (self.players[0], self.players[2]),  # Team 1: Player 1 and Player 3
            (self.players[1], self.players[3])   # Team 2: Player 2 and Player 4
        ]

    def conduct_match(self, team1_score, team2_score):
        if team1_score > team2_score:
            self.teams[0][0].update_wins()
            self.teams[0][1].update_wins()
            self.teams[0][0].update_points(team1_score)
            self.teams[0][1].update_points(team1_score)
        else:
            self.teams[1][0].update_wins()
            self.teams[1][1].update_wins()
            self.teams[1][0].update_points(team2_score)
            self.teams[1][1].update_points(team2_score)

    def sort_players(self):
        self.players.sort(key=lambda p: (-p.wins, -p.points))

    def display_results(self):
        self.sort_players()
        for player in self.players:
            print(f"{player.name}: Wins: {player.wins}, Points: {player.points}")