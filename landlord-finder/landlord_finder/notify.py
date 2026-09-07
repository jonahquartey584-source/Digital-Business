"""Cross-platform desktop notification + optional email, with no paid/cloud
dependency and nothing that needs code-signing or an app store."""

from __future__ import annotations

import platform
import smtplib
import subprocess
from email.mime.text import MIMEText


def desktop_notify(title: str, message: str) -> None:
    system = platform.system()
    try:
        if system == "Linux":
            subprocess.run(["notify-send", title, message], check=False)
        elif system == "Darwin":
            script = f'display notification "{message}" with title "{title}"'
            subprocess.run(["osascript", "-e", script], check=False)
        elif system == "Windows":
            # BurntToast-free PowerShell balloon-tip fallback; works on stock Windows.
            ps = (
                "Add-Type -AssemblyName System.Windows.Forms; "
                "$n = New-Object System.Windows.Forms.NotifyIcon; "
                "$n.Icon = [System.Drawing.SystemIcons]::Information; "
                f"$n.BalloonTipTitle = '{title}'; $n.BalloonTipText = '{message}'; "
                "$n.Visible = $true; $n.ShowBalloonTip(10000);"
            )
            subprocess.run(["powershell", "-Command", ps], check=False)
        else:
            print(f"[{title}] {message}")
    except FileNotFoundError:
        # notify-send/osascript/powershell not available in this environment — degrade gracefully.
        print(f"[{title}] {message}")


def email_notify(config_email: dict, subject: str, body: str) -> None:
    host = (config_email or {}).get("smtp_host")
    if not host:
        return  # email not configured; silently skip

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = config_email.get("from_addr", "")
    msg["To"] = config_email.get("to_addr", "")

    with smtplib.SMTP(host, config_email.get("smtp_port", 587)) as server:
        server.starttls()
        username = config_email.get("username")
        password = config_email.get("password")
        if username and password:
            server.login(username, password)
        server.sendmail(msg["From"], [msg["To"]], msg.as_string())


def notify_new_matches(notifications_config: dict, new_matches: list[dict]) -> None:
    if not new_matches:
        return

    count = len(new_matches)
    title = "Landlord Finder: new matches"
    top = new_matches[0]
    message = f"{count} new private-landlord listing(s) match your criteria. Top: {top.get('title', '(untitled)')}"

    method = (notifications_config or {}).get("method", "desktop")
    if method == "desktop":
        desktop_notify(title, message)
    elif method != "none":
        print(f"[landlord-finder] Unknown notification method '{method}', printing instead.")
        print(f"[{title}] {message}")

    email_cfg = (notifications_config or {}).get("email")
    if email_cfg and email_cfg.get("smtp_host"):
        body_lines = [
            f"- {m.get('title')} | ${m.get('price')} | {m.get('location')} | "
            f"confidence={m.get('landlord_confidence'):.2f} | {m.get('url')}"
            for m in new_matches
        ]
        email_notify(email_cfg, title, "\n".join(body_lines))
