def sort_players(players):
    return sorted(players, key=lambda player: (-player.wins, -player.points))

def display_results(players):
    sorted_players = sort_players(players)
    print("Tournament Results:")
    for player in sorted_players:
        print(f"{player.name}: Wins: {player.wins}, Points: {player.points}")

def format_team(team):
    return " vs ".join(player.name for player in team)