import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Monitor de Massivas SNMP" },
      { name: "description", content: "Detecta possíveis massivas a partir do relatório SNMP do IPRAN." },
      { property: "og:title", content: "Monitor de Massivas SNMP" },
      { property: "og:description", content: "Detecta possíveis massivas a partir do relatório SNMP do IPRAN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Site = { reg: string; equip: string; alarme: string; data: string; hora: string; key: string };
type Meta = { obs1: string; causa: string; hidden: boolean; extra: string[]; color: number; manual?: boolean };

type Snap = { id: number; at: string; text: string; meta: Record<string, Meta>; massivas: number; sites: number };
const MIN_SITES = 3;
const PALETTE = 8;
const LS = "massivas-v1";
const LINE = /^(\S+)\s+(\S+)\s+(\S+)\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2}:\d{2})/;

function parse(text: string): Site[] {
  const out: Site[] = [];
  for (const l of text.split("\n")) {
    const m = l.trim().match(LINE);
    if (m) out.push({ reg: m[1]!, equip: m[2]!, alarme: m[3]!, data: m[4]!, hora: m[5]!, key: `${m[4]} ${m[5]}` });
  }
  return out;
}
const sortVal = (k: string) => {
  const [d = "", h = ""] = k.split(" ");
  const [dd, mm, yy] = d.split("/");
  return `${yy}${mm}${dd}${h}`;
};

function Index() {
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [meta, setMeta] = useState<Record<string, Meta>>({});
  const [loaded, setLoaded] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [history, setHistory] = useState<Snap[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(LS) || "{}");
      setText(s.text || "");
      setDebounced(s.text || "");
      setMeta(s.meta || {});
      setHistory(s.history || []);
      setLastUpdate(s.lastUpdate || "");
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(LS, JSON.stringify({ text, meta, history, lastUpdate }));
  }, [text, meta, history, lastUpdate, loaded]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(text), 600);
    return () => clearTimeout(t);
  }, [text]);

  // snapshot on each SNMP change
  useEffect(() => {
    if (!loaded || !debounced.trim()) return;
    if (history[0]?.text === debounced) return;
    const t = setTimeout(() => {
      const at = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setLastUpdate(at);
      const m = metaRef.current;
      const act = Object.keys(m).filter((k) => !m[k]!.hidden).length;
      setHistory((h) => (h[0]?.text === debounced ? h : [{ id: Date.now(), at, text: debounced, meta: m, massivas: act, sites: parse(debounced).length }, ...h].slice(0, 50)));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, loaded]);

  const restore = (h: Snap) => {
    setText(h.text);
    setDebounced(h.text);
    setMeta(h.meta);
  };

  const sites = useMemo(() => parse(debounced), [debounced]);
  const groups = useMemo(() => {
    const g: Record<string, Site[]> = {};
    sites.forEach((s) => (g[s.key] ||= []).push(s));
    return g;
  }, [sites]);

  // register new massivas keeping previous metadata/colors
  useEffect(() => {
    if (!loaded) return;
    setMeta((prev) => {
      let changed = false;
      const next = { ...prev };
      const used = Object.values(next).map((m) => m.color);
      Object.entries(groups).forEach(([k, list]) => {
        if (list.length >= MIN_SITES && !next[k]) {
          let c = 0;
          while (used.includes(c) && c < PALETTE) c++;
          if (c >= PALETTE) c = Object.keys(next).length % PALETTE;
          used.push(c);
          next[k] = { obs1: "", causa: "", hidden: false, extra: [], color: c };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [groups, loaded]);

  const keys = Object.keys(meta).sort((a, b) => sortVal(a).localeCompare(sortVal(b)));
  const upd = (k: string, p: Partial<Meta>) => setMeta((m) => ({ ...m, [k]: { ...m[k]!, ...p } as Meta }));
  const remove = (k: string) => setMeta((m) => { const n = { ...m }; delete n[k]; return n; });

  const colorOf = (s: Site): number | null => {
    const own = meta[s.key];
    if (own && !own.hidden) return own.color;
    for (const k of keys) if (!meta[k]!.hidden && meta[k]!.extra.includes(s.equip)) return meta[k]!.color;
    return null;
  };
  const count = (k: string) => (groups[k]?.length || 0) + meta[k]!.extra.length;

  const addManual = () => {
    const v = newKey.trim();
    if (!/^\d{2}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(v) || meta[v]) return;
    setMeta((m) => ({ ...m, [v]: { obs1: "", causa: "", hidden: false, extra: [], color: Object.keys(m).length % PALETTE, manual: true } }));
    setNewKey("");
  };

  const active = keys.filter((k) => !meta[k]!.hidden);
  const sitesOf = (k: string) => [...(groups[k] || []).map((s) => s.equip), ...meta[k]!.extra];
  const affected = new Set(active.flatMap(sitesOf)).size;

  return (
    <div className="noc-page">
    <div className="noc-stats">
      <div className="noc-stat"><span>Massivas</span><b>{active.length}</b></div>
      <div className="noc-stat"><span>Sites afetados</span><b>{affected}</b></div>
      <div className="noc-stat"><span>Mais antiga</span><b>{active[0]?.split(" ")[1] ?? "—"}</b></div>
      <div className="noc-stat"><span>Atualização</span><b>{lastUpdate || "—"}</b></div>
    </div>
    <div className="noc-grid">
      {/* Coluna 1 */}
      <section className="noc-col">
        <h2 className="noc-title">SNMP</h2>
        <textarea className="noc-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Cole aqui o relatório SNMP..." />
        <div className="noc-lines">
          {sites.map((s, i) => {
            const c = colorOf(s);
            return (
              <div key={i} className="noc-line" style={c !== null ? { background: `var(--m${c})`, color: "var(--m-fg)" } : undefined}>
                <span>{s.equip}</span><span>{s.hora}</span>
              </div>
            );
          })}
          {!sites.length && <p className="noc-muted">Nenhum equipamento reconhecido.</p>}
        </div>
      </section>

      {/* Coluna 2 */}
      <section className="noc-col">
        <h2 className="noc-title text-center">Possíveis Massivas</h2>
        <div className="flex gap-2 justify-center mb-3">
          <input className="noc-field w-48" placeholder="04/10/26 14:00" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
          <button className="noc-btn" onClick={addManual}>+ Adicionar</button>
        </div>
        <div className="flex flex-col gap-3 items-center">
          {keys.map((k) => {
            const m = meta[k]!;
            const own = groups[k] || [];
            const others = sites.filter((s) => s.key !== k);
            return (
              <article key={k} className={`noc-card ${m.hidden ? "opacity-40" : ""}`} style={{ borderColor: `var(--m${m.color})` }}>
                <header className="flex items-center justify-between gap-2">
                  <span className="noc-badge" style={{ background: `var(--m${m.color})` }}>{k}</span>
                  <span className="font-semibold">{count(k)} estações</span>
                  <div className="flex gap-1">
                    <button className="noc-btn" onClick={() => upd(k, { hidden: !m.hidden })}>{m.hidden ? "Ativar" : "Ocultar"}</button>
                    {m.manual && <button className="noc-btn" onClick={() => remove(k)}>Remover</button>}
                  </div>
                </header>
                <div className="noc-muted text-xs mt-2">{own.map((s) => s.equip).join(", ") || "—"}</div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <label className="text-xs">Obs1 (massiva)
                    <textarea className="noc-field h-20" value={m.obs1} onChange={(e) => upd(k, { obs1: e.target.value })} />
                  </label>
                  <label className="text-xs">Causa (Obs2)
                    <textarea className="noc-field h-20" value={m.causa} onChange={(e) => upd(k, { causa: e.target.value })} />
                  </label>
                </div>
                {others.length > 0 && (
                  <details className="mt-3">
                    <summary className="text-xs cursor-pointer">Correlação ({m.extra.length} adicionados)</summary>
                    <div className="grid grid-cols-2 gap-1 mt-2 max-h-40 overflow-auto">
                      {others.map((s) => (
                        <label key={s.equip} className="text-xs flex gap-1 items-center">
                          <input type="checkbox" checked={m.extra.includes(s.equip)}
                            onChange={(e) => upd(k, { extra: e.target.checked ? [...m.extra, s.equip] : m.extra.filter((x) => x !== s.equip) })} />
                          {s.equip} <span className="noc-muted">{s.hora}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
          {!keys.length && <p className="noc-muted">Nenhuma massiva detectada (3+ sites no mesmo horário).</p>}
        </div>
      </section>

      {/* Coluna 3 */}
      <section className="noc-col">
        <h2 className="noc-title">Resumo</h2>
        <table className="noc-table">
          <thead><tr><th>QUEDA</th><th>QTD</th><th>SITES</th><th>CAUSA</th></tr></thead>
          <tbody>
            {active.map((k) => (
              <tr key={k}>
                <td className="whitespace-nowrap"><span className="noc-dot" style={{ background: `var(--m${meta[k]!.color})` }} />{k.split(" ")[1]}</td>
                <td className="whitespace-nowrap">{count(k)} ESTAÇÕES</td>
                <td className="noc-sites">{sitesOf(k).join(", ")}</td>
                <td>{meta[k]!.causa || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="noc-title mt-6">Histórico</h2>
        <div className="flex flex-col gap-1">
          {history.map((h, i) => (
            <div key={h.id} className="noc-hist">
              <span>{h.at}</span>
              <span className="noc-muted">{h.massivas} massivas · {h.sites} sites</span>
              <button className="noc-btn" onClick={() => restore(h)}>Voltar</button>
              <button className="noc-btn-ghost" onClick={() => setHistory((x) => x.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          {!history.length && <p className="noc-muted text-xs">Cada SNMP colado gera um registro aqui.</p>}
        </div>
      </section>
    </div>
    </div>
  );
}
