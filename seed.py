import sqlite3
from database import get_db, init_db
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta

def seed_database():
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    # Controleer of er al gebruikers zijn
    cursor.execute("SELECT COUNT(*) as count FROM users")
    if cursor.fetchone()['count'] > 0:
        print("Database bevat al gegevens. Overslaan van seeding.")
        conn.close()
        return

    print("Seeden van initiële gegevens...")

    # 1. Ontwikkelaar account (de enige die rollen kan beheren)
    dev_pass = generate_password_hash("DevSecret2026!")
    cursor.execute("""
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    """, ("App Ontwikkelaar", "ontwikkelaar@dodentocht.be", dev_pass, "developer"))
    dev_id = cursor.lastrowid

    # 2. Administrator account
    admin_pass = generate_password_hash("Coach2026!")
    cursor.execute("""
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    """, ("Koen (Team Coach)", "coach@dodentocht.be", admin_pass, "admin"))
    admin_id = cursor.lastrowid

    # 3. Reguliere lopers / wandelaars
    user1_pass = generate_password_hash("Wandelaar123!")
    cursor.execute("""
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    """, ("Sarah De Smet", "sarah@dodentocht.be", user1_pass, "user"))
    user1_id = cursor.lastrowid

    user2_pass = generate_password_hash("Wandelaar123!")
    cursor.execute("""
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, ?)
    """, ("Thomas Peeters", "thomas@dodentocht.be", user2_pass, "user"))
    user2_id = cursor.lastrowid

    today = datetime.now()
    date_sess1 = (today + timedelta(days=3)).strftime("%Y-%m-%d")
    date_sess2 = (today + timedelta(days=10)).strftime("%Y-%m-%d")
    date_sess3 = (today + timedelta(days=24)).strftime("%Y-%m-%d")
    date_event = (today + timedelta(days=60)).strftime("%Y-%m-%d")

    # 4. Sessies toevoegen
    # Sessie 1: Oefentraining 20km
    cursor.execute("""
        INSERT INTO sessions (title, session_type, date, start_time, location, distance_km, target_pace, description, route_url, creator_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Eerste Teamtraining: Scheldeland lus",
        "training",
        date_sess1,
        "08:30",
        "Kerkplein, Bornem (Grote Markt)",
        21.5,
        "5.8 km/u",
        "Gezamenlijke opstarttraining langs de Scheldedijken. Zorg voor voldoende water en geteste wandelschoenen. Na afloop koffie!",
        "https://maps.google.com/?q=Bornem",
        admin_id
    ))
    sess1_id = cursor.lastrowid

    # Sessie 2: Nachtelijke training 35km
    cursor.execute("""
        INSERT INTO sessions (title, session_type, date, start_time, location, distance_km, target_pace, description, route_url, creator_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Nachttraining: Test met hoofdlamp",
        "training",
        date_sess2,
        "22:00",
        "Station Puurs (Voorkant parking)",
        35.0,
        "5.5 km/u",
        "Voorbereiding op de nachtelijke uren van het event. Breng hoofdlampje, fluohesje en reservebatterijen mee.",
        "https://maps.google.com/?q=Station+Puurs",
        user1_id
    ))
    sess2_id = cursor.lastrowid

    # Sessie 3: Lange afstandstraining 50km
    cursor.execute("""
        INSERT INTO sessions (title, session_type, date, start_time, location, distance_km, target_pace, description, route_url, creator_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "Duurtraining halve afstand (50 km)",
        "training",
        date_sess3,
        "06:30",
        "Sportcomplex Breeven, Bornem",
        50.0,
        "6.0 km/u",
        "De ultieme test voor voeding, bepakking en wandelritme. Bevoorradingspost voorzien halverwege.",
        "https://maps.google.com/?q=Sportcomplex+Breeven+Bornem",
        admin_id
    ))
    sess3_id = cursor.lastrowid

    # Hoofdevent: 100km Dodentocht
    cursor.execute("""
        INSERT INTO sessions (title, session_type, date, start_time, location, distance_km, target_pace, description, route_url, creator_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "🏆 100km Dodentocht (Het Hoofdevent)",
        "event",
        date_event,
        "21:00",
        "Startzone Dodentocht, Bornem",
        100.0,
        "5.0 - 6.0 km/u",
        "Het officiële evenement! We verzamelen 2 uur voor starttijd als team voor de gezamenlijke groepsfoto en briefing.",
        "https://www.dodentocht.be",
        admin_id
    ))
    event_id = cursor.lastrowid

    # 5. Intekeningen / aanwezigheid toevoegen
    # Sessie 1
    cursor.execute("INSERT INTO registrations (session_id, user_id, status, note) VALUES (?, ?, ?, ?)",
                   (sess1_id, admin_id, 'present', 'Neemt EHBO-kit en reserve sportdrank mee'))
    cursor.execute("INSERT INTO registrations (session_id, user_id, status, note) VALUES (?, ?, ?, ?)",
                   (sess1_id, user1_id, 'present', 'Kan 2 mensen oppikken aan station'))
    cursor.execute("INSERT INTO registrations (session_id, user_id, status, note) VALUES (?, ?, ?, ?)",
                   (sess1_id, user2_id, 'present', 'Sluit aan tot km 15'))

    # Sessie 2
    cursor.execute("INSERT INTO registrations (session_id, user_id, status, note) VALUES (?, ?, ?, ?)",
                   (sess2_id, user1_id, 'present', 'Route is uitgestippeld op Komoot'))
    cursor.execute("INSERT INTO registrations (session_id, user_id, status, note) VALUES (?, ?, ?, ?)",
                   (sess2_id, user2_id, 'maybe', 'Afhankelijk van vroege shift op het werk'))

    # Hoofdevent
    cursor.execute("INSERT INTO registrations (session_id, user_id, status, note) VALUES (?, ?, ?, ?)",
                   (event_id, admin_id, 'present', 'Ingeschreven startvak 1'))
    cursor.execute("INSERT INTO registrations (session_id, user_id, status, note) VALUES (?, ?, ?, ?)",
                   (event_id, user1_id, 'present', 'Ticket binnen! Klaar voor de 100km'))
    cursor.execute("INSERT INTO registrations (session_id, user_id, status, note) VALUES (?, ?, ?, ?)",
                   (event_id, user2_id, 'present', 'Eerste deelname, mik op 24u'))

    conn.commit()
    conn.close()
    print("Database succesvol voorzien van voorbeelddata!")

if __name__ == '__main__':
    seed_database()
