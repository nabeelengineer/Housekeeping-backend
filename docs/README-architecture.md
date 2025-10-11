# Housekeeping App Architecture

This document summarizes the system design, ER diagram, and key flows for the Buy/Sell and Vehicle Rental modules, along with Notifications and Moderation. It references code paths so you can quickly navigate.

## Monorepo Layout
- Backend: `Housekeeping-backend/`
- Frontend: `Housekeeping-frontend/`
- Docs: `docs/`

## ER Diagram
The Mermaid ER diagram is in `docs/er-diagram.mmd`.

Render as PNG/SVG via:
- VS Code Mermaid preview or Markdown preview enhanced.
- Mermaid CLI (requires Node):
  ```bash
  npx @mermaid-js/mermaid-cli -i docs/er-diagram.mmd -o docs/er-diagram.png
  npx @mermaid-js/mermaid-cli -i docs/er-diagram.mmd -o docs/er-diagram.svg
  ```

## Backend Overview
- Server bootstrap: `Housekeeping-backend/src/index.js`
  - Mounts routes: `auth`, `departments`, `categories`, `employees`, `requests`, `market`, `vehicles`, `notifications`
  - Static uploads: `/uploads` (market images)
  - `sequelize.sync()` on start to ensure tables exist

- Models and associations: `Housekeeping-backend/src/Models/`
  - Employees/Org: `employee.js`, `department.js`, `category.js`
  - Requests: `request.js` + junctions (if present)
  - Buy/Sell: `product.js`, `productImage.js`, `productInterest.js`, `productFlag.js`, `productComment.js`
  - Vehicles: `vehicle.js`, `rentalLog.js`
  - Notifications: `notification.js`
  - Associations registered in `Models/index.js`

### Market (Buy/Sell) Routes — `src/routes/market.js`
- `POST /api/market/products` — create listing (multipart; 3–5 images). After create:
  - Notify all employees except seller: `product_posted` (via `Notification.bulkCreate`)
- `GET /api/market/products` — list products; supports `search`, `status`, `sellerId`, `sort`, `order`
- `GET /api/market/products/:id` — product detail (+ seller info)
- `PATCH /api/market/products/:id` — update fields (seller/admin). Edits `name`, `price`, `description`
- `DELETE /api/market/products/:id` — soft-remove (seller/admin)
- Interests/Comments: 
  - `POST /products/:id/interest`, `GET /products/:id/interest/my`, `GET /products/:id/interests`
  - `POST /products/:id/comments`, `GET /products/:id/comments`
- Flags & Moderation (Admin):
  - `POST /products/:id/flags` (open)
  - `GET /admin/flags` (status filter)
  - `PATCH /admin/flags/:id` with actions `received|keep|remove`, and in-app notifications to reporter

### Vehicles Routes — `src/routes/vehicles.js`
- `GET /api/vehicles` — list (default only `available`; use `?status=all` to include `rented`)
- `POST /api/vehicles/:id/rent` — rent a vehicle (atomic)
- `POST /api/vehicles/:id/return` — return by renter
- `POST /api/vehicles/admin/:id/return` — admin force return
- Admin logs: `GET /api/vehicles/admin/logs` and `GET /api/vehicles/admin/logs.csv`

### Notifications Routes — `src/routes/notifications.js`
- `GET /api/notifications` — list my notifications (latest first)
- `PATCH /api/notifications/:id/read` — mark as read

## Frontend Overview
- Router and NavBar: `Housekeeping-frontend/src/App.jsx`
  - Protected paths use `ProtectedRoute`
  - NavBar includes bell showing unread notifications and dropdown list using `listNotifications`, `readNotification`

- API layer: `Housekeeping-frontend/src/api/endpoints.js`
  - Auth, employees, departments, categories, requests
  - Market: list/get/create/update/delete/mark-sold; interests, comments; flags & moderation
  - Vehicles: list, rent, return, myActive, logs, logs.csv
  - Notifications: list, read

### Buy/Sell UI
- List page: `src/pages/BuySell/BuySellList.jsx`
  - Search + "List a Product" dialog
  - "My Posts" filter toggles `sellerId` param
- Product page: `src/pages/BuySell/ProductDetail.jsx`
  - Buyers: "I'm Interested", Comments, Flag
  - Seller tools: Mark as Sold, Edit (dialog; updates name/price/description), Delete
  - Shows interested buyers to seller
- Admin: `src/pages/Admin/BuySellModeration.jsx`
  - Accordions for Open/Received/Kept/Removed; actions wire to admin endpoint and send notifications

### Vehicles UI
- `src/pages/VehicleRental/VehicleList.jsx` — list/rent; label logic for car/bike/scooty and image fallbacks
- `src/pages/VehicleRental/MyRental.jsx` — active rentals; return button; label fix
- `src/pages/Admin/VehicleRentalLogs.jsx` — admin view of logs with CSV export

## Key Flows (End-to-End)
- Product created → images saved → notifications broadcast to employees (except seller) → bell shows unread → can mark read.
- Product flagged → admin actions (received/keep/remove) → status changes + reporter notified.
- Vehicle rent/return → `RentalLog` entries → employee sees under My Rentals → admin sees in Logs.

## How to Export ER Diagram
Using Mermaid CLI (Node):
```bash
npm i -g @mermaid-js/mermaid-cli
mmdc -i docs/er-diagram.mmd -o docs/er-diagram.png
mmdc -i docs/er-diagram.mmd -o docs/er-diagram.svg
```

Alternatively, paste the content into https://mermaid.live and export.

## Future Enhancements
- Seller notifications for interests and comments
- "Mark all as read" in bell dropdown; deep-link to product detail using `meta.product_id`
- Product image editing (add/remove)
- Dashboard metrics for admin
