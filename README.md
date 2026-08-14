# Wakfu Companion

Application de bureau (Windows) qui accompagne les joueurs de [Wakfu](https://www.wakfu.com/) en
lisant en local le fichier `wakfu.log` généré par le jeu, pour en déduire certains événements
(connexion à un serveur, quêtes rencontrées ou terminées, hauts faits débloqués) et notifier
l'utilisateur.

L'application ne fait que de la **lecture passive** du fichier de log : pas d'automatisation
d'actions en jeu, pas de lecture mémoire ou réseau.

## Fonctionnalités

- **Détection de serveur** : affiche automatiquement le serveur sur lequel le joueur est connecté.
- **Suivi de quêtes environnementales** : suivez des quêtes par leur nom exact et recevez une
  notification quand elles sont rencontrées ou terminées.
- **Exploits** : regroupez des quêtes environnementales et des archimonstres en objectifs
  composés, avec suivi de progression.
- **Timers personnels** : créez des timers avec notification système à échéance.
- **Comptes et amis** (optionnel) : créez un compte pour suivre vos niveaux de métiers, voir ceux
  de vos amis, et synchroniser vos données entre plusieurs appareils.
- **Archimonstres** : référentiel partagé (nom, niveau, zone) avec suivi personnel des
  archimonstres actuellement recherchés.
- **Mise à jour automatique** et **thème clair/sombre** inspiré de l'identité visuelle Wakfu.

## Téléchargement

Les installeurs Windows sont disponibles sur la page
[Releases](https://github.com/gbtclement/WakfuCompanion/releases) de ce dépôt.

L'application intègre une mise à jour automatique — inutile de revenir ici à chaque nouvelle
version.

## Respect des CGU Ankama

- Lecture passive uniquement du fichier de log local.
- Aucune automatisation d'action en jeu.
- Aucune lecture mémoire ou réseau du client de jeu.
- Aucune donnée d'identification du joueur stockée ou transmise.

## Support

Pour un bug ou une suggestion, ouvre une [issue](https://github.com/gbtclement/WakfuCompanion/issues).
