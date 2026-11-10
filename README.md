# Nirjas

A full-stack skincare shop built with plain HTML, CSS and vanilla JavaScript on the front end and Node.js, Express and PostgreSQL on the back end. It covers the whole buying flow: browse and search products, cart, checkout (guest or logged in), online payment through the SSLCommerz sandbox, and an order history with a delivery timeline.

**Live demo:** _add your Render link here_

> Payments run against the SSLCommerz **sandbox**. No real money moves.

<!--
Add screenshots after you take them, then uncomment:

![Shop](docs/screenshots/shop.png)
![Cart](docs/screenshots/cart.png)
![Checkout](docs/screenshots/checkout.png)
![My orders](docs/screenshots/my-orders.png)
-->

## Features

**Shopping**
- Product grid with category filter
- Ranked search: matches in the name rank above matches in the description, multi-word queries, live suggestions, keyboard shortcuts (`/` to focus, arrow keys, `Esc`)
- Cart saved in the browser (`localStorage`), quantity controls, running total

**Checkout and payment**
- Guest checkout or checkout as a logged-in user
- Cash on delivery or online payment with SSLCommerz (sandbox)
- Orders and order items are saved in a single database transaction
- Payments are verified on the server before an order is marked as paid

**Accounts**
- Sign up, log in, log out
- Passwords hashed with bcrypt, session token in an `httpOnly` cookie
- "My orders" page: status badges, delivery timeline, delivery details, item list, copy order number, reorder, filters (All, Active, Delivered, Cancelled)

## Tech stack

| Layer | Tools |
|---|---|
| Front end | HTML, CSS, vanilla JavaScript |
| Back end | Node.js (18+), Express |
| Database | PostgreSQL (hosted on Neon), `pg` |
| Auth | `bcrypt`, `jsonwebtoken`, `cookie-parser` |
| Payments | SSLCommerz sandbox |
| Hosting | Render (app) and Neon (database) |

## Security notes

- **Prices and totals are calculated on the server** from the `products` table. The browser only sends product ids and quantities, so editing the cart in DevTools changes nothing.
- The order's `user_id` comes from the verified token, never from the request body.
- All SQL uses parameters (`$1`, `$2`) to prevent SQL injection.
- Input is validated on the server (names, phone numbers, quantities, payment method, cart size).
- Payment confirmation checks the gateway's validation API for status, transaction id, amount and currency before marking an order as paid.
- Rate limiting on login, sign up and order creation.
- Login errors are the same for unknown emails and wrong passwords.
- User-supplied text is rendered with `textContent`, not `innerHTML`.

## Project structure

```
nirjas-shop/
  index.js               Express app: API routes and middleware
  db.js                  PostgreSQL connection pool
  schema.sql             Database tables
  .env.example           Environment variable template
  middleware/auth.js     verifyToken and optionalAuth
  routes/payment.js      SSLCommerz: init, success, fail, cancel
  public/
    shop.html / shop.js / shop.css        Products, search, filters
    cart.html / cart.js / cart.css        Cart
    checkout.html / checkout.js           Checkout
    order-result.html                     Payment result page
    login.html / login.js                 Log in and sign up
    my-orders.html / my-orders.js / orders.css   Order history and timeline
    auth.js                               Header user menu
```

## API

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/products` | public | List products |
| POST | `/api/orders` | guest or user | Create an order |
| POST | `/api/signup` | public | Create an account |
| POST | `/api/login` | public | Log in |
| POST | `/api/logout` | public | Log out |
| GET | `/api/me` | public | Current user, or `null` |
| GET | `/api/my/orders` | logged in | The user's orders with items |
| POST | `/api/pay/init` | public | Start an SSLCommerz payment for a pending online order |
| POST | `/api/pay/success` `/fail` `/cancel` | gateway | Return URLs called by SSLCommerz |

## Run it locally

You need Node.js 18 or newer and a PostgreSQL database (a free Neon database works).

1. Clone the repository and install packages:
   ```
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in the values (see below).
3. Create the tables by running `schema.sql` in your database (the Neon SQL Editor, or `psql`).
4. Add a few products. Example:
   ```sql
   INSERT INTO products (name, description, price, category, image_url)
   VALUES ('Gentle Cleanser', 'A mild daily face wash.', 14.99, 'Cleansers', 'https://example.com/cleanser.jpg');
   ```
5. Start the server:
   ```
   npm start
   ```
6. Open `http://localhost:3000/shop.html`.

### Environment variables

| Name | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `SSLC_STORE_ID` | SSLCommerz sandbox store id |
| `SSLC_STORE_PASS` | SSLCommerz sandbox store password |
| `SSLC_IS_LIVE` | `false` for the sandbox |
| `SSLC_CURRENCY` | Currency sent to the gateway (default `USD`) |
| `BASE_URL` | Public address of the app, for example `http://localhost:3000` |
| `NODE_ENV` | `production` when deployed (makes the cookie `secure`) |

Never commit `.env`. It is listed in `.gitignore`.

## Testing payments (sandbox)

Create a free SSLCommerz sandbox account to get a store id and password. The sandbox documentation lists the test cards and the mobile OTP to use: https://sandbox-gw.sslcommerz.com/docs

After a successful test payment the order status becomes `paid`. If you cancel on the payment page it becomes `cancelled`.

## Deploying

The app is deployed as a Render web service connected to a Neon database.

- Build command: `npm install`
- Start command: `npm start`
- Set every variable from the table above in the Render dashboard
- Set `BASE_URL` to the Render address, then redeploy so the payment return URLs point to it

## Known limitations and next steps

- Delivery status (`processing`, `shipped`, `delivered`) is changed directly in the database. An admin page for this is the next feature.
- Payment is confirmed when the customer returns to the site. Instant Payment Notification (IPN) would also cover customers who close the tab after paying.
- No order emails, password reset, or stock tracking yet.
- One currency for the whole shop.

## Author

Built by SHUBAIHI as a portfolio project.
