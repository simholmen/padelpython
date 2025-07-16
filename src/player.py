class Player:
    def __init__(self, name):
        self.name = name
        self.wins = 0
        self.points = 0

    def add_win(self):
        self.wins = self.wins + 1

    def add_winnerscore(self, score):
        self.points = self.points + (21 - score)

    def add_looserscore(self, score):
        self.points = self.points - (21 - score)

    def add_player(self, name):
        self.name.append(name)

    def print_standings(self):
        print(f"Navn: {self.name}")
        print(f"Wins: {self.wins}")
        print(f"Points: {self.points}")

    def print_name(self):
        print(f"Navn: {self.name}")



    