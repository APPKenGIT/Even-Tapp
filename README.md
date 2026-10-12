# 📅 Even'Tapp - Event & Activiteiten Planner

Een moderne, mobielvriendelijke Progressive Web App (PWA) om gezamenlijke evenementen, bijeenkomsten, sporttrainingen en activiteiten in te plannen, bij te houden en de aanwezigheid te registreren.

Net zoals de **Hardware Selector** is deze applicatie gebouwd als een **statische client-side webapp** (`index.html`, `style.css`, `app.js`, `manifest.json`, `sw.js`). Dit betekent dat de app **volledig gratis online staat via GitHub Pages**!

---

## 🚀 Live Webapp Link

👉 **[https://appkengit.github.io/Even-Tapp/](https://appkengit.github.io/Even-Tapp/)**

Deel deze link in WhatsApp of per mail en iedereen kan hem direct op smartphone of computer openen zonder iets te hoeven installeren!

---

## 🌟 Belangrijkste Functies & Eigenschappen

1. **Beveiligde Toegang (Login Wall)**:
   - Gebruikers moeten **eerst inloggen of een account aanmaken** voordat geplande events, deelnemerslijsten en details zichtbaar zijn.
   - Snelle en directe registratie: geen activatiemails of wachttijden nodig.

2. **Parameters per Event / Activiteit**:
   - **Type**: Evenement, Sport & Training, of Bijeenkomst / Social
   - **Datum & Starttijd**
   - **Locatie** (met directe knop naar **Google Maps**)
   - **Afstand in km** (indien van toepassing / optioneel)
   - **Toelichting, programma & link** (optioneel)
   - **Aangemaakt door: [Naam van de organisator]**

3. **Intekenen op Aanwezigheid**:
   - Deelnemers tekenen in onder hun eigen accountnaam:
     - ✅ **Aanwezig** ("Ik doe mee")
     - ❓ **Misschien** ("Nog onzeker")
     - ❌ **Niet aanwezig**
   - Mogelijkheid tot optionele opmerking (carpoolen, dieetwensen, etc.).
   - Live teller en overzichtelijke deelnemerslijst.
   - **Deel op WhatsApp knop**: Deel direct de link en samenvatting in groepsgesprekken.

4. **Rechten & Toegangscontrole**:
   - **Elke ingelogde gebruiker**: kan nieuwe events aanmaken en eigen events bewerken/verwijderen.
   - **Administrators**: kunnen alle events beheren.
   - **App Ontwikkelaar (`kennydm94@gmail.com`)**:
     - Heeft exclusieve toegang tot het **Rollenbeheer**.
     - Kan gebruikers promoveren naar Administrator.
     - Kan met **1 klik direct een nieuw wachtwoord instellen** voor deelnemers die hun wachtwoord vergeten zijn.

5. **GDPR / Privacy Veilig**:
   - Wachtwoorden worden via de **SHA-256 Web Crypto API** met sterke salt cryptografisch gehasht. Wachtwoorden worden **nooit in plaintext** opgeslagen of verzonden.
   - Gebruikers kunnen via hun profiel met 1 klik een GDPR-exportbestand downloaden.

6. **Stille Cloud Synchronisatie**:
   - Alle data synchroniseert automatisch en stil via de gekoppelde Firebase Realtime Database.
   - Geen storende statusindicatoren of handmatige synchronisatieknoppen; alles werkt vloeiend en transparant op de achtergrond.

---

## 🔑 Vooraf Ingesteld Ontwikkelaarsaccount:
- **E-mail**: `kennydm94@gmail.com`
- **Wachtwoord**: `KennyEvenTapp2026!` (of `KennyDodentocht2026!`)
- **Rol**: 👑 App Ontwikkelaar (volledige rechten)
