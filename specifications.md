# RacsoR

Rental Assets & Contract System for Operations & Returns

## 1. Objectif

WebApp interne Carrefour pour gerer :
- les contrats de location
- le stock theorique par date
- le retrait et le retour du materiel
- les cautions
- les incidents et retards
- l'administration des produits, tarifs, utilisateurs et etats

Le systeme doit etre pense pour une implementation Google Apps Script avec Google Sheets comme base de donnees metier.

## 2. Stack cible

- Google Apps Script : logique serveur + WebApp
- Google Sheets : base de donnees
- Google Docs : generation des contrats
- Google Drive : stockage des contrats et pieces jointes
- Google Calendar : suivi des retraits et retours
- MailApp : notifications automatiques

## 2.1 Charte visuelle

- La WebApp doit utiliser les couleurs presentes dans le document/image fourni dans le dossier projet.
- Ces couleurs sont considerees comme les couleurs officielles Carrefour pour ce projet.
- L'interface doit reprendre cette palette pour les elements principaux : header, boutons, accents, statuts et navigation.
- Si un systeme de theme ou des variables CSS sont mis en place, cette palette doit etre centralisee dans la configuration UI.

## 3. Roles

### RESP

Acces complet.

Responsabilites :
- administration des utilisateurs
- administration des produits
- administration des tarifs
- administration des etats de retour
- acces a toutes les vues et a tout l'historique
- supervision des incidents et retards

### SAV

Responsabilites :
- creation de contrat
- annulation de contrat
- generation du contrat
- televersement du contrat signe/scanne
- consultation des retours et anomalies
- gestion de la caution au moment de la cloture metier

### DRIVE

Responsabilites :
- verification d'un contrat signe
- validation du retrait
- saisie du retour
- saisie des anomalies et incidents

Note : le role `LOG` est fusionne dans `DRIVE`.

## 4. Regles metier

### 4.1 Duree de location

- La location est definie par une date de retrait et une date de retour.
- Le calcul se fait uniquement avec des dates, sans gestion d'heure.
- Une regle speciale `week-end` existe pour une location du vendredi au lundi.
- Une location de plus de 10 jours est interdite.

### 4.2 Pricing

Le prix se calcule par ligne de contrat :

`montant_ligne = prix_unitaire_regle * quantite * duree_ou_forfait`

Puis :

`montant_contrat = somme des lignes`

Regles de pricing attendues :
- forfait `week-end`
- tarif journalier `1 a 4 jours`
- tarif journalier `5 a 10 jours`

Comportement attendu :
- si les dates correspondent au cas `vendredi -> lundi`, appliquer le forfait `week-end`
- sinon si la duree est comprise entre 1 et 4 jours, appliquer le tarif `1 a 4 jours`
- sinon si la duree est comprise entre 5 et 10 jours, appliquer le tarif `5 a 10 jours`
- sinon refuser la creation du contrat

Tous les prix sont stockes en TTC.

### 4.3 Caution

- La caution est definie au niveau du produit.
- La caution du contrat = somme des `caution_produit * quantite`.
- La caution est fixe par produit.
- La gestion fine des retenues partielles n'est pas encore definie.
- Pour le moment, au retour, l'interface doit surtout fournir un recapitulatif des anomalies.

### 4.4 Reservation du stock

- Le stock est reserve des la creation du contrat.
- La reservation s'applique sur toutes les dates couvertes par le contrat.
- Si le contrat est annule, les mouvements de stock doivent etre neutralises.
- Les stocks sont geres via un journal de mouvements, pas via un snapshot journalier persiste.

### 4.5 Retrait

- Le retrait n'est autorise que si le contrat est au statut `signed`.
- Cela implique qu'un contrat signe/scanne a ete televerse dans le dossier du contrat.
- Le Drive peut retrouver un contrat par numero de contrat.

### 4.6 Retour

- Le retour se fait en une seule fois. Pas de retour partiel.
- Pour chaque produit loue, l'interface affiche une ligne.
- Chaque ligne contient :
  - le produit
  - la quantite louee
  - un champ quantite retournee
  - une saisie de l'etat par unite
- La quantite retournee doit correspondre a la quantite louee.

### 4.7 Etat du materiel

- Les etats sont administrables par l'admin.
- Il y a 5 etats par defaut.
- Exemple initial d'etats :
  - conforme
  - sale
  - abime
  - casse
  - manquant

Important :
- l'etat est saisi par unite, pas seulement par ligne globale
- exemple : sur 10 chaises, 5 conformes, 2 abimees, 3 sales

### 4.8 Retards

- Un contrat peut passer en statut `late` si la date de retour est depassee et que le materiel n'a pas ete retourne.
- Une fonction planifiee doit pouvoir etre cablee sur un declencheur quotidien.
- Cette fonction doit detecter :
  - les retards
  - les incidents devant generer une notification

## 5. Statuts du contrat

Liste cible :
- `draft`
- `signed`
- `picked_up`
- `returned`
- `late`
- `closed`
- `cancelled`
- `incident`

Interpretation recommandee :
- `draft` : contrat cree mais pas encore signe/scanne
- `signed` : contrat signe/scanne present et pret pour retrait
- `picked_up` : materiel retire
- `returned` : materiel restitue, retour saisi
- `late` : retour en retard
- `closed` : dossier termine cote metier/SAV
- `cancelled` : contrat annule
- `incident` : anomalie significative constatee

## 6. Convention de nommage

### 6.1 Numero de contrat

Format :

`AAMMDDXX`

Ou :
- `AA` = annee sur 2 chiffres
- `MM` = mois
- `DD` = jour
- `XX` = compteur du jour

### 6.2 Dossier Drive

Format :

`AAMMDDXX_NOMCLIENT`

### 6.3 Fichiers contrat

- contrat auto-genere : `AAMMDDXX_NOMCLIENT_autoGenerate`
- contrat signe/scanne : `AAMMDDXX_NOMCLIENT_signed`

## 7. Architecture des donnees Google Sheets

## 7.1 Sheets principales

### Products

Champs recommandes :
- `id`
- `name`
- `sku` optionnel
- `stock_max`
- `deposit_amount`
- `is_active`
- `created_at`
- `updated_at`

### Pricing_Rules

Champs recommandes :
- `id`
- `code`
- `type`
- `value`
- `label`
- `is_active`

Exemples :
- `WEEKEND`
- `LTE_4_DAYS`
- `LTE_10_DAYS`

### Prices

Champs recommandes :
- `id`
- `product_id`
- `pricing_rule_id`
- `unit_price_ttc`
- `is_active`
- `created_at`
- `updated_at`

### Transactions

Table contrat, 1 ligne par contrat.

Champs recommandes :
- `id`
- `contract_number`
- `folder_name`
- `client_first_name`
- `client_last_name`
- `client_full_name`
- `client_phone`
- `client_email`
- `pickup_date`
- `return_date`
- `status`
- `total_amount_ttc`
- `total_deposit_amount`
- `drive_folder_id`
- `generated_contract_file_id`
- `signed_contract_file_id`
- `pickup_calendar_event_id`
- `return_calendar_event_id`
- `created_by`
- `created_at`
- `updated_at`
- `cancelled_at`

### Transaction_Items

Table lignes de contrat.

Champs recommandes :
- `id`
- `transaction_id`
- `product_id`
- `product_label_snapshot`
- `quantity`
- `pricing_rule_id`
- `unit_price_ttc`
- `line_amount_ttc`
- `deposit_unit_amount`
- `deposit_line_amount`

### Stock_Movements

Journal des mouvements de stock.

Champs recommandes :
- `id`
- `movement_date`
- `product_id`
- `transaction_id`
- `movement_type`
- `quantity_delta`
- `source_status`
- `note`
- `created_at`

Exemples de `movement_type` :
- `reservation`
- `reservation_cancel`
- `pickup`
- `return`
- `manual_adjustment`

Note :
- le dashboard journalier doit etre calcule a partir de ce journal
- la fiche de stock detaillee peut reconstituer les entrees/sorties jour par jour

### Return_Items

Detail des retours par produit et par etat.

Champs recommandes :
- `id`
- `transaction_id`
- `product_id`
- `state_id`
- `quantity`
- `comment`

### Return_States

Liste des etats configurables.

Champs recommandes :
- `id`
- `label`
- `sort_order`
- `is_default`
- `is_active`

### Users

Champs recommandes :
- `email`
- `role`
- `is_active`
- `get_alert`
- `created_at`
- `updated_at`

### Logs

Champs recommandes :
- `timestamp`
- `user_email`
- `action`
- `entity_type`
- `entity_id`
- `details`

## 8. WebApp

## 8.1 Dashboard

Objectif :
- afficher une vue legere des contrats en cours et a venir
- afficher le stock theorique du jour
- afficher les alertes de retard et incident

Contenus attendus :
- stock du jour par produit
- retraits a venir
- retours a venir
- incidents ouverts
- contrats en retard

Interaction attendue :
- clic sur un produit => ouvrir une fiche de stock detaillee jour par jour
- cette fiche peut etre une page dediee de la WebApp

## 8.2 Vue SAV

Fonctions :
- creer un contrat
- verifier la disponibilite
- calculer le prix
- calculer la caution
- generer le contrat Google Docs
- creer le dossier Drive du contrat
- televerser le contrat signe/scanne
- annuler un contrat
- consulter le recap du retour

Contraintes :
- le stock doit etre verifie avant creation
- le contrat ne peut pas etre retire tant qu'il n'est pas `signed`

## 8.3 Vue DRIVE

Fonctions :
- rechercher un contrat par numero
- verifier le statut
- valider le retrait
- saisir le retour
- remonter un incident
- acceder facilement au dossier Drive du contrat

Ecran retour attendu :
- une modale reprenant les produits loues
- une ligne par produit
- un input de quantite retournee
- une saisie des etats par unite
- un champ commentaire/incident

## 8.4 Vue ADMIN

Fonctions :
- gerer les produits
- gerer les tarifs
- gerer les utilisateurs
- gerer les etats de retour
- acceder a l'historique complet
- consulter la fiche de stock detaillee

Note :
- meme si certains reglages peuvent temporairement etre modifies dans la Sheet, le spec doit prevoir une admin WebApp
- il faut aussi prevoir un script d'initialisation de la base

## 9. Google Drive

Un dossier racine est fourni en parametre.

Structure cible :

`/Contrats/AAMMDDXX_NOMCLIENT/`

Le dossier d'un contrat peut contenir :
- le contrat auto-genere
- le contrat signe/scanne
- d'autres pieces jointes
- des photos
- des justificatifs d'incident

La WebApp doit permettre d'acceder facilement au dossier Drive du contrat et d'y televerser des fichiers.

## 10. Google Docs

Le contrat doit etre genere a partir d'un template Google Docs.

Le systeme doit prevoir une variable de configuration pour :
- l'ID du template Google Docs

Le template doit pouvoir etre alimente automatiquement avec :
- numero de contrat
- identite client
- dates
- lignes produits
- montant TTC
- montant de caution

## 11. Google Calendar

- un seul agenda Google partage aux equipes
- deux evenements par contrat :
  - un evenement de retrait
  - un evenement de retour

Les IDs des evenements doivent etre stockes sur le contrat.

Les evenements doivent contenir au minimum :
- numero de contrat
- nom client
- recap produits
- lien vers le dossier ou contrat

## 12. Notifications

Des notifications email doivent etre prevues pour :
- les incidents
- les retards

Une fonction Apps Script dediee doit pouvoir etre executee via un trigger quotidien.

## 13. Initialisation

Le projet doit prevoir un script d'initialisation pour :
- creer la structure des sheets
- initialiser les produits de lancement
- initialiser les regles tarifaires
- initialiser les tarifs
- initialiser les etats par defaut

Produits de lancement :
- Table multifonction pliable
- Table cocktail pliable
- Fauteuil plastique noir

## 14. Hors perimetre ou a arbitrer plus tard

Points non tranches a ce stade :
- politique exacte de retenue de caution
- workflow de remboursement de caution
- arbitrage automatique ou manuel des anomalies
- gestion d'une tarification au-dela de 10 jours
- gestion multi-retraits ou retours partiels
- signature electronique native

## 15. Ligne directrice d'implementation pour une IA

Pour une implementation robuste, le projet doit etre decoupe en modules :
- configuration
- acces Sheets
- moteur de pricing
- moteur de stock
- gestion contrats
- integration Drive
- integration Docs
- integration Calendar
- notifications
- UI WebApp
- script d'initialisation

Priorites de build recommandees :
1. initialisation Sheets + configuration
2. CRUD produits, tarifs, etats, utilisateurs
3. moteur de pricing
4. moteur de stock via journal de mouvements
5. creation/annulation de contrat
6. generation Docs + dossier Drive
7. workflow `signed` -> `picked_up` -> `returned`
8. dashboard + fiche de stock
9. notifications retard/incident
