class Player:
    def __init__(self, name):
        self.name = name
        self.wins = 0
        self.points = 0

    def update_wins(self):
        self.wins += 1

    def update_points(self, points):
        self.points += points

    def __repr__(self):
        return f"{self.name}: Wins={self.wins}, Points={self.points}"