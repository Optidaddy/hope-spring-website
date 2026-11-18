# Hope Spring — v2

## What changed
- Python + Flask backend replaces the Node/Express server.
- SQLite persists M-Pesa checkout requests and callback results.
- Separate Home, About, Programs, Stories and Contact pages.
- Dark/light mode preference persists in the browser.
- Stronger light-mode contrast and a visible Donate Now button.
- Language selector for English, Kiswahili, French and Spanish (navigation/primary CTA translations currently provided).
- Upendo has a more prominent floating launcher.

## Run locally (Windows PowerShell)
```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
Copy-Item .env.example .env
py app.py
```
Open http://localhost:3000. If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal, or use `.venv\Scripts\python.exe -m pip install -r requirements.txt` and `.venv\Scripts\python.exe app.py` without activation.

## Daraja setup
Fill `.env` with NEW credentials generated in Daraja, your shortcode, Lipa Na M-Pesa passkey and a publicly reachable HTTPS callback URL. Keep `.env` private and never commit it. Begin with `DARAJA_ENV=sandbox`; production credentials and approval are required for live customer charges. A callback cannot reach localhost; use a secure public HTTPS deployment/tunnel for sandbox callbacks.

The backend sends real Daraja STK Push requests when configured; there is no fake success mode. It records request/callback status in SQLite. Before public production use, deploy persistent storage/backups and independently reconcile callback results using Safaricom transaction-query facilities; do not treat an unverified browser message as proof of payment.

## Important content note
Impact statistics, programme progress and story dates/text are illustrative placeholders. Replace them with verified organisational information before publishing. The language menu currently translates navigation and main donation CTA; full-page professional translations are a separate content task.
