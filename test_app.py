import unittest
import os
import sqlite3
from app import app
from database import init_db, get_db
from mailer import generate_token, verify_token
from werkzeug.security import check_password_hash

class TrainingsAppTestCase(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        self.client = app.test_client()
        conn = get_db()
        user = conn.execute("SELECT id FROM users WHERE email = 'nieuwe.loper@gmail.com'").fetchone()
        if user:
            conn.execute("DELETE FROM registrations WHERE user_id = ?", (user['id'],))
            conn.execute("DELETE FROM sessions WHERE creator_id = ?", (user['id'],))
            conn.execute("DELETE FROM users WHERE id = ?", (user['id'],))
            conn.commit()
        conn.close()

    def test_database_password_gdpr_encryption(self):
        """Controleer of wachtwoorden in de database veilig gehasht zijn en niet als plaintext opgeslagen."""
        conn = get_db()
        users = conn.execute("SELECT email, password_hash FROM users").fetchall()
        self.assertGreater(len(users), 0)

        for u in users:
            self.assertFalse(u['password_hash'].startswith('DevSecret'))
            self.assertFalse(u['password_hash'].startswith('Coach'))
            self.assertFalse(u['password_hash'].startswith('Wandelaar'))
            self.assertTrue('$' in u['password_hash'] or ':' in u['password_hash'])
        conn.close()

    def test_homepage_loads(self):
        """Controleer of de homepage goed laadt met sessies."""
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'Teamtrainingen & Sportevents', res.data)
        self.assertIn(b'100km Dodentocht', res.data)

    def test_registration_instant_active_flow(self):
        """Test nieuw account aanmaken: direct actief en direct ingelogd zonder e-mailvertraging."""
        email = "nieuwe.loper@gmail.com"
        reg_res = self.client.post('/register', data={
            'name': 'Bert De Wandelaar',
            'email': email,
            'password': 'VeiligWachtwoord123!',
            'password_confirm': 'VeiligWachtwoord123!',
            'phone': '0471234567'
        }, follow_redirects=True)
        self.assertEqual(reg_res.status_code, 200)
        self.assertIn(b'direct geactiveerd', reg_res.data)
        self.assertIn(b'Bert De Wandelaar', reg_res.data)

        # Controleren dat account direct actief is in de database (is_verified == 1)
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        conn.close()
        self.assertIsNotNone(user)
        self.assertEqual(user['is_verified'], 1)

        # 5. Controleren in DB dat is_verified nu 1 is
        conn = get_db()
        user_after = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        conn.close()
        self.assertEqual(user_after['is_verified'], 1)

    def test_forgot_password_and_reset_flow(self):
        """Test de 'wachtwoord vergeten' workflow."""
        email = "nieuwe.loper@gmail.com"
        conn = get_db()
        conn.execute("""
            INSERT OR REPLACE INTO users (name, email, password_hash, role, is_verified)
            VALUES ('Bert De Wandelaar', ?, 'dummy_hash', 'user', 1)
        """, (email,))
        conn.commit()
        conn.close()

        # 1. Wachtwoord vergeten aanvragen
        forgot_res = self.client.post('/forgot-password', data={'email': email}, follow_redirects=True)
        self.assertEqual(forgot_res.status_code, 200)
        self.assertIn(b'hebben we zojuist een e-mail gestuurd met een herstellink', forgot_res.data)

        # 2. Herstellink bezoeken met geldige token
        reset_token = generate_token(email, salt='reset-password')
        reset_page = self.client.get(f'/reset-password/{reset_token}')
        self.assertEqual(reset_page.status_code, 200)
        self.assertIn(b'Nieuw Wachtwoord', reset_page.data)

        # 3. Nieuw wachtwoord instellen
        new_pass_res = self.client.post(f'/reset-password/{reset_token}', data={
            'password': 'MijnNieuwWachtwoord456!',
            'password_confirm': 'MijnNieuwWachtwoord456!'
        }, follow_redirects=True)
        self.assertEqual(new_pass_res.status_code, 200)
        self.assertIn(b'succesvol gewijzigd', new_pass_res.data)

        # 4. Uitloggen en testen inloggen met het nieuwe wachtwoord
        self.client.get('/logout')
        login_res = self.client.post('/login', data={
            'email': email,
            'password': 'MijnNieuwWachtwoord456!'
        }, follow_redirects=True)
        self.assertEqual(login_res.status_code, 200)
        self.assertIn(b'Bert De Wandelaar', login_res.data)

    def test_developer_activation_and_exclusive_role_management(self):
        """Test developer activatie via mail en exclusieve rechten."""
        dev_email = "kennydm94@gmail.com"

        # 1. Kenny activeert zijn ontwikkelaarsaccount via de link uit de e-mail
        token = generate_token(dev_email, salt='activate-dev')
        activate_res = self.client.post(f'/activate-developer/{token}', data={
            'name': 'Kenny De Meester',
            'password': 'KennyDevWachtwoord2026!',
            'password_confirm': 'KennyDevWachtwoord2026!'
        }, follow_redirects=True)
        self.assertEqual(activate_res.status_code, 200)
        self.assertIn(b'Welkom Kenny!', activate_res.data)

        # 2. Kenny bezoekt het exclusieve rollenbeheer
        roles_page = self.client.get('/developer/roles')
        self.assertEqual(roles_page.status_code, 200)
        self.assertIn(b'Gebruikers- en Rollenbeheer', roles_page.data)

        # 3. Kenny wijst een administrator rol toe aan een deelnemer
        conn = get_db()
        conn.execute("""
            INSERT OR REPLACE INTO users (name, email, password_hash, role, is_verified)
            VALUES ('Bert De Wandelaar', 'nieuwe.loper@gmail.com', 'dummy_hash', 'user', 1)
        """)
        conn.commit()
        user = conn.execute("SELECT id FROM users WHERE email = 'nieuwe.loper@gmail.com'").fetchone()
        conn.close()

        promote_res = self.client.post('/developer/roles', data={
            'user_id': user['id'],
            'role': 'admin'
        }, follow_redirects=True)
        self.assertEqual(promote_res.status_code, 200)

        # Controleer in database
        conn = get_db()
        promoted_user = conn.execute("SELECT role FROM users WHERE id = ?", (user['id'],)).fetchone()
        conn.close()
        self.assertEqual(promoted_user['role'], 'admin')

if __name__ == '__main__':
    unittest.main()
