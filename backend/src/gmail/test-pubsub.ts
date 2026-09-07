import { startGmailPubSubListener } from "./pubsub-listener";

// Standalone entry point for running the Gmail Pub/Sub listener on its
// own (npm run gmail:pubsub), e.g. for manual debugging. In normal
// operation server.ts starts this same listener in-process instead, so
// that Gmail-ingested conversations share the dashboard's in-memory store.
startGmailPubSubListener();
