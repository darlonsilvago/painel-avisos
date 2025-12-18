import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    email: "",
    role: "user",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function loadUsers() {
    try {
      setLoading(true);
      const res = await api.get("/auth/users");
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function startEdit(u) {
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      password: "",
    });
    setError("");
    setSuccess("");
  }

  function newUser() {
    setForm({
      id: null,
      name: "",
      email: "",
      role: "user",
      password: "",
    });
    setError("");
    setSuccess("");
  }

  async function removeUser(id) {
    if (!window.confirm("Tem certeza que deseja excluir este usuário?")) return;

    try {
      await api.delete(`/auth/users/${id}`);
      setSuccess("Usuário removido");
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao remover usuário");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (form.id) {
        await api.put(`/auth/users/${form.id}`, {
          name: form.name,
          email: form.email,
          role: form.role,
        });

        if (form.password) {
          await api.patch(`/auth/users/${form.id}/password`, {
            password: form.password,
          });
        }

        setSuccess("Usuário atualizado");
      } else {
        await api.post(`/auth/register`, {
          name: form.name,
          email: form.email,
          password: form.password,
          role: form.role,
        });

        setSuccess("Usuário criado");
      }

      newUser();
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Erro ao salvar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "28px", width: "100%" }}>
      <h2 style={{ fontSize: 26, marginBottom: 6 }}>
        Administração de Usuários
      </h2>
      <p style={{ marginBottom: 24, color: "#ccc" }}>
        Gerencie operadores e administradores do sistema.
      </p>

      {error && (
        <div style={{ color: "#ff6b6b", marginBottom: 12 }}>{error}</div>
      )}
      {success && (
        <div style={{ color: "#4ade80", marginBottom: 12 }}>{success}</div>
      )}

      <div style={{ display: "flex", gap: 32 }}>
        {/* LISTA */}
        <div
          style={{
            flex: 1,
            background: "#0f172a",
            padding: 20,
            borderRadius: 12,
            border: "1px solid #1e293b",
          }}
        >
          <h3 style={{ marginBottom: 16 }}>Usuários cadastrados</h3>

          {loading ? (
            <p>Carregando...</p>
          ) : users.length === 0 ? (
            <p>Nenhum usuário encontrado.</p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 14,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", color: "#9ca3af" }}>
                  <th>ID</th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderTop: "1px solid #1e293b" }}>
                    <td>{u.id}</td>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      <button
                        onClick={() => startEdit(u)}
                        style={{ marginRight: 8 }}
                        className="btn"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => removeUser(u.id)}
                        className="btn danger"
                      >
                        Apagar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* FORM */}
        <div className="card" style={{ Width: "100%" }}>
          <h2 className="card-title">
            {form.id ? "Editar usuário" : "Novo usuário"}
          </h2>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 2.5fr) minmax(0, 1.4fr)",
              gap: 32,
              alignItems: "start",
            }}
          >
            <div>
              <label className="field-label">Nome</label>
              <input
                className="field-input"
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="field-label">E-mail</label>
              <input
                className="field-input"
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="field-label">Perfil</label>
              <select
                className="field-select"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <option value="user">Operador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <label className="field-label">
                {form.id ? "Nova senha (opcional)" : "Senha"}
              </label>

              <div style={{ position: "relative" }}>
                <input
                  className="field-input"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  {...(!form.id ? { required: true } : {})}
                  style={{ paddingRight: 42 }}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                    color: "#9ca3af",
                  }}
                  title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? "x" : "👀"}
                </button>
              </div>
            </div> 

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving
                ? "Salvando..."
                : form.id
                ? "Salvar alterações"
                : "Criar usuário"}
            </button>

            {form.id && (
              <button type="button" className="btn btn-soft" onClick={newUser}>
                Cancelar edição
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
