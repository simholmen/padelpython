from player import Player
from tournament import Tournament

class Main:
    def __init__(self):
        self.tournament = Tournament()

    def start_tournament(self):
        while True:
            print("Velg handling:\n 1. Legg inn navn \n 2. Vis innlagte spillere\n 3. Gå videre \n 4. Avslutt program")
            choise = input("Velg handling: ")
            if choise == "1":
                while True:
                    name = input("Skriv inn navn: ")
                    if name == "ferdig":
                        break
                    player = Player(name)
                    self.tournament.add_players(player)
                    print(f"{name} lagt til i turneringen! Skriv ferdig for å avslutte")
            elif choise == "2":
                for player in self.tournament.players:
                    player.print_name()
                print (f"{len(self.tournament.players)} spillere er med i turneringen!")
            elif choise == "3":
                self.start_game()
            elif choise == "4":
                print("Avslutter")
                break

    def start_game(self):
        while True:
            print("Velg handling:\n 1. Start runde \n 2. Vis spiller-standings \n 3. Tilbake til main menu \n 4. Avslutt")
            choise = input("Velg handling: ")
            if choise == "1":
                self.tournament.handle_match_results()
            elif choise == "2":
                for player in self.tournament.players:
                    player.print_standings()
            elif choise == "3":
                print("Går tilbake")
                break
            elif choise == "4":
                print("Avslutter")
                break

main = Main()
main.start_tournament()