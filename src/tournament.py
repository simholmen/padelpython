class Tournament:
    def __init__(self):
        self.players = []

    def add_players(self, player):
        self.players.append(player)

    def sort_players(self):
        self.players.sort(key=lambda p: (p.wins, p.points), reverse=True)

    def handle_match_results(self):
        players = self.players
        num_players = len(players)
        if num_players % 4 != 0:
            print("Antall spillere må være delelig på 4")
        for i in range(0, num_players, 4):
            p1, p2, p3, p4 = players[i], players[i+1], players[i+2], players[i+3]
            print(f"Kamp {(i//4)+1}: {p1.name} & {p3.name} MOT {p2.name} & {p4.name}:")

        ferdig = input("Har kampen blitt spilt? y/n: ")
        if ferdig.lower() != "y":
            print("OK, hopper over denne kampen.")

        for i in range(0, num_players, 4):
            p1, p2, p3, p4 = players[i], players[i+1], players[i+2], players[i+3]
            print(f"Kamp {(i//4)+1}: {p1.name} & {p3.name} MOT {p2.name} & {p4.name}:")
            won = input(f"Hvem vant av (1) {p1.name} og {p3.name} MOT (2) {p2.name} og {p4.name}: ")
            if won == "1":
                p1.add_win()
                p3.add_win()
            else:
                p2.add_win()
                p4.add_win()

            winpoeng = int(input(f"Hva ble poengsummen til {p1.name} & {p3.name}: "))
            tappoeng = int(input(f"Hva ble poengsummen til {p2.name} & {p4.name}: "))
            p1.add_winnerscore(tappoeng)
            p3.add_winnerscore(tappoeng)
            p2.add_looserscore(tappoeng)
            p4.add_looserscore(tappoeng)

        self.sort_players()
        fortsett = input("Fortsett turnering eller vis resultater? y/n?: ")
        if fortsett == "n":
            for player in self.players:
                player.print_standings()
