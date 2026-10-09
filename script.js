/* =========================================================
   DHANA FOODS
   Customer Cart + Order System
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  /* =======================================================
     PRODUCT PRICES
  ======================================================= */

  const PRODUCTS = {
    "Idli Batter": {
      "500g": 25,
      "1kg": 45
    },

    "Dosa Batter": {
      "500g": 25,
      "1kg": 45
    },

    "Adai Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Mappilai Samba Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Appam Batter": {
      "500g": 30,
      "1kg": 60
    },

    "Millet Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Poonghar Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Karuppu Kavuni Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Keerai Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Kambu Yasnam Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Ragi Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Karunguruvai Batter": {
      "500g": 40,
      "1kg": 80
    },

    "Pachai Payiru Batter": {
      "500g": 40,
      "1kg": 80
    }
  };


  /* =======================================================
     PRODUCT ALIASES
  ======================================================= */

  const PRODUCT_ALIASES = {

    "idli": "Idli Batter",
    "idli batter": "Idli Batter",

    "dosa": "Dosa Batter",
    "dosa batter": "Dosa Batter",

    "adai": "Adai Batter",
    "adai batter": "Adai Batter",

    "mappilai samba": "Mappilai Samba Batter",
    "mappilai samba batter": "Mappilai Samba Batter",

    "mapillai samba": "Mappilai Samba Batter",
    "mapillai samba batter": "Mappilai Samba Batter",

    "appam": "Appam Batter",
    "appam batter": "Appam Batter",

    "millet": "Millet Batter",
    "millet batter": "Millet Batter",

    "poonghar": "Poonghar Batter",
    "poonghar batter": "Poonghar Batter",

    "poongar": "Poonghar Batter",
    "poongar batter": "Poonghar Batter",

    "poongar batter": "Poonghar Batter",

    "karuppu kavuni": "Karuppu Kavuni Batter",
    "karuppu kavuni batter": "Karuppu Kavuni Batter",

    "karupu kavuni": "Karuppu Kavuni Batter",
    "karupu kavuni batter": "Karuppu Kavuni Batter",

    "keerai": "Keerai Batter",
    "keerai batter": "Keerai Batter",

    "kambu yasnam": "Kambu Yasnam Batter",
    "kambu yasnam batter": "Kambu Yasnam Batter",

    "ragi": "Ragi Batter",
    "ragi batter": "Ragi Batter",

    "karunguruvai": "Karunguruvai Batter",
    "karunguruvai batter": "Karunguruvai Batter",

    "karinagaruvai": "Karunguruvai Batter",
    "karinagaruvai batter": "Karunguruvai Batter",

    "karunaguvrai": "Karunguruvai Batter",
    "karunaguvrai batter": "Karunguruvai Batter",

    "karumburuvai": "Karunguruvai Batter",
    "karumburuvai batter": "Karunguruvai Batter",

    "pachai payiru": "Pachai Payiru Batter",
    "pachai payiru batter": "Pachai Payiru Batter",

    "pachai payir": "Pachai Payiru Batter",
    "pachai payir batter": "Pachai Payiru Batter"
  };


  /* =======================================================
     CART
  ======================================================= */

  let cart = [];


  /* =======================================================
     DOM ELEMENTS
  ======================================================= */

  const quantityInputs =
    document.querySelectorAll(".product-qty");

  const cartItems =
    document.getElementById("cartItems");

  const cartTotal =
    document.getElementById("cartTotal");

  const cartCount =
    document.getElementById("cartCount");

  const formItemCount =
    document.getElementById("formItemCount");

  const formOrderTotal =
    document.getElementById("formOrderTotal");

  const orderForm =
    document.getElementById("orderForm");

  const placeOrderBtn =
    document.getElementById("placeOrderBtn");

  const orderSuccess =
    document.getElementById("orderSuccess");

  const deliveryDateInput =
    document.getElementById("deliveryDate");


  /* =======================================================
     NORMALIZE PRODUCT NAME
  ======================================================= */

  function normalizeProductKey(value) {

    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, " ");

  }


  function normalizeProductName(value) {

    const original =
      String(value || "").trim();

    if (!original) {
      return "";
    }

    const key =
      normalizeProductKey(original);

    return PRODUCT_ALIASES[key] || original;

  }


  /* =======================================================
     GET OFFICIAL PRICE
  ======================================================= */

  function getOfficialPrice(product, size) {

    const canonicalProduct =
      normalizeProductName(product);

    if (
      !PRODUCTS[canonicalProduct] ||
      !PRODUCTS[canonicalProduct][size]
    ) {
      return null;
    }

    return PRODUCTS[canonicalProduct][size];

  }


  /* =======================================================
     READ PRODUCT INPUTS
  ======================================================= */

  function readProductInputs() {

    const items = [];

    quantityInputs.forEach((input) => {

      let quantity =
        parseInt(input.value, 10);

      if (
        Number.isNaN(quantity) ||
        quantity < 0
      ) {
        quantity = 0;
      }

      if (quantity === 0) {
        return;
      }

      const product =
        normalizeProductName(
          input.dataset.product
        );

      const size =
        input.dataset.size;

      const price =
        getOfficialPrice(product, size);

      if (
        !product ||
        !size ||
        price === null
      ) {
        return;
      }

      items.push({
        product,
        size,
        quantity,
        price
      });

    });

    return items;

  }


  /* =======================================================
     SYNC INPUTS → CART
  ======================================================= */

  function syncCartFromInputs() {

    cart =
      readProductInputs();

    renderCart();

  }


  /* =======================================================
     RENDER CART
  ======================================================= */

  function renderCart() {

    if (!cartItems) {
      return;
    }

    if (cart.length === 0) {

      cartItems.innerHTML = `
        <div class="empty-cart">

          <div>🛒</div>

          <h3>
            Your cart is empty
          </h3>

          <p>
            Select your favourite batter above.
          </p>

        </div>
      `;

      updateCartSummary();

      return;
    }


    cartItems.innerHTML = "";


    cart.forEach((item, index) => {

      const itemTotal =
        item.price * item.quantity;


      const row =
        document.createElement("div");

      row.className = "cart-item";

      row.innerHTML = `

        <div class="cart-item-icon">
          🥣
        </div>

        <div class="cart-item-info">

          <strong>
            ${escapeHtml(item.product)}
          </strong>

          <span>
            ${escapeHtml(item.size)}
            × ${item.quantity}
          </span>

        </div>

        <div class="cart-item-price">

          ₹${itemTotal}

        </div>

        <button
          type="button"
          class="cart-remove"
          data-index="${index}"
          aria-label="Remove item"
        >
          ✕
        </button>

      `;

      cartItems.appendChild(row);

    });


    document
      .querySelectorAll(".cart-remove")
      .forEach((button) => {

        button.addEventListener(
          "click",
          () => {

            const index =
              Number(button.dataset.index);

            removeCartItem(index);

          }
        );

      });


    updateCartSummary();

  }


  /* =======================================================
     REMOVE CART ITEM
  ======================================================= */

  function removeCartItem(index) {

    const item =
      cart[index];

    if (!item) {
      return;
    }


    quantityInputs.forEach((input) => {

      const product =
        normalizeProductName(
          input.dataset.product
        );

      const size =
        input.dataset.size;

      if (
        product === item.product &&
        size === item.size
      ) {

        input.value = 0;

      }

    });


    cart.splice(index, 1);

    renderCart();

  }


  /* =======================================================
     CART SUMMARY
  ======================================================= */

  function updateCartSummary() {

    let total = 0;
    let itemCount = 0;


    cart.forEach((item) => {

      total +=
        item.price * item.quantity;

      itemCount +=
        item.quantity;

    });


    if (cartTotal) {

      cartTotal.textContent =
        `₹${total}`;

    }


    if (cartCount) {

      cartCount.textContent =
        `${itemCount} ${
          itemCount === 1
            ? "item"
            : "items"
        }`;

    }


    if (formItemCount) {

      formItemCount.textContent =
        itemCount;

    }


    if (formOrderTotal) {

      formOrderTotal.textContent =
        `₹${total}`;

    }

  }


  /* =======================================================
     INPUT EVENTS
  ======================================================= */

  quantityInputs.forEach((input) => {

    input.addEventListener(
      "input",
      () => {

        let value =
          parseInt(input.value, 10);

        if (
          Number.isNaN(value) ||
          value < 0
        ) {
          input.value = 0;
        }

        syncCartFromInputs();

      }
    );


    input.addEventListener(
      "change",
      () => {

        let value =
          parseInt(input.value, 10);

        if (
          Number.isNaN(value) ||
          value < 0
        ) {
          input.value = 0;
        }

        syncCartFromInputs();

      }
    );

  });


  /* =======================================================
     ESCAPE HTML
  ======================================================= */

  function escapeHtml(value) {

    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  }


  /* =======================================================
     MINIMUM DELIVERY DATE
  ======================================================= */

  function setMinimumDeliveryDate() {

    if (!deliveryDateInput) {
      return;
    }

    const today =
      new Date();

    const year =
      today.getFullYear();

    const month =
      String(
        today.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        today.getDate()
      ).padStart(2, "0");


    const minimumDate =
      `${year}-${month}-${day}`;


    deliveryDateInput.min =
      minimumDate;

  }


  setMinimumDeliveryDate();


  /* =======================================================
     PHONE VALIDATION
  ======================================================= */

  function isValidPhone(phone) {

    const cleaned =
      String(phone || "")
        .replace(/\D/g, "");

    return /^[6-9]\d{9}$/.test(
      cleaned
    );

  }


  /* =======================================================
     SHOW MESSAGE
  ======================================================= */

  function showOrderMessage(
    message,
    type = "success"
  ) {

    if (!orderSuccess) {
      return;
    }

    orderSuccess.textContent =
      message;

    orderSuccess.className =
      `order-success ${type}`;

    orderSuccess.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });

  }


  /* =======================================================
     ORDER SUBMISSION
  ======================================================= */

  if (orderForm) {

    orderForm.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();


        syncCartFromInputs();


        if (cart.length === 0) {

          showOrderMessage(
            "🛒 Please select at least one batter before placing your order.",
            "error"
          );

          return;
        }


        const customerNameInput =
          document.getElementById(
            "customerName"
          );

        const phoneInput =
          document.getElementById(
            "phone"
          );

        const addressInput =
          document.getElementById(
            "address"
          );


        const customerName =
          customerNameInput
            ? customerNameInput.value.trim()
            : "";


        const phone =
          phoneInput
            ? phoneInput.value.trim()
            : "";


        const address =
          addressInput
            ? addressInput.value.trim()
            : "";


        const deliveryDate =
          deliveryDateInput
            ? deliveryDateInput.value
            : "";


        if (!customerName) {

          showOrderMessage(
            "👤 Please enter your name.",
            "error"
          );

          customerNameInput?.focus();

          return;
        }


        if (!isValidPhone(phone)) {

          showOrderMessage(
            "📱 Please enter a valid 10-digit Indian mobile number.",
            "error"
          );

          phoneInput?.focus();

          return;
        }


        if (!address) {

          showOrderMessage(
            "🏠 Please enter your delivery address.",
            "error"
          );

          addressInput?.focus();

          return;
        }


        if (!deliveryDate) {

          showOrderMessage(
            "📅 Please select a delivery date.",
            "error"
          );

          deliveryDateInput?.focus();

          return;
        }


        const selectedPayment =
          document.querySelector(
            'input[name="paymentMethod"]:checked'
          );


        const paymentMethod =
          selectedPayment
            ? selectedPayment.value
            : "COD";


        const orderData = {

          customerName,

          phone,

          address,

          deliveryDate,

          paymentMethod,

          items: cart.map((item) => ({
            product:
              normalizeProductName(
                item.product
              ),

            size:
              item.size,

            quantity:
              Number(item.quantity),

            price:
              Number(item.price)
          }))

        };


        /* ===============================================
           BUTTON LOADING
        =============================================== */

        const originalButtonText =
          placeOrderBtn
            ? placeOrderBtn.innerHTML
            : "";


        if (placeOrderBtn) {

          placeOrderBtn.disabled =
            true;

          placeOrderBtn.innerHTML =
            "⏳ Placing Your Order...";

        }


        if (orderSuccess) {

          orderSuccess.textContent =
            "";

          orderSuccess.className =
            "order-success";

        }


        try {

          const response =
            await fetch(
              "/api/orders",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json"
                },

                body:
                  JSON.stringify(
                    orderData
                  )
              }
            );


          let data = null;


          try {

            data =
              await response.json();

          } catch {

            data = null;

          }


          if (!response.ok) {

            const serverMessage =
              data?.error ||
              data?.message ||
              "Unable to place your order.";

            throw new Error(
              serverMessage
            );

          }


          /* =============================================
             SUCCESS
          ============================================= */

          const orderId =
            data?.order?.id ||
            data?.id ||
            data?.orderId ||
            "";


          let successMessage =
            "🎉 Your order has been placed successfully! ❤️";


          if (orderId) {

            successMessage +=
              ` Order #${orderId}`;

          }


          showOrderMessage(
            successMessage,
            "success"
          );


          /* Clear quantities */

          quantityInputs.forEach(
            (input) => {
              input.value = 0;
            }
          );


          cart = [];

          renderCart();


          /* Reset customer form */

          orderForm.reset();


          /* Keep minimum delivery date */

          setMinimumDeliveryDate();


          /* Reset payment */

          const codRadio =
            document.querySelector(
              'input[name="paymentMethod"][value="COD"]'
            );

          if (codRadio) {
            codRadio.checked = true;
          }


          /* Reset button */

          if (placeOrderBtn) {

            placeOrderBtn.disabled =
              false;

            placeOrderBtn.innerHTML =
              originalButtonText ||
              "🛒 Place My Order";

          }


        } catch (error) {

          console.error(
            "Order submission error:",
            error
          );


          showOrderMessage(
            `❌ ${
              error.message ||
              "Something went wrong. Please try again."
            }`,
            "error"
          );


          if (placeOrderBtn) {

            placeOrderBtn.disabled =
              false;

            placeOrderBtn.innerHTML =
              originalButtonText ||
              "🛒 Place My Order";

          }

        }

      }
    );

  }


  /* =======================================================
     SMOOTH NAVIGATION
  ======================================================= */

  document
    .querySelectorAll(
      'a[href^="#"]'
    )
    .forEach((link) => {

      link.addEventListener(
        "click",
        (event) => {

          const targetId =
            link.getAttribute("href");

          if (
            !targetId ||
            targetId === "#"
          ) {
            return;
          }


          const target =
            document.querySelector(
              targetId
            );


          if (!target) {
            return;
          }


          event.preventDefault();


          target.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });

        }
      );

    });


  /* =======================================================
     SCROLL REVEAL
  ======================================================= */

  const revealElements =
    document.querySelectorAll(
      ".feature-card, .schedule-card, .product-card, .status-step"
    );


  if (
    "IntersectionObserver" in window
  ) {

    const observer =
      new IntersectionObserver(
        (entries) => {

          entries.forEach(
            (entry) => {

              if (
                entry.isIntersecting
              ) {

                entry.target.classList.add(
                  "visible"
                );

                observer.unobserve(
                  entry.target
                );

              }

            }
          );

        },
        {
          threshold: 0.12
        }
      );


    revealElements.forEach(
      (element) => {

        observer.observe(
          element
        );

      }
    );

  }


  /* =======================================================
     HEADER SCROLL EFFECT
  ======================================================= */

  const header =
    document.querySelector(
      ".main-header"
    );


  window.addEventListener(
    "scroll",
    () => {

      if (!header) {
        return;
      }


      if (window.scrollY > 30) {

        header.style.boxShadow =
          "0 10px 30px rgba(20,60,30,0.10)";

      } else {

        header.style.boxShadow =
          "0 5px 25px rgba(20,60,30,0.06)";

      }

    },
    {
      passive: true
    }
  );


  /* =======================================================
     INITIAL CART
  ======================================================= */

  renderCart();

  setMinimumDeliveryDate();


  console.log(
    "🥣 DHANA FOODS customer system loaded successfully."
  );

});