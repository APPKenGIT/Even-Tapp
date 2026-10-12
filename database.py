import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'trainingsapp.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    # Tabel voor gebruikers met verificatiestatus voor e-mailbevestiging
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user', -- 'developer', 'admin', 'user'
        is_verified INTEGER NOT NULL DEFAULT 0, -- 0 = wacht op e-mailbevestiging, 1 = bevestigd
        phone TEXT,
        emergency_contact TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # Tabel voor trainingssessies en sportevents
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        session_type TEXT NOT NULL DEFAULT 'training', -- 'training' of 'event'
        date TEXT NOT NULL,          -- Formaat: YYYY-MM-DD
        start_time TEXT NOT NULL,    -- Formaat: HH:MM
        location TEXT NOT NULL,
        distance_km REAL,            -- Afstand optioneel / indien aangegeven
        target_pace TEXT,            -- Bijv. "5.5 km/u" of "Wandel-/looptempo"
        description TEXT,
        route_url TEXT,
        creator_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users (id) ON DELETE CASCADE
    )
    """)

    # Tabel voor inschrijvingen / intekeningen op aanwezigheid
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'present', -- 'present' (aanwezig), 'maybe' (misschien), 'absent' (afwezig)
        note TEXT, -- optionele opmerking (bijv. carpool, deelafstand)
        registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(session_id, user_id)
    )
    """)

    # Automatische migratie: controleer of is_verified kolom bestaat in users
    cursor.execute("PRAGMA table_info(users)")
    columns = [col['name'] for col in cursor.fetchall()]
    if 'is_verified' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER NOT NULL DEFAULT 0")

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database succesvol geïnitialiseerd!")
