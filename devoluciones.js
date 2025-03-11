/* devoluciones.js
   Módulo CRUD para devoluciones de mercadería.
   - Al crear una devolución se incrementa el stock del producto.
   - Al editar se revierte la devolución anterior y se aplica la nueva.
   - Al eliminar (si está activa) se revierte la devolución disminuyendo el stock.
   - Al anular se revierte el efecto en el inventario y se actualiza el estado a "anulado".
*/

// Variable global para almacenar los productos
let products = [];

/* Cargar productos desde la colección "productos" y poblar el select */
async function loadProductsForReturn() {
  try {
    const snapshot = await db.collection("productos").orderBy("codigo").get();
    products = [];
    const select = document.getElementById("returnProduct");
    select.innerHTML = "<option value=''>Seleccione producto</option>";
    snapshot.forEach((doc) => {
      const prod = doc.data();
      prod.id = doc.id;
      products.push(prod);
      const option = document.createElement("option");
      option.value = prod.id;
      option.textContent = `${prod.codigo} - ${prod.descripcion}`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar productos:", error);
  }
}

/* Cargar y mostrar las devoluciones desde la colección "devoluciones" */
async function loadReturns() {
  try {
    const snapshot = await db.collection("devoluciones").orderBy("date", "desc").get();
    const tbody = document.querySelector("#returnsTable tbody");
    tbody.innerHTML = "";
    snapshot.forEach((doc) => {
      const ret = doc.data();
      const row = tbody.insertRow();
      // Resaltar si la devolución está anulada
      if (ret.status === "anulado") {
        row.classList.add("table-warning");
      }
      const prod = products.find(p => p.id === ret.productId);
      const prodText = prod ? `${prod.codigo} - ${prod.descripcion}` : ret.productId;
      row.insertCell(0).textContent = prodText;
      row.insertCell(1).textContent = ret.quantity;
      const dateStr = ret.date && ret.date.toDate ? ret.date.toDate().toLocaleString() : "";
      row.insertCell(2).textContent = dateStr;
      row.insertCell(3).textContent = ret.comments || "";
      row.insertCell(4).textContent = ret.status ? ret.status.toUpperCase() : "ACTIVO";
      const cellActions = row.insertCell(5);
      cellActions.innerHTML = `
        <button class="btn btn-sm btn-primary me-1" onclick="editReturn('${doc.id}')">Editar</button>
        <button class="btn btn-sm btn-warning me-1" onclick="annulReturn('${doc.id}')">Anular</button>
        <button class="btn btn-sm btn-danger" onclick="deleteReturn('${doc.id}')">Eliminar</button>
      `;
    });
  } catch (error) {
    console.error("Error al cargar devoluciones:", error);
    Swal.fire("Error", "Error al cargar devoluciones: " + error.message, "error");
  }
}

/* Mostrar el formulario para nueva devolución */
function showReturnForm() {
  document.getElementById("returnForm").reset();
  document.getElementById("returnId").value = "";
  document.getElementById("returnModalLabel").textContent = "Nueva Devolución";
  new bootstrap.Modal(document.getElementById("returnModal")).show();
}

/* Cargar datos de una devolución para editar */
async function editReturn(returnId) {
  try {
    const doc = await db.collection("devoluciones").doc(returnId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Devolución no encontrada.", "error");
      return;
    }
    const ret = doc.data();
    if (ret.status !== "activo") {
      Swal.fire("Error", "No se puede editar una devolución anulada.", "error");
      return;
    }
    document.getElementById("returnId").value = returnId;
    document.getElementById("returnProduct").value = ret.productId;
    document.getElementById("returnQuantity").value = ret.quantity;
    document.getElementById("returnComments").value = ret.comments || "";
    document.getElementById("returnModalLabel").textContent = "Editar Devolución";
    new bootstrap.Modal(document.getElementById("returnModal")).show();
  } catch (error) {
    console.error("Error al cargar devolución:", error);
    Swal.fire("Error", "Error al cargar devolución: " + error.message, "error");
  }
}

/* Guardar (crear o actualizar) devolución */
document.getElementById("returnForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const returnId = document.getElementById("returnId").value;
  const productId = document.getElementById("returnProduct").value;
  const quantity = parseFloat(document.getElementById("returnQuantity").value);
  const comments = document.getElementById("returnComments").value;
  
  if (!productId || isNaN(quantity) || quantity <= 0) {
    Swal.fire("Error", "Complete todos los campos obligatorios.", "error");
    return;
  }
  
  try {
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      Swal.fire("Error", "Producto no encontrado.", "error");
      return;
    }
    // Si es nueva devolución, se incrementa el stock y se registra
    if (!returnId) {
      await db.collection("productos").doc(productId).update({
        stock: firebase.firestore.FieldValue.increment(quantity)
      });
      await db.collection("devoluciones").add({
        productId,
        quantity,
        comments,
        date: firebase.firestore.FieldValue.serverTimestamp(),
        status: "activo"
      });
      Swal.fire("Éxito", "Devolución registrada correctamente.", "success");
    } else {
      // Para editar, primero revertir el efecto de la devolución anterior y luego aplicar el nuevo valor
      const oldDoc = await db.collection("devoluciones").doc(returnId).get();
      if (!oldDoc.exists) {
        Swal.fire("Error", "Devolución no encontrada.", "error");
        return;
      }
      const oldReturn = oldDoc.data();
      if (oldReturn.status !== "activo") {
        Swal.fire("Error", "No se puede editar una devolución anulada.", "error");
        return;
      }
      // Revertir: disminuir stock en la cantidad anterior
      await db.collection("productos").doc(oldReturn.productId).update({
        stock: firebase.firestore.FieldValue.increment(-oldReturn.quantity)
      });
      // Aplicar el nuevo valor: incrementar stock
      await db.collection("productos").doc(productId).update({
        stock: firebase.firestore.FieldValue.increment(quantity)
      });
      // Actualizar el registro de devolución
      await db.collection("devoluciones").doc(returnId).update({
        productId,
        quantity,
        comments,
        date: firebase.firestore.FieldValue.serverTimestamp()
      });
      Swal.fire("Éxito", "Devolución actualizada correctamente.", "success");
    }
    bootstrap.Modal.getInstance(document.getElementById("returnModal")).hide();
    loadReturns();
  } catch (error) {
    console.error("Error en saveReturn:", error);
    Swal.fire("Error", "Error al guardar devolución: " + error.message, "error");
  }
});

/* Eliminar devolución: si está activa, revertir el inventario y luego eliminar */
async function deleteReturn(returnId) {
  if (!confirm("¿Está seguro de eliminar esta devolución?")) return;
  try {
    const doc = await db.collection("devoluciones").doc(returnId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Devolución no encontrada.", "error");
      return;
    }
    const ret = doc.data();
    if (ret.status === "activo") {
      await db.collection("productos").doc(ret.productId).update({
        stock: firebase.firestore.FieldValue.increment(-ret.quantity)
      });
    }
    await db.collection("devoluciones").doc(returnId).delete();
    Swal.fire("Éxito", "Devolución eliminada.", "success");
    loadReturns();
  } catch (error) {
    console.error("Error al eliminar devolución:", error);
    Swal.fire("Error", "Error al eliminar devolución: " + error.message, "error");
  }
}

/* Anular devolución: revierte el efecto en el inventario y actualiza el estado a "anulado" */
async function annulReturn(returnId) {
  if (!confirm("¿Está seguro de anular esta devolución? Se revertirá el inventario.")) return;
  try {
    const doc = await db.collection("devoluciones").doc(returnId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Devolución no encontrada.", "error");
      return;
    }
    const ret = doc.data();
    if (ret.status !== "activo") {
      Swal.fire("Error", "La devolución ya está anulada.", "error");
      return;
    }
    // Revertir inventario: disminuir el stock en la cantidad de la devolución
    await db.collection("productos").doc(ret.productId).update({
      stock: firebase.firestore.FieldValue.increment(-ret.quantity)
    });
    // Actualizar el estado de la devolución
    await db.collection("devoluciones").doc(returnId).update({ status: "anulado" });
    Swal.fire("Éxito", "Devolución anulada y el inventario fue restablecido.", "success");
    loadReturns();
  } catch (error) {
    console.error("Error al anular devolución:", error);
    Swal.fire("Error", "Error al anular devolución: " + error.message, "error");
  }
}

// Inicialización: cargar productos y devoluciones al cargar la página
document.addEventListener("DOMContentLoaded", async () => {
  await loadProductsForReturn();
  loadReturns();
});
