# 🧾 Nota Digital - Invoice Management System

A modern, high-performance Web & Mobile Invoice Management Application built with **Next.js 16 (App Router)**, **Capacitor 8**, **Tailwind CSS v4**, and **TypeScript**.

Designed for fast receipt/invoice creation, transaction history management, PDF export, native device sharing, and seamless cross-platform deployment (PWA & Android APK).

---

## ✨ Features

- **⚡ Instant Invoice Generation**: Fast itemized invoice creation with automatic total calculation.
- **📄 PDF Export & Image Export**: Export invoices directly to PDF or image format using `jspdf` and `html2canvas`.
- **📲 Native Mobile Integration**: Built-in integration with Capacitor plugins (`@capacitor/filesystem`, `@capacitor/share`, `@capacitor/splash-screen`).
- **📱 PWA & Offline Support**: Progressive Web App capabilities powered by `@ducanh2912/next-pwa` for reliable offline access.
- **📜 Transaction History**: Track, filter, and review past invoices stored securely on device storage.
- **🎨 Premium UI/UX**: Styled with Tailwind CSS v4 and Lucide React icons for a responsive, modern aesthetic.
- **🤖 Automated CI/CD**: GitHub Actions workflow included for automated Android APK compilation and release.

---

## 🛠️ Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **UI Styling** | [Tailwind CSS v4](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/) |
| **Mobile Runtime** | [Capacitor 8](https://capacitorjs.com/) (Android) |
| **PWA & Cache** | [@ducanh2912/next-pwa](https://github.com/DuCanh2912/next-pwa) |
| **PDF & Canvas** | [jsPDF](https://github.com/parallax/jsPDF) & [html2canvas](https://html2canvas.hertzen.com/) |
| **Testing** | [Playwright](https://playwright.dev/) & [Lighthouse](https://github.com/GoogleChrome/lighthouse) |
| **Package Manager** | [pnpm](https://pnpm.io/) / npm |

---

## 🚀 Getting Started

### Prerequisites

Make sure you have Node.js (v18+) and pnpm (or npm) installed on your system.

```bash
# Verify Node version
node -v

# Verify pnpm version
pnpm -v
```

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Zonee-Dev/Invoice-Management.git
   cd Invoice-Management
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

---

## 💻 Development & Build Scripts

### Run Development Server

```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Web Build

```bash
pnpm build
```

### Run End-to-End Tests

```bash
npx playwright test
```

---

## 📱 Mobile Build (Capacitor Android)

To build the static web export and sync with the Android project:

```bash
# 1. Build the production static site (outputs to /out)
pnpm build

# 2. Sync web assets with Capacitor Android
npx cap sync android

# 3. Open in Android Studio
npx cap open android
```

### Automated Android APK CI/CD Workflow

This repository includes a pre-configured GitHub Actions workflow located at [.github/workflows/build-apk.yml](.github/workflows/build-apk.yml). Whenever commits are pushed to `main`, GitHub Actions will automatically compile and produce an installable Android APK artifact.

---

## 📂 Project Structure

```
Invoice-Management/
├── .github/workflows/      # GitHub Actions CI/CD workflows
├── android/                # Native Android Gradle project (Capacitor)
├── assets/                 # App icon & splash screen source assets
├── e2e/                    # Playwright End-to-End tests
├── public/                 # Static public assets & PWA manifest
├── src/
│   ├── app/                # Next.js App Router pages (Home, Invoice, History)
│   ├── components/         # Reusable UI layout & navigation components
│   └── lib/                # Data store & local persistence logic
├── capacitor.config.ts     # Capacitor application configuration
├── next.config.ts          # Next.js & PWA build configuration
└── package.json            # Project dependencies & scripts
```

---

## 🔒 Security & Sensitive Files

Sensitive files such as API keys, keystores (`*.jks`, `*.keystore`), environment variables (`.env*`), and credential properties are strictly ignored via `.gitignore` to maintain security best practices.

---

## 📄 License

Distributed under the **ISC License**.
