import os
import sys
import webbrowser
from threading import Timer
from database import init_db
from app import app
from setup_developer import setup_developer_and_clean_demo

def open_browser():
    webbrowser.open_new("http://127.0.0.1:5000/")

if __name__ == '__main__':
    print("=" * 60)
    print("🥾 Dodentocht & Teamtraining Registratie-App")
    print("=" * 60)
    print("Initialiseren van database...")
    init_db()
    setup_developer_and_clean_demo()
    print("\nDe applicatie wordt gestart op http://127.0.0.1:5000")
    print("Druk op Ctrl+C om de server te stoppen.\n")

    # Open automatisch de browser na 1 seconde
    Timer(1.2, open_browser).start()

    app.run(host='127.0.0.1', port=5000, debug=True)
