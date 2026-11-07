# 🍽️ DhanaFoods

### A Digital Food Ordering & Business Management Platform

**DhanaFoods** is a web-based food ordering platform designed to simplify the ordering experience for customers and help food businesses manage their products, orders, and business operations more efficiently.

This project was initially developed by my friend. I contributed to extending the existing application by implementing additional full-stack features, payment integration, security improvements, and a better customer and admin experience.

🌐 **Live Website:** https://dhanafoods.netlify.app/

💻 **GitHub Repository:** https://github.com/nareshkumar01062007-rgb/dhana-foods

---

## 🎯 Problem Statement

Many small and local food businesses depend on manual ordering methods, phone calls, or messaging applications to handle customer orders.

This creates several challenges:

- Difficulty managing multiple customer orders.
- Lack of centralized order tracking.
- Manual product and price management.
- Limited visibility into sales and revenue.
- Challenges in managing customer payments.

## 💡 Our Solution

DhanaFoods provides a centralized digital platform where customers can browse food products, add items to their cart, place orders, and make online payments.

The platform also provides an admin dashboard to manage products, monitor customer orders, update order statuses, and analyze business performance.

## ✨ Key Features

### 👤 Customer Module
- Customer registration and login.
- Browse available food products.
- Add products to shopping cart.
- Cart persistence across login.
- Place and track orders.
- View order history.
- Cancel eligible orders.
- Online payments through Razorpay.

### 🔐 Admin Module
- Secure admin authentication.
- Protected administrative APIs.
- Add, edit, hide, and remove products.
- Manage customer orders.
- Update order statuses.
- View revenue and order statistics.
- Sales analytics and top-selling product insights.

### 📱 User Experience
- Responsive website design.
- Mobile-friendly navigation.
- Hamburger menu for mobile devices.
- Improved ordering experience.

## 👨‍💻 Development Contributions

### Original Development – My Friend
- Developed the initial DhanaFoods application.
- Built the original website and its core functionality.

### Enhancements & Additional Development – Naresh Kumar R.J.
- Implemented customer registration and authentication.
- Integrated Razorpay payment functionality.
- Implemented payment signature verification.
- Improved admin authentication and API security.
- Developed dynamic product management.
- Enhanced order management and customer order history.
- Implemented cart persistence across the login process.
- Enhanced admin dashboard analytics.
- Developed responsive mobile navigation.
- Worked on application configuration and deployment.

## 🛠️ Technology Stack

| Category | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB Atlas |
| Payment Gateway | Razorpay |
| Serverless Functions | Netlify Functions |
| Hosting | Netlify |
| Version Control | Git & GitHub |

## 🏗️ Application Architecture

```text
           CUSTOMER / ADMIN
                  |
                  v
           FRONTEND WEBSITE
           HTML, CSS, JavaScript
                  |
                  v
             BACKEND API
          Node.js + Express.js
                  |
          +-------+--------+
          |                |
          v                v
      MongoDB Atlas     Razorpay
       Database         Payments
          |
          v
    Products & Orders

          |
          v
        Netlify
       Deployment
```

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm
- MongoDB Atlas account
- Razorpay account (for payment functionality)

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/nareshkumar01062007-rgb/dhana-foods.git
```

**2. Navigate to the project directory**

```bash
cd dhana-foods
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure environment variables**

Create a local `.env` file and configure the required credentials:

```env
MONGODB_URI=your_mongodb_connection_string
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_admin_password
ADMIN_SESSION_SECRET=your_admin_session_secret
CUSTOMER_SESSION_SECRET=your_customer_session_secret
```

**5. Run the application**

Use the appropriate development or start script configured in `package.json`.

> Never commit `.env` files, passwords, database credentials, or payment secrets to GitHub.

## 📚 Learning Outcomes

Through this project, I gained practical experience in:

- Full-stack web development.
- REST API development.
- MongoDB database integration.
- Authentication and authorization.
- Secure payment integration.
- Payment verification workflows.
- Admin dashboard development.
- Application deployment.
- Git and GitHub collaboration.

## 🔮 Future Enhancements

- Improved order notifications.
- Advanced business reporting.
- Enhanced customer experience.
- Further performance and security improvements.

---

## 🤝 Acknowledgement

This project represents collaborative development and continuous learning. Special thanks to my friend for developing the original DhanaFoods application and providing the opportunity to contribute additional features and improvements.

**Built with collaboration, learning, and continuous improvement. 🚀**

**Project:** DhanaFoods  
**Contributor:** Naresh Kumar R.J.
