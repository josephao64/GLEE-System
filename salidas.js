/* ventas.js */

// Inicializar Firebase si no se ha inicializado (puedes evitar duplicar esta lógica si ya lo haces en inventario.js)
if (!firebase.apps.length) {
    var firebaseConfig = {
      apiKey: "AIzaSyAjVTKBJwZ8qql32ZrZBy0Q1NFUYMu-Xzk",
      authDomain: "gleedb-5d36a.firebaseapp.com",
      projectId: "gleedb-5d36a",
      storageBucket: "gleedb-5d36a.firebasestorage.app",
      messagingSenderId: "1090238022032",
      appId: "1:1090238022032:web:c637b0a6dfe06be5287315"
    };
    firebase.initializeApp(firebaseConfig);
  }
  var db = firebase.firestore();
  
  // Array global para almacenar los productos del carrito de venta
  let saleCart = [];
  
  /* Cargar productos disponibles (con stock > 0) y mostrarlos como tarjetas */
  async function loadAvailableProducts() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let productsDiv = document.getElementById("productsAvailable");
      productsDiv.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        if (product.stock > 0) {
          let card = document.createElement("div");
          card.className = "col-md-6 mb-3";
          card.innerHTML = `
            <div class="card">
              <div class="card-body">
                <h5 class="card-title">${product.name}</h5>
                <p class="card-text">Precio: Q. ${parseFloat(product.unitPrice || 0).toFixed(2)}</p>
                <p class="card-text">Stock: ${product.stock}</p>
                <button class="btn btn-primary btn-sm" onclick="addProductToCart('${doc.id}', '${product.name}', ${product.unitPrice}, ${product.stock})">
                  Agregar
                </button>
              </div>
            </div>
          `;
          productsDiv.appendChild(card);
        }
      });
    } catch (error) {
      console.error("Error al cargar productos disponibles:", error);
      alert("Error al cargar productos: " + error.message);
    }
  }
  
  /* Agregar producto al carrito */
  function addProductToCart(productId, productName, unitPrice, availableStock) {
    let existingItem = saleCart.find(item => item.productId === productId);
    if (existingItem) {
      if (existingItem.quantity < availableStock) {
        existingItem.quantity++;
        existingItem.total = existingItem.quantity * unitPrice;
      } else {
        alert("No hay suficiente stock disponible.");
        return;
      }
    } else {
      saleCart.push({
        productId: productId,
        productName: productName,
        unitPrice: unitPrice,
        quantity: 1,
        total: unitPrice,
        availableStock: availableStock
      });
    }
    updateSaleCartTable();
  }
  
  /* Actualizar tabla del carrito de venta */
  function updateSaleCartTable() {
    let tbody = document.querySelector("#saleCartTable tbody");
    tbody.innerHTML = "";
    saleCart.forEach((item, index) => {
      let row = tbody.insertRow();
      row.insertCell(0).textContent = item.productName;
      row.insertCell(1).textContent = item.quantity;
      row.insertCell(2).textContent = "Q. " + parseFloat(item.unitPrice).toFixed(2);
      row.insertCell(3).textContent = "Q. " + parseFloat(item.total).toFixed(2);
      row.insertCell(4).innerHTML = `<button class="btn btn-sm btn-danger" onclick="removeCartItem(${index})"><i class="fa-solid fa-trash"></i></button>`;
    });
  }
  
  /* Remover un ítem del carrito */
  function removeCartItem(index) {
    saleCart.splice(index, 1);
    updateSaleCartTable();
  }
  
  /* Finalizar venta: se abre el modal para solicitar usuario y tipo de pago */
  function finalizeSale() {
    if (saleCart.length === 0) {
      alert("El carrito de ventas está vacío.");
      return;
    }
    // Asignar fecha actual al modal
    let now = new Date();
    document.getElementById("saleDate").value = now.toLocaleString();
    let finalizeModal = new bootstrap.Modal(document.getElementById("finalizeSaleModal"));
    finalizeModal.show();
  }
  
  /* Confirmar venta: actualizar stock, registrar venta en Firestore y limpiar carrito */
  async function confirmSale() {
    try {
      let saleUser = document.getElementById("saleUser").value.trim();
      let paymentTypeElem = document.querySelector('input[name="paymentType"]:checked');
      if (!saleUser) {
        alert("Ingrese el nombre de usuario.");
        return;
      }
      if (!paymentTypeElem) {
        alert("Seleccione el tipo de pago.");
        return;
      }
      let paymentType = paymentTypeElem.value;
      let saleItems = [];
      // Validar stock y actualizar cada producto
      for (let item of saleCart) {
        let productRef = db.collection("inventoryProducts").doc(item.productId);
        let productDoc = await productRef.get();
        if (!productDoc.exists) {
          alert("Producto no encontrado: " + item.productName);
          return;
        }
        let productData = productDoc.data();
        if (item.quantity > productData.stock) {
          alert("No hay suficiente stock para " + item.productName);
          return;
        }
        let newStock = productData.stock - item.quantity;
        await productRef.update({ stock: newStock });
        saleItems.push({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total
        });
      }
      // Crear registro de venta
      let saleRecord = {
        user: saleUser.toUpperCase(),
        paymentType: paymentType,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        items: saleItems,
        overallTotal: saleItems.reduce((sum, curr) => sum + curr.total, 0)
      };
      await db.collection("sales").add(saleRecord);
      alert("Venta registrada exitosamente.");
      // Limpiar carrito y actualizar UI
      saleCart = [];
      updateSaleCartTable();
      loadAvailableProducts();
      // Cerrar modal y limpiar campos
      let modalEl = document.getElementById("finalizeSaleModal");
      let modalInstance = bootstrap.Modal.getInstance(modalEl);
      modalInstance.hide();
      document.getElementById("saleUser").value = "";
      document.getElementsByName("paymentType").forEach(radio => radio.checked = false);
    } catch (error) {
      console.error("Error al confirmar venta:", error);
      alert("Error al confirmar venta: " + error.message);
    }
  }
  
  /* Mostrar historial de ventas */
  async function showSalesHistory() {
    try {
      let snapshot = await db.collection("sales").orderBy("date", "desc").get();
      let tbody = document.querySelector("#salesHistoryTable tbody");
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        let sale = doc.data();
        let row = tbody.insertRow();
        // Concatenar productos vendidos
        let productsStr = sale.items.map(item => `${item.productName} (x${item.quantity})`).join(", ");
        row.insertCell(0).textContent = productsStr;
        row.insertCell(1).textContent = sale.items.reduce((sum, item) => sum + item.quantity, 0);
        // Se muestra el precio unitario del primer producto como referencia (o bien se puede calcular un promedio)
        row.insertCell(2).textContent = "Q. " + parseFloat(sale.items[0].unitPrice).toFixed(2);
        row.insertCell(3).textContent = "Q. " + parseFloat(sale.overallTotal).toFixed(2);
        row.insertCell(4).textContent = sale.user;
        row.insertCell(5).textContent = sale.paymentType;
        let saleDate = sale.date ? new Date(sale.date.seconds * 1000).toLocaleString() : "";
        row.insertCell(6).textContent = saleDate;
      });
      let historyModal = new bootstrap.Modal(document.getElementById("salesHistoryModal"));
      historyModal.show();
    } catch (error) {
      console.error("Error al cargar historial de ventas:", error);
      alert("Error al cargar historial: " + error.message);
    }
  }
  
  /* Inicializar la página de ventas */
  window.onload = function() {
    loadAvailableProducts();
  };
  