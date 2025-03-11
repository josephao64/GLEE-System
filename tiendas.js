/* tiendas.js
   Módulo CRUD para la administración de tiendas.
   Permite crear, editar, eliminar y habilitar/deshabilitar tiendas.
   Se utiliza la colección "tiendas" en Firestore.
*/

// Variable global para almacenar las tiendas (opcional, para facilitar la actualización de la tabla)
let stores = [];

/* Cargar y mostrar las tiendas en la tabla */
async function loadStores() {
  try {
    const snapshot = await db.collection("tiendas").orderBy("nombre").get();
    stores = [];
    const tbody = document.querySelector("#storesTable tbody");
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const store = doc.data();
      store.id = doc.id;
      stores.push(store);
      const row = tbody.insertRow();
      row.insertCell(0).textContent = store.nombre;
      row.insertCell(1).textContent = store.direccion || "";
      row.insertCell(2).textContent = store.enabled ? "Sí" : "No";
      const cellActions = row.insertCell(3);
      cellActions.innerHTML = `
        <button class="btn btn-sm btn-primary me-1" onclick="editStore('${store.id}')">Editar</button>
        <button class="btn btn-sm btn-warning me-1" onclick="toggleStore('${store.id}', ${store.enabled})">
          ${store.enabled ? "Deshabilitar" : "Habilitar"}
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteStore('${store.id}')">Eliminar</button>
      `;
    });
  } catch (error) {
    console.error("Error al cargar tiendas:", error);
    Swal.fire("Error", "Error al cargar tiendas: " + error.message, "error");
  }
}

/* Mostrar el formulario para crear una nueva tienda */
function showStoreForm() {
  document.getElementById("storeForm").reset();
  document.getElementById("storeId").value = "";
  document.getElementById("storeModalLabel").textContent = "Crear Tienda";
  new bootstrap.Modal(document.getElementById("storeModal")).show();
}

/* Manejar el envío del formulario para crear o editar una tienda */
document.getElementById("storeForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const storeId = document.getElementById("storeId").value;
  const nombre = document.getElementById("storeName").value.trim();
  const direccion = document.getElementById("storeAddress").value.trim();
  const enabled = document.getElementById("storeEnabled").value === "true";
  
  if (!nombre) {
    Swal.fire("Error", "El nombre es obligatorio.", "error");
    return;
  }
  
  try {
    const storeData = { nombre, direccion, enabled };
    if (storeId) {
      // Actualizar tienda
      await db.collection("tiendas").doc(storeId).update(storeData);
      Swal.fire("Éxito", "Tienda actualizada.", "success");
    } else {
      // Crear nueva tienda
      await db.collection("tiendas").add(storeData);
      Swal.fire("Éxito", "Tienda creada.", "success");
    }
    bootstrap.Modal.getInstance(document.getElementById("storeModal")).hide();
    loadStores();
  } catch (error) {
    console.error("Error al guardar tienda:", error);
    Swal.fire("Error", "Error al guardar tienda: " + error.message, "error");
  }
});

/* Cargar datos de una tienda en el formulario para editarla */
async function editStore(storeId) {
  try {
    const doc = await db.collection("tiendas").doc(storeId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Tienda no encontrada.", "error");
      return;
    }
    const store = doc.data();
    document.getElementById("storeId").value = storeId;
    document.getElementById("storeName").value = store.nombre;
    document.getElementById("storeAddress").value = store.direccion || "";
    document.getElementById("storeEnabled").value = store.enabled ? "true" : "false";
    document.getElementById("storeModalLabel").textContent = "Editar Tienda";
    new bootstrap.Modal(document.getElementById("storeModal")).show();
  } catch (error) {
    console.error("Error al cargar tienda:", error);
    Swal.fire("Error", "Error al cargar tienda: " + error.message, "error");
  }
}

/* Eliminar una tienda */
async function deleteStore(storeId) {
  if (!confirm("¿Está seguro de eliminar esta tienda?")) return;
  try {
    await db.collection("tiendas").doc(storeId).delete();
    Swal.fire("Éxito", "Tienda eliminada.", "success");
    loadStores();
  } catch (error) {
    console.error("Error al eliminar tienda:", error);
    Swal.fire("Error", "Error al eliminar tienda: " + error.message, "error");
  }
}

/* Alternar el estado de la tienda (habilitar/deshabilitar) */
async function toggleStore(storeId, currentStatus) {
  try {
    await db.collection("tiendas").doc(storeId).update({
      enabled: !currentStatus
    });
    Swal.fire("Éxito", "Estado de la tienda actualizado.", "success");
    loadStores();
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    Swal.fire("Error", "Error al actualizar estado: " + error.message, "error");
  }
}

// Cargar las tiendas al iniciar la página
document.addEventListener("DOMContentLoaded", () => {
  loadStores();
});
