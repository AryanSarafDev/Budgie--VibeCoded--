# Budgie

<img width="1354" height="738" alt="Logo" src="https://github.com/user-attachments/assets/d2381ed2-4af8-4d73-96fa-076fd794b2bf" />

Budgie is a monthly savings and goal-planning app that helps you decide where your money should go, then tracks progress over time.

This project is vibe coded: built through rapid iteration with hands-on product feedback and AI-assisted development.

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
- AI advisor integration with fallback when API is unavailable or rate-limited

## Tech Stack

- React
- Vite
- Plain CSS
- Gemini API (optional, via environment variable)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set environment variables (optional for AI)

Create a `.env` file in project root:

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

### 3. Start development server

```bash
npm run dev
```

### 4. Build for production

```bash
npm run build
```

## Notes

- App data is stored in browser localStorage.
- If AI quota is exhausted, Budgie automatically falls back to a local smart recommendation plan.

## Status

Actively evolving with ongoing UX and layout refinements.
