/* roles.js
   Módulo CRUD para la administración de roles.
   Cada rol tiene:
     - name: string
     - description: string (opcional)
*/

async function loadRoles() {
    try {
      const snapshot = await db.collection("roles").orderBy("name").get();
      const tbody = document.querySelector("#rolesTable tbody");
      tbody.innerHTML = "";
      snapshot.forEach(doc => {
        const role = doc.data();
        role.id = doc.id;
        const row = tbody.insertRow();
        row.insertCell(0).textContent = role.name;
        row.insertCell(1).textContent = role.description || "";
        const cellActions = row.insertCell(2);
        cellActions.innerHTML = `
          <button class="btn btn-sm btn-primary me-1" onclick="editRole('${role.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteRole('${role.id}')">Eliminar</button>
        `;
      });
    } catch (error) {
      console.error("Error al cargar roles:", error);
      Swal.fire("Error", "Error al cargar roles: " + error.message, "error");
    }
  }
  
  function showRoleForm() {
    document.getElementById("roleForm").reset();
    document.getElementById("roleId").value = "";
    document.getElementById("roleModalLabel").textContent = "Crear Rol";
    new bootstrap.Modal(document.getElementById("roleModal")).show();
  }
  
  document.getElementById("roleForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const roleId = document.getElementById("roleId").value;
    const name = document.getElementById("roleName").value.trim();
    const description = document.getElementById("roleDescription").value.trim();
    
    if (!name) {
      Swal.fire("Error", "El nombre del rol es obligatorio.", "error");
      return;
    }
    
    try {
      const roleData = { name, description };
      if (roleId) {
        await db.collection("roles").doc(roleId).update(roleData);
        Swal.fire("Éxito", "Rol actualizado.", "success");
      } else {
        await db.collection("roles").add(roleData);
        Swal.fire("Éxito", "Rol creado.", "success");
      }
      bootstrap.Modal.getInstance(document.getElementById("roleModal")).hide();
      loadRoles();
    } catch (error) {
      console.error("Error al guardar rol:", error);
      Swal.fire("Error", "Error al guardar rol: " + error.message, "error");
    }
  });
  
  async function editRole(roleId) {
    try {
      const doc = await db.collection("roles").doc(roleId).get();
      if (!doc.exists) {
        Swal.fire("Error", "Rol no encontrado.", "error");
        return;
      }
      const role = doc.data();
      document.getElementById("roleId").value = roleId;
      document.getElementById("roleName").value = role.name;
      document.getElementById("roleDescription").value = role.description || "";
      document.getElementById("roleModalLabel").textContent = "Editar Rol";
      new bootstrap.Modal(document.getElementById("roleModal")).show();
    } catch (error) {
      console.error("Error al cargar rol:", error);
      Swal.fire("Error", "Error al cargar rol: " + error.message, "error");
    }
  }
  
  async function deleteRole(roleId) {
    if (!confirm("¿Está seguro de eliminar este rol?")) return;
    try {
      await db.collection("roles").doc(roleId).delete();
      Swal.fire("Éxito", "Rol eliminado.", "success");
      loadRoles();
    } catch (error) {
      console.error("Error al eliminar rol:", error);
      Swal.fire("Error", "Error al eliminar rol: " + error.message, "error");
    }
  }
  
  // Inicialización: cargar roles al cargar la página
  document.addEventListener("DOMContentLoaded", () => {
    loadRoles();
  });
  