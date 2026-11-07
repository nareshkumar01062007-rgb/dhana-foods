# Dhana Foods — Phase 4: Order Status Management

## Included
- Admin order status options: Pending, Confirmed, Preparing, Out for Delivery, Delivered, Cancelled.
- Server-side validation for the six supported statuses.
- Existing admin-only order update endpoint retained.
- Customer account order history shows the current status, a progress indicator, payment method, and last-updated time.
- Customer can manually refresh order status.
- The single-order lookup endpoint now requires admin authentication instead of exposing order details publicly.
- Existing Admin/Customer authentication, product catalogue, COD, Razorpay and MongoDB order storage are retained.

## Run locally
1. Extract the ZIP.
2. Open the inner `dhana-foods-main` folder (the folder containing `package.json`).
3. Copy your existing `.env` into this folder. Do not share or commit it.
4. Run `npm install` if dependencies are not installed.
5. Run `npm start`.
6. Test admin order status changes and customer account refresh using a COD test order.

## Local verification checklist
- Admin can log in and view orders.
- Admin can set each of the six statuses.
- Invalid status values are rejected by the API.
- Customer can only see orders associated with their authenticated account.
- Customer refresh shows the updated status.
- COD order flow still works.
- Do not make a live Razorpay payment just to test this phase.

This package has passed source-level syntax checks. Complete the local functional checklist before deploying it.
