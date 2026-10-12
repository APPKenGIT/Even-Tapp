# 🥾 Dodentocht Teamtraining Planner (GitHub Pages)

Een moderne, mobielvriendelijke Progressive Web App (PWA) om gezamenlijke teamtrainingen en het uiteindelijke sportevenement (zoals de 100km Dodentocht) in te plannen, bij te houden en de aanwezigheid te registreren.

Net zoals de **Hardware Selector** is deze applicatie gebouwd als een **statische client-side webapp** (`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`). Dit betekent dat je de app **volledig gratis online kunt zetten via GitHub Pages met een directe GitHub-link**!

---

## 🚀 In 3 Stappen Online Zetten via GitHub Pages

Net zoals bij de Hardware Selector:

1. **Upload deze map naar een GitHub repository**:
   - Maak een nieuwe repository aan op [GitHub.com](https://github.com) (bijv. `dodentocht-planner`).
   - Upload alle bestanden uit deze map naar de repository.

2. **Activeer GitHub Pages**:
   - Ga in je repository naar **Settings** (Instellingen) ⚙️.
   - Klik in het linkermenu op **Pages**.
   - Onder **Build and deployment** > **Branch**: kies `main` (of `master`) en `/ (root)`.
   - Klik op **Save**.

3. **Klaar! Je link is direct live**:
   - Binnen 1 minuut verschijnt bovenaan je online link:
     👉 **`https://jouw-github-naam.github.io/dodentocht-planner/`**
   - Deel deze link in WhatsApp of per mail en iedereen kan hem direct op smartphone of computer openen zonder iets te installeren!

---

## 🌟 Belangrijkste Functies & Eigenschappen

1. **Parameters per Training / Event**:
   - **Datum** (met countdown en overzichtelijke Nederlandse datumweergave)
   - **Starttijd** (in uren/minuten)
   - **Startlocatie** (met directe knop naar **Google Maps**)
   - **Afstand in km** (indien aangegeven / optioneel)
   - **Streeftempo** (bijv. 5.5 - 6.0 km/u)
   - **Route / GPX link** (Komoot, Strava, GPX)
   - **Aangemaakt door: [Naam van de maker]**

2. **Intekenen op Aanwezigheid**:
   - Deelnemers tekenen in onder hun eigen naam:
     - ✅ **Aanwezig** ("Ik doe mee")
     - ❓ **Misschien** ("Nog onzeker")
     - ❌ **Afwezig**
   - Mogelijkheid tot optionele opmerking (carpoolen, deelafstand meelopen, etc.).
   - Live teller en overzichtelijke lijst van aanwezigen.
   - **Deel op WhatsApp knop**: Genereert met 1 klik een kant-en-klaar WhatsApp-bericht met de details en de link!

3. **Rechten & Toegangscontrole**:
   - **Elke ingelogde gebruiker**: kan sessies aanmaken en eigen sessies bewerken/verwijderen.
   - **Administrators**: kunnen alle sessies beheren.
   - **App Ontwikkelaar (`kennydm94@gmail.com`)**:
     - Heeft exclusieve toegang tot het **Rollenbeheer** (knoppen en dropdowns).
     - Kan gebruikers promoveren naar Administrator.
     - Kan met **1 klik direct een nieuw wachtwoord instellen** voor elke loper die zijn wachtwoord vergeten is.

4. **Inloggen & Registratie ZONDER E-mails**:
   - Nieuwe gebruikers registreren met Naam, E-mail en Wachtwoord.
   - **Account is meteen actief en ingelogd** (geen verificatiemails, app-wachtwoorden of wachttijden).
   - **GDPR conform**: Wachtwoorden worden via **SHA-256 Web Crypto API** met sterke salt cryptografisch gehasht. Wachtwoorden worden **nooit in plaintext** opgeslagen.
   - E-mailadressen en wachtwoorden blijven privé en zijn niet publiek zichtbaar voor andere lopers.

5. **Cloud Synchronisatie & Database Backups**:
   - **Realtime Live Cloud Synchronisatie**: Jouw Firebase Realtime Database (`https://even-tapp-default-rtdb.europe-west1.firebasedatabase.app`) is reeds standaard ingebouwd! Zodra iemand een training toevoegt of intekent, ziet iedereen dit binnen seconden live op zijn smartphone.
   - **Lokaal & Offline**: Werkt zelfs als iemand even geen bereik heeft in de bossen dankzij lokale cache en Service Worker.
   - **Database Backup & Herstel**: Net zoals bij de Hardware Selector kun je met 1 klik een complete JSON-backup van alle trainingen en gebruikers downloaden en herstellen.

---

## 💻 Lokaal Testen op je Computer

Dubbelklik simpelweg op:
```cmd
start.bat
```
Of open `index.html` rechtstreeks in Google Chrome, Edge of Safari.

### 🔑 Vooraf Ingesteld Ontwikkelaarsaccount:
- **E-mail**: `kennydm94@gmail.com`
- **Wachtwoord**: `KennyDodentocht2026!`
- **Rol**: 👑 App Ontwikkelaar (volledige rechten)
