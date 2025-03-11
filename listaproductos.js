// listaproductos.js

let products = [];
let selectedProductId = null;

// Obtener el usuario logueado (almacenado en localStorage, clave "loggedUser")
const loggedUser = localStorage.getItem("loggedUser") || "admin";

// Variable que contendrá la tienda a filtrar
let currentStore = "";

// Para usuarios no admin, se espera que la tienda asignada esté en localStorage ("currentStore")
if (loggedUser.toLowerCase() !== "admin") {
  currentStore = localStorage.getItem("currentStore");
  if (!currentStore) {
    // Si no hay tienda asignada, se puede asignar un valor por defecto o mostrar un mensaje.
    currentStore = "DefaultStore";
    localStorage.setItem("currentStore", currentStore);
  }
  document.getElementById("inventoryTitle").textContent = `Inventario de: ${currentStore}`;
} else {
  // Para admin, se mostrará el select para filtrar tiendas
  document.getElementById("adminStoreFilter").style.display = "block";
  // Inicialmente, admin no ha seleccionado filtro, mostramos stock total
  document.getElementById("inventoryTitle").textContent = "Inventario: Stock Total";
}

// Función para cargar la lista de tiendas en el select de filtro (solo para admin)
async function loadStoreFilter() {
  try {
    const snapshot = await firebase.firestore().collection("tiendas").orderBy("nombre").get();
    const storeSelect = document.getElementById("storeSelect");
    storeSelect.innerHTML = "<option value=''>Inventario: Stock Total</option>";
    snapshot.forEach(doc => {
      const store = doc.data();
      const option = document.createElement("option");
      option.value = store.nombre;
      option.textContent = store.nombre;
      storeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar tiendas para filtro:", error);
  }
}

// Para admin: al cargar la página, se configura el listener del select
if (loggedUser.toLowerCase() === "admin") {
  document.addEventListener("DOMContentLoaded", () => {
    loadStoreFilter();
    document.getElementById("storeSelect").addEventListener("change", function () {
      currentStore = this.value;
      if (currentStore) {
        document.getElementById("inventoryTitle").textContent = `Inventario de: ${currentStore}`;
      } else {
        document.getElementById("inventoryTitle").textContent = "Inventario: Stock Total";
      }
      listenProducts();
    });
  });
}

// Función para escuchar cambios en la colección "productos"
// En este ejemplo, se muestran TODOS los productos y se determina el stock a mostrar en función del filtro.
function listenProducts() {
  // Consulta: se muestran todos los productos
  let query = firebase.firestore().collection("productos").orderBy("createdAt", "desc");
  
  query.onSnapshot((snapshot) => {
    products = [];
    snapshot.forEach((doc) => {
      let prod = doc.data();
      prod.id = doc.id;
      products.push(prod);
    });
    renderProducts();
  }, (error) => {
    console.error("Error en el snapshot:", error);
    Swal.fire("Error", "Error en la consulta: " + error.message, "error");
  });
}

// Función para renderizar la tabla de productos
function renderProducts() {
  const tbody = document.getElementById("productsBody");
  tbody.innerHTML = "";
  
  if (products.length === 0) {
    tbody.innerHTML = "<tr><td colspan='5' class='text-center'>No hay productos disponibles</td></tr>";
    return;
  }
  
  products.forEach((prod) => {
    const tr = document.createElement("tr");
    
    // Calcular el stock a mostrar:
    // Cada producto tiene un campo "stock" que es un objeto con claves: { "Tienda A": 20, "Tienda B": 30, ... }
    let stockDisplay = 0;
    if (prod.stock && typeof prod.stock === "object") {
      if (loggedUser.toLowerCase() !== "admin") {
        // Para usuarios no admin, mostrar el stock de su tienda asignada
        stockDisplay = prod.stock[currentStore] || 0;
      } else {
        // Para admin, si se ha seleccionado una tienda en el filtro, mostrar ese stock; de lo contrario, sumar todos los stocks
        if (currentStore) {
          stockDisplay = prod.stock[currentStore] || 0;
        } else {
          stockDisplay = Object.values(prod.stock).reduce((sum, val) => sum + Number(val), 0);
        }
      }
    } else {
      stockDisplay = prod.stock || 0;
    }
    
    tr.innerHTML = `
      <td>${prod.codigo}</td>
      <td>${prod.descripcion}</td>
      <td>${prod.talla || ""}</td>
      <td>Q ${parseFloat(prod.precio).toFixed(2)}</td>
      <td>${stockDisplay}</td>
    `;
    
    // Evento para seleccionar la fila
    tr.addEventListener("click", () => {
      document.querySelectorAll("#productsBody tr").forEach((row) => row.classList.remove("table-active"));
      tr.classList.add("table-active");
      selectedProductId = prod.id;
    });
    tbody.appendChild(tr);
  });
}

// Inicializar la escucha de productos al cargar la página
document.addEventListener("DOMContentLoaded", () => {
  listenProducts();
});
