import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
const LIVE_MS = 5 * 60 * 1000;
const LIVE_URL = "http://www-grbs.embratel.net.br/grb/topologia_rede/www/consulta_historico.php?refresh=5+min&id_rede=33&id_alarme=&id_conex=&todos_tuneis=N&centro=&rot=%2A&serial=&designacao=&texto_livre=&operadora=&al_ral_cad=N&id_agrupado=&sintoma=SEM_RESP_SNMP&status=NAO+NORMALIZADO&intervalo=ALL&sel_relat=0&acao=consultar&order_by=t2.id_alarme+desc&PERMS1=MjsxMDsyMDsyMTsyMjsyMzsyNDsyNTsyNjsyNzsyODsyOTszNTszNjszODszOTs0NDs0Njs1MDs1Mjs1NTs1Njs1ODs2MTs2Mjs2Mzs2NDs2NTs2Njs2OTs3MDs3Mzs3NDs3Nzs3ODs4OTs5MDs5NTs5NjsxMDE7MTAyOzEwNzsxMDg7MTEwOzExMTsxMjQ7MTI1OzEzMzsxMzQ7MTM4OzEzOTsxNDQ7MTQ1OzE0NzsxNDg7MTUxOzE1MjsxNTU7MTU2OzE1ODsxNTk7MTYxOzE2MjsxNjQ7MTY1OzE2NzsxNjg7MTcxOzE3MjsxNzQ7MTc1OzE3NzsxNzg7MTgwOzE4MTsxODM7MTg0OzE4NjsxODc7MTkwOzE5MTsxOTQ7MTk1OzE5OTsyMDA7MjAzOzIwNDsyMDc7MjA4OzIwOTsyMTE7MjEyOzIxNTsyMTY7MjE5OzIyMDsyMjI7MjIzOzIyNTsyMjY7MjMzOzIzNDs%3D&sintomas=97%3B0%3B70%3B39%3B77%3B19%3B1%3B80%3B95%3B98%3B22%3B76%3B42%3B88%3B89%3B36%3B40%3B2%3B3%3B21%3B20%3B116%3B56%3B109%3B87%3B52%3B4%3B93%3B107%3B111%3B31%3B27%3B5%3B55%3B114%3B17%3B43%3B83%3B41%3B6%3B54%3B26%3B28%3B69%3B91%3B33%3B94%3B74%3B7%3B110%3B18%3B57%3B30%3B112%3B86%3B90%3B75%3B118%3B68%3B58%3B104%3B8%3B23%3B25%3B24%3B92%3B9%3B79%3B59%3B117%3B81%3B51%3B71%3B34%3B10%3B60%3B105%3B102%3B103%3B78%3B11%3B12%3B106%3B85%3B82%3B37%3B72%3B73%3B13%3B14%3B15%3B16%3B96%3B101%3B38%3B32%3B99%3B29%3B113%3B100%3B35%3B84%3B115&remote_user=92465827&leo=&pagina=1&csv_output=1&pt_output=off&pt_id_tabela_csv=tabelaAlarme";

function dayStamp(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function dayKey() {
  return `${LS}-${dayStamp()}`;
}

function download(filename: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function csvCell(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

function pdfEscape(text: string) {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else if (code >= 32 && code <= 126) out += ch;
    else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return out;
}

function wrapLine(line: string, width = 90) {
  if (line.length <= width) return [line];
  const out: string[] = [];
  let rest = line;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(" ", width);
    if (cut < 20) cut = width;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

function pdfBytes(text: string) {
  const fontSize = 11;
  const leading = 14;
  const margin = 48;
  const pageH = 842;
  const lines = text.split("\n").flatMap((l) => wrapLine(l));
  const perPage = Math.floor((pageH - margin * 2) / leading);
  const chunks: string[][] = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += perPage) chunks.push(lines.slice(i, i + perPage));

  const objects: string[] = [];
  const kids: number[] = [];
  let id = 4;
  for (const chunk of chunks) {
    const pageId = id++;
    const contentId = id++;
    const y = pageH - margin;
    const stream = ["BT", `/F1 ${fontSize} Tf`, `${leading} TL`, `1 0 0 1 ${margin} ${y} Tm`, ...chunk.map((line) => `(${pdfEscape(line)}) Tj T*`), "ET"].join("\n");
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    kids.push(pageId);
  }
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${kids.map((n) => `${n} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = new TextEncoder().encode(pdf).length;
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

function siteId(m: RegExpMatchArray) {
  return `${m[1]}|${m[2]}|${m[3]}|${m[4]}|${m[5]}`;
}

function dedupeText(text: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];
  let lastBlank = false;
  for (const l of text.split("\n")) {
    const trimmed = l.trim();
    if (!trimmed) {
      if (!lastBlank && kept.length) kept.push("");
      lastBlank = true;
      continue;
    }
    lastBlank = false;
    const m = trimmed.match(LINE);
    const id = m ? `site:${siteId(m)}` : `line:${trimmed}`;
    if (seen.has(id)) continue;
    seen.add(id);
    kept.push(m ? trimmed : l);
  }
  return kept.join("\n");
}

function splitCsv(line: string, sep: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { out.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function csvSep(text: string) {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const score = (sep: string) => (line.match(new RegExp(sep === "\t" ? "\\t" : `\\${sep}`, "g")) || []).length;
  const semi = score(";");
  const comma = score(",");
  const tab = score("\t");
  if (tab >= semi && tab >= comma && tab > 0) return "\t";
  return semi >= comma ? ";" : ",";
}

function fold(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function colOf(headers: string[], names: string[]) {
  const h = headers.map(fold);
  return h.findIndex((x) => names.some((n) => x.includes(n)));
}

function clockOf(raw: string) {
  let data = "";
  let hora = "";
  const br = raw.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  const hm = raw.match(/(\d{2}):(\d{2})/);
  if (br) data = `${br[1]}/${br[2]}/${br[3]!.slice(-2)}`;
  else if (iso) data = `${iso[3]}/${iso[2]}/${iso[1]!.slice(-2)}`;
  if (hm) hora = `${hm[1]}:${hm[2]}`;
  return { data, hora };
}

function csvToSnmp(text: string) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("<"));
  if (!lines.length) return "";
  const sep = csvSep(text);
  const rows = lines.map((l) => splitCsv(l, sep));
  const header = fold(rows[0]!.join(" "));
  const named = /equip|sintoma|alarme|regional|data|hora|host/.test(header);
  const body = named ? rows.slice(1) : rows;
  const idx = named
    ? {
        reg: colOf(rows[0]!, ["regional", "regiao", "sigla"]),
        equip: colOf(rows[0]!, ["equipamento", "hostname", "elemento", "roteador", "site"]),
        alarme: colOf(rows[0]!, ["sintoma", "alarme"]),
        data: colOf(rows[0]!, ["data", "inicio", "abertura", "datetime", "datahora", "data_hora"]),
        hora: colOf(rows[0]!, ["hora", "horario"]),
      }
    : { reg: -1, equip: -1, alarme: -1, data: -1, hora: -1 };
  const out: string[] = [];
  for (const r of body) {
    let reg = idx.reg >= 0 ? r[idx.reg] ?? "" : "";
    let equip = idx.equip >= 0 ? r[idx.equip] ?? "" : "";
    let alarme = idx.alarme >= 0 ? r[idx.alarme] ?? "" : "";
    let { data, hora } = clockOf(`${idx.data >= 0 ? r[idx.data] ?? "" : ""} ${idx.hora >= 0 ? r[idx.hora] ?? "" : ""}`);
    if (!named) {
      for (const cell of r) {
        if (!equip && /[A-Z0-9]{3,}[-_][A-Z0-9-]+/i.test(cell)) equip = cell;
        const d = clockOf(cell);
        if (d.data && !data) data = d.data;
        if (d.hora && !hora) hora = d.hora;
        if (!reg && /^[A-Z]{2}$/.test(cell)) reg = cell;
      }
    }
    reg = reg.split(/\s+/)[0] ?? "";
    equip = equip.replace(/\s+/g, "");
    alarme = (alarme || "SEM_RESP_SNMP").replace(/\s+/g, "_");
    if (!reg) reg = "SI";
    if (!equip || !data || !hora) continue;
    out.push(`${reg} ${equip} ${alarme} ${data} ${hora}`);
  }
  return dedupeText(out.join("\n"));
}

function parse(text: string): Site[] {
  const out: Site[] = [];
  const seen = new Set<string>();
  for (const l of text.split("\n")) {
    const m = l.trim().match(LINE);
    if (!m) continue;
    const id = siteId(m);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ reg: m[1]!, equip: m[2]!, alarme: m[3]!, data: m[4]!, hora: m[5]!, key: `${m[4]} ${m[5]}` });
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
  const [modal, setModal] = useState(false);
  const [history, setHistory] = useState<Snap[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const [reportShow, setReportShow] = useState({ obs1: true, obs2: true, sites: true });
  const [cols, setCols] = useState({ n: true, queda: true, qtd: true, sites: true, causa: true });
  const [liveText, setLiveText] = useState("");
  const [liveState, setLiveState] = useState<"buscando" | "ok" | "erro">("buscando");
  const [liveAt, setLiveAt] = useState("");
  const [liveError, setLiveError] = useState("");
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(dayKey()) ?? localStorage.getItem(LS) ?? "{}");
      const clean = dedupeText(s.text || "");
      setText(clean);
      setDebounced(clean);
      setMeta(s.meta || {});
      setHistory(s.history || []);
      setLastUpdate(s.lastUpdate || "");
      setReportShow({
        obs1: s.reportShow?.obs1 !== false,
        obs2: s.reportShow?.obs2 !== false,
        sites: s.reportShow?.sites !== false,
      });
      setCols({
        n: s.cols?.n !== false,
        queda: s.cols?.queda !== false,
        qtd: s.cols?.qtd !== false,
        sites: s.cols?.sites !== false,
        causa: s.cols?.causa !== false,
      });
      setFolded(s.folded && typeof s.folded === "object" ? s.folded : {});
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(dayKey(), JSON.stringify({ text, meta, history, lastUpdate, reportShow, cols, folded }));
  }, [text, meta, history, lastUpdate, reportShow, cols, folded, loaded]);
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

  const pullSeq = useRef(0);
  const pullLive = useCallback(async () => {
    const seq = ++pullSeq.current;
    setLiveState("buscando");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const res = await fetch(LIVE_URL, { cache: "no-store", signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.text();
      if (seq !== pullSeq.current) return;
      if (/<!doctype html|<html/i.test(raw)) throw new Error("resposta html");
      const snmp = csvToSnmp(raw);
      if (!snmp.trim()) throw new Error("vazio");
      setLiveText(snmp);
      setLiveError("");
      setLiveAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      setLiveState("ok");
    } catch {
      if (seq !== pullSeq.current) return;
      setLiveState("erro");
      setLiveError("Sem acesso à planilha. A busca segue a cada 5 min.");
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    void pullLive();
    const t = setInterval(() => void pullLive(), LIVE_MS);
    return () => clearInterval(t);
  }, [pullLive]);

  const restore = (h: Snap) => {
    const clean = dedupeText(h.text);
    setText(clean);
    setDebounced(clean);
    setMeta(h.meta);
  };

  const manualSites = useMemo(() => parse(debounced), [debounced]);
  const liveSites = useMemo(() => parse(liveText), [liveText]);
  const sites = useMemo(() => {
    const seen = new Set<string>();
    const out: Site[] = [];
    for (const s of [...manualSites, ...liveSites]) {
      const id = `${s.reg}|${s.equip}|${s.alarme}|${s.data}|${s.hora}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(s);
    }
    return out;
  }, [manualSites, liveSites]);
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
  const report = useMemo(() => {
    const head = `### COP REDE MOVEL ### Atualização: ${lastUpdate || "-"}`;
    const body = active.map((k, i) => {
      const lines = [`Massiva: ${i + 1}`, `${k.split(" ")[1]} | ${count(k)} ESTAÇÕES`];
      if (reportShow.obs1) lines.push(meta[k]!.obs1 || "-");
      if (reportShow.obs2) lines.push(meta[k]!.causa || "-");
      if (reportShow.sites) lines.push(sitesOf(k).join(", ") || "-");
      return lines.join("\n");
    }).join("\n\n");
    return body ? `${head}\n${body}` : head;
  }, [active, lastUpdate, reportShow, meta, groups]);

  const exportCsv = () => {
    const headers = ["ordem", "horario", "estacoes"];
    if (reportShow.obs1) headers.push("obs1");
    if (reportShow.obs2) headers.push("obs2");
    if (reportShow.sites) headers.push("sites");
    const rows = active.map((k, i) => {
      const row = [String(i + 1), k.split(" ")[1] ?? "", String(count(k))];
      if (reportShow.obs1) row.push(meta[k]!.obs1);
      if (reportShow.obs2) row.push(meta[k]!.causa);
      if (reportShow.sites) row.push(sitesOf(k).join(", "));
      return row;
    });
    const csv = `\uFEFF${[headers, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n")}`;
    download(`cop-rede-movel-${dayStamp()}.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  };

  const exportPdf = () => {
    download(`cop-rede-movel-${dayStamp()}.pdf`, new Blob([pdfBytes(report)], { type: "application/pdf" }));
  };

  return (
    <div className="noc-page">
    <div className="noc-stats">
      <div className="noc-stat"><span>Massivas</span><b>{active.length}</b></div>
      <div className="noc-stat"><span>Sites afetados</span><b>{affected}</b></div>
      <div className="noc-stat"><span>Mais antiga</span><b>{active[0]?.split(" ")[1] ?? "—"}</b></div>
      <div className="noc-stat"><span>Atualização</span><b>{lastUpdate || "—"}</b></div>
    </div>
    {modal && (
      <div className="noc-modal-bg" onClick={() => setModal(false)}>
        <div className="noc-modal" onClick={(e) => e.stopPropagation()}>
          <h2 className="noc-title">Resumo para Gestão</h2>
          <div className="flex flex-wrap gap-4 my-3 text-xs">
            {([["obs1", "Obs1"], ["obs2", "Obs2"], ["sites", "Sites"]] as const).map(([key, label]) => (
              <label key={key} className="flex gap-1 items-center">
                <input type="checkbox" checked={reportShow[key]} onChange={() => setReportShow((s) => ({ ...s, [key]: !s[key] }))} />
                {label}
              </label>
            ))}
          </div>
          <pre className="noc-report">{report}</pre>
          <div className="flex gap-2 justify-end mt-3">
            <button className="noc-btn" onClick={() => navigator.clipboard.writeText(report)}>Copiar</button>
            <button className="noc-btn" onClick={exportCsv}>CSV</button>
            <button className="noc-btn" onClick={exportPdf}>PDF</button>
            <button className="noc-btn-ghost" onClick={() => setModal(false)}>Fechar</button>
          </div>
        </div>
      </div>
    )}
    <div className="noc-grid">
      {/* Coluna 1 */}
      <section className="noc-col">
        <h2 className="noc-title">SNMP</h2>
        <textarea className="noc-input" value={text} onChange={(e) => setText(dedupeText(e.target.value))} placeholder="Cole aqui o relatório SNMP..." />
        <div className="noc-lines">
          {manualSites.map((s, i) => {
            const c = colorOf(s);
            return (
              <div key={i} className="noc-line" style={c !== null ? { background: `var(--m${c})`, color: "var(--m-fg)" } : undefined}>
                <span>{s.equip}</span><span>{s.hora}</span>
              </div>
            );
          })}
          {!manualSites.length && <p className="noc-muted">Nenhum equipamento reconhecido.</p>}
        </div>
        <div className="noc-live">
          <div className="flex items-center justify-between gap-2">
            <h3 className="noc-title">SNMP automático</h3>
            <button className="noc-btn" onClick={() => void pullLive()}>Atualizar</button>
          </div>
          <p className="noc-muted text-xs">
            {liveState === "buscando" && "Buscando a planilha..."}
            {liveState === "ok" && `${liveSites.length} equipamentos · ${liveAt}`}
            {liveState === "erro" && liveError}
          </p>
          <div className="noc-lines">
            {liveSites.map((s, i) => {
              const c = colorOf(s);
              return (
                <div key={i} className="noc-line" style={c !== null ? { background: `var(--m${c})`, color: "var(--m-fg)" } : undefined}>
                  <span>{s.equip}</span><span>{s.hora}</span>
                </div>
              );
            })}
          </div>
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
            if (folded[k]) {
              return (
                <article key={k} className={`noc-card-min ${m.hidden ? "opacity-40" : ""}`} style={{ background: `var(--m${m.color})`, color: "var(--m-fg)" }}>
                  <span>{k} - {count(k)} ESTAÇÕES</span>
                  <div className="flex gap-1">
                    <button className="noc-btn" onClick={() => upd(k, { hidden: !m.hidden })}>{m.hidden ? "Ativar" : "Ocultar"}</button>
                    {m.manual && <button className="noc-btn" onClick={() => remove(k)}>Remover</button>}
                    <button className="noc-btn" onClick={() => setFolded((f) => ({ ...f, [k]: false }))}>Maximizar</button>
                  </div>
                </article>
              );
            }
            return (
              <article key={k} className={`noc-card ${m.hidden ? "opacity-40" : ""}`} style={{ borderColor: `var(--m${m.color})` }}>
                <header className="flex items-center justify-between gap-2">
                  <span className="noc-badge" style={{ background: `var(--m${m.color})` }}>{k}</span>
                  <span className="font-semibold">{count(k)} estações</span>
                  <div className="flex gap-1">
                    <button className="noc-btn" onClick={() => upd(k, { hidden: !m.hidden })}>{m.hidden ? "Ativar" : "Ocultar"}</button>
                    {m.manual && <button className="noc-btn" onClick={() => remove(k)}>Remover</button>}
                    <button className="noc-btn" onClick={() => setFolded((f) => ({ ...f, [k]: true }))}>Minimizar</button>
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
        <h2 className="noc-title flex justify-between">Resumo <button className="noc-btn" onClick={() => setModal(true)}>Gestão</button></h2>
        <div className="flex flex-wrap gap-3 mb-2 text-xs">
          {([["n", "#"], ["queda", "Queda"], ["qtd", "Qtd"], ["sites", "Sites"], ["causa", "Causa"]] as const).map(([key, label]) => (
            <label key={key} className="flex gap-1 items-center">
              <input type="checkbox" checked={cols[key]} onChange={() => setCols((c) => ({ ...c, [key]: !c[key] }))} />
              {label}
            </label>
          ))}
        </div>
        <table className="noc-table">
          <colgroup>
            {cols.n && <col className="noc-w-n" />}
            {cols.queda && <col className="noc-w-queda" />}
            {cols.qtd && <col className="noc-w-qtd" />}
            {cols.sites && <col />}
            {cols.causa && <col />}
          </colgroup>
          <thead>
            <tr>
              {cols.n && <th>#</th>}
              {cols.queda && <th>QUEDA</th>}
              {cols.qtd && <th>QTD</th>}
              {cols.sites && <th>SITES</th>}
              {cols.causa && <th>CAUSA</th>}
            </tr>
          </thead>
          <tbody>
            {active.map((k, i) => (
              <tr key={k}>
                {cols.n && <td>{i + 1}</td>}
                {cols.queda && <td className="whitespace-nowrap"><span className="noc-dot" style={{ background: `var(--m${meta[k]!.color})` }} />{k.split(" ")[1]}</td>}
                {cols.qtd && <td className="whitespace-nowrap">{count(k)} ESTAÇÕES</td>}
                {cols.sites && <td><div className="noc-clamp noc-sites">{sitesOf(k).join(", ")}</div></td>}
                {cols.causa && <td><div className="noc-clamp">{meta[k]!.causa || "—"}</div></td>}
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
