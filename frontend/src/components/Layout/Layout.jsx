// src/components/Layout/Layout.jsx
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

// importa a logo
import logoPainel from "../../assets/Logoigrja.png";

function SidebarLink({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        "sidebar-link " + (isActive ? "sidebar-link-active" : "")
      }
      end
    >
      {label}
    </NavLink>
  );
}

// função de logout
function handleLogout() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

export default function Layout() {
  const { user } = useAuth();
  const userName = user?.name || "Operador";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        {/* LOGO NO TOPO */}
        <div className="sidebar-logo">
          <img
            src={logoPainel}
            alt="Painel Avisos"
            className="sidebar-logo-img"
          />
          <div>
            <div className="sidebar-logo-title">Painel Avisos</div>
            <div className="sidebar-logo-subtitle">Central WhatsApp</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {/* <SidebarLink to="/" label="Dashboard" /> */}
          <SidebarLink to="/instances" label="Conexão WhatsApp" />
          <SidebarLink to="/contacts" label="Contatos" />
          {/* <SidebarLink to="/groups" label="Grupos" /> */}
          <SidebarLink to="/send" label="Envio" />
          {/* APENAS PARA ADMIN */}
          {user?.role === "admin" && (
            <SidebarLink to="/users" label="Usuários" />
          )}
        </nav>

        {/* RODAPÉ DO MENU: CRÉDITO + SAIR */}
        <div className="sidebar-footer">
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
            Logado como <strong>{userName}</strong>
          </div>
          <button
            className="btn"
            style={{ width: "100%", fontSize: 12, padding: "6px 10px" }}
            onClick={handleLogout}
          >
            Sair
          </button>

          <div className="cria" style={{ marginTop: 16, fontSize: 11 }}>
            <p className="criador" style={{ margin: 0 }}>
              Sistema criado por
            </p>
            <h3 style={{ margin: 0, fontSize: 12 }}>Darlan da Silva</h3>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-title">Central de Mensagens WhatsApp</div>
          {/* não precisa mais mostrar usuário aqui */}
        </header>

        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
