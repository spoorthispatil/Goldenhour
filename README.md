# GoldenHour – Interface & Access

Role-based web interface, authentication and API layer for GoldenHour, a severity ranking and hospital readiness matching system for emergency ambulance response.

## Overview

This part of GoldenHour handles the frontend interface and access management of GoldenHour. It provides a role-based web interface for dispatchers, hospitals, and patients, allowing each user to access the features relevant to their role. It also manages authentication, protected routes, navigation, and communication with the backend APIs.

## Technologies Used

- **React 18** – Building the user interface using reusable components.
- **Vite** – Frontend development server and build tool.
- **TypeScript** – Type-safe frontend development.
- **Tailwind CSS** – Styling and responsive layouts.
- **React Router** – Page navigation and protected routes.
- **Axios** – Communication with backend APIs.
- **Lucide React** – Icons and interface elements.

## Key Features

- Responsive and user-friendly web interface.
- Login and authentication system.
- Protected routes to prevent unauthorized access.
- Role-based navigation and dashboards.
- Separate portals for dispatchers, hospitals, and patients.
- Patient dashboard for emergency requests, ambulance requests, and hospital comparison.
- Hospital portal for managing hospital-related activities and resources.
- Reusable UI components for consistent design.
- API integration for retrieving and updating application data.

## Role-Based Interface

### Dispatcher Portal
Provides access to the dispatcher interface, emergency management, and related operational features.

### Hospital Portal
Allows registered hospitals to access their portal and manage hospital-related information and activities.

### Patient Portal
Provides patients with access to their dashboard, emergency and ambulance request features, and hospital comparison.

## Implementation

The frontend is developed using React with a component-based architecture. React Router manages navigation between pages, while authentication and role-based access control protect restricted sections of the application.

Reusable components are used across different pages to maintain consistency. Axios is used to communicate with backend APIs, and the interface is organized into layouts, dashboards, forms, tables, and role-specific pages.

## Project Structure

The main frontend components are:

- **Pages:** Landing page, login, dashboards, and portal pages.
- **Components:** Reusable UI elements, tables, forms, badges, and interface components.
- **Layouts:** Shared layouts for different user roles.
- **Authentication:** Login, user authentication, and access control.
- **Routing:** Application routes and protected route handling.
- **API Integration:** Frontend communication with backend services.

## Current Implementation Status

The frontend foundation, authentication, protected routes, role-based navigation, dispatcher interface, hospital portal, and patient portal have been implemented. The frontend is integrated with backend services for the supported application features.


## Note

This repository holds the interface, access and API layer only. It imports modules from other parts of GoldenHour that are not included here (the database layer in `server/prisma` and `server/src/db`, the ranking and matching services, and `client/src/lib/severity.ts`), so it will not run on its own.

See [PROGRESS.md](PROGRESS.md) for the work log.
