# GridWise Energy

A personal electricity carbon footprint tracker that helps users in Arizona
shift energy use to the cleanest hours of the day. Log appliance usage, compare
it against grid carbon intensity, and move heavy loads to when solar and nuclear
baseload are abundant.

Built in 24 hours for HackAZ 2026 on the AI for Environmental Sustainability
track. Deployed as Griddaddy at [griddaddy.us](https://griddaddy.us).

## Features

- **Appliance tracking.** Log daily usage of heavy appliances: HVAC, EV charger, pool pump, dryer.
- **Carbon impact.** Estimates CO2 emissions from your habits, your home size, and the local energy mix.
- **Grid data.** Pulls real-time grid intensity, falling back to a simulated Arizona baseline when the feed is unavailable.
- **Insights.** Seven-day carbon trends, your worst habit, and the single shift that would save the most.
- **Baseload awareness.** Shows how much of the current mix comes from clean baseload such as Palo Verde.
- **Leaderboard.** Opt-in ranking against other users by emissions saved.

## Stack

| | |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Charts | Recharts |
| Backend | Vercel serverless functions |
| Database | Vercel Postgres (Neon) |
| Auth | Auth0 |
| AI | Google Gemini for the chatbot, ridge regression for the grid forecast |

## Running it

Requires Node 18 or newer.

```bash
npm install
cp .env.example .env    # fill in Auth0, Postgres, and Gemini keys
npm run dev
```

Vite serves on `http://localhost:5173`. `npm run build` produces a production
build and `npm run preview` serves it locally.

## Built by

Heng-Pok, Nathan Tebbs, John Imanishimwe, and gsw2019.
