import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { toast } from "sonner";

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);

  // formulário 1 em 1
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formActive, setFormActive] = useState(true);

  const [xlsxFile, setXlsxFile] = useState(null);
  const [uploadingXlsx, setUploadingXlsx] = useState(false);
  


  async function handleUploadXlsx(e) {
    e.preventDefault();
    if (!xlsxFile) {
      toast.error("Selecione um arquivo Excel (.xlsx).");
      return;
    }

    try {
      setUploadingXlsx(true);
      const formData = new FormData();
      formData.append("file", xlsxFile);

      const res = await api.post("/contacts/import-xlsx", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(
        `Importação concluída: ${res.data.saved} de ${res.data.total}`
      );
      setXlsxFile(null);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    } catch (err) {
      toast.error(err.response?.data?.error || "Erro ao importar planilha.");
    } finally {
      setUploadingXlsx(false);
    }
  }

  // em massa
  const [bulkText, setBulkText] = useState("");

  // importar do grupo
  const [importInstanceId, setImportInstanceId] = useState("");
  const [importGroupJid, setImportGroupJid] = useState("");

  const queryClient = useQueryClient();

  // ======================
  // Instâncias (para importar grupos)
  // ======================
  const { data: instances } = useQuery({
    queryKey: ["instances"],
    queryFn: async () => {
      const res = await api.get("/instances");
      return res.data;
    },
  });

  // Grupos da instância escolhida (para importação)
  const {
    data: importGroups,
    isLoading: loadingImportGroups,
    isFetching: fetchingImportGroups,
  } = useQuery({
    queryKey: ["groups-import", importInstanceId],
    enabled: !!importInstanceId,
    queryFn: async () => {
      const res = await api.get(`/groups/${importInstanceId}`);
      return res.data;
    },
  });

  // ======================
  // Contatos
  // ======================
  const {
    data: contacts,
    isLoading: loadingContacts,
    isFetching: fetchingContacts,
  } = useQuery({
    queryKey: ["contacts", { search, onlyActive }],
    queryFn: async () => {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (onlyActive) params.active = "true";
      const res = await api.get("/contacts", { params });
      return res.data;
    },
  });

  const safeContacts = Array.isArray(contacts) ? contacts : [];

  // Criar / editar contato (1 em 1)
  const saveContactMutation = useMutation({
    mutationFn: async (contact) => {
      if (contact.id) {
        const { id, ...data } = contact;
        const res = await api.put(`/contacts/${id}`, data);
        return res.data;
      } else {
        const res = await api.post("/contacts", contact);
        return res.data;
      }
    },
    onSuccess: () => {
      toast.success("Contato salvo com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      resetForm();
    },
    onError: (err) => {
      const msg = err.response?.data?.error || "Erro ao salvar contato.";
      toast.error(msg);
    },
  });

  // Deletar contato
  const deleteContactMutation = useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/contacts/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Contato apagado.");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err) => {
      const msg = err.response?.data?.error || "Erro ao apagar contato.";
      toast.error(msg);
    },
  });

  // Salvar em massa
  const bulkMutation = useMutation({
    mutationFn: async (contacts) => {
      const res = await api.post("/contacts/bulk", { contacts });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Foram salvos/atualizados ${data.saved} contatos.`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setBulkText("");
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error || "Erro ao salvar contatos em massa.";
      toast.error(msg);
    },
  });

  // Importar participantes de grupo → contatos
  const importFromGroupMutation = useMutation({
    mutationFn: async ({ instanceId, groupJid }) => {
      const res = await api.post("/contacts/import-from-group", {
        instanceId,
        groupJid,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(
        `Participantes encontrados: ${
          data.totalFound || 0
        }. Salvos/atualizados: ${data.saved || 0}.`
      );
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error || "Erro ao importar contatos do grupo.";
      toast.error(msg);
    },
  });

  // ======================
  // Handlers
  // ======================
  function resetForm() {
    setEditingId(null);
    setFormName("");
    setFormPhone("");
    setFormTags("");
    setFormNotes("");
    setFormActive(true);
  }

  function handleEdit(contact) {
    setEditingId(contact.id);
    setFormName(contact.name || "");
    setFormPhone(contact.phone || "");
    setFormTags(contact.tags || "");
    setFormNotes(contact.notes || "");
    setFormActive(contact.active !== false);
  }

  function handleSubmitContact(e) {
    e.preventDefault();

    const phone = (formPhone || "").replace(/\D/g, "");
    if (!phone) {
      toast.error("Informe um telefone válido (somente números).");
      return;
    }

    const payload = {
      id: editingId,
      name: formName || phone,
      phone,
      tags: formTags || null,
      notes: formNotes || null,
      active: formActive,
    };

    saveContactMutation.mutate(payload);
  }

  function handleDelete(contact) {
    if (
      !window.confirm(`Apagar o contato "${contact.name}" (${contact.phone})?`)
    )
      return;
    deleteContactMutation.mutate(contact.id);
  }

  function handleSubmitBulk(e) {
    e.preventDefault();

    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      toast.error("Cole pelo menos uma linha de contato.");
      return;
    }

    const contacts = [];
    for (const line of lines) {
      // formatos aceitos:
      // 1) Nome;telefone
      // 2) telefone
      const parts = line.split(";");
      if (parts.length === 1) {
        const phone = parts[0].replace(/\D/g, "");
        if (!phone) continue;
        contacts.push({ name: phone, phone });
      } else {
        const name = parts[0].trim();
        const phone = parts[1].replace(/\D/g, "");
        if (!phone) continue;
        contacts.push({ name: name || phone, phone });
      }
    }

    if (contacts.length === 0) {
      toast.error("Nenhum telefone válido encontrado.");
      return;
    }

    bulkMutation.mutate(contacts);
  }

  function handleImportFromGroup(e) {
    e.preventDefault();
    if (!importInstanceId) {
      toast.error("Selecione uma instância.");
      return;
    }
    if (!importGroupJid) {
      toast.error("Selecione um grupo.");
      return;
    }

    importFromGroupMutation.mutate({
      instanceId: Number(importInstanceId),
      groupJid: importGroupJid,
    });
  }

  const savingContact = saveContactMutation.isLoading;
  const savingBulk = bulkMutation.isLoading;
  const importingGroup = importFromGroupMutation.isLoading;

  const loadingList = loadingContacts;
  const reloadingList = fetchingContacts;

  return (
    <div className="contacts-page">
      {/* BLOCO 1: Importar contatos de grupos */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h1 className="card-title" style={{ marginBottom: 8 }}>
          Importar contatos de grupos do WhatsApp
        </h1>
        <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>
          Escolha uma instância conectada, selecione um grupo e importe os
          participantes para sua lista de contatos.
        </p>

        <form
          onSubmit={handleImportFromGroup}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          {/* Instância */}
          <div>
            <label style={{ fontSize: 13 }}>Instância</label>
            <select
              value={importInstanceId}
              onChange={(e) => {
                setImportInstanceId(e.target.value);
                setImportGroupJid("");
              }}
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
            >
              <option value="">Selecione...</option>
              {instances?.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}{" "}
                  {inst.status === "connected" ? " (conectada)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Grupo */}
          <div>
            <label style={{ fontSize: 13 }}>Grupo</label>
            <select
              value={importGroupJid}
              onChange={(e) => setImportGroupJid(e.target.value)}
              disabled={!importInstanceId || loadingImportGroups}
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
            >
              <option value="">
                {importInstanceId
                  ? loadingImportGroups
                    ? "Carregando grupos..."
                    : "Selecione um grupo..."
                  : "Selecione uma instância primeiro"}
              </option>
              {importGroups?.map((g) => (
                <option key={g.id} value={g.jid}>
                  {g.name}
                </option>
              ))}
            </select>
            {fetchingImportGroups && !loadingImportGroups && (
              <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                Atualizando lista de grupos...
              </p>
            )}
          </div>

          {/* Botão importar */}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!importInstanceId || !importGroupJid || importingGroup}
            style={{ whiteSpace: "nowrap", paddingInline: 16 }}
          >
            {importingGroup ? "Importando..." : "Importar contatos"}
          </button>
        </form>
      </div>
      {/* Upload Excel */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 8 }}>
          Importar contatos por Excel
        </h2>
        <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>
          Envie um arquivo <b>.xlsx</b> com colunas:
          <br />
          <code>nome</code>, <code>telefone</code>, <code>cargo</code>,
          <code>data_nascimento</code>
        </p>

        <form
          onSubmit={handleUploadXlsx}
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="file"
            accept=".xlsx"
            onChange={(e) => setXlsxFile(e.target.files?.[0] || null)}
          />

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!xlsxFile || uploadingXlsx}
          >
            {uploadingXlsx ? "Importando..." : "Importar Excel"}
          </button>
        </form>
      </div>

      {/* BLOCO 2: formulário (1 em 1) e em massa */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1.8fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Form 1 em 1 */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 8 }}>
            {editingId ? "Editar contato" : "Novo contato"}
          </h2>
          <form
            onSubmit={handleSubmitContact}
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div>
              <label style={{ fontSize: 13 }}>Nome</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: João da Silva"
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

            <div>
              <label style={{ fontSize: 13 }}>Telefone</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="Ex: 5599999999999 (somente números)"
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

            <div>
              <label style={{ fontSize: 13 }}>Tags</label>
              <input
                type="text"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="Ex: grupo-avisos, campanha-natal"
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

            <div>
              <label style={{ fontSize: 13 }}>Observações</label>
              <textarea
                rows={3}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Observações internas sobre esse contato..."
                style={{
                  marginTop: 4,
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid #1f2937",
                  background: "#020617",
                  color: "#e5e7eb",
                  fontSize: 14,
                  resize: "vertical",
                }}
              />
            </div>

            <label style={{ fontSize: 13, display: "flex", gap: 6 }}>
              <input
                type="checkbox"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
              />
              Contato ativo
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={savingContact}
              >
                {savingContact
                  ? "Salvando..."
                  : editingId
                  ? "Salvar alterações"
                  : "Adicionar contato"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn"
                  onClick={resetForm}
                  style={{
                    background: "#111827",
                    border: "1px solid #4b5563",
                  }}
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Form em massa */}
        <div className="card">
          <h2 className="card-title" style={{ marginBottom: 8 }}>
            Salvar contatos em massa
          </h2>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8 }}>
            Cole uma lista de contatos, um por linha. Formatos aceitos:
            <br />
            <code>Nome;telefone</code> ou apenas <code>telefone</code>. Ex:
          </p>
          <pre
            style={{
              fontSize: 11,
              background: "#020617",
              padding: 8,
              borderRadius: 8,
              border: "1px solid #1f2937",
              marginBottom: 8,
              color: "#e5e7eb",
            }}
          >
            João da Silva;5599999999999{"\n"}
            5588888888888{"\n"}
            Maria;5597777777777
          </pre>

          <form
            onSubmit={handleSubmitBulk}
            style={{ display: "flex", flexDirection: "column", gap: 8 }}
          >
            <textarea
              rows={7}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Cole aqui sua lista..."
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: 13,
                resize: "vertical",
              }}
            />

            <button
              type="submit"
              className="btn btn-primary"
              disabled={savingBulk}
            >
              {savingBulk
                ? "Salvando em massa..."
                : "Salvar / atualizar contatos"}
            </button>
          </form>
        </div>
      </div>

      {/* BLOCO 3: lista de contatos */}
      <div className="card">
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            marginBottom: 8,
            flexWrap: "wrap",
          }}
        >
          <h2 className="card-title" style={{ marginBottom: 0 }}>
            Contatos cadastrados
          </h2>

          <div style={{ flex: 1, minWidth: 220 }}>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              style={{
                width: "100%",
                padding: "6px 10px",
                borderRadius: 999,
                border: "1px solid #1f2937",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: 13,
              }}
            />
          </div>

          <label style={{ fontSize: 12, display: "flex", gap: 6 }}>
            <input
              type="checkbox"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Mostrar apenas ativos
          </label>

          {reloadingList && (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              Atualizando lista...
            </span>
          )}
        </div>

        {loadingList ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            Carregando contatos...
          </p>
        ) : safeContacts.length === 0 ? (
          <p style={{ fontSize: 13, color: "#9ca3af" }}>
            Nenhum contato encontrado.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              className="instances-table"
              style={{ minWidth: 600, fontSize: 13 }}
            >
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>Tags</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {safeContacts.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td style={{ fontSize: 11, color: "#9ca3af" }}>
                      {c.tags || "-"}
                    </td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (c.active !== false
                            ? "badge-connected"
                            : "badge-pending")
                        }
                      >
                        {c.active !== false ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 8,
                        }}
                      >
                        <button
                          className="btn"
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            background: "#111827",
                            border: "1px solid #4b5563",
                          }}
                          onClick={() => handleEdit(c)}
                        >
                          Editar
                        </button>
                        <button
                          className="btn"
                          style={{
                            fontSize: 12,
                            padding: "4px 10px",
                            background: "#7f1d1d",
                            border: "1px solid #b91c1c",
                          }}
                          onClick={() => handleDelete(c)}
                          disabled={deleteContactMutation.isLoading}
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
  );
}
