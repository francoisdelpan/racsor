# LOCATION MATERIEL

## WebApp en production

Lien actuel :
https://script.google.com/a/macros/franchise.carrefour.com/s/AKfycbzQ3NHBhik-HFnDr8fVveZK5ooJaYExAVf5ca7hUrgbLwqbyl7DOwKPPthC7WlfJRPb/exec

## A quoi sert cette application

Cette WebApp permet de gérer la location de matériel :

- création d’un contrat
- génération du contrat à imprimer
- téléversement du contrat signé
- enlèvement du matériel
- retour et contrôle qualité
- décision SAV sur la caution
- archivage du dossier dans Drive

L’application s’appuie sur :

- une base Google Sheets
- un dossier racine Google Drive
- un template Google Docs pour le contrat
- un agenda Google Calendar partagé

## Parcours métier simple

### 1. `DRAFT`

Le contrat vient d’être créé.

- le stock est réservé
- le dossier Drive du client est créé
- le contrat auto-généré est disponible
- le contrat n’est pas encore signé

Action attendue :

- imprimer le contrat
- faire signer
- téléverser le contrat signé

### 2. `SIGNED`

Le contrat signé est disponible.

- le dossier peut passer au Drive
- le matériel peut être préparé puis retiré

Action attendue :

- le Drive confirme l’enlèvement

### 3. `PICKED_UP`

Le matériel est parti.

- le contrat est en cours de location
- le retour est attendu à la date prévue

Action attendue :

- le Drive contrôle le retour

### 4. `RETURNED`

Le retour a été saisi sans anomalie.

- le SAV peut traiter la caution
- le dossier peut être clôturé

### 5. `INCIDENT`

Le retour a été saisi avec anomalie.

- casse
- manque
- matériel sale
- matériel abîmé

Action attendue :

- le SAV décide du remboursement de caution
- le dossier est ensuite clôturé

### 6. `LATE`

Le retour attendu est dépassé.

- le contrat reste visible dans les vues de suivi
- une alerte peut être envoyée

### 7. `CLOSED`

Le SAV a terminé le traitement.

- le dossier disparaît du dashboard standard
- le dossier reste consultable uniquement dans l’espace `Admin`

## Menus de l’application

### Dashboard

Permet de suivre :

- le stock du jour
- les enlèvements du jour
- les retours du jour
- les alertes
- les derniers contrats non clôturés

### Fiches de stock

Permet d’afficher la base de stock par date et par produit.

### Inventaire

Permet de corriger le stock réel à une date donnée.

- un champ vide ne modifie rien
- une valeur saisie remplace le stock du jour concerné

### Nouvelle location

Permet de :

- saisir le client
- choisir les dates
- vérifier la disponibilité
- calculer le montant TTC
- calculer la caution
- créer le contrat

### Enlèvement

Permet au Drive de confirmer le départ du matériel.

### Retour DRIVE

Permet au Drive de saisir le retour et le contrôle qualité.

### Retour SAV

Permet au SAV de :

- saisir le remboursement de caution
- ajouter un commentaire
- joindre le ticket de caisse
- clôturer le dossier

### Admin

Permet à l’administrateur de :

- gérer les produits
- gérer les tarifs
- gérer les utilisateurs
- consulter les états de retour
- retrouver les dossiers clôturés

## Pré-requis de configuration

Le projet Apps Script doit avoir accès à :

- un Google Spreadsheet
- un dossier racine Drive
- un template Google Docs
- un agenda Google Calendar

Script Properties à renseigner si besoin :

- `RACSOR_SPREADSHEET_ID`
- `RACSOR_DRIVE_ROOT_FOLDER_ID`
- `RACSOR_CONTRACT_TEMPLATE_ID`
- `RACSOR_CALENDAR_ID`
- `RACSOR_LOGO_URL`

## Fonctions utiles pour l’équipe projet

### `initializeProject()`

À lancer lors de la première mise en place.

Cette fonction :

- crée les onglets nécessaires
- initialise les données de base
- prépare la feuille de stock

### `seedDemoUsersIfMissing()`

Ajoute automatiquement l’utilisateur courant en `RESP` si besoin.

### `runDailyChecks()`

Permet de marquer les retards et d’envoyer les alertes prévues.

## Points importants pour l’usage

- le contrat signé doit être téléversé pour passer en `SIGNED`
- un contrat `CLOSED` n’apparaît plus dans le dashboard standard
- le dossier client reste toujours dans Drive
- le SAV génère aussi un récapitulatif de clôture dans le dossier client

## Structure du projet

- `src/*.gs` : logique Apps Script côté serveur
- `src/*.html` : interface WebApp
- `appsscript.json` : manifest Apps Script
- `specifications.md` : cadrage fonctionnel

## Notes techniques simples

- le stock repose sur la feuille `Stock_Mouvement`
- chaque ligne représente une date
- chaque colonne représente un produit
- Google Sheets sert de moteur de propagation des stocks

## Contact projet

En cas d’évolution métier, la référence de fonctionnement reste le process métier Carrefour validé dans ce dépôt.
