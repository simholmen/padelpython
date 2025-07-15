from player import Player
from tournament import Tournament

class Main:
    def __init__(self):
        self.tournament = Tournament()

    def start_tournament(self):
        while True:
            print("Legg til personer i turneringen:\n 1. Legg inn navn \n 2. Vis innlagte spillere\n 3. Gå videre \n 4. Avslutt program")
            choise = input("Velg handling: ")
            if choise == "1":
                name = input("Skriv inn navn: ")
                player = Player(name)
                self.tournament.add_players(player)
                print(f"{name} lagt til i turneringen!")
            elif choise == "2":
                for player in self.tournament.players:
                    player.print_name()
            elif choise == "3":
                self.start_game()
            elif choise == "4":
                print("Avslutter")
                break

    def start_game(self):
        while True:
            print("Velg handling:\n 1. Start runde \n 2. Vis spiller-standings \n 3. Tilbake til main menu")
            choise = input("Velg handling: ")
            if choise == "1":
                print(f"Første kamp er {self.tournament.players[0].name} og {self.tournament.players[2].name} mot {self.tournament.players[1].name} og {self.tournament.players[3].name}:")
                ferdig = input("Er kampene ferdig? y/n: ")
                if ferdig == "y":
                    won = input(f"Hvem vant av (1) {self.tournament.players[0].name} og {self.tournament.players[2].name} mot (2){self.tournament.players[1].name} og {self.tournament.players[3].name}: ")
                    if won == "1":
                        self.tournament.players[0].add_win()
                        self.tournament.players[2].add_win()
                    else:
                        self.tournament.players[1].add_win()
                        self.tournament.players[3].add_win()
                elif ferdig == "n":
                    print("OK, starter runde på ny")
                    
            elif choise == "2":
                for player in self.tournament.players:
                    player.print_standings()
            elif choise == "3":
                print("Går tilbake")
                break
                

main = Main()
main.start_tournament()

    # def start_game(self):
    #     while True:
    #         print("Velg handling:\n 1. Start runde \n 2. Vis spiller-standings \n 4. Avslutt")
    #         choise = input("Velg handling: ")
    #         if choise == "1":
    #             name = input("Skriv inn navn: ")
    #             player = Player(name)
    #             self.tournament.add_players(player)
    #             print(f"{name} lagt til i turneringen!")
    #         elif choise == "2":
    #             for player in self.tournament.players:
    #                 player.print_standings()
    #         elif choise == "3":
    #             name = input("Skriv navn på personen som skal få en seier: ")
    #             found = False
    #             for player in self.tournament.players:
    #                 if player.name == name:
    #                     player.add_win()
    #                     print(f"La til en seier for {name}")
    #                     found = True
    #                     break
    #                 else:
    #                     print("Fant ikke spilleren")
    #         elif choise == "4":
    #             print("Avslutter")
    #             break