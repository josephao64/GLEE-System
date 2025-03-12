/************ Verificar Login ************/
document.addEventListener("DOMContentLoaded", () => {
  const loggedUser = localStorage.getItem("loggedUser");
  if (!loggedUser) {
    // Si no hay usuario logueado, redirige al login
    window.location.href = "login.html";
  }
});

/************ Configuración de Firebase ************/
var firebaseConfig = {
  apiKey: "AIzaSyAjVTKBJwZ8qql32ZrZBy0Q1NFUYMu-Xzk",
  authDomain: "gleedb-5d36a.firebaseapp.com",
  projectId: "gleedb-5d36a",
  storageBucket: "gleedb-5d36a",
  messagingSenderId: "1090238022032",
  appId: "1:1090238022032:web:c637b0a6dfe06be5287315"
};
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

/************ Variables Globales ************/
let productos = [];
let cart = [];
let datosCliente = {};

// Variables para control de caja
let cajaAbierta = false;
let idAperturaActivo = null;
let montoApertura = 0;
let datosApertura = {};

// Gestión de usuario y tienda
const loggedUser = localStorage.getItem("loggedUser") || "admin";
const isAdmin = loggedUser.toLowerCase() === "admin";
let currentStore = "";
document.addEventListener("DOMContentLoaded", () => {
  const inventoryTitleEl = document.getElementById("inventoryTitle");
  if (!isAdmin) {
    currentStore = localStorage.getItem("currentStore") || "DefaultStore";
    localStorage.setItem("currentStore", currentStore);
    if (inventoryTitleEl) {
      inventoryTitleEl.textContent = `Inventario de: ${currentStore}`;
    }
  } else {
    // Para admin: mostrar el select y cargar las sucursales
    const adminStoreFilterEl = document.getElementById("adminStoreFilter");
    if (adminStoreFilterEl) {
      adminStoreFilterEl.style.display = "block";
    }
    if (inventoryTitleEl) {
      inventoryTitleEl.textContent = "Inventario: Stock Total";
    }
    loadStoreFilter();
    const storeSelectEl = document.getElementById("storeSelect");
    if (storeSelectEl) {
      storeSelectEl.addEventListener("change", function () {
        currentStore = this.value;
        if (inventoryTitleEl) {
          if (currentStore) {
            inventoryTitleEl.textContent = `Inventario de: ${currentStore}`;
          } else {
            inventoryTitleEl.textContent = "Inventario: Stock Total";
          }
        }
        loadProductos();
      });
    }
  }
});
const usuarioActual = loggedUser;

/************ Funciones para generar IDs ************/
function generarIdCorto() {
  return Math.floor(Math.random() * 90000) + 10000;
}
function generarIdVentaCorta() {
  return Math.floor(Math.random() * 9000) + 1000;
}

/************ Función para cargar sucursales (tiendas) para admin ************/
async function loadStoreFilter() {
  try {
    const snapshot = await db.collection("tiendas").orderBy("nombre").get();
    const storeSelect = document.getElementById("storeSelect");
    if (storeSelect) {
      storeSelect.innerHTML = "<option value=''>Inventario: Stock Total</option>";
      snapshot.forEach(doc => {
        const store = doc.data();
        const option = document.createElement("option");
        option.value = store.nombre;
        option.textContent = store.nombre;
        storeSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error al cargar tiendas para filtro:", error);
  }
}

/************ Carga y Renderizado de Productos ************/
async function loadProductos() {
  try {
    const snapshot = await db.collection("productos").orderBy("createdAt", "desc").get();
    productos = [];
    snapshot.forEach(doc => {
      let prod = doc.data();
      prod.id = doc.id;
      productos.push(prod);
    });
    renderProducts();
  } catch (error) {
    console.error("Error al cargar productos:", error);
    Swal.fire("Error", "No se pudieron cargar los productos: " + error.message, "error");
  }
}

function renderProducts() {
  const searchQuery = document.getElementById("searchInput").value.toLowerCase();
  const sizeFilter = document.getElementById("sizeFilter").value;
  const tbody = document.getElementById("productsBody");
  tbody.innerHTML = "";
  
  // Filtrar productos según búsqueda y talla
  const filteredProducts = productos.filter(prod => {
    const matchesSearch = prod.codigo.toLowerCase().includes(searchQuery) ||
                          prod.descripcion.toLowerCase().includes(searchQuery);
    let matchesSize = true;
    if (sizeFilter) {
      matchesSize = prod.talla && prod.talla.toLowerCase() === sizeFilter.toLowerCase();
    }
    return matchesSearch && matchesSize;
  });
  
  if (filteredProducts.length === 0) {
    tbody.innerHTML = "<tr><td colspan='6' class='text-center'>No hay productos disponibles</td></tr>";
    return;
  }
  
  filteredProducts.forEach(prod => {
    let stockDisplay = 0;
    if (prod.stock && typeof prod.stock === "object") {
      if (!isAdmin) {
        stockDisplay = prod.stock[currentStore] || 0;
      } else {
        if (currentStore) {
          stockDisplay = prod.stock[currentStore] || 0;
        } else {
          stockDisplay = Object.values(prod.stock).reduce((sum, val) => sum + Number(val), 0);
        }
      }
    } else {
      stockDisplay = prod.stock || 0;
    }
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${prod.codigo}</td>
      <td>${prod.descripcion}</td>
      <td>${prod.talla || ""}</td>
      <td>Q ${parseFloat(prod.precio).toFixed(2)}</td>
      <td>${stockDisplay}</td>
      <td><button class="btn btn-primary btn-sm" onclick="agregarProductoAlCarrito('${prod.id}')">Agregar</button></td>
    `;
    tr.addEventListener("click", () => {
      document.querySelectorAll("#productsBody tr").forEach(row => row.classList.remove("table-active"));
      tr.classList.add("table-active");
    });
    tbody.appendChild(tr);
  });
}

/************ Buscador y Filtro: Actualiza la lista en tiempo real ************/
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("searchInput").addEventListener("input", renderProducts);
  document.getElementById("sizeFilter").addEventListener("change", renderProducts);
});

/************ Función para Agregar Producto al Carrito ************/
async function agregarProductoAlCarrito(productId) {
  const prod = productos.find(p => p.id === productId);
  if (!prod) return;
  
  let stockDisponible = 0;
  if (prod.stock && typeof prod.stock === "object") {
    if (!isAdmin) {
      stockDisponible = prod.stock[currentStore] || 0;
    } else {
      if (currentStore) {
        stockDisponible = prod.stock[currentStore] || 0;
      } else {
        stockDisponible = Object.values(prod.stock).reduce((sum, val) => sum + Number(val), 0);
      }
    }
  } else {
    stockDisponible = prod.stock || 0;
  }
  
  const { value: cantidad } = await Swal.fire({
    title: "Cantidad a Agregar",
    input: "number",
    inputLabel: `Ingrese la cantidad (Stock disponible: ${stockDisponible})`,
    inputAttributes: { min: 1, max: stockDisponible, step: 1 },
    inputValidator: (value) => {
      if (!value || value <= 0) return "Ingrese una cantidad válida";
      if (value > stockDisponible) return "La cantidad excede el stock disponible";
    }
  });
  if (cantidad) {
    let existing = cart.find(item => item.productId === prod.id);
    if (existing) {
      if (existing.cantidad + parseInt(cantidad) > stockDisponible) {
        Swal.fire("Error", "La cantidad total excede el stock disponible", "error");
        return;
      }
      existing.cantidad += parseInt(cantidad);
    } else {
      cart.push({
        productId: prod.id,
        producto: prod.descripcion,
        producto_codigo: prod.codigo || "N/A",
        cantidad: parseInt(cantidad),
        precio: prod.precio
      });
    }
    Swal.fire("Producto agregado al carrito", "", "success");
    renderCart();
  }
}

/************ Carrito de Venta ************/
function renderCart() {
  let tbody = document.querySelector("#cartTable tbody");
  tbody.innerHTML = "";
  let total = 0;
  cart.forEach((item, index) => {
    let subtotal = item.cantidad * item.precio;
    total += subtotal;
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.producto} <br><small>${item.producto_codigo}</small></td>
      <td>${item.cantidad}</td>
      <td>Q ${item.precio.toFixed(2)}</td>
      <td>Q ${subtotal.toFixed(2)}</td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="removerDelCarrito(${index})">❌</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById("totalVenta").textContent = total.toFixed(2);
}

function removerDelCarrito(index) {
  cart.splice(index, 1);
  renderCart();
}

/************ Función para Procesar Venta (con Datos del Cliente Integrados) ************/
async function procesarVenta() {
  if (!cajaAbierta || !idAperturaActivo) {
    Swal.fire("Error", "Debes abrir la caja antes de realizar ventas.", "warning");
    return;
  }
  if (cart.length === 0) {
    Swal.fire("El carrito está vacío", "", "warning");
    return;
  }
  let resumen = "";
  cart.forEach(item => {
    resumen += `
      <p>
        <strong>${item.producto}</strong> (${item.producto_codigo})<br>
        Cantidad: ${item.cantidad} x Q${item.precio.toFixed(2)} = Q${(item.cantidad * item.precio).toFixed(2)}
      </p>
    `;
  });
  let totalVenta = parseFloat(document.getElementById("totalVenta").textContent) || 0;
  resumen += `<h4>Total: Q${totalVenta.toFixed(2)}</h4>`;
  const { value: formData } = await Swal.fire({
    title: "Procesar Venta",
    html: `
      <h4>Datos del Cliente</h4>
      <input type="text" id="clienteNombre" class="swal2-input" placeholder="Nombre y Apellido">
      <input type="text" id="clienteTelefono" class="swal2-input" placeholder="Teléfono">
      <input type="email" id="clienteCorreo" class="swal2-input" placeholder="Correo Electrónico (opcional)">
      <input type="text" id="clienteDireccion" class="swal2-input" placeholder="Dirección (opcional)">
      <hr>
      <h4>Detalle de la Venta</h4>
      ${resumen}
      <select id="metodoPago" class="swal2-select">
        <option value="Efectivo" selected>Efectivo</option>
        <option value="Tarjeta">Tarjeta</option>
        <option value="Transferencia">Transferencia</option>
      </select>
      <div id="pagoEfectivoContainer">
        <input type="number" id="montoRecibido" class="swal2-input" value="${totalVenta}" placeholder="Monto recibido (Q)">
      </div>
    `,
    focusConfirm: false,
    preConfirm: () => {
      const nombre = document.getElementById("clienteNombre").value.trim();
      const telefono = document.getElementById("clienteTelefono").value.trim();
      if (!nombre) {
        Swal.showValidationMessage("El nombre es obligatorio");
        return;
      }
      if (!telefono) {
        Swal.showValidationMessage("El teléfono es obligatorio");
        return;
      }
      const clienteData = {
        nombre,
        telefono,
        correo: document.getElementById("clienteCorreo").value.trim(),
        direccion: document.getElementById("clienteDireccion").value.trim()
      };
      const metodo = document.getElementById("metodoPago").value;
      let pagoObj = { metodo: metodo };
      if (metodo === "Efectivo") {
        let monto = parseFloat(document.getElementById("montoRecibido").value);
        if (isNaN(monto) || monto < totalVenta) {
          Swal.showValidationMessage("Monto insuficiente para cubrir el total");
          return;
        }
        pagoObj.montoRecibido = monto;
        pagoObj.cambio = monto - totalVenta;
      }
      return { clienteData, pagoObj };
    },
    didOpen: () => {
      const metodoSelect = document.getElementById("metodoPago");
      const pagoContainer = document.getElementById("pagoEfectivoContainer");
      metodoSelect.addEventListener("change", function () {
        pagoContainer.style.display = this.value === "Efectivo" ? "block" : "none";
      });
    }
  });
  if (!formData) return;
  // Asignar datos del cliente
  datosCliente = formData.clienteData;
  
  // Crear objeto de venta
  let idVenta = generarIdVentaCorta();
  let venta = {
    idVenta: idVenta,
    fecha: new Date().toISOString(),
    cliente: datosCliente,
    productos: cart.map(item => ({
      producto_id: item.productId,
      producto_nombre: item.producto,
      producto_codigo: item.producto_codigo,
      cantidad: item.cantidad,
      precio_unitario: item.precio,
      subtotal: item.cantidad * item.precio
    })),
    total: totalVenta,
    metodo_pago: formData.pagoObj.metodo,
    cambio: formData.pagoObj.cambio || 0,
    usuario: usuarioActual,
    idApertura: idAperturaActivo
  };
  let batch = db.batch();
  for (let item of cart) {
    let prodRef = db.collection("productos").doc(item.productId);
    let prodDoc = await prodRef.get();
    if (prodDoc.exists) {
      let prodData = prodDoc.data();
      if (prodData.stock && typeof prodData.stock === "object") {
        if (!isAdmin || currentStore) {
          let currentStock = prodData.stock[currentStore] || 0;
          prodData.stock[currentStore] = currentStock - item.cantidad;
        }
      } else {
        prodData.stock = prodData.stock - item.cantidad;
      }
      batch.update(prodRef, { stock: prodData.stock });
    }
  }
  let ventaRef = db.collection("ventas").doc();
  batch.set(ventaRef, venta);
  batch.commit().then(() => {
    Swal.fire({
      title: "Venta procesada!",
      html:
        "Comprobante generado.<br><button class='btn btn-primary' onclick='descargarComprobante(" +
        JSON.stringify(venta) +
        ")'>Descargar Comprobante</button>",
      icon: "success"
    });
    cart = [];
    renderCart();
  }).catch(error => {
    Swal.fire("Error", error.toString(), "error");
  });
}

/************ Función para Descargar Comprobante en PDF ************/
function descargarComprobante(venta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: [80, 300] });
  const pageWidth = doc.internal.pageSize.getWidth();
  let xMargin = 5, y = 10;
  const colorLineas = [200, 200, 200], colorSeccion = [230, 230, 240];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("COMPROBANTE DE VENTA", pageWidth / 2, y, { align: "center" });
  y += 6;
  doc.setLineWidth(0.3);
  doc.setDrawColor(...colorLineas);
  doc.line(xMargin, y, pageWidth - xMargin, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setFillColor(...colorSeccion);
  doc.rect(xMargin, y - 3, pageWidth - xMargin * 2, 6, "F");
  doc.text("Datos del Cliente", xMargin + 1, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Fecha: " + new Date(venta.fecha).toLocaleString(), xMargin, y);
  y += 5;
  doc.text("Nombre: " + (venta.cliente.nombre || ""), xMargin, y);
  y += 5;
  doc.text("Tel: " + (venta.cliente.telefono || ""), xMargin, y);
  y += 5;
  if (venta.cliente.correo) { doc.text("Correo: " + venta.cliente.correo, xMargin, y); y += 5; }
  if (venta.cliente.direccion) { doc.text("Dir: " + venta.cliente.direccion, xMargin, y); y += 5; }
  y += 2;
  doc.line(xMargin, y, pageWidth - xMargin, y);
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFillColor(...colorSeccion);
  doc.rect(xMargin, y - 3, pageWidth - xMargin * 2, 6, "F");
  doc.text("Productos", xMargin + 1, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Desc.", xMargin, y);
  doc.text("Cant", pageWidth - xMargin - 30, y, { align: "right" });
  doc.text("P.U.", pageWidth - xMargin - 18, y, { align: "right" });
  doc.text("Subt.", pageWidth - xMargin, y, { align: "right" });
  y += 4;
  doc.setDrawColor(...colorLineas);
  doc.line(xMargin, y, pageWidth - xMargin, y);
  y += 3;
  doc.setFont("helvetica", "normal");
  venta.productos.forEach((prod, index) => {
    const precio_unitario = prod.precio_unitario !== undefined ? prod.precio_unitario : prod.precio;
    const subtotal = prod.subtotal !== undefined ? prod.subtotal : prod.cantidad * prod.precio;
    let nombre = prod.producto_nombre || prod.producto;
    if(nombre.length > 20) { nombre = nombre.substring(0,20) + "..."; }
    doc.text(`${index+1}. ${nombre}`, xMargin, y);
    y += 4;
    doc.text(String(prod.cantidad), pageWidth - xMargin - 30, y - 2, { align: "right" });
    doc.text("Q" + precio_unitario.toFixed(2), pageWidth - xMargin - 18, y - 2, { align: "right" });
    doc.text("Q" + subtotal.toFixed(2), pageWidth - xMargin, y - 2, { align: "right" });
    y += 6;
  });
  doc.line(xMargin, y, pageWidth - xMargin, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFillColor(...colorSeccion);
  doc.rect(xMargin, y - 3, pageWidth - xMargin * 2, 6, "F");
  doc.text("Resumen", xMargin + 1, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", pageWidth - xMargin - 20, y, { align: "right" });
  doc.text("Q" + venta.total.toFixed(2), pageWidth - xMargin, y, { align: "right" });
  y += 5;
  let impuestos = 0;
  doc.text("Impuestos:", pageWidth - xMargin - 20, y, { align: "right" });
  doc.text("Q" + impuestos.toFixed(2), pageWidth - xMargin, y, { align: "right" });
  y += 5;
  let totalPagar = venta.total + impuestos;
  doc.setFont("helvetica", "bold");
  doc.text("Total:", pageWidth - xMargin - 20, y, { align: "right" });
  doc.text("Q" + totalPagar.toFixed(2), pageWidth - xMargin, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 7;
  doc.text("Método de Pago: " + venta.metodo_pago, xMargin, y);
  if (venta.metodo_pago === "Efectivo") {
    y += 6;
    doc.text("Recibido: Q" + (venta.montoRecibido !== undefined ? venta.montoRecibido.toFixed(2) : "0.00"), xMargin, y);
    y += 6;
    doc.text("Cambio: Q" + (venta.cambio !== undefined ? venta.cambio.toFixed(2) : "0.00"), xMargin, y);
  }
  y += 10;
  doc.setFont("helvetica", "italic");
  doc.text("¡Gracias por su compra!", pageWidth / 2, y, { align: "center" });
  doc.save("comprobante_venta_estrecho.pdf");
}

/************ Apertura y Cierre de Caja ************/
function abrirCaja() {
  Swal.fire({
    title: "Abrir Caja",
    input: "number",
    inputLabel: "Ingrese el monto inicial en efectivo (Q)",
    inputAttributes: { min: 0.01, step: 0.01 },
    preConfirm: (value) => {
      if (!value || parseFloat(value) <= 0) {
        Swal.showValidationMessage("Ingrese un monto válido");
      }
      return parseFloat(value);
    }
  }).then(result => {
    if (result.isConfirmed) {
      montoApertura = result.value;
      let now = new Date();
      let fecha = now.toISOString().split("T")[0];
      let hora = now.toTimeString().split(" ")[0];
      let idApertura = generarIdCorto();
      let apertura = {
        idApertura: idApertura,
        fechaApertura: fecha,
        horaApertura: hora,
        montoApertura: montoApertura,
        usuario: usuarioActual,
        activo: true
      };
      db.collection("aperturas").doc(idApertura.toString()).set(apertura)
        .then(() => {
          cajaAbierta = true;
          idAperturaActivo = idApertura;
          datosApertura = apertura;
          Swal.fire("Caja abierta", "La apertura se ha registrado correctamente. Monto inicial: Q " + montoApertura.toFixed(2), "success");
        })
        .catch(error => {
          Swal.fire("Error", "No se pudo abrir la caja: " + error.toString(), "error");
        });
    }
  });
}

function cerrarCaja() {
  if (!cajaAbierta || !idAperturaActivo) {
    Swal.fire("Error", "No hay una apertura activa.", "warning");
    return;
  }
  Swal.fire({
    title: "Cerrar Caja",
    html: `
      <input type="date" id="fechaCierre" class="swal2-input" placeholder="Fecha de cierre">
      <input type="number" id="montoFinal" class="swal2-input" placeholder="Monto final en caja (Q)">
    `,
    focusConfirm: false,
    preConfirm: () => {
      const fechaCierre = document.getElementById("fechaCierre").value;
      const montoFinal = parseFloat(document.getElementById("montoFinal").value);
      if (!fechaCierre) {
        Swal.showValidationMessage("Debe ingresar la fecha de cierre");
        return;
      }
      if (isNaN(montoFinal)) {
        Swal.showValidationMessage("Debe ingresar un monto final válido");
        return;
      }
      return { fechaCierre, montoFinal };
    }
  }).then(result => {
    if (result.isConfirmed) {
      const { fechaCierre, montoFinal } = result.value;
      db.collection("ventas")
        .where("idApertura", "==", idAperturaActivo)
        .get()
        .then(snapshot => {
          let totalEfectivo = 0, totalTarjeta = 0, totalTransferencia = 0;
          let ventasDetalle = [];
          if (snapshot.empty) {
            Swal.fire("Información", "No hay ventas registradas en esta apertura.", "info");
            return;
          }
          snapshot.forEach(doc => {
            let venta = doc.data();
            venta.id = doc.id;
            ventasDetalle.push(venta);
            if (venta.metodo_pago.toLowerCase() === "efectivo") {
              totalEfectivo += venta.total;
            } else if (venta.metodo_pago.toLowerCase() === "tarjeta") {
              totalTarjeta += venta.total;
            } else if (venta.metodo_pago.toLowerCase() === "transferencia") {
              totalTransferencia += venta.total;
            }
          });
          let totalGeneral = totalEfectivo + totalTarjeta + totalTransferencia;
          let diferencia = montoFinal - totalGeneral;
          let now = new Date();
          let fechaCierreReal = now.toISOString().split("T")[0];
          let horaCierre = now.toTimeString().split(" ")[0];
          let cierre = {
            idApertura: idAperturaActivo,
            fechaApertura: datosApertura.fechaApertura,
            horaApertura: datosApertura.horaApertura,
            fechaCierre: fechaCierre,
            horaCierre: horaCierre,
            totalEfectivo: totalEfectivo,
            totalTarjeta: totalTarjeta,
            totalTransferencia: totalTransferencia,
            totalGeneral: totalGeneral,
            montoApertura: montoApertura,
            montoFinal: montoFinal,
            diferencia: diferencia,
            usuario: usuarioActual
          };
          db.collection("cierres").add(cierre)
            .then(() => {
              db.collection("aperturas").doc(idAperturaActivo.toString()).update({ activo: false, fechaCierre: fechaCierre, horaCierre: horaCierre })
                .then(() => {
                  mostrarReporteCierre(ventasDetalle, cierre);
                  cajaAbierta = false;
                  idAperturaActivo = null;
                });
            })
            .catch(error => {
              Swal.fire("Error", "No se pudo cerrar la caja: " + error.toString(), "error");
            });
        })
        .catch(error => {
          Swal.fire("Error", "Error al consultar ventas: " + error.toString(), "error");
        });
    }
  });
}

function mostrarReporteCierre(ventas, cierre) {
  let htmlReporte = `
    <div class="container">
      <div class="row mb-3">
        <div class="col-md-3 summary-box">
          <strong>Num. Apertura:</strong> <span id="numApertura">${cierre.idApertura}</span>
        </div>
        <div class="col-md-3 summary-box">
          <strong>Nombre Cajero:</strong> <span id="nombreCajero">${usuarioActual}</span>
        </div>
        <div class="col-md-3 summary-box">
          <strong>Fecha Apertura:</strong> <span id="fechaApertura">${cierre.fechaApertura} ${cierre.horaApertura}</span>
        </div>
        <div class="col-md-3 summary-box">
          <strong>Fecha Cierre:</strong> <span id="fechaCierre">${cierre.fechaCierre} ${cierre.horaCierre}</span>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-md-4 summary-box bg-light">
          <strong>Fondo Apertura:</strong> Q <span id="fondoApertura">${cierre.montoApertura.toFixed(2)}</span>
        </div>
        <div class="col-md-4 summary-box bg-light">
          <strong>Venta Total:</strong> Q <span id="ventaTotal">${cierre.totalGeneral.toFixed(2)}</span>
        </div>
        <div class="col-md-4 summary-box bg-light">
          <strong>Venta Efectivo:</strong> Q <span id="ventaEfectivo">${cierre.totalEfectivo.toFixed(2)}</span>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-md-6 summary-box bg-light">
          <strong>Venta Tarjeta:</strong> Q <span id="ventaTarjeta">${cierre.totalTarjeta.toFixed(2)}</span>
        </div>
        <div class="col-md-6 summary-box bg-light">
          <strong>Venta Transferencia:</strong> Q <span id="ventaTransferencia">${cierre.totalTransferencia.toFixed(2)}</span>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-md-6 summary-box bg-light">
          <strong>Total Sistema:</strong> Q <span id="totalSistema">${cierre.totalGeneral.toFixed(2)}</span>
        </div>
        <div class="col-md-6 summary-box bg-light">
          <strong>Total Cajero:</strong> Q <span id="totalCajero">${cierre.montoFinal.toFixed(2)}</span>
        </div>
      </div>
      <div class="row mb-3">
        <div class="col-md-12 summary-box bg-light">
          <strong>Diferencia de Caja:</strong> Q <span id="diferenciaCaja">${cierre.diferencia.toFixed(2)}</span>
        </div>
      </div>
      <h4>Detalles de Operaciones</h4>
      <table class="table table-bordered">
        <thead>
          <tr>
            <th>N° Documento</th>
            <th>Forma de Pago</th>
            <th>Monto Pagado</th>
            <th>Equivalencia en Caja</th>
          </tr>
        </thead>
        <tbody>`;
  ventas.forEach(v => {
    let equivalencia = v.metodo_pago.toLowerCase() === "efectivo" ? parseFloat(v.total).toFixed(2) : "-";
    htmlReporte += `
          <tr>
            <td>${v.id}</td>
            <td>${v.metodo_pago}</td>
            <td>Q ${parseFloat(v.total).toFixed(2)}</td>
            <td>${equivalencia}</td>
          </tr>`;
  });
  htmlReporte += `
        </tbody>
      </table>
      <br>
      <button class="btn btn-primary" onclick="descargarReporteCierre(${encodeURIComponent(JSON.stringify(ventas))}, ${encodeURIComponent(JSON.stringify(cierre))})">Descargar Reporte PDF</button>
    </div>`;
  Swal.fire({
    title: "Cierre Registrado y Reporte",
    html: htmlReporte,
    width: "80%"
  });
}

function descargarReporteCierre(ventasJSON, cierreJSON) {
  const ventas = JSON.parse(decodeURIComponent(ventasJSON));
  const cierre = JSON.parse(decodeURIComponent(cierreJSON));
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  let y = 10;
  doc.setFontSize(14);
  doc.text(`Reporte de Ventas - Apertura ${cierre.idApertura}`, 10, y);
  y += 10;
  doc.setFontSize(10);
  doc.text(`Fecha Apertura: ${cierre.fechaApertura} ${cierre.horaApertura}`, 10, y);
  y += 7;
  doc.text(`Fecha de Cierre: ${cierre.fechaCierre} ${cierre.horaCierre}`, 10, y);
  y += 7;
  doc.text(`Usuario: ${cierre.usuario}`, 10, y);
  y += 7;
  doc.text(`Monto Apertura: Q ${cierre.montoApertura.toFixed(2)}`, 10, y);
  y += 7;
  doc.text(`Total Efectivo: Q ${cierre.totalEfectivo.toFixed(2)}`, 10, y);
  y += 7;
  doc.text(`Total Tarjeta: Q ${cierre.totalTarjeta.toFixed(2)}`, 10, y);
  y += 7;
  doc.text(`Total Transferencia: Q ${cierre.totalTransferencia.toFixed(2)}`, 10, y);
  y += 7;
  doc.text(`Total Sistema: Q ${cierre.totalGeneral.toFixed(2)}`, 10, y);
  y += 7;
  doc.text(`Monto Final (Efectivo): Q ${cierre.montoFinal.toFixed(2)}`, 10, y);
  y += 7;
  doc.text(`Diferencia: Q ${cierre.diferencia.toFixed(2)}`, 10, y);
  y += 10;
  doc.text("Detalles de Operaciones:", 10, y);
  y += 7;
  ventas.forEach(v => {
    let linea = `${v.id} - ${v.metodo_pago} - Q ${parseFloat(v.total).toFixed(2)}`;
    doc.text(linea, 10, y);
    y += 7;
    if (y > 280) { doc.addPage(); y = 10; }
  });
  doc.save(`Reporte_Ventas_Apertura_${cierre.idApertura}.pdf`);
}

/************ Inicialización ************/
async function initSistemaVenta() {
  await loadProductos();
}
initSistemaVenta();
