export const SERVER_CONNECTION_LINES = {
  dispatcher: ' INFO 18:26:45,738 [AWT-EventQueue-0] (aVj:62) - Connexion au proxy :wakfu-dispatcher.ankama-games.com:5558 / ssl : true',
  ogrest: ' INFO 18:26:49,060 [AWT-EventQueue-0] (aVj:62) - Connexion au proxy :wakfu-ogrest.ankama-games.com:5556 / ssl : true'
}

export const QUEST_COMPLETED_LINES = {
  won: ' INFO 18:22:57,585 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Vous venez de remporter la quête "Course : Salbatroce Voyageur"',
  failed: ' INFO 20:05:36,472 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Quête échouée: "Collaboratif : Hordes de Vandaliénés"'
}

export const ACHIEVEMENT_LINES = {
  activated: ' INFO 16:29:51,226 [AWT-EventQueue-0] (ber:341) - Achievement activated : 4267',
  objectiveCompleted: ' INFO 21:03:16,003 [AWT-EventQueue-0] (ber:318) - Achievement objective completed : 9388'
}

export const JOB_LEVEL_UP_LINES = {
  trappeurSingleLevel:
    ' INFO 20:04:47,496 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Trappeur : +1 041 points d\'XP.  +1 niveau. Prochain niveau dans : 20 796.',
  mineurMultiLevel:
    ' INFO 09:12:03,001 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Mineur : +12 500 points d\'XP.  +3 niveaux. Prochain niveau dans : 5 200.',
  unknownJob:
    ' INFO 11:00:00,000 [AWT-EventQueue-0] (aPV:174) - [Information (jeu)] Astrologue : +500 points d\'XP.  +1 niveau. Prochain niveau dans : 100.'
}

export const UNRELATED_LINES = [
  ' WARN 20:05:40,092 [AWT-EventQueue-0] (ME:157) - Unable to get value for key content.151.10001',
  ' INFO 20:05:41,264 [AWT-EventQueue-0] (ftK:272) - Update de chaos du protecteur 311, chaos = false'
]
