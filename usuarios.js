/* usuarios.js
   Módulo CRUD para la administración de usuarios y roles.
   Se utilizan las colecciones "usuarios", "roles" y "tiendas" en Firestore.
   Cada usuario tiene:
     - username: string
     - password: string
     - enabled: boolean
     - tienda: string (opcional, no para admin)
     - rol: string (opcional, no para admin)
     - permissions: objeto (opcional, para permisos personalizados)
   Cada rol tiene:
     - roleName: string
     - roleDescription: string (opcional)
     - permissions: objeto (ej: { productos: true, entradas: true, movimientos: true, salidas: true, usuarios: true, tiendas: true })
*/

let users = [];
let roles = [];
let stores = [];

/* Función para asegurar que exista el rol "admin" */
async function ensureAdminRole() {
  try {
    const snapshot = await db.collection("roles").where("roleName", "==", "admin").get();
    if (snapshot.empty) {
      await db.collection("roles").add({
        roleName: "admin",
        roleDescription: "Rol de administrador con todos los permisos",
        permissions: {
          productos: true,
          entradas: true,
          movimientos: true,
          salidas: true,
          usuarios: true,
          tiendas: true
        }
      });
    }
  } catch (error) {
    console.error("Error asegurando rol admin:", error);
  }
}

/* Cargar usuarios y mostrarlos en la tabla */
async function loadUsers() {
  try {
    const snapshot = await db.collection("usuarios").orderBy("username").get();
    users = [];
    const tbody = document.querySelector("#usersTable tbody");
    tbody.innerHTML = "";
    snapshot.forEach(doc => {
      const user = doc.data();
      user.id = doc.id;
      users.push(user);
      const row = tbody.insertRow();
      row.insertCell(0).textContent = user.username;
      row.insertCell(1).textContent = user.password; // Se muestra la contraseña en texto plano
      row.insertCell(2).textContent = user.username.toLowerCase() === "admin" ? "-" : (user.tienda || "");
      row.insertCell(3).textContent = user.rol || "";
      row.insertCell(4).textContent = user.enabled ? "Sí" : "No";
      const cellActions = row.insertCell(5);
      cellActions.innerHTML = `
        <button class="btn btn-sm btn-primary me-1" onclick="editUser('${user.id}')">Editar</button>
        <button class="btn btn-sm btn-danger me-1" onclick="deleteUser('${user.id}')">Eliminar</button>
        <button class="btn btn-sm btn-warning" onclick="toggleUser('${user.id}', ${user.enabled})">
          ${user.enabled ? "Deshabilitar" : "Habilitar"}
        </button>
      `;
    });
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    Swal.fire("Error", "Error al cargar usuarios: " + error.message, "error");
  }
}

/* Cargar roles y llenar el select del formulario de usuario y la tabla de roles */
async function loadRoles() {
  try {
    // Asegurar que exista el rol admin
    await ensureAdminRole();
    const snapshot = await db.collection("roles").orderBy("roleName").get();
    roles = [];
    const roleSelect = document.getElementById("userRole");
    roleSelect.innerHTML = "<option value=''>Seleccione rol</option>";
    snapshot.forEach(doc => {
      const role = doc.data();
      role.id = doc.id;
      roles.push(role);
      const option = document.createElement("option");
      option.value = role.roleName;
      option.textContent = role.roleName;
      roleSelect.appendChild(option);
    });
    loadRolesTable();
  } catch (error) {
    console.error("Error al cargar roles:", error);
    Swal.fire("Error", "Error al cargar roles: " + error.message, "error");
  }
}

/* Cargar roles en la tabla del modal de roles */
function loadRolesTable() {
  const tbody = document.querySelector("#rolesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  roles.forEach(role => {
    const row = tbody.insertRow();
    row.insertCell(0).textContent = role.roleName;
    // Convertir objeto de permisos a cadena
    const perms = [];
    if (role.permissions) {
      for (const key in role.permissions) {
        if (role.permissions[key]) perms.push(key);
      }
    }
    row.insertCell(1).textContent = perms.join(", ");
    const cellActions = row.insertCell(2);
    cellActions.innerHTML = `
      <button class="btn btn-sm btn-primary me-1" onclick="editRole('${role.id}')">Editar</button>
      <button class="btn btn-sm btn-danger" onclick="deleteRole('${role.id}')">Eliminar</button>
    `;
  });
}

/* Cargar tiendas y llenar el select del formulario de usuario */
async function loadStores() {
  try {
    const snapshot = await db.collection("tiendas").orderBy("nombre").get();
    stores = [];
    const storeSelect = document.getElementById("userStore");
    storeSelect.innerHTML = "<option value=''>Seleccione tienda</option>";
    snapshot.forEach(doc => {
      const store = doc.data();
      store.id = doc.id;
      stores.push(store);
      const option = document.createElement("option");
      option.value = store.nombre;
      option.textContent = store.nombre;
      storeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar tiendas:", error);
    Swal.fire("Error", "Error al cargar tiendas: " + error.message, "error");
  }
}

/* Mostrar formulario para crear/editar usuario */
function showUserForm() {
  document.getElementById("userForm").reset();
  document.getElementById("userId").value = "";
  document.getElementById("userModalLabel").textContent = "Crear Usuario";
  // Habilitar campos por defecto
  document.getElementById("userStore").disabled = false;
  document.getElementById("userRole").disabled = false;
  new bootstrap.Modal(document.getElementById("userModal")).show();
}

/* Guardar (crear o actualizar) usuario */
document.getElementById("userForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const userId = document.getElementById("userId").value;
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const tienda = document.getElementById("userStore").value;
  const rol = document.getElementById("userRole").value;
  const enabled = document.getElementById("userEnabled").value === "true";
  
  if (!username || !password) {
    Swal.fire("Error", "Complete los campos obligatorios.", "error");
    return;
  }
  
  // Si el rol es admin o el usuario es admin, no se asocia tienda
  if (rol.toLowerCase() !== "admin" && username.toLowerCase() !== "admin") {
    if (!tienda) {
      Swal.fire("Error", "Seleccione una tienda.", "error");
      return;
    }
    if (!rol) {
      Swal.fire("Error", "Seleccione un rol.", "error");
      return;
    }
  }
  
  // Obtener permisos personalizados del usuario
  const permissions = {
    productos: document.getElementById("permProductosUser").checked,
    entradas: document.getElementById("permEntradasUser").checked,
    movimientos: document.getElementById("permMovimientosUser").checked,
    salidas: document.getElementById("permSalidasUser").checked,
    usuarios: document.getElementById("permUsuariosUser").checked,
    tiendas: document.getElementById("permTiendasUser").checked
  };
  
  try {
    const userData = { username, password, enabled, permissions };
    if (rol.toLowerCase() !== "admin" && username.toLowerCase() !== "admin") {
      userData.tienda = tienda;
      userData.rol = rol;
    }
    if (userId) {
      await db.collection("usuarios").doc(userId).update(userData);
      Swal.fire("Éxito", "Usuario actualizado.", "success");
    } else {
      await db.collection("usuarios").add(userData);
      Swal.fire("Éxito", "Usuario creado.", "success");
    }
    bootstrap.Modal.getInstance(document.getElementById("userModal")).hide();
    loadUsers();
  } catch (error) {
    console.error("Error al guardar usuario:", error);
    Swal.fire("Error", "Error al guardar usuario: " + error.message, "error");
  }
});

/* Cargar datos de un usuario para editar */
async function editUser(userId) {
  try {
    const doc = await db.collection("usuarios").doc(userId).get();
    if (!doc.exists) {
      Swal.fire("Error", "Usuario no encontrado.", "error");
      return;
    }
    const user = doc.data();
    document.getElementById("userId").value = userId;
    document.getElementById("username").value = user.username;
    document.getElementById("password").value = user.password;
    // Si el usuario es admin o tiene rol admin, deshabilitar tienda y rol
    if ((user.rol && user.rol.toLowerCase() === "admin") || user.username.toLowerCase() === "admin") {
      document.getElementById("userStore").value = "";
      document.getElementById("userStore").disabled = true;
      document.getElementById("userRole").value = "";
      document.getElementById("userRole").disabled = true;
    } else {
      document.getElementById("userStore").disabled = false;
      document.getElementById("userRole").disabled = false;
      document.getElementById("userStore").value = user.tienda || "";
      document.getElementById("userRole").value = user.rol || "";
    }
    document.getElementById("userEnabled").value = user.enabled ? "true" : "false";
    // Cargar permisos personalizados, si existen
    if (user.permissions) {
      document.getElementById("permProductosUser").checked = !!user.permissions.productos;
      document.getElementById("permEntradasUser").checked = !!user.permissions.entradas;
      document.getElementById("permMovimientosUser").checked = !!user.permissions.movimientos;
      document.getElementById("permSalidasUser").checked = !!user.permissions.salidas;
      document.getElementById("permUsuariosUser").checked = !!user.permissions.usuarios;
      document.getElementById("permTiendasUser").checked = !!user.permissions.tiendas;
    } else {
      document.getElementById("permProductosUser").checked = false;
      document.getElementById("permEntradasUser").checked = false;
      document.getElementById("permMovimientosUser").checked = false;
      document.getElementById("permSalidasUser").checked = false;
      document.getElementById("permUsuariosUser").checked = false;
      document.getElementById("permTiendasUser").checked = false;
    }
    document.getElementById("userModalLabel").textContent = "Editar Usuario";
    new bootstrap.Modal(document.getElementById("userModal")).show();
  } catch (error) {
    console.error("Error al cargar usuario:", error);
    Swal.fire("Error", "Error al cargar usuario: " + error.message, "error");
  }
}

/* Eliminar usuario */
async function deleteUser(userId) {
  if (!confirm("¿Está seguro de eliminar este usuario?")) return;
  try {
    await db.collection("usuarios").doc(userId).delete();
    Swal.fire("Éxito", "Usuario eliminado.", "success");
    loadUsers();
  } catch (error) {
    console.error("Error al eliminar usuario:", error);
    Swal.fire("Error", "Error al eliminar usuario: " + error.message, "error");
  }
}

/* Alternar estado del usuario */
async function toggleUser(userId, currentStatus) {
  try {
    await db.collection("usuarios").doc(userId).update({
      enabled: !currentStatus
    });
    Swal.fire("Éxito", "Estado del usuario actualizado.", "success");
    loadUsers();
  } catch (error) {
    console.error("Error al actualizar estado:", error);
    Swal.fire("Error", "Error al actualizar estado: " + error.message, "error");
  }
}

/* --- Funciones para Roles --- */

/* Cargar roles y llenar el select del formulario de usuario y la tabla de roles */
async function loadRoles() {
  try {
    // Asegurar que exista el rol admin
    await ensureAdminRole();
    const snapshot = await db.collection("roles").orderBy("roleName").get();
    roles = [];
    const roleSelect = document.getElementById("userRole");
    roleSelect.innerHTML = "<option value=''>Seleccione rol</option>";
    snapshot.forEach(doc => {
      const role = doc.data();
      role.id = doc.id;
      roles.push(role);
      const option = document.createElement("option");
      option.value = role.roleName;
      option.textContent = role.roleName;
      roleSelect.appendChild(option);
    });
    loadRolesTable();
  } catch (error) {
    console.error("Error al cargar roles:", error);
    Swal.fire("Error", "Error al cargar roles: " + error.message, "error");
  }
}

/* Función para asegurar que exista el rol "admin" */
async function ensureAdminRole() {
  try {
    const snapshot = await db.collection("roles").where("roleName", "==", "admin").get();
    if (snapshot.empty) {
      await db.collection("roles").add({
        roleName: "admin",
        roleDescription: "Rol de administrador con todos los permisos",
        permissions: {
          productos: true,
          entradas: true,
          movimientos: true,
          salidas: true,
          usuarios: true,
          tiendas: true
        }
      });
    }
  } catch (error) {
    console.error("Error asegurando rol admin:", error);
  }
}

/* Cargar roles en la tabla del modal de roles */
function loadRolesTable() {
  const tbody = document.querySelector("#rolesTable tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  roles.forEach(role => {
    const row = tbody.insertRow();
    row.insertCell(0).textContent = role.roleName;
    // Convertir objeto de permisos a cadena
    const perms = [];
    if (role.permissions) {
      for (const key in role.permissions) {
        if (role.permissions[key]) perms.push(key);
      }
    }
    row.insertCell(1).textContent = perms.join(", ");
    const cellActions = row.insertCell(2);
    cellActions.innerHTML = `
      <button class="btn btn-sm btn-primary me-1" onclick="editRole('${role.id}')">Editar</button>
      <button class="btn btn-sm btn-danger" onclick="deleteRole('${role.id}')">Eliminar</button>
    `;
  });
}

/* Cargar tiendas y llenar el select del formulario de usuario */
async function loadStores() {
  try {
    const snapshot = await db.collection("tiendas").orderBy("nombre").get();
    stores = [];
    const storeSelect = document.getElementById("userStore");
    storeSelect.innerHTML = "<option value=''>Seleccione tienda</option>";
    snapshot.forEach(doc => {
      const store = doc.data();
      store.id = doc.id;
      stores.push(store);
      const option = document.createElement("option");
      option.value = store.nombre;
      option.textContent = store.nombre;
      storeSelect.appendChild(option);
    });
  } catch (error) {
    console.error("Error al cargar tiendas:", error);
    Swal.fire("Error", "Error al cargar tiendas: " + error.message, "error");
  }
}

/* Inicialización: cargar tiendas, roles y usuarios */
document.addEventListener("DOMContentLoaded", async () => {
  await loadStores();
  await loadRoles();
  loadUsers();
});
