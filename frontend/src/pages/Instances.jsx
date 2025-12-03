import { useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "../api/client";
import { toast } from "sonner";

export default function Instances() {
  const [name, setName] = useState("");
  const [qrModal, setQrModal] = useState(null); // { instance, data }
  const [qrLoadingId, setQrLoadingId] = useState(null); // id da instância que está gerando QR
  const [creatingUi, setCreatingUi] = useState(false); // controle visual manual

  const queryClient = useQueryClient();

  // 🔹 Buscar instâncias
  const {
    data: instances,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["instances"],
    queryFn: async () => {
      const res = await api.get("/instances");
      return res.data;
    },
  });

  // 🔹 Sincronizar status com a Evolution + atualizar lista
  async function handleRefresh() {
    try {
      await api.get("/instances/sync-status"); // backend vai na Evolution
      await queryClient.invalidateQueries({ queryKey: ["instances"] });
      toast.success("Status sincronizado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao sincronizar status das instâncias");
    }
  }

  // 🔹 Criar instância
  const createMutation = useMutation({
    mutationFn: async (name) => {
      const res = await api.post("/instances", { name });
      return res.data;
    },
    onSuccess: () => {
      toast.success("Instância criada com sucesso!");
      setName("");
      queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error || "Erro ao criar instância na Evolution";
      toast.error(msg);
    },
    onSettled: () => {
      setCreatingUi(false);
    },
  });

  // 🔹 Buscar QR Code
  const qrMutation = useMutation({
    mutationFn: async ({ id }) => {
      const res = await api.get(`/instances/${id}/qr`);
      return res.data;
    },
    onSuccess: (data, variables) => {
      setQrModal({
        instance: variables.instance,
        data,
      });
      queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error ||
        "Erro ao buscar QR Code da Evolution";
      toast.error(msg);
    },
    onSettled: () => {
      setQrLoadingId(null);
    },
  });

  // 🔹 Deletar instância
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await api.delete(`/instances/${id}`);
    },
    onSuccess: () => {
      toast.success("Instância apagada.");
      queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error || "Erro ao apagar instância";
      toast.error(msg);
    },
  });

  function handleCreateInstance(e) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreatingUi(true);
    createMutation.mutate(name.trim());
  }

  function handleShowQr(instance) {
    setQrLoadingId(instance.id);
    qrMutation.mutate({ id: instance.id, instance });
  }

  function handleDelete(instance) {
    if (!window.confirm(`Apagar a instância "${instance.name}"?`)) return;
    deleteMutation.mutate(instance.id);
  }

  const loadingList = isLoading;
  const creating = creatingUi || createMutation.isLoading;

  // 🔹 montar imagem do QR
  let qrImageSrc = null;
  const qrData = qrModal?.data;

  if (qrData?.base64 && typeof qrData.base64 === "string") {
    const b64 = qrData.base64;
    if (b64.startsWith("data:image")) {
      qrImageSrc = b64;
    } else {
      qrImageSrc = `data:image/png;base64,${b64}`;
    }
  } else if (qrData?.qrcode && typeof qrData.qrcode === "string") {
    const q = qrData.qrcode;
    if (q.startsWith("data:image") || q.startsWith("http")) {
      qrImageSrc = q;
    } else {
      qrImageSrc = `data:image/png;base64,${q}`;
    }
  }

  return (
    <>
      <div className="instances-grid">
        {/* Formulário de criação */}
        <div className="card">
          <h1 className="card-title" style={{ marginBottom: 8 }}>
            Instâncias WhatsApp
          </h1>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>
            Crie uma nova instância na Evolution API e acompanhe o status
            de conexão pelo QR Code.
          </p>

          <form
            onSubmit={handleCreateInstance}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div>
              <label style={{ fontSize: 13 }}>Nome da instância</label>
              <input
                type="text"
                placeholder="Ex: Igreja - Avisos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #1f2937",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: 14,
                }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={creating}
            >
              {creating ? "Criando instância..." : "Criar instância"}
            </button>

            {creating && (
              <p style={{ fontSize: 11, color: "#9ca3af" }}>
                Criando instância na Evolution API, aguarde alguns segundos...
              </p>
            )}
          </form>
        </div>

        {/* Lista de instâncias */}
        <div className="card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <h2 className="card-title">Instâncias cadastradas</h2>
            <button
              className="btn"
              onClick={handleRefresh}
              disabled={loadingList || creating}
              style={{ paddingInline: 16, fontSize: 13 }}
            >
              Atualizar painel
            </button>
          </div>

          {isFetching && !isLoading && (
            <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
              Atualizando lista de instâncias...
            </p>
          )}

          {loadingList ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              Carregando instâncias...
            </p>
          ) : !instances || instances.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              Nenhuma instância cadastrada ainda.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="instances-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nome</th>
                    <th>Evolution ID</th>
                    <th>Telefone</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th style={{ textAlign: "right" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {instances.map((inst) => (
                    <tr key={inst.id}>
                      <td>{inst.id}</td>
                      <td>{inst.name}</td>
                      <td style={{ fontSize: 11, color: "#9ca3af" }}>
                        {inst.evolution_instance_id || "-"}
                      </td>
                      <td>{inst.phone || "-"}</td>
                      <td>
                        <span
                          className={
                            "badge " +
                            (inst.status === "connected"
                              ? "badge-connected"
                              : "badge-pending")
                          }
                        >
                          {inst.status || "pending"}
                        </span>
                      </td>
                      <td>
                        {inst.created_at
                          ? new Date(inst.created_at).toLocaleString("pt-BR")
                          : "-"}
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 12, padding: "6px 10px" }}
                            onClick={() => handleShowQr(inst)}
                            disabled={qrLoadingId === inst.id}
                          >
                            {qrLoadingId === inst.id
                              ? "Gerando QR..."
                              : "Ver QR"}
                          </button>

                          <button
                            className="btn"
                            style={{
                              fontSize: 12,
                              padding: "6px 10px",
                              background: "#111827",
                              border: "1px solid #4b5563",
                            }}
                            onClick={() => handleDelete(inst)}
                            disabled={deleteMutation.isLoading}
                          >
                            Apagar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal QR */}
      {qrModal && (
        <div className="modal-backdrop" onClick={() => setQrModal(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="card-title" style={{ marginBottom: 8 }}>
              QR Code - {qrModal.instance.name}
            </h3>
            <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
              Aponte a câmera do WhatsApp dessa instância para conectar.
            </p>

            {qrImageSrc ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <img
                  src={qrImageSrc}
                  alt="QR Code"
                  style={{
                    maxWidth: 260,
                    maxHeight: 260,
                    borderRadius: 12,
                    background: "#fff",
                    padding: 8,
                  }}
                />
              </div>
            ) : (
              <pre
                style={{
                  fontSize: 11,
                  background: "#020617",
                  padding: 8,
                  borderRadius: 8,
                  maxHeight: 260,
                  overflow: "auto",
                  color: "#e5e7eb",
                }}
              >
                {JSON.stringify(qrModal.data, null, 2)}
              </pre>
            )}

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 4 }}
              onClick={() => setQrModal(null)}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
