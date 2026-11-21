# Progress

Work log for the interface, access and API layer.

## Frontend

- React 18 + Vite + TypeScript + Tailwind app shell, routing and shared layout (sidebar, topbar, protected routes).
- Login and registration for hospitals, dispatchers and patients; session handled through an HttpOnly cookie.
- Role-based navigation and dashboards:
  - Dispatcher: situation report, emergency registration, priority queue, ambulance search, fleet, hospital matching, assignment desk.
  - Hospital: dashboard, beds and resources, dataset import, pre-bookings, donation campaigns.
  - Patient: dashboard, ambulance call, hospital comparison and pre-booking, notifications.
- Landing page with live public summary.
- Live updates over Socket.IO with polling as a fallback.

## Backend

- Express routes for auth, registration, emergency requests, queue, ambulances, hospitals, assignments, dashboards, patient and hospital portals, health and public summary.
- Server-side validation modules for every write endpoint.
- Session middleware with role guards and login rate limiting.
- Campaign notification delivery (email, SMS, web push) with a delivery report; added migration `20261121120000_notification_delivery`.

## Status

- Interface, access control and API integration implemented for the dispatcher, hospital and patient portals.
