# MiniDesk

**Professional-grade Mac Mini M4 workstation bundles for Nigerian creators, freelancers, and professionals.**

> Your dream workstation, finally affordable.

---

## Overview

MiniDesk helps you configure and order complete Mac Mini M4 workstation setups — monitor, keyboard, accessories and all — at a price that makes sense. Built for professionals in Lagos and across Nigeria.

### Key Features

- **Bundle Configurator** — Choose between a Basic Work Bundle (from ₦850,000) or a Full Workspace Bundle (from ₦1,350,000)
- **Monitor Selection** — Four tiers: Entry (Dell SE2726HG), Mid (Dell S2725DS), Top (Dell S2725QS), and Creator's Choice (ASUS ProArt PA278CV)
- **Keyboard Pairing** — Smart keyboard gating based on your monitor selection (Apple Magic Keyboard unlocks with Mid-tier and above)
- **Optional Add-ons** — Laptop stand, SanDisk 1TB Extreme Portable SSD, and more
- **Dark / Light Mode** — Toggle between themes for comfortable browsing
- **Admin Dashboard** — Manage products, orders, and inventory
- **Online Payments** — Paystack and Flutterwave integration for seamless checkout

---

## Tech Stack

| Layer        | Technology                                  |
| ------------ | ------------------------------------------- |
| Frontend     | HTML · CSS · Vanilla JavaScript             |
| Backend      | Netlify Functions (serverless Node.js)      |
| Database     | Supabase (PostgreSQL)                       |
| Payments     | Paystack · Flutterwave                      |
| Email        | Resend                                      |
| Hosting      | Netlify                                     |

---

## Project Structure

```
MiniDesk/
├── index.html              # Main landing page & configurator
├── order-success.html      # Order confirmation page
├── css/
│   └── styles.css          # Global styles (dark/light themes)
├── js/
│   └── app.js              # Frontend logic (configurator, orders, theme toggle)
├── images/                 # Product & hero images
├── admin/                  # Admin dashboard
│   ├── index.html          # Admin panel
│   ├── login.html          # Admin login
│   ├── products.html       # Product management
│   ├── css/                # Admin styles
│   └── js/                 # Admin scripts
├── netlify/
│   └── functions/          # Serverless API endpoints
│       ├── admin.js        # Admin operations
│       ├── auth.js         # Authentication
│       ├── orders.js       # Order processing & email notifications
│       ├── payments.js     # Paystack/Flutterwave payment handling
│       ├── products.js     # Product CRUD
│       └── utils.js        # Shared helpers
├── supabase/
│   ├── schema.sql          # Database schema
│   └── products.sql        # Seed product data
├── netlify.toml            # Netlify config & redirects
├── package.json            # Dependencies & scripts
├── .env.example            # Environment variable template
└── .gitignore
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Netlify CLI](https://docs.netlify.com/cli/get-started/)
- A [Supabase](https://supabase.com/) project
- A [Paystack](https://paystack.com/) and/or [Flutterwave](https://flutterwave.com/) account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/GodfreyEyituoyo/MiniDesk.git
   cd MiniDesk
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase, Paystack, Flutterwave, and Resend credentials in `.env`.

4. **Set up the database**

   Run `supabase/schema.sql` and `supabase/products.sql` in your Supabase SQL editor to create tables and seed product data.

5. **Start the dev server**
   ```bash
   npm run dev
   ```
   This launches Netlify Dev at `http://localhost:8888`.

---

## Environment Variables

See [`.env.example`](.env.example) for the full list:

| Variable                | Description                        |
| ----------------------- | ---------------------------------- |
| `SUPABASE_URL`          | Your Supabase project URL          |
| `SUPABASE_ANON_KEY`     | Supabase anonymous/public key      |
| `SUPABASE_SERVICE_KEY`  | Supabase service role key          |
| `PAYSTACK_SECRET_KEY`   | Paystack secret key                |
| `PAYSTACK_PUBLIC_KEY`   | Paystack public key                |
| `FLUTTERWAVE_SECRET_KEY`| Flutterwave secret key (optional)  |
| `RESEND_API_KEY`        | Resend API key for emails          |
| `ADMIN_EMAILS`          | Comma-separated admin emails       |
| `SITE_URL`              | Site URL for payment callbacks     |

---

## Deployment

The site is configured for **Netlify**. Push to the connected branch and Netlify will auto-deploy.

```bash
git push origin master
```

---

## Authors

Built with ❤️ for Nigerian professionals who deserve world-class tools.

---

## License

© 2025 MiniDesk. All rights reserved.
