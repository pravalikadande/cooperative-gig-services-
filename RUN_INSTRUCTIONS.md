# Cooperative Gig Service - Run Instructions

## Requirements

Install Node.js 20 or 22 and pnpm 9+ on your laptop.

## Install dependencies

```bash
pnpm install
```

Firebase Cloud Functions dependencies are separate:

```bash
cd firebase/functions
pnpm install --ignore-scripts
cd ../..
```

## Run the app in browser

```bash
pnpm dev:metro
```

Then open the URL shown by Expo, normally `http://localhost:8081`.

## Run app and backend together

```bash
pnpm dev
```

## Verify the project

```bash
pnpm run check
pnpm run build
```

The Firebase functions can be checked with:

```bash
cd firebase/functions
./node_modules/.bin/tsc --noEmit
```
