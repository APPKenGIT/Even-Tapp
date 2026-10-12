import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature

# Geheime sleutel voor token hashing
SECRET_KEY = os.environ.get('SECRET_KEY', 'dodentocht_secret_key_training_2026_super_veilig')
SECURITY_PASSWORD_SALT = os.environ.get('SECURITY_PASSWORD_SALT', 'dodentocht_salt_tokens_2026')

# SMTP E-mailconfiguratie (via omgevingsvariabelen in te stellen)
SMTP_HOST = os.environ.get('SMTP_HOST', '')          # bv. 'smtp.gmail.com'
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))  # 587 voor TLS, 465 voor SSL
SMTP_USER = os.environ.get('SMTP_USER', '')          # bv. 'jouw-email@gmail.com'
SMTP_PASS = os.environ.get('SMTP_PASS', '')          # bv. Google App Wachtwoord
SMTP_FROM = os.environ.get('SMTP_FROM', 'Dodentocht Teamtraining <noreply@dodentocht-team.be>')

LOG_FILE = os.path.join(os.path.dirname(__file__), 'sent_emails.log')

def get_serializer():
    return URLSafeTimedSerializer(SECRET_KEY)

def generate_token(email, salt='email-confirm'):
    serializer = get_serializer()
    return serializer.dumps(email, salt=salt)

def verify_token(token, salt='email-confirm', max_age=86400):
    """
    Controleer token. Standaard max_age is 86400 seconden (24 uur).
    Voor wachtwoordreset kan max_age bijvoorbeeld 3600 seconden (1 uur) zijn.
    """
    serializer = get_serializer()
    try:
        email = serializer.loads(token, salt=salt, max_age=max_age)
        return email
    except (SignatureExpired, BadSignature):
        return None

def log_email_to_file(to_email, subject, content, link=None):
    """Slaat e-mails op in sent_emails.log voor inspectie en als fallback bij offline/lokaal gebruik."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, 'a', encoding='utf-8') as f:
        f.write(f"\n{'='*70}\n")
        f.write(f"TIJDSTIP : {timestamp}\n")
        f.write(f"AAN      : {to_email}\n")
        f.write(f"ONDERWERP: {subject}\n")
        if link:
            f.write(f"ACTIELINK: {link}\n")
        f.write(f"INHOUD   :\n{content}\n")
        f.write(f"{'='*70}\n")

def send_email(to_email, subject, html_content, text_content=None, action_link=None):
    """
    Verzendt een e-mail via SMTP indien geconfigureerd.
    Logt de e-mail altijd naar sent_emails.log voor betrouwbaarheid en fallback.
    """
    log_email_to_file(to_email, subject, text_content or html_content, action_link)

    # Indien SMTP gegevens zijn ingevuld, versturen we over het internet
    if SMTP_HOST and SMTP_USER and SMTP_PASS:
        try:
            msg = MIMEMultipart("alternative")
            msg['Subject'] = subject
            msg['From'] = SMTP_FROM
            msg['To'] = to_email

            if text_content:
                msg.attach(MIMEText(text_content, "plain", "utf-8"))
            msg.attach(MIMEText(html_content, "html", "utf-8"))

            if SMTP_PORT == 465:
                with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                    server.login(SMTP_USER, SMTP_PASS)
                    server.sendmail(SMTP_FROM, [to_email], msg.as_string())
            else:
                with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                    server.starttls()
                    server.login(SMTP_USER, SMTP_PASS)
                    server.sendmail(SMTP_FROM, [to_email], msg.as_string())
            print(f"[E-MAIL] Succesvol verstuurd via SMTP naar {to_email}")
            return True, "Verstuurd via SMTP"
        except Exception as e:
            err_msg = f"SMTP verzendfout naar {to_email}: {str(e)}"
            print(f"[E-MAIL WAARSCHUWING] {err_msg}")
            return False, err_msg
    else:
        print(f"[E-MAIL SIMULATIE] E-mail voor {to_email} opgeslagen in sent_emails.log (SMTP nog niet ingesteld)")
        return True, "Opgeslagen in lokaal e-maillogboek (stel SMTP_HOST/USER/PASS in voor live verzending)"

def send_verification_email(to_email, name, confirm_url):
    subject = "Bevestig je aanmelding voor Dodentocht Teamtraining"
    text_content = f"""Hallo {name},

Bedankt voor je registratie op de Dodentocht Teamtraining Planner!

Klik op onderstaande link om je e-mailadres te bevestigen en je account te activeren:
{confirm_url}

Deze link is 24 uur geldig.

Sportieve groeten,
Het Dodentocht Team
"""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 6px solid #1b4332;">
            <h2 style="color: #1b4332; margin-top: 0;">🥾 Welkom bij het Dodentocht Team!</h2>
            <p>Beste <strong>{name}</strong>,</p>
            <p>Fijn dat je meedoet! Om je aanmelding op de app te voltooien en intekeningen onder jouw naam te activeren, vragen we je om je e-mailadres te bevestigen.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{confirm_url}" style="background-color: #1b4332; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                    ✅ Bevestig Mijn Aanmelding
                </a>
            </div>
            <p style="font-size: 13px; color: #64748b;">Werkt de knop niet? Kopieer en plak dan deze link in je browser:<br>
                <a href="{confirm_url}" style="color: #1b4332;">{confirm_url}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">
                Deze link is 24 uur geldig conform privacy- en veiligheidsnormen (GDPR). Wachtwoorden zijn onomkeerbaar versleuteld.
            </p>
        </div>
    </body>
    </html>
    """
    return send_email(to_email, subject, html_content, text_content, confirm_url)

def send_password_reset_email(to_email, name, reset_url):
    subject = "Wachtwoord herstellen - Dodentocht Teamtraining"
    text_content = f"""Hallo {name},

We hebben een verzoek ontvangen om het wachtwoord van je account te herstellen.

Klik op onderstaande link om een nieuw wachtwoord in te stellen:
{reset_url}

Deze link is 1 uur geldig. Heb je dit niet aangevraagd? Dan kun je deze mail veilig negeren.

Sportieve groeten,
Het Dodentocht Team
"""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 6px solid #fb8500;">
            <h2 style="color: #1b4332; margin-top: 0;">🔐 Wachtwoord Herstellen</h2>
            <p>Beste <strong>{name}</strong>,</p>
            <p>Je hebt een aanvraag ingediend om het wachtwoord van je account op de Dodentocht Teamtraining Planner te herstellen.</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" style="background-color: #fb8500; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                    Stel Nieuw Wachtwoord In
                </a>
            </div>
            <p style="font-size: 13px; color: #64748b;">Werkt de knop niet? Kopieer en plak dan deze link in je browser:<br>
                <a href="{reset_url}" style="color: #fb8500;">{reset_url}</a>
            </p>
            <p style="font-size: 13px; color: #64748b;">Deze link is <strong>1 uur</strong> geldig uit veiligheidsoverwegingen.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">
                Heb je dit verzoek niet zelf ingediend? Negeer deze e-mail gerust. Je huidige wachtwoord blijft ongewijzigd en veilig gehasht.
            </p>
        </div>
    </body>
    </html>
    """
    return send_email(to_email, subject, html_content, text_content, reset_url)

def send_developer_welcome_email(to_email, name, activate_url):
    subject = "Welkom App Ontwikkelaar - Dodentocht Teamtraining Planner"
    text_content = f"""Beste {name},

Jouw account is als enige App Ontwikkelaar ingesteld voor de Dodentocht Teamtraining Planner.

Gebruik onderstaande link om je ontwikkelaarsaccount te bevestigen en je persoonlijke wachtwoord in te stellen:
{activate_url}

Als App Ontwikkelaar heb jij exclusieve toegang tot het Gebruikers- en Rollenbeheer.

Sportieve groeten,
Dodentocht Registratie Systeem
"""
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 12px; padding: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 6px solid #ffb703;">
            <h2 style="color: #1b4332; margin-top: 0;">👑 Welkom, App Ontwikkelaar!</h2>
            <p>Beste <strong>{name}</strong> (<code>{to_email}</code>),</p>
            <p>Jouw e-mailadres is ingesteld als de <strong>enige officiële App Ontwikkelaar</strong> van het Dodentocht Teamtraining planningsplatform.</p>
            <p>Klik op de onderstaande knop om je account direct te activeren en je wachtwoord in te stellen:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{activate_url}" style="background-color: #ffb703; color: #1e293b; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                    🚀 Activeer Ontwikkelaarsaccount
                </a>
            </div>
            <p style="font-size: 13px; color: #64748b;">Directe link:<br>
                <a href="{activate_url}" style="color: #1b4332;">{activate_url}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
            <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">
                Met deze rol kun je als enige administrators aanduiden en rollen van deelnemers beheren.
            </p>
        </div>
    </body>
    </html>
    """
    return send_email(to_email, subject, html_content, text_content, activate_url)
