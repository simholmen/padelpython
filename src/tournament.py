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
        num_full_groups = num_players // 4
        remainder = num_players % 4
        for i in range(0, num_full_groups * 4, 4):
            p1, p2, p3, p4 = players[i], players[i+1], players[i+2], players[i+3]
            print(f"Kamp {(i//4)+1}: {p1.name} & {p3.name} MOT {p2.name} & {p4.name}:")
        if remainder == 1:
            self._handle_walkover(players[-1])
        elif remainder == 2:
            self._handle_remainder_double(players[-2], players[-1])
        elif remainder == 3:
            self._handle_remainder_triple(players[-3], players[-2], players[-1])
        ferdig = input("Har kampene blitt spilt? y/n: ")
        if ferdig.lower() != "y":
            print("OK, går tilbake")
            return
        self.handle_matches(num_full_groups)
        if remainder == 2:
            self.handle_remainder_singlematch(players[-2], players[-1])
        elif remainder == 1:
            self._handle_walkover(players[-1], add_win=True)
        elif remainder == 3:
            self.handle_remainder_singlematch(players[-3], players[-2])
            self._handle_walkover(players[-1], add_win=True)
        self.sort_players()
        fortsett = input("Fortsett turnering eller vis resultater? y/n?: ")
        if fortsett == "n":
            for player in self.players:
                player.print_standings()

    def _handle_walkover(self, player, add_win=False):
        print(f"{player.name} får walkover!")
        if add_win:
            player.add_win()

    def _handle_remainder_double(self, p1, p2):
        print(f"Ekstra kamp: {p1.name} MOT {p2.name}")

    def _handle_remainder_triple(self, p1, p2, p3):
        print(f"Ekstra kamp: {p1.name} MOT {p2.name}")
        print(f"{p3.name} får walkover!")

    def handle_matches(self, num_full_groups):
        for i in range(0, num_full_groups * 4, 4):
            p1, p2, p3, p4 = self.players[i], self.players[i+1], self.players[i+2], self.players[i+3]
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

    def handle_remainder_singlematch(self, p1, p2):
        print(f"Ekstra kamp: {p1.name} mot {p2.name}")
        won = input(f"Hvem vant? (1) {p1.name} eller (2) {p2.name}: ")
        if won == "1":
            p1.add_win()
        else:
            p2.add_win()
        winpoeng = int(input(f"Hva ble poengsummen til vinneren?: "))
        tappoeng = int(input(f"Hva ble poengsummen til taperen?: "))
        if won == "1":
            p1.add_winnerscore(tappoeng)
            p2.add_looserscore(tappoeng)
        else:
            p2.add_winnerscore(tappoeng)
            p1.add_looserscore(tappoeng)

