# RacsoR Apps Script

Projet Google Apps Script pour la gestion de locations Carrefour.

## Contenu

- `appsscript.json` : manifest Apps Script
- `src/*.gs` : logique serveur
- `ui/*.html` : WebApp
- `specifications.md` : spec fonctionnel

## Demarrage

1. Cree un projet Apps Script ou connecte ce dossier via `clasp`.
2. Associe le projet a un Google Spreadsheet qui servira de base.
3. Definis les Script Properties si besoin :
   - `RACSOR_SPREADSHEET_ID`
   - `RACSOR_DRIVE_ROOT_FOLDER_ID`
   - `RACSOR_CONTRACT_TEMPLATE_ID`
   - `RACSOR_CALENDAR_ID`
4. Execute `initializeProject`.
5. Execute `seedDemoUsersIfMissing` si tu veux des roles de test.
6. Deploie la WebApp.

## Fonctions utiles

- `initializeProject()`
- `seedDemoUsersIfMissing()`
- `runDailyChecks()`
- `doGet()`

## Notes

- Si le template Google Docs n'est pas configure, le contrat auto-genere est produit sous forme de fichier texte dans le dossier du contrat.
- Le projet est pense comme une v1 robuste. Les regles de caution apres incident restent a arbitrer.
