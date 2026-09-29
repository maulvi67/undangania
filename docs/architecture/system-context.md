# System Context

```mermaid
flowchart LR
  Couple[Couple / Customer] --> Platform[Undangania]
  Guest[Guest] --> Platform
  Vendor[Vendor / Printer] --> Platform
  Reseller[Reseller] --> Platform
  Admin[Admin / Support / Finance] --> Platform
  Platform --> Pay[Payment Gateway]
  Platform --> Msg[WhatsApp / Email]
  Platform --> Store[Object Storage / CDN]
  Platform --> DNS[DNS / Domain Provider]
  Platform --> Ship[Shipping Provider]
  Platform --> AI[AI Providers]
  Platform --> Obs[Monitoring / Analytics]
```
