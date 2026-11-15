# Simple E-commerce Store (CodeAlpha Full Stack Internship, Task 1)

**Submitted by:** Laxmikant Siddaram Poojari
**College:** Moodlakatte Institute of Technology
**Degree:** B.E. in Computer Science and Engineering
**Repository name:** `CodeAlpha_SimpleEcommerce`

---

## 1. Objective

Build a basic e-commerce website with product listings, a shopping cart, a product details page, user registration and login, and order processing, backed by a database that stores products, users and orders.

## 2. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | HTML5, CSS3, JavaScript (ES6) | Pages, styling, cart logic, API calls |
| Backend | Node.js with Express.js | REST API for products, auth and orders |
| Database | SQLite (via better-sqlite3) | Stores users, products, orders and order items |
| Security | bcryptjs, express-session | Password hashing and login sessions |

## 3. Features Implemented

- **Product listing:** the home page loads all products from `/api/products`, showing name, description, price and stock.
- **Product details page:** `product.html?id=N` shows full details and lets the user pick a quantity before adding to the cart.
- **Shopping cart:** items are stored in `localStorage`, so the cart survives page reloads. The user can change quantities, remove items, and see a live total and item count in the header.
- **User registration and login:** passwords are hashed with bcrypt and never stored in plain text. Sessions are kept with an HTTP cookie.
- **Order processing:** checkout requires login. The server checks stock, calculates the total from database prices (not from the browser), saves the order and order items, and reduces stock. All of this runs in one database transaction, so a failed order changes nothing.

## 4. Database Design

```
users        (id, name, email UNIQUE, password_hash)
products     (id, name, description, price, stock)
orders       (id, user_id -> users.id, total, status, created_at)
order_items  (id, order_id -> orders.id, product_id -> products.id, quantity, price)
```

`price` is copied into `order_items` at purchase time, so later price changes do not alter past orders.

## 5. API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/register` | No | Create an account and log in |
| POST | `/api/login` | No | Log in |
| POST | `/api/logout` | No | End the session |
| GET | `/api/me` | No | Current user or `null` |
| GET | `/api/products` | No | List products |
| GET | `/api/products/:id` | No | One product |
| POST | `/api/orders` | Yes | Place an order `{ items: [{ productId, quantity }] }` |
| GET | `/api/orders` | Yes | The logged-in user's order history |

## 6. How to Run

**Requirements:** Node.js 18 or newer.

```bash
cd CodeAlpha_SimpleEcommerce
npm install
npm start
```

Open **http://localhost:3000** in your browser.

Sample products are added automatically the first time the server starts. The database file `ecommerce.db` is created in the project folder.

**Quick test:** browse products, open one, add it to the cart, click Cart, then Place order. You will be asked to log in or register first. After the order, the stock count drops on the product page.

## 7. Project Structure

```
CodeAlpha_SimpleEcommerce/
├── server.js          # Express server, database setup, API routes
├── package.json       # Dependencies and start script
├── README.md          # This report
└── public/
    ├── index.html     # Product listing
    ├── product.html   # Product details
    ├── cart.html      # Cart and checkout
    ├── auth.html      # Login and registration
    ├── css/style.css  # Styling
    └── js/common.js   # Cart, API helper, navigation
```

## 8. Testing Summary

| Test | Expected result | Result |
|---|---|---|
| Open home page | All 5 products shown | Pass |
| Open product details | Correct name, price, stock | Pass |
| Add to cart, reload page | Item still in cart | Pass |
| Checkout while logged out | Redirected to login | Pass |
| Register with existing email | "Account already exists" message | Pass |
| Order more than stock | Error, stock unchanged | Pass |
| Successful order | Order ID shown, stock reduced, cart cleared | Pass |

## 9. Challenges and Learnings

- Keeping money calculations on the server prevents users from changing prices in the browser.
- Wrapping order creation in a transaction keeps stock and orders consistent when one item fails.
- Escaping user-supplied text before inserting it into HTML prevents script injection.

## 10. Possible Improvements

- Admin page for adding and editing products
- Payment gateway integration
- Order status updates and email confirmation
- Product images and search or category filters

## 11. Conclusion

This project covers the full request cycle of a web application: a browser UI, a REST API, database storage and authentication. It gave practical experience with Express.js routing, SQL schema design, password security and client-side state management.
