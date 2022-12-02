# Barcode Capture Simple sample

A very simple example of setting up the library to scan barcodes.

## Installation

Install dependencies:

```bash
npm install
```

## How to run

Insert your license key into `index.ts`, replacing the placeholder `YOUR_LICENSE_KEY_HERE` with your license key.

Build and serve the application:

```bash
npm run build
npm run serve
```

Open http://localhost:8888 and start scanning.

## How to test the sample from any device

You can use an SSH tunnel to access the running sample from another device via the internet. To do so, you can install [ngrok](https://ngrok.com/) and create a tunnel to the running sample:

```bash
# execute this after npm run serve
ngrok http 8888
```

Make sure you use the HTTP**S** tunnel because most of the browsers will deny permission to access the camera in non-secure contexts.