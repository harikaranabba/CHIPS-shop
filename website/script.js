function calculateAmount() {
    const price = parseFloat(document.getElementById("price").value) || 0;
    const quantity = parseFloat(document.getElementById("quantity").value) || 0;
    const unit = document.getElementById("unit").value;

    let quantityInKg = quantity;

    if (unit === "g") {
        quantityInKg = quantity / 1000;
    }

    const total = price * quantityInKg;

    document.getElementById("totalAmount").textContent =
        "₹" + total.toFixed(2);
}

function continueToPayment() {
    const product = document.getElementById("productName").value.trim();
    const price = parseFloat(document.getElementById("price").value);
    const quantity = parseFloat(document.getElementById("quantity").value);
    const unit = document.getElementById("unit").value;

    if (!product || !price || !quantity || quantity <= 0) {
        alert("Please enter product, price and quantity.");
        return;
    }

    let quantityInKg = quantity;

    if (unit === "g") {
        quantityInKg = quantity / 1000;
    }

    const total = price * quantityInKg;

    // Save order details temporarily
    localStorage.setItem("shopOrder", JSON.stringify({
        product: product,
        price: price,
        quantity: quantity,
        unit: unit,
        total: total
    }));

    // Open payment page
    window.location.href = "payment.html";
}