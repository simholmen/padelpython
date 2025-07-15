class Team:
    def __init__(self, player1, player3, player2, player4):
        self.members = [player1, player3, player2, player4]

    def get_team_members(self):
        return self.members

    def calculate_total_wins(self):
        return sum(player.wins for player in self.members)

    def calculate_total_points(self):
        return sum(player.points for player in self.members)

    def display_team_info(self):
        team_info = {
            "members": [player.name for player in self.members],
            "total_wins": self.calculate_total_wins(),
            "total_points": self.calculate_total_points()
        }
        return team_info