/* inventario.js */

// CONFIGURACIÓN DE FIREBASE
var firebaseConfig = {
    apiKey: "AIzaSyAjVTKBJwZ8qql32ZrZBy0Q1NFUYMu-Xzk",
    authDomain: "gleedb-5d36a.firebaseapp.com",
    projectId: "gleedb-5d36a",
    storageBucket: "gleedb-5d36a.firebasestorage.app",
    messagingSenderId: "1090238022032",
    appId: "1:1090238022032:web:c637b0a6dfe06be5287315"
  };
  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();
  
  /* FUNCIONES DE UTILIDAD */
  function closeModal(modalId) {
    var modalEl = document.getElementById(modalId);
    if (modalEl.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    var modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    } else {
      new bootstrap.Modal(modalEl).hide();
    }
  }
  
  function showSection(section) {
    // Oculta todas las secciones
    document.getElementById("productsSection").style.display = "none";
    document.getElementById("movementsSection").style.display = "none";
    document.getElementById("categoriesSection").style.display = "none";
  
    if (section === "products") {
      document.getElementById("productsSection").style.display = "block";
      loadProducts();
    } else if (section === "movements") {
      document.getElementById("movementsSection").style.display = "block";
      loadMovements(); // Suponiendo que está definida en otro módulo
    }
  }
  
  /* GESTIÓN DE PRODUCTOS */
  function showAddProductForm() {
    document.getElementById("productModalLabel").textContent = "Agregar Producto";
    document.getElementById("productId").value = "";
    document.getElementById("productName").value = "";
    document.getElementById("productDescription").value = "";
    document.getElementById("productTalla").value = "";
    document.getElementById("productColor").value = "";
    document.getElementById("productMarca").value = "";
    document.getElementById("productUnitPrice").value = "";
    document.getElementById("productCode").value = "";
    loadCategoriesToSelect();
    document.getElementById("variantsContainer").innerHTML = "";
  }
  
  function addVariantRow() {
    const container = document.getElementById("variantsContainer");
    const row = document.createElement("div");
    row.className = "variant-row mb-2 row";
    row.innerHTML = `
      <div class="col-md-2">
        <input type="text" class="form-control variant-talla" placeholder="Talla" required>
      </div>
      <div class="col-md-2">
        <input type="text" class="form-control variant-color" placeholder="Color" required>
      </div>
      <div class="col-md-2">
        <input type="number" class="form-control variant-stock" placeholder="Stock" min="0" required>
      </div>
      <div class="col-md-2">
        <input type="number" step="0.01" class="form-control variant-unitPrice" placeholder="Precio" min="0" required>
      </div>
      <div class="col-md-3">
        <input type="text" class="form-control variant-code" placeholder="Código (opcional)">
      </div>
      <div class="col-md-1">
        <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    `;
    container.appendChild(row);
  }
  
  function generateProductCode() {
    let code = "PRD-" + Date.now();
    document.getElementById("productCode").value = code;
  }
  
  async function saveProduct() {
    try {
      let id = document.getElementById("productId").value;
      let name = document.getElementById("productName").value.trim().toUpperCase();
      let description = document.getElementById("productDescription").value.trim().toUpperCase();
      let marca = document.getElementById("productMarca").value.trim().toUpperCase();
      let unitPrice = parseFloat(document.getElementById("productUnitPrice").value) || 0;
      let productCode = document.getElementById("productCode").value.trim().toUpperCase();
      let category = document.getElementById("productCategory").value;
      
      if (!name) throw new Error("El nombre del producto es obligatorio.");
      if (!category) throw new Error("La categoría es obligatoria.");
      
      let variantRows = document.querySelectorAll("#variantsContainer .variant-row");
      let variants = [];
      variantRows.forEach(row => {
        let talla = row.querySelector(".variant-talla").value.trim().toUpperCase();
        let color = row.querySelector(".variant-color").value.trim().toUpperCase();
        let stock = parseInt(row.querySelector(".variant-stock").value) || 0;
        let vUnitPrice = parseFloat(row.querySelector(".variant-unitPrice").value) || 0;
        let variantCode = row.querySelector(".variant-code").value.trim().toUpperCase();
        if (talla && color) {
          if (!variantCode) {
            variantCode = `${name.substr(0,3)}-${talla}-${color}-${Date.now()}`;
          }
          variants.push({
            talla,
            color,
            stock,
            unitPrice: vUnitPrice,
            productCode: variantCode
          });
        }
      });
      if (variants.length === 0) {
        throw new Error("Debe agregar al menos una variante.");
      }
      
      let idNum = id ? null : Date.now();
      let productData = {
        name,
        description,
        category,
        marca,
        unitPrice,
        productCode,
        variants
      };
      
      if (!id) {
        productData.idNum = idNum;
        await db.collection("inventoryProducts").add(productData);
      } else {
        await db.collection("inventoryProducts").doc(id).update(productData);
      }
      
      closeModal("productModal");
      loadProducts();
      populateProductSelects();
    } catch (error) {
      console.error("Error al guardar producto:", error);
      alert("Error al guardar producto: " + error.message);
    }
  }
  
  async function loadProducts() {
    try {
      let snapshot = await db.collection("inventoryProducts")
        .orderBy("category")
        .orderBy("name")
        .get();
      let tbody = document.getElementById("productsTable").getElementsByTagName("tbody")[0];
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        let row = tbody.insertRow();
        row.insertCell(0).textContent = product.idNum ? product.idNum : "-";
        row.insertCell(1).textContent = product.name;
        row.insertCell(2).textContent = product.category;
        row.insertCell(3).textContent = product.variants ? product.variants.length : 0;
        row.insertCell(4).innerHTML = `
          <button class="btn btn-sm btn-primary" onclick="editProduct('${doc.id}')">
            <i class="fa-solid fa-edit"></i> Editar
          </button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct('${doc.id}')">
            <i class="fa-solid fa-trash"></i> Eliminar
          </button>
        `;
      });
    } catch (error) {
      console.error("Error al cargar productos:", error);
      alert("Error al cargar productos: " + error.message);
    }
  }
  
  function filterProducts() {
    var input = document.getElementById("productSearchInput");
    var filter = input.value.toUpperCase();
    var table = document.getElementById("productsTable");
    var tr = table.getElementsByTagName("tr");
    for (var i = 1; i < tr.length; i++) {
      let cells = tr[i].getElementsByTagName("td");
      if (cells.length > 0) {
        let text = cells[0].textContent + " " + cells[1].textContent + " " + cells[2].textContent;
        tr[i].style.display = text.toUpperCase().indexOf(filter) > -1 ? "" : "none";
      }
    }
  }
  
  async function editProduct(id) {
    try {
      let doc = await db.collection("inventoryProducts").doc(id).get();
      if (doc.exists) {
        let product = doc.data();
        document.getElementById("productModalLabel").textContent = "Editar Producto";
        document.getElementById("productId").value = id;
        document.getElementById("productName").value = product.name;
        document.getElementById("productDescription").value = product.description;
        document.getElementById("productMarca").value = product.marca;
        document.getElementById("productUnitPrice").value = product.unitPrice || "";
        document.getElementById("productCode").value = product.productCode || "";
        loadCategoriesToSelect(product.category);
        let container = document.getElementById("variantsContainer");
        container.innerHTML = "";
        if (product.variants && Array.isArray(product.variants)) {
          product.variants.forEach(variant => {
            const row = document.createElement("div");
            row.className = "variant-row mb-2 row";
            row.innerHTML = `
              <div class="col-md-2">
                <input type="text" class="form-control variant-talla" placeholder="Talla" value="${variant.talla}" required>
              </div>
              <div class="col-md-2">
                <input type="text" class="form-control variant-color" placeholder="Color" value="${variant.color}" required>
              </div>
              <div class="col-md-2">
                <input type="number" class="form-control variant-stock" placeholder="Stock" value="${variant.stock}" min="0" required>
              </div>
              <div class="col-md-2">
                <input type="number" step="0.01" class="form-control variant-unitPrice" placeholder="Precio" value="${variant.unitPrice}" min="0" required>
              </div>
              <div class="col-md-3">
                <input type="text" class="form-control variant-code" placeholder="Código (opcional)" value="${variant.productCode}">
              </div>
              <div class="col-md-1">
                <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            `;
            container.appendChild(row);
          });
        }
      } else {
        alert("Producto no encontrado.");
      }
    } catch (error) {
      console.error("Error al cargar producto:", error);
      alert("Error al cargar producto: " + error.message);
    }
  }
  
  async function deleteProduct(id) {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
      try {
        await db.collection("inventoryProducts").doc(id).delete();
        loadProducts();
        populateProductSelects();
      } catch (error) {
        console.error("Error al eliminar producto:", error);
        alert("Error al eliminar producto: " + error.message);
      }
    }
  }
  
  async function populateProductSelects() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let movementSelect = document.getElementById("movementProductSelect");
      if (movementSelect) movementSelect.innerHTML = "";
      snapshot.forEach(doc => {
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = doc.data().name;
        if (movementSelect) movementSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Error al cargar productos para selects:", error);
    }
  }
  
  /* GESTIÓN DE CATEGORÍAS */
  // En lugar de redirigir, se carga el contenido de categorias.html en el iframe
  function showCategoryModal() {
    // Oculta secciones de productos y movimientos
    document.getElementById("productsSection").style.display = "none";
    document.getElementById("movementsSection").style.display = "none";
    
    // Muestra la sección de Categorías y carga el iframe
    let catSection = document.getElementById("categoriesSection");
    catSection.style.display = "block";
    let catFrame = document.getElementById("categoriesFrame");
    if (!catFrame.src) {
      catFrame.src = "categorias.html";
    }
  }
  
  async function loadCategoriesToSelect(selectedCategory = "") {
    try {
      let snapshot = await db.collection("categories").orderBy("name").get();
      let select = document.getElementById("productCategory");
      select.innerHTML = '<option value="">Seleccione una categoría</option>';
      snapshot.forEach(doc => {
        let cat = doc.data();
        let option = document.createElement("option");
        option.value = doc.id;
        option.textContent = cat.name;
        if (doc.id === selectedCategory) {
          option.selected = true;
        }
        select.appendChild(option);
      });
    } catch (error) {
      console.error("Error al cargar categorías:", error);
      alert("Error al cargar categorías: " + error.message);
    }
  }
  
  /* VISUALIZAR STOCK DE VARIANTES */
  function showVariantsStock() {
    let container = document.getElementById("variantsContainer");
    let rows = container.querySelectorAll(".variant-row");
    let contentDiv = document.getElementById("variantsStockContent");
    contentDiv.innerHTML = "";
    if (rows.length === 0) {
      contentDiv.innerHTML = "<p>No hay variantes agregadas.</p>";
    } else {
      let table = document.createElement("table");
      table.className = "table table-striped";
      let thead = document.createElement("thead");
      thead.innerHTML = `
        <tr>
          <th>Talla</th>
          <th>Color</th>
          <th>Stock</th>
          <th>Precio Unitario</th>
          <th>Código</th>
        </tr>
      `;
      table.appendChild(thead);
      let tbody = document.createElement("tbody");
      rows.forEach(row => {
        let talla = row.querySelector(".variant-talla").value;
        let color = row.querySelector(".variant-color").value;
        let stock = row.querySelector(".variant-stock").value;
        let price = row.querySelector(".variant-unitPrice").value;
        let code = row.querySelector(".variant-code").value;
        let tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${talla}</td>
          <td>${color}</td>
          <td>${stock}</td>
          <td>Q. ${parseFloat(price).toFixed(2)}</td>
          <td>${code}</td>
        `;
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      contentDiv.appendChild(table);
    }
    let stockModal = new bootstrap.Modal(document.getElementById("variantsStockModal"));
    stockModal.show();
  }
  
  /* EXPORTAR STOCK (PRODUCTOS) */
  async function exportProductsStockImage() {
    try {
      let snapshot = await db.collection("inventoryProducts").get();
      let tbody = document.getElementById("exportProductsBody");
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        let product = doc.data();
        let row = document.createElement("tr");
        let cellName = document.createElement("td");
        cellName.textContent = product.name;
        let totalStock = 0;
        if (product.variants && Array.isArray(product.variants)) {
          product.variants.forEach(v => totalStock += v.stock);
        }
        let cellStock = document.createElement("td");
        cellStock.textContent = totalStock;
        row.appendChild(cellName);
        row.appendChild(cellStock);
        tbody.appendChild(row);
      });
      let now = new Date();
      document.getElementById("exportHeader").textContent =
        "REPORTE STOCK DE BODEGA - " + now.toLocaleDateString();
      let exportContainer = document.getElementById("exportProductsContainer");
      exportContainer.style.display = "block";
      html2canvas(exportContainer).then(canvas => {
        let link = document.createElement("a");
        let fileName = "Stock_" + now.toISOString().slice(0, 10) + ".png";
        link.download = fileName;
        link.href = canvas.toDataURL("image/png");
        link.click();
        exportContainer.style.display = "none";
      });
    } catch (error) {
      console.error("Error al exportar stock de productos:", error);
      alert("Error al exportar stock: " + error.message);
    }
  }
  
  /* INICIALIZACIÓN */
  window.onload = function() {
    showSection("products");
    populateProductSelects();
  };
  