import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { toast } from "sonner";

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

function formatWhatsAppText(text) {
  if (!text) return "";
  let formatted = text;
  formatted = formatted.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");
  formatted = formatted.replace(/~([^~]+)~/g, "<del>$1</del>");
  formatted = formatted.replace(/```([^`]+)```/g, "<code>$1</code>");
  formatted = formatted.replace(/\n/g, "<br>");
  return formatted;
}

const emojiCategories = {
  sorrisos: [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "🤣",
    "😂",
    "🙂",
    "😉",
    "😊",
    "😇",
  ],
  fe: ["🙏", "✝️", "⛪", "🕊️", "📖", "✨", "🌟", "💒"],
  coracoes: [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🤍",
    "🤎",
    "🖤",
    "💖",
    "💗",
    "💘",
  ],
};

function EmojiPicker({ onSelect }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("sorrisos");

  function handleSelect(emoji) {
    onSelect(emoji);
    setOpen(false);
  }

  return (
    <div className="emoji-picker">
      <button
        type="button"
        className="btn-icon"
        onClick={() => setOpen(!open)}
        title="Inserir emoji"
      >
        😀
      </button>
      {open && (
        <div className="emoji-popover">
          <div className="emoji-tabs">
            {Object.keys(emojiCategories).map((key) => (
              <button
                key={key}
                type="button"
                className={
                  "emoji-tab" + (tab === key ? " emoji-tab-active" : "")
                }
                onClick={() => setTab(key)}
              >
                {key}
              </button>
            ))}
          </div>
          <div className="emoji-grid">
            {emojiCategories[tab].map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="emoji-btn"
                onClick={() => handleSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageEditor({ value, onChange }) {
  const textareaRef = useRef(null);

  function insertAroundSelection(prefix, suffix = prefix) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newText = before + prefix + selected + suffix + after;
    onChange(newText);
    const newPos = start + prefix.length + selected.length + suffix.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  function handleEmoji(emoji) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const newText = before + emoji + after;
    onChange(newText);
    const newPos = start + emoji.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  return (
    <div className="editor-wrapper">
      <div className="editor-toolbar">
        <div className="editor-buttons">
          <button
            type="button"
            className="btn-icon"
            onClick={() => insertAroundSelection("*")}
            title="Negrito *texto*"
          >
            B
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => insertAroundSelection("_")}
            title="Itálico _texto_"
          >
            I
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => insertAroundSelection("~")}
            title="Tachado ~texto~"
          >
            S
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => insertAroundSelection("```")}
            title="Código ```texto```"
          >
            {"</>"}
          </button>
        </div>
        <EmojiPicker onSelect={handleEmoji} />
        <div className="editor-hint">
          Formatação WhatsApp: *negrito* _itálico_ ~tachado~ ```código```
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="editor-textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Digite a mensagem que será enviada..."
      />

      <div className="editor-footer">
        <span>
          Dica: selecione um trecho e clique nos botões para formatar.
        </span>
        <span>{value.length} caracteres</span>
      </div>
    </div>
  );
}

function ImagePicker({ imageDataUrl, onChange }) {
  const fileInputRef = useRef(null);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Imagem muito grande. Máximo de 1 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      onChange(typeof dataUrl === "string" ? dataUrl : null);
    };
    reader.readAsDataURL(file);
  }

  function handleChooseClick() {
    if (fileInputRef.current) fileInputRef.current.click();
  }

  function handleClear() {
    onChange(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="image-picker">
      <label className="image-label">
        Imagem (opcional, até 1 MB) — se anexar, o texto vira legenda.
      </label>
      <div className="image-actions">
        <button type="button" className="btn" onClick={handleChooseClick}>
          Escolher imagem
        </button>
        {imageDataUrl && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleClear}
          >
            Remover
          </button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {imageDataUrl && (
        <div className="image-preview">
          <img src={imageDataUrl} alt="Preview" />
        </div>
      )}
    </div>
  );
}

function MessagePreview({ message, imageDataUrl }) {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );

  useEffect(() => {
    const id = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="preview-card">
      <div className="preview-header">
        <div className="preview-avatar">G</div>
        <div>
          <div className="preview-title">Grupo / Contato</div>
          <div className="preview-subtitle">online</div>
        </div>
      </div>

      <div className="preview-message">
        <div className="preview-bubble">
          {imageDataUrl && (
            <div className="preview-image">
              <img src={imageDataUrl} alt="Imagem" />
            </div>
          )}
          {message ? (
            <p
              className="preview-text"
              dangerouslySetInnerHTML={{ __html: formatWhatsAppText(message) }}
            />
          ) : (
            <p className="preview-placeholder">
              Digite sua mensagem para visualizar aqui...
            </p>
          )}
          <div className="preview-meta">
            <span className="preview-time">{time}</span>
            <span className="preview-checks">✓✓</span>
          </div>
        </div>
      </div>

      <div className="preview-hint">
        Formatação suportada: *negrito*, _itálico_, ~tachado~, ```código```.
      </div>
    </div>
  );
}

export default function Send() {
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [selectedContactIds, setSelectedContactIds] = useState([]);
  const [message, setMessage] = useState("");
  const [delaySec, setDelaySec] = useState("5"); // em segundos
  const [imageDataUrl, setImageDataUrl] = useState(null);

  const queryClient = useQueryClient();

  const instancesQuery = useQuery({
    queryKey: ["instances"],
    queryFn: async () => {
      const res = await api.get("/instances");
      return res.data;
    },
  });

  const groupsQuery = useQuery({
    queryKey: ["groups", selectedInstanceId],
    enabled: !!selectedInstanceId,
    queryFn: async () => {
      const res = await api.get(`/groups/${selectedInstanceId}`);
      return res.data;
    },
  });

  const contactsQuery = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const res = await api.get("/contacts");
      return res.data;
    },
  });

  const queueStatusQuery = useQuery({
    queryKey: ["send-queue-status"],
    queryFn: async () => {
      const res = await api.get("/send/queue/status");
      return res.data;
    },
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInstanceId) {
        throw new Error("Selecione a instância que será usada para enviar.");
      }

      if (!message.trim() && !imageDataUrl) {
        throw new Error("Digite uma mensagem ou selecione uma imagem.");
      }

      const groups = groupsQuery.data || [];
      const contacts = contactsQuery.data || [];

      const selectedGroups = groups.filter((g) =>
        selectedGroupIds.includes(String(g.id))
      );
      const selectedContacts = contacts.filter((c) =>
        selectedContactIds.includes(String(c.id))
      );

      const targetsGroups = selectedGroups.map((g) => g.jid);
      const targetsContacts = selectedContacts.map((c) => c.phone);
      const allTargets = [...targetsGroups, ...targetsContacts];

      if (allTargets.length === 0) {
        throw new Error("Selecione ao menos um grupo ou contato.");
      }

      // delay em segundos -> milissegundos
      let sec = Number(delaySec) || 5;
      if (sec < 5) sec = 5;
      if (sec > 30) sec = 30;
      const delayMs = sec * 1000;

      // tipo de envio
      const type = imageDataUrl ? "image" : "text";

      // para imagem, backend agora limpa o dataURL e converte para base64 puro
      const body = {
        instanceId: Number(selectedInstanceId),
        type,
        message: message.trim(),
        imageUrl: imageDataUrl || null,
        caption: message.trim(),
        targets: allTargets,
        delayMs,
      };

      const res = await api.post("/send/bulk", body);
      return res.data;
    },
    onSuccess: () => {
      toast.success("Envio em massa iniciado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["send-queue-status"] });
    },
    onError: (err) => {
      const msg =
        err.response?.data?.error || err.message || "Erro ao iniciar o envio.";
      toast.error(msg);
    },
  });

  function toggleGroup(id) {
    setSelectedGroupIds((current) => {
      const s = String(id);
      if (current.includes(s)) {
        return current.filter((g) => g !== s);
      }
      return [...current, s];
    });
  }
  async function handleSyncGroups() {
    if (!selectedInstanceId) {
      toast.error("Escolha uma instância primeiro.");
      return;
    }

    try {
      await api.post(`/groups/${selectedInstanceId}/refresh`);
      await queryClient.invalidateQueries({
        queryKey: ["groups", selectedInstanceId],
      });
      toast.success("Grupos sincronizados com sucesso!");
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        "Erro ao sincronizar grupos.";
      toast.error(msg);
    }
  }

  function toggleContact(id) {
    setSelectedContactIds((current) => {
      const s = String(id);
      if (current.includes(s)) {
        return current.filter((c) => c !== s);
      }
      return [...current, s];
    });
  }

  const sending = sendMutation.isLoading;
  const instances = instancesQuery.data || [];
  const groups = groupsQuery.data || [];
  const contacts = contactsQuery.data || [];

  const defaultDelaySec = Math.round(
    (queueStatusQuery.data?.defaultDelayMs ?? 5000) / 1000
  );

  return (
    <div className="send-grid">
      <div className="send-left">
        <h1 className="card-title" style={{ marginBottom: 8 }}>
          Envio de mensagens
        </h1>
        <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>
          Escolha a instância, selecione grupos/contatos, configure a mensagem e
          o intervalo de envio.
        </p>

        <div className="card-section">
          <label className="field-label">Instância</label>

          <select
            className="field-select"
            value={selectedInstanceId}
            onChange={(e) => {
              setSelectedInstanceId(e.target.value);
              setSelectedGroupIds([]);
            }}
          >
            <option value="">Selecione...</option>
            {instances.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name} ({inst.status || "pending"})
              </option>
            ))}
          </select>

          {/* === BOTÃO DE SINCRONIZAR GRUPOS === */}
          {selectedInstanceId && (
            <button
              type="button"
              className="btn btn-outline sicronizar"
              style={{ marginTop: "10px" }}
              onClick={handleSyncGroups}
            >
              🔄 Sincronizar grupos da instância
            </button>
          )}
        </div>

        <div className="card-section">
          <label className="field-label">Mensagem</label>
          <MessageEditor value={message} onChange={setMessage} />
        </div>

        <div className="card-section">
          <ImagePicker imageDataUrl={imageDataUrl} onChange={setImageDataUrl} />
        </div>

        <div className="card-section">
          <label className="field-label">
            Intervalo entre mensagens (segundos) — mínimo 5, máximo 30
          </label>
          <input
            type="number"
            className="field-input"
            min={5}
            max={30}
            value={delaySec}
            onChange={(e) => setDelaySec(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => sendMutation.mutate()}
          disabled={sending}
        >
          {sending ? "Agendando envios..." : "Iniciar envio"}
        </button>

        <div className="queue-status">
          <span className="queue-dot" />
          <span>
            Fila: {queueStatusQuery.data?.pending ?? 0} pendente(s) •{" "}
            {queueStatusQuery.data?.processing ? "processando" : "parado"} •
            delay padrão {defaultDelaySec}s
          </span>
        </div>
      </div>

      <div className="send-right">
        <h2 className="card-title" style={{ marginBottom: 8 }}>
          Pré-visualização
        </h2>
        <MessagePreview message={message} imageDataUrl={imageDataUrl} />

        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="card-title" style={{ marginBottom: 8 }}>
            Grupos selecionados
          </h3>
          {!selectedInstanceId ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              Selecione uma instância para carregar os grupos.
            </p>
          ) : groupsQuery.isLoading ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              Carregando grupos...
            </p>
          ) : groups.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              Nenhum grupo salvo para esta instância.
            </p>
          ) : (
            <div className="groups-list">
              {groups.map((g) => {
                const checked = selectedGroupIds.includes(String(g.id));
                return (
                  <label
                    key={g.id}
                    className={
                      "group-item" + (checked ? " group-item-active" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroup(g.id)}
                    />
                    <div className="group-info">
                      <div className="group-name">{g.name}</div>
                      <div className="group-jid">{g.jid}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <h3 className="card-title" style={{ marginBottom: 8 }}>
            Contatos salvos
          </h3>
          {contactsQuery.isLoading ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              Carregando contatos...
            </p>
          ) : contacts.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9ca3af" }}>
              Nenhum contato cadastrado ainda.
            </p>
          ) : (
            <div className="groups-list">
              {contacts.map((c) => {
                const checked = selectedContactIds.includes(String(c.id));
                return (
                  <label
                    key={c.id}
                    className={
                      "group-item" + (checked ? " group-item-active" : "")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleContact(c.id)}
                    />
                    <div className="group-info">
                      <div className="group-name">{c.name}</div>
                      <div className="group-jid">{c.phone}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
