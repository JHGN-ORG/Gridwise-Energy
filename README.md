# Griddaddy 🌱⚡️

Griddaddy is a personal electricity carbon footprint tracker designed to help users in Arizona (and beyond) shift their energy use to the cleanest times of the day. By tracking appliance usage and comparing it against live or simulated grid intensity, Griddaddy empowers users to reduce their carbon emissions through **Demand Response**—shifting heavy loads to times when clean energy (like solar and nuclear baseload) is abundant.

## 🚀 Features

- **Appliance Tracking:** Log daily usage of heavy appliances (HVAC, EV charger, pool pump, dryer).
- **Carbon Impact Calculation:** See the estimated CO₂ emissions of your habits based on your home size and the local energy mix.
- **Live Grid Data:** Integrates with real-time grid intensity data (or falls back to a simulated Arizona baseline).
- **Personalized Insights:** View your 7-day carbon trends, identify your "worst habit," and discover your best opportunity to save emissions by shifting usage.
- **Nuclear Baseload Awareness:** Highlights the percentage of energy coming from clean baseload sources like the Palo Verde Nuclear Generating Station.

## 🛠 Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Styling:** Tailwind CSS, shadcn/ui
- **Charting:** Recharts
- **Backend/Database:** Supabase (optional integration), Vercel Serverless Functions

## 💻 Getting Started

Follow these instructions to get the project up and running on your local machine.

### Prerequisites

- Node.js (v18 or higher recommended)
- npm (Node Package Manager)

### Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd Gridwise-Energy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Copy the example environment file and fill in any required API keys (like Supabase or grid APIs, if applicable):
   ```bash
   cp .env.example .env
   ```

### Running the App Locally

To start the development server:

```bash
npm run dev
```

The terminal will provide a local URL (typically `http://localhost:5173`). Open this URL in your web browser to view the application.

### Building for Production

To create a production build:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## 🤝 Contributing

Contributions are welcome! If you're participating in the Hackathon, check the project tasks to see where you can add meaningful AI/ML integrations, such as an LLM-powered energy coach or predictive grid forecasting.

---
*Built for the AI for Environmental Sustainability Hackathon Track.*
