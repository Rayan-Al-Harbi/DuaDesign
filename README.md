# Dua Design

> Transform your wishes into beautiful, authentic Arabic duas using AI + RAG

## ✨ Features

### Core
- **RAG-Lite Context Injection** — 14 topic categories, 50+ authentic references from Hisn Al-Muslim, Sahih Bukhari/Muslim, Quran
- **Flowing Arabic Generation** — Single-pass natural dua composition via Llama 4 Maverick on Groq
- **Arabic Text-to-Speech** — Listen to your dua recited in authentic Saudi Arabic (Groq Orpheus)

### User Experience
- **Islamic Ramadan UI** — Starry night sky, swaying lanterns, crescent moon, gold-on-midnight
- **Dua History** — Last 12 duas saved locally
- **Regenerate** — Get a new dua with the same wishes
- **Share** — Native Web Share API on mobile, clipboard on desktop
- **Copy** — One-click clipboard copy
- **Feedback** — Thumbs up/down (logged to localStorage for review)
- **PWA** — Installable as a phone app

## 🏗️ Architecture

```
User Input → Preprocessing → Topic Matcher → Knowledge Base Lookup
                                                     ↓
                                            Context Injection (RAG-lite)
                                                     ↓
                                        LLM Generation (single pass)
                                                     ↓
                                             Validation → Output
                                                     ↓
                                          TTS (Orpheus Arabic Saudi)
```

## 🚀 Quick Start

```bash
npm install
cp .env.example .env
# Edit .env → add your Groq API key from https://console.groq.com/keys
npm run dev
```


## 📁 Tech Stack

Next.js 14 • TypeScript • React • Groq API • Llama 4 Maverick • Orpheus TTS • RAG