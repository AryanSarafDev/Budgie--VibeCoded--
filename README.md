# Budgie

<img width="1354" height="738" alt="Logo" src="https://github.com/user-attachments/assets/d2381ed2-4af8-4d73-96fa-076fd794b2bf" />

Budgie is a monthly savings and goal-planning app that helps you decide where your money should go, then tracks progress over time.

This project is vibe coded: built through rapid iteration with hands-on product feedback and AI-assisted development.

Deployed here --> https://budgie-vibe-coded.vercel.app/

<img width="720" height="1600" alt="image" src="https://github.com/user-attachments/assets/789b7604-aa3e-4f9d-81a9-abfccade6f2c" />
<img width="1428" height="1297" alt="image" src="https://github.com/user-attachments/assets/0dbd2c33-6385-4bfa-9763-cd1c7542141f" />

<img width="1429" height="1152" alt="image" src="https://github.com/user-attachments/assets/4a65d1ba-2731-4b85-90c3-29ba41879215" />


## What Budgie Does

Budgie helps you:

- Add monthly salary
- Track expenses as line items
- Calculate your live monthly savings pool
- Create savings goals with priority and optional fixed percentage allocation
- Smartly distribute savings across goals
- Process month-by-month progress
- Buy goals when enough money is available
- View purchase history and spending analytics
- Generate AI plan suggestions for better allocation

## How It Works

1. Enter your monthly salary and recurring expenses.
2. Budgie computes your available savings pool.
3. Add goals with target amount, priority (high/medium/low), and optional fixed %.
4. The allocation engine:
   - Applies fixed percentages first
   - Scales if configured percentages exceed 100%
   - Distributes remaining pool by priority weight
   - Prevents over-allocation past goal target
5. Process each month to move allocated amounts into goal progress.
6. Use Buy when a goal is fundable via saved amount + available excess.

## Key Features

- Smart allocation with safeguards and normalization
- Expense list management (add/remove)
- Goal progress tracking with visual bars
- Purchase workflow and history
- Analytics page for spending trends and categories
- Local persistence (state survives refresh)
- Firebase Google Login + Firestore cloud sync (optional)
- AI advisor integration with fallback when API is unavailable or rate-limited

## Tech Stack

- React
- Vite
- Plain CSS
- Gemini API (optional, via environment variable)
- Firebase Auth + Firestore (optional, via environment variables)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables (optional for AI + Firebase)

Create a `.env` file in project root:

```env
VITE_GEMINI_API_KEY=your_api_key_here
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 3. Start development server

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build
```

## Firebase Setup (Cloud Sync)

Cloud saving is optional. If you skip this section, Budgie still works with local storage.

1. Create or select your Firebase project.
2. In Authentication, enable Google as a sign-in provider.
3. In Firestore Database, create a database in production mode or test mode.
4. Add the Firebase web app config values to your local `.env`.
5. Start the app and sign in with Google from the top-right login button.

### Firestore Rules

Use rules like this so each user can only read/write their own data:

```txt
rules_version = '2';
service cloud.firestore {
   match /databases/{database}/documents {
      match /budgieUsers/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
      }
   }
}
```

### Cloud Data Shape

- Collection: `budgieUsers`
- Document ID: authenticated Firebase UID
- Main field: `plannerState`
- Metadata fields: `updatedAt`, `email`

## Notes

- App data is stored in browser localStorage.
- If you sign in with Google, planner data is also synced to Firestore (`budgieUsers/{uid}`).
- Enable Google as a Sign-in provider in Firebase Console > Authentication before using login.
- If AI quota is exhausted, Budgie automatically falls back to a local smart recommendation plan.
- If cloud sync fails, the app continues in local mode and keeps your data in localStorage.

## Security

- Keep `.env` private and never commit secrets.
- If keys are ever shared publicly, rotate/regenerate them in provider consoles.

## Status

Actively evolving with ongoing UX and layout refinements.
