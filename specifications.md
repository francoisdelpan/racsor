🧾 RacsoR — Rental Assets & Contract System for Operations & Returns

🎯 Objectif

WebApp interne pour gérer :
	•	stock matériel théorique par date
	•	locations (contrats)
	•	retours / état
	•	cautions
	•	admin produits / tarifs / users

⸻

🧱 Stack
	•	WebApp (Apps Script) → interface
	•	Google Sheets → DB
	•	Google Docs → contrats en auto fill
	•	Google Drive → fichiers
	•	Google Calendar → retraits / retours
	•	MailApp → notifications

⸻

👥 Rôles/ Vues
	•	RESP : full accès + admin (gestion users, produits, tarifications).
	•	SAV : dashbord + crée/annule contrat de location + retour pour caution.
	•	DRIVE : dashbord + enlèvement + retour matériel.

⸻

🗂️ Sheets (DB)
Products
	•	id, nom, stock_max, caution, actif
Prices
	•	product_id, pricing_id, prix
Pricing_Rules
	•	id, type (weekend, lessThanX), valeur
Transactions
	•	id, contrat, client, dates, statut, montants, calendar_id, drive_id
Theorical_Stock
	•	date, product_id, qty, transaction_id
Users
	•	email, role, get_alert (true/ false)
Logs
	•	timestamp, user, action

⸻

🖥️ WebApp

Dashboard
	•	stock live
	•	retours à venir (Calendar)
	•	alertes

SAV
	•	créer location
	•	générer contrat (Docs → PDF)
	•	décrément stock
	•	créer event Calendar
	•	annuler location
	•	gérer caution

LOG
	•	vérifier contrat (numéro)
	•	valider retrait
	•	saisir retour (qty + état)
	•	remonter incident

ADMIN
	•	produits
	•	tarifs
	•	users
	•	paramètres

⸻

📅 Calendar
	•	1 agenda RacsoR
	•	events :
	    •	retrait
	    •	retour
    •	lien du contrat

⸻

📁 Drive (lien du folder en paramètre)
	•	/Contrats
	    •	/AAMMDDXX_NOMCLIENT
	        •	AAMMDDXX_NOMCLIENT_autoGenerate
	        •	AAMMDDXX_NOMCLIENT_signe