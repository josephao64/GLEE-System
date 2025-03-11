/* traslados.js */

// Global variable for products
let products = [];

/* Cargar productos desde "productos" y poblar el select */
async function loadProductsForTransfer() {
  try {
    const snapshot = await db.collection("productos").orderBy("codigo").get();
    products = [];
    const select = document.getElementById("transferProduct");
    select.innerHTML = "<option value=''>Seleccione producto</option>";
    snapshot.forEach(doc => {
      const prod = doc.data();
      prod.id = doc.id;
      products.push(prod);
      const option = document.createElement("option");
      option.value = prod.id;
      option.textContent = `${prod.codigo} - ${prod.descripcion}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading products:", error);
  }
}

/* Cargar tiendas destino y poblar el select */
async function loadDestinationStores() {
  try {
    const snapshot = await db.collection("tiendas").orderBy("nombre").get();
    const select = document.getElementById("transferDestination");
    select.innerHTML = "<option value=''>Seleccione tienda destino</option>";
    snapshot.forEach(doc => {
      const store = doc.data();
      const option = document.createElement("option");
      option.value = store.nombre;
      option.textContent = store.nombre;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading destination stores:", error);
  }
}

/* Configurar automáticamente la Tienda Origen según el usuario logueado */
async function setOriginStore() {
  const loggedUser = localStorage.getItem("loggedUser");
  if (!loggedUser) return;
  try {
    const snapshot = await db.collection("usuarios").where("username", "==", loggedUser).get();
    let userData;
    snapshot.forEach(doc => { userData = doc.data(); });
    if (userData && userData.tienda && userData.username.toLowerCase() !== "admin") {
      document.getElementById("transferOrigin").value = userData.tienda;
      document.getElementById("transferOrigin").readOnly = true;
    } else {
      document.getElementById("transferOrigin").readOnly = false;
    }
  } catch (error) {
    console.error("Error setting origin store:", error);
  }
}

/* Mostrar el stock actual del producto en la tienda origen cuando se seleccione */
document.getElementById("transferProduct").addEventListener("change", () => {
  const productId = document.getElementById("transferProduct").value;
  const originStore = document.getElementById("transferOrigin").value;
  const infoDiv = document.getElementById("productStockInfo");
  if (!productId || !originStore) {
    infoDiv.textContent = "";
    return;
  }
  const prod = products.find(p => p.id === productId);
  let originStockField;
  if (originStore === "Tienda A") originStockField = "stockTiendaA";
  else if (originStore === "Tienda B") originStockField = "stockTiendaB";
  const stock = prod && prod[originStockField] !== undefined ? prod[originStockField] : "N/A";
  infoDiv.textContent = `Stock actual en ${originStore}: ${stock}`;
});

/* Cargar traslados creados por el usuario (Mis Traslados) */
async function loadMyTransfers() {
  const loggedUser = localStorage.getItem("loggedUser");
  if (!loggedUser) return;
  try {
    const snapshot = await db.collection("traslados")
      .where("pedidoPor", "==", loggedUser)
      .orderBy("date", "desc")
      .get();
    const tbody = document.querySelector("#myTransfersTable tbody");
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const transfer = doc.data();
      const row = tbody.insertRow();
      // Mostrar un ID corto (primeros 6 caracteres)
      row.insertCell(0).textContent = doc.id.substring(0, 6);
      const prod = products.find(p => p.id === transfer.productId);
      row.insertCell(1).textContent = prod ? `${prod.codigo} - ${prod.descripcion}` : transfer.productId;
      row.insertCell(2).textContent = transfer.quantity;
      row.insertCell(3).textContent = transfer.origin;
      row.insertCell(4).textContent = transfer.destination;
      const dateStr = transfer.date && transfer.date.toDate ? transfer.date.toDate().toLocaleString() : "";
      row.insertCell(5).textContent = dateStr;
      row.insertCell(6).textContent = transfer.status ? transfer.status.toUpperCase() : "ACTIVO";
      const cellActions = row.insertCell(7);
      if (transfer.status === "pendiente") {
        cellActions.innerHTML = `
          <button class="btn btn-sm btn-primary me-1" onclick="editTransfer('${doc.id}')">Editar</button>
          <button class="btn btn-sm btn-warning me-1" onclick="annulTransfer('${doc.id}')">Anular</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTransfer('${doc.id}')">Eliminar</button>
        `;
      } else {
        cellActions.textContent = "-";
      }
    });
  } catch (error) {
    console.error("Error loading my transfers:", error);
    Swal.fire("Error", "Error loading my transfers: " + error.message, "error");
  }
}

/* Cargar traslados pendientes para validación (donde destination es la tienda del usuario y status es pendiente) */
async function loadPendingTransfers() {
  const loggedUser = localStorage.getItem("loggedUser");
  if (!loggedUser) return;
  let userData;
  const snapshotUser = await db.collection("usuarios").where("username", "==", loggedUser).get();
  snapshotUser.forEach(doc => { userData = doc.data(); });
  if (!userData || !userData.tienda) return;
  const destinationStore = userData.tienda;
  document.getElementById("destinationFilter").value = destinationStore;
  try {
    const snapshot = await db.collection("traslados")
      .where("destination", "==", destinationStore)
      .where("status", "==", "pendiente")
      .orderBy("date", "desc")
      .get();
    const tbody = document.querySelector("#pendingTransfersTable tbody");
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const transfer = doc.data();
      const row = tbody.insertRow();
      row.insertCell(0).textContent = doc.id.substring(0, 6);
      const dateStr = transfer.date && transfer.date.toDate ? transfer.date.toDate().toLocaleString() : "";
      row.insertCell(1).textContent = dateStr;
      const prod = products.find(p => p.id === transfer.productId);
      row.insertCell(2).textContent = prod ? `${prod.codigo} - ${prod.descripcion}` : transfer.productId;
      row.insertCell(3).textContent = transfer.quantity;
      row.insertCell(4).textContent = transfer.pedidoPor || "-";
      let destStockField;
      if (destinationStore === "Tienda A") destStockField = "stockTiendaA";
      else if (destinationStore === "Tienda B") destStockField = "stockTiendaB";
      const currentStock = prod && prod[destStockField] !== undefined ? prod[destStockField] : "N/A";
      row.insertCell(5).textContent = currentStock;
      const cellActions = row.insertCell(6);
      cellActions.innerHTML = `<button class="btn btn-sm btn-info" onclick="showValidationDetail('${doc.id}')">Ver Detalles</button>`;
    });
  } catch (error) {
    console.error("Error loading pending transfers:", error);
    Swal.fire("Error", "Error loading pending transfers: " + error.message, "error");
  }
}

/* Mostrar la tarjeta de detalle para validación de un traslado pendiente */
async function showValidationDetail(transferId) {
  try {
    const doc = await db.collection("traslados").doc(transferId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Transfer not found", "error");
      return;
    }
    const transfer = doc.data();
    const prod = products.find(p => p.id === transfer.productId);
    document.getElementById("detailId").textContent = transferId.substring(0, 6);
    document.getElementById("detailProduct").textContent = prod ? `${prod.codigo} - ${prod.descripcion}` : transfer.productId;
    document.getElementById("detailQuantity").textContent = transfer.quantity;
    document.getElementById("detailPedidoPor").textContent = transfer.pedidoPor || "-";
    const loggedUser = localStorage.getItem("loggedUser");
    let userData;
    const snapshotUser = await db.collection("usuarios").where("username", "==", loggedUser).get();
    snapshotUser.forEach(doc => { userData = doc.data(); });
    let destinationStore = userData && userData.tienda ? userData.tienda : "";
    let destStockField;
    if (destinationStore === "Tienda A") destStockField = "stockTiendaA";
    else if (destinationStore === "Tienda B") destStockField = "stockTiendaB";
    const currentStock = prod && prod[destStockField] !== undefined ? prod[destStockField] : "N/A";
    document.getElementById("detailStock").textContent = currentStock;
    document.getElementById("transferDetail").setAttribute("data-id", transferId);
    document.getElementById("transferDetail").style.display = "block";
  } catch (error) {
    console.error("Error showing validation detail:", error);
    Swal.fire("Error", "Error showing validation detail: " + error.message, "error");
  }
}

/* Validar (confirmar recepción) del traslado pendiente */
async function validateTransfer() {
  const transferId = document.getElementById("transferDetail").getAttribute("data-id");
  if (!transferId) return;
  const confirmResult = await Swal.fire({
    title: "Confirmar Recepción",
    text: "¿Confirmas que has recibido físicamente los productos?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Pedido Recibido",
    cancelButtonText: "Cancelar"
  });
  if (!confirmResult.isConfirmed) return;
  try {
    const doc = await db.collection("traslados").doc(transferId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Transfer not found", "error");
      return;
    }
    const transfer = doc.data();
    const loggedUser = localStorage.getItem("loggedUser");
    let userData;
    const snapshotUser = await db.collection("usuarios").where("username", "==", loggedUser).get();
    snapshotUser.forEach(doc => { userData = doc.data(); });
    if (!userData || !userData.tienda) {
      Swal.fire("Error", "Unable to determine your store", "error");
      return;
    }
    const destinationStore = userData.tienda;
    let destStockField;
    if (destinationStore === "Tienda A") destStockField = "stockTiendaA";
    else if (destinationStore === "Tienda B") destStockField = "stockTiendaB";
    // Incrementar el stock en la tienda destino
    await db.collection("productos").doc(transfer.productId).update({
      [destStockField]: firebase.firestore.FieldValue.increment(transfer.quantity)
    });
    // Actualizar el estado del traslado a "validado"
    await db.collection("traslados").doc(transferId).update({
      status: "validado",
      dateValidation: firebase.firestore.FieldValue.serverTimestamp()
    });
    Swal.fire("Success", "Transfer validated and stock updated", "success");
    document.getElementById("transferDetail").style.display = "none";
    loadMyTransfers();
    loadPendingTransfers();
  } catch (error) {
    console.error("Error validating transfer:", error);
    Swal.fire("Error", "Error validating transfer: " + error.message, "error");
  }
}

/* Mostrar el formulario para crear/editar un traslado */
function showTransferForm() {
  document.getElementById("transferForm").reset();
  document.getElementById("transferId").value = "";
  document.getElementById("transferModalLabel").textContent = "Nuevo Traslado";
  setOriginStore();
  loadDestinationStores();
  new bootstrap.Modal(document.getElementById("transferModal")).show();
}

/* Cargar datos de un traslado en el formulario para editar */
async function editTransfer(transferId) {
  try {
    const doc = await db.collection("traslados").doc(transferId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Transfer not found", "error");
      return;
    }
    const transfer = doc.data();
    if (transfer.status !== "pendiente") {
      Swal.fire("Error", "Only pending transfers can be edited", "error");
      return;
    }
    document.getElementById("transferId").value = transferId;
    document.getElementById("transferProduct").value = transfer.productId;
    document.getElementById("transferQuantity").value = transfer.quantity;
    document.getElementById("transferOrigin").value = transfer.origin;
    loadDestinationStores().then(() => {
      document.getElementById("transferDestination").value = transfer.destination;
    });
    document.getElementById("transferComments").value = transfer.comments || "";
    document.getElementById("transferModalLabel").textContent = "Editar Traslado";
    setOriginStore();
    new bootstrap.Modal(document.getElementById("transferModal")).show();
  } catch (error) {
    console.error("Error editing transfer:", error);
    Swal.fire("Error", "Error editing transfer: " + error.message, "error");
  }
}

/* Manejar el envío del formulario para crear o actualizar un traslado */
document.getElementById("transferForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const transferId = document.getElementById("transferId").value;
  const productId = document.getElementById("transferProduct").value;
  const quantity = parseFloat(document.getElementById("transferQuantity").value);
  const origin = document.getElementById("transferOrigin").value;
  const destination = document.getElementById("transferDestination").value;
  const comments = document.getElementById("transferComments").value;
  
  if (!productId || isNaN(quantity) || quantity <= 0 || !origin || !destination) {
    Swal.fire("Error", "Complete all required fields and ensure quantity is greater than zero", "error");
    return;
  }
  if (origin === destination) {
    Swal.fire("Error", "Origin and destination must be different", "error");
    return;
  }
  
  const confirmResult = await Swal.fire({
    title: "Confirm Transfer",
    text: "Are you sure you want to save this transfer?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Yes, save it",
    cancelButtonText: "Cancel"
  });
  if (!confirmResult.isConfirmed) return;
  
  try {
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      Swal.fire("Error", "Product not found", "error");
      return;
    }
    let originStockField;
    if (origin === "Tienda A") originStockField = "stockTiendaA";
    else if (origin === "Tienda B") originStockField = "stockTiendaB";
    
    if (!transferId) {
      // Crear traslado: deducir stock en origen y registrar quién hizo el pedido
      if (prod[originStockField] < quantity) {
        Swal.fire("Error", "Insufficient stock in origin store", "error");
        return;
      }
      const pedidoPor = localStorage.getItem("loggedUser");
      await db.collection("productos").doc(productId).update({
        [originStockField]: prod[originStockField] - quantity
      });
      await db.collection("traslados").add({
        productId,
        quantity,
        origin,
        destination,
        comments,
        pedidoPor,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        status: "pendiente"
      });
      Swal.fire("Success", "Transfer created successfully", "success");
    } else {
      // Editar traslado: revertir el descuento previo y aplicar el nuevo
      const oldDoc = await db.collection("traslados").doc(transferId).get();
      if (!oldDoc.exists) {
        Swal.fire("Error", "Transfer not found", "error");
        return;
      }
      const oldTransfer = oldDoc.data();
      if (oldTransfer.status !== "pendiente") {
        Swal.fire("Error", "Only pending transfers can be edited", "error");
        return;
      }
      let oldOriginField;
      if (oldTransfer.origin === "Tienda A") oldOriginField = "stockTiendaA";
      else if (oldTransfer.origin === "Tienda B") oldOriginField = "stockTiendaB";
      // Revertir el descuento anterior
      await db.collection("productos").doc(oldTransfer.productId).update({
        [oldOriginField]: firebase.firestore.FieldValue.increment(oldTransfer.quantity)
      });
      if (oldTransfer.productId !== productId) {
        const newProd = products.find(p => p.id === productId);
        if (!newProd || newProd[originStockField] < quantity) {
          Swal.fire("Error", "Insufficient stock in origin store for new product", "error");
          return;
        }
        await db.collection("productos").doc(productId).update({
          [originStockField]: newProd[originStockField] - quantity
        });
      } else {
        const prodDoc = await db.collection("productos").doc(productId).get();
        const currentProd = prodDoc.data();
        if (currentProd[originStockField] < quantity) {
          Swal.fire("Error", "Insufficient stock in origin store", "error");
          return;
        }
        await db.collection("productos").doc(productId).update({
          [originStockField]: currentProd[originStockField] - quantity
        });
      }
      await db.collection("traslados").doc(transferId).update({
        productId,
        quantity,
        origin,
        destination,
        comments,
        date: firebase.firestore.FieldValue.serverTimestamp()
      });
      Swal.fire("Success", "Transfer updated successfully", "success");
    }
    bootstrap.Modal.getInstance(document.getElementById("transferModal")).hide();
    loadMyTransfers();
    loadPendingTransfers();
  } catch (error) {
    console.error("Error saving transfer:", error);
    Swal.fire("Error", "Error saving transfer: " + error.message, "error");
  }
});

/* Eliminar traslado */
async function deleteTransfer(transferId) {
  if (!confirm("Are you sure you want to delete this transfer?")) return;
  try {
    const doc = await db.collection("traslados").doc(transferId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Transfer not found", "error");
      return;
    }
    const transfer = doc.data();
    if (transfer.status === "pendiente") {
      let originField;
      if (transfer.origin === "Tienda A") originField = "stockTiendaA";
      else if (transfer.origin === "Tienda B") originField = "stockTiendaB";
      await db.collection("productos").doc(transfer.productId).update({
        [originField]: firebase.firestore.FieldValue.increment(transfer.quantity)
      });
    }
    await db.collection("traslados").doc(transferId).delete();
    Swal.fire("Success", "Transfer deleted", "success");
    loadMyTransfers();
    loadPendingTransfers();
  } catch (error) {
    console.error("Error deleting transfer:", error);
    Swal.fire("Error", "Error deleting transfer: " + error.message, "error");
  }
}

/* Anular traslado: revertir stock y marcar como anulado */
async function annulTransfer(transferId) {
  if (!confirm("Are you sure you want to annul this transfer? This will revert the inventory.")) return;
  try {
    const doc = await db.collection("traslados").doc(transferId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Transfer not found", "error");
      return;
    }
    const transfer = doc.data();
    if (transfer.status !== "pendiente") {
      Swal.fire("Error", "Only pending transfers can be annulled", "error");
      return;
    }
    let originField;
    if (transfer.origin === "Tienda A") originField = "stockTiendaA";
    else if (transfer.origin === "Tienda B") originField = "stockTiendaB";
    await db.collection("productos").doc(transfer.productId).update({
      [originField]: firebase.firestore.FieldValue.increment(transfer.quantity)
    });
    await db.collection("traslados").doc(transferId).update({ status: "anulado" });
    Swal.fire("Success", "Transfer annulled and inventory reverted", "success");
    loadMyTransfers();
    loadPendingTransfers();
  } catch (error) {
    console.error("Error annulling transfer:", error);
    Swal.fire("Error", "Error annulling transfer: " + error.message, "error");
  }
}

/* Inicialización: cargar productos, tiendas destino, configurar tienda origen y cargar tablas */
document.addEventListener("DOMContentLoaded", async () => {
  await loadProductsForTransfer();
  await loadDestinationStores();
  await setOriginStore();
  loadMyTransfers();
  loadPendingTransfers();
});
