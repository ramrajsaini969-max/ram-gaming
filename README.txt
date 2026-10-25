RAM GAMING WEBSITE PROTOTYPE

Open on Mac:
1. Download and unzip ram-gaming-prototype.zip.
2. Open the folder and double-click index.html.

Includes:
- English dark gaming design, mobile responsive
- Your uploaded portrait in the hero/top section
- Your uploaded QR image included as-is
- UPI ID 9376090619@fam and contact number 9376090619
- Demo tournament editor, mobile OTP UI, and team-details form

IMPORTANT:
This is a front-end demo only. The OTP is generated in the browser and is NOT sent by SMS. Admin demo PIN is 2468 and can be seen in js/app.js; it is not secure. Tournament changes are saved only in this browser, not for all visitors. Team forms are stored only locally. Payments are not processed or verified and the organizer is not notified.

For a real public website, add a backend/database, server-side admin login, SMS OTP provider, and payment gateway with server-side webhook verification. Recommended real flow: phone OTP login -> choose tournament -> payment order -> payment gateway confirms via backend webhook -> team details form unlocks -> registration appears in organizer dashboard. Do not trust browser PINs, localStorage, uploaded screenshots, or user-entered UTR as payment proof. Never put API secrets in browser JavaScript.
