import os
import sqlite3
from functools import wraps
from datetime import datetime
from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, session, g, jsonify, abort
)
from werkzeug.security import generate_password_hash, check_password_hash
from database import get_db, init_db
from mailer import (
    generate_token, verify_token,
    send_verification_email, send_password_reset_email, send_developer_welcome_email
)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dodentocht_secret_key_training_2026_super_veilig')

# Database helper per request
def get_request_db():
    if 'db' not in g:
        g.db = get_db()
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

# Haal de huidige ingelogde gebruiker op
@app.before_request
def load_logged_in_user():
    user_id = session.get('user_id')
    if user_id is None:
        g.user = None
    else:
        db = get_request_db()
        g.user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()

# Authenticatie decorator
def login_required(view):
    @wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None:
            flash("Je moet eerst inloggen om deze pagina te bekijken.", "warning")
            return redirect(url_for('login', next=request.url))
        return view(**kwargs)
    return wrapped_view

# Ontwikkelaar decorator (alleen de app ontwikkelaar mag rollen beheren)
def developer_required(view):
    @wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None or g.user['role'] != 'developer':
            flash("Toegang geweigerd. Deze pagina is exclusief voor de app-ontwikkelaar.", "danger")
            return redirect(url_for('index'))
        return view(**kwargs)
    return wrapped_view

# Template helpers
@app.template_filter('format_date')
def format_date_filter(val):
    if not val:
        return ""
    try:
        dt = datetime.strptime(val, "%Y-%m-%d")
        months = ["januari", "februari", "maart", "april", "mei", "juni",
                  "juli", "augustus", "september", "oktober", "november", "december"]
        days = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"]
        return f"{days[dt.weekday()]} {dt.day} {months[dt.month - 1]} {dt.year}"
    except Exception:
        return val

# --- AUTHENTICATIE, REGISTRATIE & BEVESTIGINGSMAIL ---

@app.route('/register', methods=['GET', 'POST'])
def register():
    if g.user:
        return redirect(url_for('index'))

    if request.method == 'POST':
        name = request.form.get('name', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        password_confirm = request.form.get('password_confirm', '')
        phone = request.form.get('phone', '').strip()

        errors = []
        if not name or len(name) < 2:
            errors.append("Gelieve een geldige voor- en achternaam op te geven.")
        if not email or '@' not in email:
            errors.append("Gelieve een geldig e-mailadres op te geven.")
        if not password or len(password) < 6:
            errors.append("Het wachtwoord moet minimaal 6 tekens lang zijn.")
        if password != password_confirm:
            errors.append("Wachtwoorden komen niet overeen.")

        db = get_request_db()
        existing_user = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing_user:
            errors.append("Er bestaat al een account met dit e-mailadres. Log in of vraag een wachtwoordreset aan.")

        if errors:
            for error in errors:
                flash(error, "danger")
            return render_template('register.html', name=name, email=email, phone=phone)

        # GDPR-veilig: wachtwoord wordt eenzijdig gehasht met cryptografische zoutvector
        hashed_password = generate_password_hash(password)

        # Bepaal rol: kennydm94@gmail.com of allereerste gebruiker krijgt de developer rol
        count = db.execute("SELECT COUNT(*) as c FROM users").fetchone()['c']
        role = 'developer' if (email == 'kennydm94@gmail.com' or count == 0) else 'user'

        # Account direct aanmaken en activeren (geen e-mailactivatie vereist!)
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO users (name, email, password_hash, role, is_verified, phone)
            VALUES (?, ?, ?, ?, 1, ?)
        """, (name, email, hashed_password, role, phone))
        new_user_id = cursor.lastrowid
        db.commit()

        # Direct inloggen
        session['user_id'] = new_user_id
        flash(f"Welkom {name}! Je account is direct geactiveerd en je bent nu ingelogd.", "success")
        return redirect(url_for('index'))

    return render_template('register.html')

@app.route('/confirm/<token>')
def confirm_email(token):
    """Verwerkt de bevestigingslink uit de e-mail om een account te activeren."""
    email = verify_token(token, salt='email-confirm', max_age=86400) # 24u geldig
    if not email:
        flash("De bevestigingslink is ongeldig of verlopen (ouder dan 24 uur). Vraag hieronder een nieuwe link aan.", "danger")
        return redirect(url_for('resend_confirmation'))

    db = get_request_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        flash("Gebruiker niet gevonden.", "danger")
        return redirect(url_for('register'))

    if user['is_verified'] == 1:
        flash("Jouw e-mailadres was reeds bevestigd! Je kunt direct inloggen.", "info")
    else:
        db.execute("UPDATE users SET is_verified = 1 WHERE id = ?", (user['id'],))
        db.commit()
        flash(f"Gefeliciteerd {user['name']}! Je account is succesvol bevestigd en geactiveerd. Je bent nu ingelogd.", "success")

    # Automatisch inloggen
    session['user_id'] = user['id']
    return redirect(url_for('index'))

@app.route('/resend-confirmation', methods=['GET', 'POST'])
def resend_confirmation():
    """Biedt de mogelijkheid om een nieuwe bevestigingsmail aan te vragen."""
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        db = get_request_db()
        user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        if user:
            if user['is_verified'] == 1:
                flash("Dit account is al geactiveerd! Je kunt gewoon inloggen.", "info")
                return redirect(url_for('login'))

            token = generate_token(email, salt='email-confirm')
            confirm_url = url_for('confirm_email', token=token, _external=True)
            send_verification_email(email, user['name'], confirm_url)

        # Altijd vriendelijke melding (veilig tegen user enumeration)
        flash(f"Indien het account '{email}' bestaat en nog niet geactiveerd is, hebben we een nieuwe bevestigingsmail gestuurd.", "info")
        return redirect(url_for('login'))

    return render_template('resend_confirmation.html')

@app.route('/activate-developer/<token>', methods=['GET', 'POST'])
def activate_developer(token):
    """Specifieke activatieroute voor de app ontwikkelaar (Kenny)."""
    email = verify_token(token, salt='activate-dev', max_age=604800) # 7 dagen geldig
    if not email:
        flash("Deze activatielink is ongeldig of verlopen.", "danger")
        return redirect(url_for('login'))

    db = get_request_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

    if request.method == 'POST':
        name = request.form.get('name', 'Kenny De Meester').strip()
        password = request.form.get('password', '')
        password_confirm = request.form.get('password_confirm', '')

        if len(password) < 6:
            flash("Wachtwoord moet minimaal 6 tekens lang zijn.", "danger")
            return render_template('activate_developer.html', email=email, user=user)
        if password != password_confirm:
            flash("Wachtwoorden komen niet overeen.", "danger")
            return render_template('activate_developer.html', email=email, user=user)

        hashed_password = generate_password_hash(password)
        existing = db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
        if existing:
            db.execute("""
                UPDATE users
                SET name = ?, password_hash = ?, is_verified = 1, role = 'developer'
                WHERE email = ?
            """, (name, hashed_password, email))
        else:
            db.execute("""
                INSERT INTO users (name, email, password_hash, role, is_verified)
                VALUES (?, ?, ?, 'developer', 1)
            """, (name, email, hashed_password))
        db.commit()

        updated_user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        session.clear()
        session['user_id'] = updated_user['id']
        flash("Welkom Kenny! Je ontwikkelaarsaccount is geactiveerd en je bent direct ingelogd.", "success")
        return redirect(url_for('manage_roles'))

    return render_template('activate_developer.html', email=email, user=user)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if g.user:
        return redirect(url_for('index'))

    next_url = request.args.get('next')

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')

        db = get_request_db()
        user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        if user and check_password_hash(user['password_hash'], password):
            session.clear()
            session['user_id'] = user['id']
            flash(f"Welkom terug, {user['name']}!", "success")
            return redirect(next_url or url_for('index'))
        else:
            flash("Ongeldig e-mailadres of wachtwoord.", "danger")

    return render_template('login.html', next=next_url)

@app.route('/logout')
def logout():
    session.clear()
    flash("Je bent succesvol uitgelogd.", "info")
    return redirect(url_for('index'))

# --- WACHTWOORD VERGETEN & HERSTELLEN ---

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        db = get_request_db()
        user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        if user:
            token = generate_token(email, salt='reset-password')
            reset_url = url_for('reset_password', token=token, _external=True)
            send_password_reset_email(email, user['name'], reset_url)

        # Altijd dezelfde melding tonen (veilig conform security best practices)
        flash(
            f"Als het e-mailadres '{email}' bij ons geregistreerd staat, "
            "hebben we zojuist een e-mail gestuurd met een herstellink. Controleer je inbox en spam-folder.",
            "info"
        )
        return redirect(url_for('login'))

    return render_template('forgot_password.html')

@app.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    email = verify_token(token, salt='reset-password', max_age=3600) # 1 uur geldig
    if not email:
        flash("De wachtwoord-herstellink is ongeldig of verlopen (ouder dan 1 uur). Vraag opnieuw een herstellink aan.", "danger")
        return redirect(url_for('forgot_password'))

    db = get_request_db()
    user = db.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not user:
        flash("Gebruiker niet gevonden.", "danger")
        return redirect(url_for('login'))

    if request.method == 'POST':
        password = request.form.get('password', '')
        password_confirm = request.form.get('password_confirm', '')

        if len(password) < 6:
            flash("Nieuw wachtwoord moet minimaal 6 tekens bevatten.", "danger")
            return render_template('reset_password.html', email=email)
        if password != password_confirm:
            flash("Wachtwoorden komen niet overeen.", "danger")
            return render_template('reset_password.html', email=email)

        # Versleutel met sterke PBKDF2/SHA-256 hash (GDPR)
        new_hash = generate_password_hash(password)
        db.execute("""
            UPDATE users
            SET password_hash = ?, is_verified = 1
            WHERE id = ?
        """, (new_hash, user['id']))
        db.commit()

        # Automatisch inloggen
        session.clear()
        session['user_id'] = user['id']
        flash("Je wachtwoord is succesvol gewijzigd! Je bent nu ingelogd.", "success")
        return redirect(url_for('index'))

    return render_template('reset_password.html', email=email)

# --- HOOFDPAGINA & OVERZICHT ---

@app.route('/')
def index():
    db = get_request_db()
    filter_type = request.args.get('type', 'all')

    query = """
        SELECT s.*, u.name as creator_name,
               (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id AND r.status = 'present') as present_count,
               (SELECT COUNT(*) FROM registrations r WHERE r.session_id = s.id AND r.status = 'maybe') as maybe_count
        FROM sessions s
        JOIN users u ON s.creator_id = u.id
    """
    params = []
    if filter_type in ['training', 'event']:
        query += " WHERE s.session_type = ?"
        params.append(filter_type)

    query += " ORDER BY s.date ASC, s.start_time ASC"
    sessions_list = db.execute(query, params).fetchall()

    my_registrations = {}
    if g.user:
        user_regs = db.execute(
            "SELECT session_id, status FROM registrations WHERE user_id = ?",
            (g.user['id'],)
        ).fetchall()
        for r in user_regs:
            my_registrations[r['session_id']] = r['status']

    stats = {
        'total_sessions': len(sessions_list),
        'trainings_count': sum(1 for s in sessions_list if s['session_type'] == 'training'),
        'events_count': sum(1 for s in sessions_list if s['session_type'] == 'event'),
        'total_km': sum(s['distance_km'] or 0 for s in sessions_list)
    }

    return render_template('index.html', sessions=sessions_list, my_registrations=my_registrations, filter_type=filter_type, stats=stats)

# --- SESSIE DETAILS & INTEKENINGEN ---

@app.route('/sessions/<int:session_id>')
def session_detail(session_id):
    db = get_request_db()
    sess = db.execute("""
        SELECT s.*, u.name as creator_name, u.role as creator_role
        FROM sessions s
        JOIN users u ON s.creator_id = u.id
        WHERE s.id = ?
    """, (session_id,)).fetchone()

    if not sess:
        abort(404)

    registrations = db.execute("""
        SELECT r.*, u.name as user_name
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        WHERE r.session_id = ?
        ORDER BY r.registered_at ASC
    """, (session_id,)).fetchall()

    my_registration = None
    if g.user:
        my_registration = db.execute(
            "SELECT * FROM registrations WHERE session_id = ? AND user_id = ?",
            (session_id, g.user['id'])
        ).fetchone()

    # Mogen bewerken: alleen maker OF admin OF developer
    can_edit = False
    if g.user:
        if g.user['id'] == sess['creator_id'] or g.user['role'] in ['admin', 'developer']:
            can_edit = True

    present_list = [r for r in registrations if r['status'] == 'present']
    maybe_list = [r for r in registrations if r['status'] == 'maybe']
    absent_list = [r for r in registrations if r['status'] == 'absent']

    return render_template('session_detail.html',
                           sess=sess,
                           can_edit=can_edit,
                           my_registration=my_registration,
                           present_list=present_list,
                           maybe_list=maybe_list,
                           absent_list=absent_list,
                           total_registrations=len(registrations))

# --- INTEKENEN OP SESSIE ---

@app.route('/sessions/<int:session_id>/register', methods=['POST'])
@login_required
def register_for_session(session_id):
    status = request.form.get('status', 'present')
    note = request.form.get('note', '').strip()

    if status not in ['present', 'maybe', 'absent']:
        status = 'present'

    db = get_request_db()
    sess = db.execute("SELECT id, title FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if not sess:
        abort(404)

    db.execute("""
        INSERT INTO registrations (session_id, user_id, status, note, registered_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(session_id, user_id) DO UPDATE SET
            status = excluded.status,
            note = excluded.note,
            registered_at = CURRENT_TIMESTAMP
    """, (session_id, g.user['id'], status, note))
    db.commit()

    status_nl = {'present': 'aanwezig gemeld', 'maybe': 'op misschien gezet', 'absent': 'afgemeld'}.get(status)
    flash(f"Je aanwezigheid voor '{sess['title']}' is bijgewerkt ({status_nl}).", "success")
    return redirect(url_for('session_detail', session_id=session_id))

@app.route('/sessions/<int:session_id>/unregister', methods=['POST'])
@login_required
def unregister_from_session(session_id):
    db = get_request_db()
    db.execute("DELETE FROM registrations WHERE session_id = ? AND user_id = ?", (session_id, g.user['id']))
    db.commit()
    flash("Je inschrijving is geannuleerd.", "info")
    return redirect(url_for('session_detail', session_id=session_id))

# --- SESSIE AANMAKEN & BEWERKEN ---

@app.route('/sessions/new', methods=['GET', 'POST'])
@login_required
def new_session():
    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        session_type = request.form.get('session_type', 'training')
        date = request.form.get('date', '').strip()
        start_time = request.form.get('start_time', '').strip()
        location = request.form.get('location', '').strip()
        distance_km = request.form.get('distance_km', '').strip()
        target_pace = request.form.get('target_pace', '').strip()
        description = request.form.get('description', '').strip()
        route_url = request.form.get('route_url', '').strip()

        errors = []
        if not title:
            errors.append("Titel is verplicht.")
        if not date:
            errors.append("Datum is verplicht.")
        if not start_time:
            errors.append("Starttijd is verplicht.")
        if not location:
            errors.append("Startlocatie is verplicht.")

        parsed_distance = None
        if distance_km:
            try:
                parsed_distance = float(distance_km.replace(',', '.'))
                if parsed_distance < 0:
                    errors.append("Afstand moet een positief getal zijn.")
            except ValueError:
                errors.append("Afstand moet een geldig getal zijn (bv. 25 of 42.5).")

        if errors:
            for err in errors:
                flash(err, "danger")
            return render_template('session_form.html', sess=request.form, action='new')

        db = get_request_db()
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO sessions (title, session_type, date, start_time, location, distance_km, target_pace, description, route_url, creator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (title, session_type, date, start_time, location, parsed_distance, target_pace, description, route_url, g.user['id']))
        new_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO registrations (session_id, user_id, status, note)
            VALUES (?, ?, 'present', 'Aangemaakt door organisator')
        """, (new_id, g.user['id']))

        db.commit()
        flash("Sessie / event succesvol aangemaakt! Je bent automatisch geregistreerd als aanwezig.", "success")
        return redirect(url_for('session_detail', session_id=new_id))

    return render_template('session_form.html', sess={}, action='new')

@app.route('/sessions/<int:session_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_session(session_id):
    db = get_request_db()
    sess = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if not sess:
        abort(404)

    if g.user['id'] != sess['creator_id'] and g.user['role'] not in ['admin', 'developer']:
        flash("Je hebt geen rechten om deze sessie te bewerken. Alleen de maker en administrators mogen dit.", "danger")
        return redirect(url_for('session_detail', session_id=session_id))

    if request.method == 'POST':
        title = request.form.get('title', '').strip()
        session_type = request.form.get('session_type', 'training')
        date = request.form.get('date', '').strip()
        start_time = request.form.get('start_time', '').strip()
        location = request.form.get('location', '').strip()
        distance_km = request.form.get('distance_km', '').strip()
        target_pace = request.form.get('target_pace', '').strip()
        description = request.form.get('description', '').strip()
        route_url = request.form.get('route_url', '').strip()

        errors = []
        if not title:
            errors.append("Titel is verplicht.")
        if not date:
            errors.append("Datum is verplicht.")
        if not start_time:
            errors.append("Starttijd is verplicht.")
        if not location:
            errors.append("Startlocatie is verplicht.")

        parsed_distance = None
        if distance_km:
            try:
                parsed_distance = float(distance_km.replace(',', '.'))
                if parsed_distance < 0:
                    errors.append("Afstand moet een positief getal zijn.")
            except ValueError:
                errors.append("Afstand moet een geldig getal zijn.")

        if errors:
            for err in errors:
                flash(err, "danger")
            return render_template('session_form.html', sess=request.form, action='edit', session_id=session_id)

        db.execute("""
            UPDATE sessions
            SET title = ?, session_type = ?, date = ?, start_time = ?,
                location = ?, distance_km = ?, target_pace = ?, description = ?,
                route_url = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (title, session_type, date, start_time, location, parsed_distance, target_pace, description, route_url, session_id))
        db.commit()

        flash("Sessie succesvol bijgewerkt!", "success")
        return redirect(url_for('session_detail', session_id=session_id))

    return render_template('session_form.html', sess=sess, action='edit', session_id=session_id)

@app.route('/sessions/<int:session_id>/delete', methods=['POST'])
@login_required
def delete_session(session_id):
    db = get_request_db()
    sess = db.execute("SELECT * FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if not sess:
        abort(404)

    if g.user['id'] != sess['creator_id'] and g.user['role'] not in ['admin', 'developer']:
        flash("Geen toestemming om deze sessie te verwijderen.", "danger")
        return redirect(url_for('session_detail', session_id=session_id))

    db.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    db.commit()
    flash(f"Sessie '{sess['title']}' is verwijderd.", "info")
    return redirect(url_for('index'))

# --- ROLLENBEHEER (EXCLUSIEF VOOR APP ONTWIKKELAAR) ---

@app.route('/developer/roles', methods=['GET', 'POST'])
@login_required
@developer_required
def manage_roles():
    db = get_request_db()

    if request.method == 'POST':
        action = request.form.get('action', 'change_role')
        target_user_id = request.form.get('user_id')

        if action == 'reset_password':
            new_pass = request.form.get('new_password', '').strip()
            target_user = db.execute("SELECT name FROM users WHERE id = ?", (target_user_id,)).fetchone()
            if not target_user:
                flash("Gebruiker niet gevonden.", "danger")
            elif len(new_pass) < 6:
                flash("Wachtwoord moet minimaal 6 tekens bevatten.", "danger")
            else:
                new_hash = generate_password_hash(new_pass)
                db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, target_user_id))
                db.commit()
                flash(f"Wachtwoord voor '{target_user['name']}' is direct gereset naar '{new_pass}'.", "success")
            return redirect(url_for('manage_roles'))

        new_role = request.form.get('role')

        if new_role not in ['user', 'admin', 'developer']:
            flash("Ongeldige rol opgegeven.", "danger")
            return redirect(url_for('manage_roles'))

        target_user = db.execute("SELECT * FROM users WHERE id = ?", (target_user_id,)).fetchone()
        if not target_user:
            flash("Gebruiker niet gevonden.", "danger")
            return redirect(url_for('manage_roles'))

        if target_user['role'] == 'developer' and new_role != 'developer':
            dev_count = db.execute("SELECT COUNT(*) as c FROM users WHERE role = 'developer'").fetchone()['c']
            if dev_count <= 1:
                flash("Er moet altijd ten minste 1 app ontwikkelaar geregistreerd blijven.", "warning")
                return redirect(url_for('manage_roles'))

        db.execute("UPDATE users SET role = ? WHERE id = ?", (new_role, target_user_id))
        db.commit()
        flash(f"Rol van '{target_user['name']}' succesvol gewijzigd naar '{new_role.upper()}'.", "success")
        return redirect(url_for('manage_roles'))

    users = db.execute("""
        SELECT u.*,
               (SELECT COUNT(*) FROM sessions s WHERE s.creator_id = u.id) as sessions_created,
               (SELECT COUNT(*) FROM registrations r WHERE r.user_id = u.id) as registrations_count
        FROM users u
        ORDER BY CASE u.role WHEN 'developer' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, u.name ASC
    """).fetchall()

    return render_template('developer_roles.html', users=users)

# --- PROFIEL & GDPR PRIVACY OVERZICHT ---

@app.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    db = get_request_db()

    if request.method == 'POST':
        action = request.form.get('action')

        if action == 'update_info':
            name = request.form.get('name', '').strip()
            phone = request.form.get('phone', '').strip()
            emergency = request.form.get('emergency_contact', '').strip()

            if len(name) < 2:
                flash("Naam moet minimaal 2 tekens zijn.", "danger")
            else:
                db.execute("UPDATE users SET name = ?, phone = ?, emergency_contact = ? WHERE id = ?",
                           (name, phone, emergency, g.user['id']))
                db.commit()
                flash("Profielgegevens succesvol bijgewerkt.", "success")
            return redirect(url_for('profile'))

        elif action == 'change_password':
            old_pass = request.form.get('old_password', '')
            new_pass = request.form.get('new_password', '')
            new_pass_confirm = request.form.get('new_password_confirm', '')

            if not check_password_hash(g.user['password_hash'], old_pass):
                flash("Huidig wachtwoord is onjuist.", "danger")
            elif len(new_pass) < 6:
                flash("Nieuw wachtwoord moet minimaal 6 tekens zijn.", "danger")
            elif new_pass != new_pass_confirm:
                flash("Nieuwe wachtwoorden komen niet overeen.", "danger")
            else:
                new_hash = generate_password_hash(new_pass)
                db.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, g.user['id']))
                db.commit()
                flash("Wachtwoord succesvol gewijzigd! Veilig versleuteld conform GDPR.", "success")
            return redirect(url_for('profile'))

    my_created_sessions = db.execute("SELECT * FROM sessions WHERE creator_id = ? ORDER BY date DESC", (g.user['id'],)).fetchall()
    my_registrations = db.execute("""
        SELECT r.*, s.title, s.date, s.start_time, s.location, s.session_type, s.distance_km
        FROM registrations r
        JOIN sessions s ON r.session_id = s.id
        WHERE r.user_id = ?
        ORDER BY s.date DESC
    """, (g.user['id'],)).fetchall()

    return render_template('profile.html', my_created=my_created_sessions, my_regs=my_registrations)

# GDPR Gegevensexport (Recht op dataportabiliteit)
@app.route('/profile/export-data')
@login_required
def export_my_data():
    db = get_request_db()
    user_data = dict(g.user)
    user_data.pop('password_hash', None)

    my_created = [dict(s) for s in db.execute("SELECT * FROM sessions WHERE creator_id = ?", (g.user['id'],)).fetchall()]
    my_regs = [dict(r) for r in db.execute("""
        SELECT r.*, s.title as session_title, s.date as session_date
        FROM registrations r
        JOIN sessions s ON r.session_id = s.id
        WHERE r.user_id = ?
    """, (g.user['id'],)).fetchall()]

    export = {
        "gdpr_verklaring": "Overzicht van alle persoonsgegevens conform Algemene Verordening Gegevensbescherming (AVG/GDPR).",
        "gebruiker": user_data,
        "aangemaakte_sessies": my_created,
        "intekeningen": my_regs
    }
    return jsonify(export)

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='127.0.0.1', port=5000)
