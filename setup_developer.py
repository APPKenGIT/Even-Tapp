import os
import sqlite3
from database import get_db, init_db
from mailer import generate_token, send_developer_welcome_email
from werkzeug.security import generate_password_hash
from datetime import datetime, timedelta

def setup_developer_and_clean_demo(base_url="http://127.0.0.1:5000"):
    init_db()
    conn = get_db()
    cursor = conn.cursor()

    print("Verwijderen van oude demo-accounts...")
    demo_emails = [
        "ontwikkelaar@dodentocht.be",
        "coach@dodentocht.be",
        "sarah@dodentocht.be",
        "thomas@dodentocht.be"
    ]
    for email in demo_emails:
        user = cursor.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if user:
            cursor.execute("DELETE FROM registrations WHERE user_id = ?", (user['id'],))
            cursor.execute("DELETE FROM sessions WHERE creator_id = ?", (user['id'],))
            cursor.execute("DELETE FROM users WHERE id = ?", (user['id'],))
            print(f" - Demo account {email} verwijderd.")

    # Controleer of kennydm94@gmail.com al bestaat
    dev_email = "kennydm94@gmail.com"
    dev_name = "Kenny (App Ontwikkelaar)"
    existing_dev = cursor.execute("SELECT * FROM users WHERE email = ?", (dev_email,)).fetchone()

    # Direct actief wachtwoord voor de ontwikkelaar (kan achteraf gewijzigd worden via profiel)
    initial_pass_hash = generate_password_hash("KennyDodentocht2026!")

    if not existing_dev:
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, is_verified)
            VALUES (?, ?, ?, 'developer', 1)
        """, (dev_name, dev_email, initial_pass_hash))
        dev_id = cursor.lastrowid
        print(f"Nieuw ontwikkelaarsaccount aangemaakt voor: {dev_email}")
    else:
        cursor.execute("""
            UPDATE users
            SET role = 'developer', is_verified = 1, password_hash = ?
            WHERE email = ?
        """, (initial_pass_hash, dev_email))
        dev_id = existing_dev['id']
        print(f"Bestaand account voor {dev_email} bijgewerkt als 'developer' (actief).")

    # Zorg dat er een officieel Dodentocht event in staat gekoppeld aan de ontwikkelaar
    event_check = cursor.execute("SELECT id FROM sessions WHERE session_type = 'event'").fetchone()
    if not event_check:
        today = datetime.now()
        date_event = (today + timedelta(days=90)).strftime("%Y-%m-%d")
        cursor.execute("""
            INSERT INTO sessions (title, session_type, date, start_time, location, distance_km, target_pace, description, route_url, creator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            "🏆 100km Dodentocht (Officiële Deelname)",
            "event",
            date_event,
            "21:00",
            "Breeven Sportcomplex, Bornem",
            100.0,
            "5.5 - 6.0 km/u",
            "Het hoofdevenement! Hier tellen we met het volledige team naartoe af. Iedereen kan intekenen op aanwezigheid.",
            "https://www.dodentocht.be",
            dev_id
        ))
        print("Hoofdevent 100km Dodentocht aangemaakt.")

    conn.commit()
    conn.close()

    # Genereer activatietoken en verzend welkomst-/inschrijvingsmail
    token = generate_token(dev_email, salt='activate-dev')
    activate_url = f"{base_url}/activate-developer/{token}"

    print(f"\nVerzenden van inschrijvingsmail naar {dev_email}...")
    success, msg = send_developer_welcome_email(dev_email, dev_name, activate_url)
    print(f"Status mailverzending: {msg}")
    print(f"\nActivatie-URL voor ontwikkelaar:\n{activate_url}\n")
    print("Demo accounts zijn succesvol gewist en ontwikkelaarsmail is gegenereerd/verzonden!")

if __name__ == '__main__':
    setup_developer_and_clean_demo()
