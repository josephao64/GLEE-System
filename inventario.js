/* Facturas.js
   Este archivo administra la creación, edición, eliminación y exportación de facturas.
   Se utiliza la colección "facturas" en Firestore y se omite cualquier campo relacionado con el proveedor.
   Además, se recuperan los productos desde la colección "productos" para que el select de cada ítem se alimente dinámicamente.
*/

// Variable global para almacenar los productos recuperados de la base de datos
let allProducts = [];

// Función para cargar todos los productos desde la colección "productos"
async function loadAllProductsForInvoice() {
  try {
    const snapshot = await db.collection("productos").orderBy("codigo").get();
    allProducts = [];
    snapshot.forEach((doc) => {
      const prod = doc.data();
      prod.id = doc.id;
      allProducts.push(prod);
    });
  } catch (error) {
    console.error("Error al cargar productos para factura:", error);
  }
}

// Función para poblar un elemento select con la lista de productos
function populateProductSelect(select) {
  select.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Seleccione producto";
  select.appendChild(defaultOption);
  allProducts.forEach((prod) => {
    const option = document.createElement("option");
    option.value = prod.id;
    option.textContent = `${prod.codigo} - ${prod.descripcion}`;
    select.appendChild(option);
  });
}

/* Función para mostrar el formulario de agregar factura */
function showAddInvoiceForm() {
  document.getElementById("invoiceForm").reset();
  document.getElementById("invoiceId").value = "";
  document.querySelector("#invoiceItemsTable tbody").innerHTML = "";
  document.getElementById("invoiceOverallTotal").value = "";
  new bootstrap.Modal(document.getElementById("invoiceModal")).show();
}

/* Función para guardar o actualizar una factura */
async function saveInvoice() {
  try {
    const invoiceId = document.getElementById("invoiceId").value;
    const invoiceNumber = document.getElementById("invoiceNumber").value.trim();
    const invoiceDate = document.getElementById("invoiceDate").value;
    const invoiceCompany = document.getElementById("invoiceCompany").value;
    
    // Recolectar los productos de la factura
    const tbody = document.querySelector("#invoiceItemsTable tbody");
    const rows = tbody.rows;
    let items = [];
    for (let row of rows) {
      const productSelect = row.querySelector("select");
      const quantityInput = row.querySelector("input[name='quantity']");
      const priceInput = row.querySelector("input[name='price']");
      if (productSelect && quantityInput && priceInput) {
        const productId = productSelect.value;
        const quantity = parseFloat(quantityInput.value);
        const price = parseFloat(priceInput.value);
        const total = quantity * price;
        items.push({ productId, quantity, price, total });
      }
    }
    
    // Calcular el total general
    const overallTotal = items.reduce((sum, item) => sum + item.total, 0);
    
    // Validar campos obligatorios
    if (!invoiceNumber || !invoiceDate || !invoiceCompany || items.length === 0) {
      throw new Error("Complete todos los campos obligatorios y agregue al menos un producto.");
    }
    
    const invoiceData = {
      invoiceNumber,
      invoiceDate: firebase.firestore.Timestamp.fromDate(new Date(invoiceDate)),
      invoiceCompany,
      items,
      overallTotal
    };
    
    if (invoiceId) {
      await db.collection("facturas").doc(invoiceId).update(invoiceData);
    } else {
      await db.collection("facturas").add(invoiceData);
    }
    
    bootstrap.Modal.getInstance(document.getElementById("invoiceModal")).hide();
    loadInvoices();
  } catch (error) {
    console.error("Error al guardar la factura:", error);
    alert("Error al guardar la factura: " + error.message);
  }
}

/* Función para agregar una nueva fila de producto en la factura */
function addInvoiceItem() {
  const tbody = document.querySelector("#invoiceItemsTable tbody");
  const row = tbody.insertRow();
  
  // Celda para seleccionar producto
  const cellProduct = row.insertCell(0);
  const select = document.createElement("select");
  select.className = "form-select";
  // Poblar el select con la lista de productos ya cargados
  populateProductSelect(select);
  cellProduct.appendChild(select);
  
  // Celda para cantidad
  const cellQuantity = row.insertCell(1);
  const quantityInput = document.createElement("input");
  quantityInput.type = "number";
  quantityInput.name = "quantity";
  quantityInput.className = "form-control";
  quantityInput.value = "0";
  quantityInput.oninput = function() {
    updateInvoiceItemTotal(row);
  };
  cellQuantity.appendChild(quantityInput);
  
  // Celda para precio unitario
  const cellPrice = row.insertCell(2);
  const priceInput = document.createElement("input");
  priceInput.type = "number";
  priceInput.name = "price";
  priceInput.className = "form-control";
  priceInput.value = "0";
  priceInput.oninput = function() {
    updateInvoiceItemTotal(row);
  };
  cellPrice.appendChild(priceInput);
  
  // Celda para total
  const cellTotal = row.insertCell(3);
  cellTotal.textContent = "0.00";
  
  // Celda para acciones (botón eliminar)
  const cellActions = row.insertCell(4);
  const btnDelete = document.createElement("button");
  btnDelete.className = "btn btn-danger btn-sm";
  btnDelete.textContent = "Eliminar";
  btnDelete.onclick = function() {
    tbody.removeChild(row);
    updateOverallTotal();
  };
  cellActions.appendChild(btnDelete);
}

/* Actualiza el total de la fila según cantidad y precio */
function updateInvoiceItemTotal(row) {
  const quantity = parseFloat(row.cells[1].querySelector("input[name='quantity']").value);
  const price = parseFloat(row.cells[2].querySelector("input[name='price']").value);
  const total = isNaN(quantity * price) ? 0 : quantity * price;
  row.cells[3].textContent = total.toFixed(2);
  updateOverallTotal();
}

/* Actualiza el total general de la factura */
function updateOverallTotal() {
  const tbody = document.querySelector("#invoiceItemsTable tbody");
  let overallTotal = 0;
  for (let row of tbody.rows) {
    const total = parseFloat(row.cells[3].textContent);
    overallTotal += isNaN(total) ? 0 : total;
  }
  document.getElementById("invoiceOverallTotal").value = overallTotal.toFixed(2);
}

/* Carga y muestra las facturas desde Firestore */
async function loadInvoices() {
  try {
    const snapshot = await db
      .collection("facturas")
      .orderBy("invoiceDate", "desc")
      .get();
    const tbody = document.querySelector("#facturasTable tbody");
    tbody.innerHTML = "";
    
    snapshot.forEach((doc) => {
      const invoice = doc.data();
      const row = tbody.insertRow();
      row.insertCell(0).textContent = invoice.invoiceNumber;
      const dateStr =
        invoice.invoiceDate && invoice.invoiceDate.toDate
          ? invoice.invoiceDate.toDate().toLocaleDateString()
          : "";
      row.insertCell(1).textContent = dateStr;
      row.insertCell(2).textContent = invoice.invoiceCompany;
      // Se muestran los códigos de producto; en producción podrías consultar sus descripciones
      const productsList = invoice.items.map((item) => item.productId).join(", ");
      row.insertCell(3).textContent = productsList;
      row.insertCell(4).textContent = invoice.overallTotal;
      
      const cellActions = row.insertCell(5);
      cellActions.innerHTML = `
        <button class="btn btn-sm btn-primary" onclick="editInvoice('${doc.id}')">
          <i class="fa-solid fa-edit"></i> Editar
        </button>
        <button class="btn btn-sm btn-danger" onclick="deleteInvoice('${doc.id}')">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      `;
    });
  } catch (error) {
    console.error("Error al cargar facturas:", error);
    alert("Error al cargar facturas: " + error.message);
  }
}

/* Edita una factura existente */
async function editInvoice(invoiceId) {
  try {
    const doc = await db.collection("facturas").doc(invoiceId).get();
    if (doc.exists) {
      const invoice = doc.data();
      document.getElementById("invoiceId").value = invoiceId;
      document.getElementById("invoiceNumber").value = invoice.invoiceNumber;
      const date =
        invoice.invoiceDate && invoice.invoiceDate.toDate
          ? invoice.invoiceDate.toDate()
          : new Date();
      document.getElementById("invoiceDate").value = date
        .toISOString()
        .split("T")[0];
      document.getElementById("invoiceCompany").value = invoice.invoiceCompany;
      
      // Reconstruir los items de la factura
      const tbody = document.querySelector("#invoiceItemsTable tbody");
      tbody.innerHTML = "";
      invoice.items.forEach((item) => {
        const row = tbody.insertRow();
        
        // Producto
        const cellProduct = row.insertCell(0);
        const select = document.createElement("select");
        select.className = "form-select";
        // Poblar el select y luego seleccionar el producto correspondiente
        populateProductSelect(select);
        select.value = item.productId;
        cellProduct.appendChild(select);
        
        // Cantidad
        const cellQuantity = row.insertCell(1);
        const quantityInput = document.createElement("input");
        quantityInput.type = "number";
        quantityInput.name = "quantity";
        quantityInput.className = "form-control";
        quantityInput.value = item.quantity;
        quantityInput.oninput = function () {
          updateInvoiceItemTotal(row);
        };
        cellQuantity.appendChild(quantityInput);
        
        // Precio unitario
        const cellPrice = row.insertCell(2);
        const priceInput = document.createElement("input");
        priceInput.type = "number";
        priceInput.name = "price";
        priceInput.className = "form-control";
        priceInput.value = item.price;
        priceInput.oninput = function () {
          updateInvoiceItemTotal(row);
        };
        cellPrice.appendChild(priceInput);
        
        // Total
        const cellTotal = row.insertCell(3);
        cellTotal.textContent = item.total.toFixed(2);
        
        // Acciones
        const cellActions = row.insertCell(4);
        const btnDelete = document.createElement("button");
        btnDelete.className = "btn btn-danger btn-sm";
        btnDelete.textContent = "Eliminar";
        btnDelete.onclick = function () {
          tbody.removeChild(row);
          updateOverallTotal();
        };
        cellActions.appendChild(btnDelete);
      });
      
      new bootstrap.Modal(document.getElementById("invoiceModal")).show();
    } else {
      alert("Factura no encontrada.");
    }
  } catch (error) {
    console.error("Error al cargar factura:", error);
    alert("Error al cargar la factura: " + error.message);
  }
}

/* Elimina una factura */
async function deleteInvoice(invoiceId) {
  if (!confirm("¿Está seguro de eliminar esta factura?")) return;
  try {
    await db.collection("facturas").doc(invoiceId).delete();
    loadInvoices();
  } catch (error) {
    console.error("Error al eliminar factura:", error);
    alert("Error al eliminar la factura: " + error.message);
  }
}

/* Exporta la tabla de facturas como imagen usando html2canvas */
function exportInvoicesImage() {
  const container = document.getElementById("exportFacturasContainer");
  const invoicesTable = document.getElementById("facturasTable");
  const exportBody = document.getElementById("exportFacturasBody");
  // Copiar el contenido del tbody
  exportBody.innerHTML = invoicesTable.querySelector("tbody").innerHTML;
  container.style.display = "block";
  html2canvas(container).then((canvas) => {
    const imgData = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = imgData;
    link.download = "facturas.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    container.style.display = "none";
  });
}

// Inicialización: cargar productos para factura y facturas al iniciar la página
document.addEventListener("DOMContentLoaded", () => {
  loadAllProductsForInvoice();
  loadInvoices();
});
