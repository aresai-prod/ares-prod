# ARES Website (Marketing)

This repo contains the public-facing marketing website for ARES. It is separate from the ARES Console product and is designed to showcase the brand, explain the product, and route users to Console Bay.

## Stack
- Next.js (App Router)
- Tailwind CSS
- Three.js
- GSAP

## Local Development

1. Install dependencies
   - `npm install`
2. Start the dev server
   - `npm run dev`
3. Open the site
   - `http://localhost:3000`

## Console Bay Redirect

All Console links point to the value of:
- `NEXT_PUBLIC_CONSOLE_URL` (defaults to `http://localhost:5173`)

## Icon Placement

Replace the icon file here:
- `public/ares-icon.svg`

## Analytics

Website analytics events are collected at:
- `src/app/api/analytics/route.ts`

Events are stored locally in:
- `data/website-analytics.json`

## Contact Form

Submissions are stored locally in:
- `data/contact-submissions.json`

API route:
- `src/app/api/contact/route.ts`

Tracked events:
- `page_view`
- `console_bay_click`
- `scroll_depth`
- `section_time`

## Notes

This site is the public landing experience only. The ARES product lives in the Console Bay domain.
