# LOCATION MATERIEL

## Lien WebApp

[PRODUCTION V1.01]()

[DEVELOPPEMENT V0.32](https://script.google.com/a/macros/franchise.carrefour.com/s/AKfycbzQ3NHBhik-HFnDr8fVveZK5ooJaYExAVf5ca7hUrgbLwqbyl7DOwKPPthC7WlfJRPb/exec)

[FAIRE UN TICKET](https://github.com/francoisdelpan/racsor/issues/new)

## A quoi sert cette application

Cette WebApp permet de gérer la location de matériel :

- création du contrat
- génération du contrat à imprimer
- téléversement du contrat signé
- enlèvement du matériel
- retour et contrôle qualité
- traitement SAV de la caution
- clôture et archivage du dossier

## Parcours métier par statut

### 1. `DRAFT`

Le contrat vient d’être créé.

- le stock est réservé
- le dossier Drive est créé
- le contrat auto-généré est disponible
- le contrat n’est pas encore signé

Action :

- imprimer
- faire signer
- téléverser le contrat signé

### 2. `SIGNED`

Le contrat signé est disponible.

- le Drive peut préparer le dossier
- le matériel peut être retiré

Action :

- confirmer l’enlèvement

### 3. `PICKED_UP`

Le matériel est sorti.

- la location est en cours
- le retour est attendu à la date prévue

Action :

- le Drive saisit le retour

### 4. `RETURNED`

Le retour a été saisi sans anomalie.

Action :

- le SAV traite la caution

### 5. `INCIDENT`

Le retour a été saisi avec anomalie.

Exemples :

- matériel sale
- matériel abîmé
- matériel cassé
- matériel manquant

Action :

- le SAV traite la caution

### 6. `LATE`

Le retour attendu est dépassé.

- le contrat reste visible dans les vues de suivi
- une alerte peut être envoyée

### 7. `READY_TO_CLOSE`

Le SAV a terminé son traitement.

- montant remboursé saisi
- commentaire SAV enregistré
- ticket de caisse éventuellement joint
- le dossier est prêt à être clôturé

Action :

- clôture finale depuis le `Dashboard`

### 8. `CLOSED`

Le dossier est définitivement clôturé.

- il disparaît du dashboard standard
- il reste consultable uniquement dans l’espace `Admin`

## Menus de l’application

### Dashboard

Permet de suivre :

- le stock du jour
- les enlèvements du jour
- les retours du jour
- les alertes
- les derniers contrats non clôturés
- les dossiers `READY_TO_CLOSE` à clôturer

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
- valider le traitement SAV

La clôture finale du dossier se fait ensuite dans le `Dashboard`.

### Admin

Permet à l’administrateur de :

- gérer les produits
- gérer les règles tarifaires
- gérer les tarifs
- gérer les utilisateurs
- consulter les états de retour
- retrouver les dossiers clôturés

## Pré-requis de configuration

Le projet Apps Script doit avoir accès à :

- un Google Spreadsheet
- un dossier racine Google Drive
- un template Google Docs
- un agenda Google Calendar

Script Properties possibles :

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
- ajoute les utilisateurs par défaut

### `seedDemoUsersIfMissing()`

Ajoute automatiquement l’utilisateur courant en `RESP` si besoin.

### `runDailyChecks()`

Permet de marquer les retards et d’envoyer les alertes prévues.

## Points importants pour l’usage

- le contrat signé doit être téléversé pour passer en `SIGNED`
- après traitement SAV, le dossier passe en `READY_TO_CLOSE`
- la clôture finale se fait depuis le `Dashboard`
- un dossier `CLOSED` n’apparaît plus dans le dashboard standard
- le dossier client reste toujours dans Drive
- le SAV génère un récapitulatif de clôture dans le dossier client

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
