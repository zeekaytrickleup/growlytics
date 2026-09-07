"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  LayoutDashboard, Sparkles, TrendingUp, TrendingDown, Package, Users,
  Megaphone, Search, Mail, Boxes, Activity, FileText, Workflow,
  Plug, Settings, Bell, Command, ArrowUpRight, ArrowDownRight, Zap, Target,
  AlertTriangle, Clock, ChevronRight, Plus, Send, Menu,
  DollarSign, ShoppingCart, Percent, Repeat, Star, Download, Cpu, Flame,
  Wallet, RefreshCw, Lightbulb, ArrowRight, Globe, Search as SearchIcon,
} from "lucide-react";
import {
  fetchOverview, fetchProducts, askAssistant, fetchIntegrations, connectIntegration, syncIntegration,
  fetchReportSummary, reportPdfUrl, fetchMe, setWorkspace,
  type Overview, type Integration, type ReportSummary, type Me,
} from "../lib/api";

/* ============================================================
   Growlytics AI — The AI Growth Manager for E-commerce
   Single-file interactive prototype (ported to Next.js)
   ============================================================ */

const STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --bg: #08080c;
  --bg-grad-1: #0e0b1e;
  --bg-grad-2: #08080c;
  --surface: #101018;
  --surface-2: #16161f;
  --surface-3: #1c1c27;
  --glass: rgba(20,20,30,0.55);
  --border: rgba(255,255,255,0.06);
  --border-2: rgba(255,255,255,0.10);
  --text: #ededf2;
  --dim: #9a9aa8;
  --mute: #62626e;
  --primary: #5b5bd6;
  --primary-2: #7c7cf0;
  --purple: #a78bfa;
  --blue: #4c8dff;
  --emerald: #34d399;
  --amber: #fbbf24;
  --red: #f87171;
  --pink: #f472b6;
  --shadow: 0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 40px -12px rgba(0,0,0,0.7);
}

* { box-sizing: border-box; }

.gos {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background:
    radial-gradient(1200px 700px at 78% -8%, rgba(91,91,214,0.16), transparent 60%),
    radial-gradient(900px 600px at 10% 8%, rgba(167,139,250,0.09), transparent 55%),
    var(--bg);
  color: var(--text);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}
.mono { font-family: 'JetBrains Mono', monospace; font-feature-settings: "tnum"; }

.app { display: flex; min-height: 100vh; }

/* ---------- Sidebar ---------- */
.sidebar {
  width: 248px; flex-shrink: 0; padding: 18px 12px;
  border-right: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.015), transparent);
  display: flex; flex-direction: column; gap: 4px;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
  transition: transform .28s cubic-bezier(.4,0,.2,1);
}
.brand { display: flex; align-items: center; gap: 10px; padding: 6px 8px 16px; }
.brand-logo {
  width: 34px; height: 34px; border-radius: 10px;
  background: linear-gradient(135deg, var(--primary), var(--purple));
  display: grid; place-items: center; box-shadow: 0 6px 20px -6px rgba(124,124,240,0.7);
}
.brand-name { font-weight: 800; font-size: 15px; letter-spacing: -0.02em; }
.brand-tag { font-size: 10.5px; color: var(--mute); font-weight: 500; }

.nav-group-label { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: var(--mute); padding: 12px 10px 6px; font-weight: 600; }
.nav-item {
  display: flex; align-items: center; gap: 11px; padding: 9px 11px; border-radius: 9px;
  color: var(--dim); font-size: 13.5px; font-weight: 500; cursor: pointer;
  border: 1px solid transparent; transition: all .16s ease; position: relative;
}
.nav-item:hover { background: var(--surface-2); color: var(--text); }
.nav-item.active { background: linear-gradient(90deg, rgba(91,91,214,0.22), rgba(91,91,214,0.05)); color: #fff; border-color: rgba(124,124,240,0.28); }
.nav-item.active::before { content: ""; position: absolute; left: 0; top: 18%; height: 64%; width: 3px; border-radius: 3px; background: var(--primary-2); }
.nav-badge { margin-left: auto; font-size: 10px; background: var(--primary); color: #fff; padding: 1px 7px; border-radius: 20px; font-weight: 700; }

/* ---------- Main ---------- */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.topbar {
  position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 14px;
  padding: 14px 26px; border-bottom: 1px solid var(--border);
  background: rgba(8,8,12,0.72); backdrop-filter: blur(14px);
}
.page-title { font-size: 19px; font-weight: 700; letter-spacing: -0.02em; }
.page-sub { font-size: 12.5px; color: var(--mute); }
.searchbar {
  margin-left: auto; display: flex; align-items: center; gap: 9px; width: 300px; max-width: 34vw;
  padding: 8px 12px; border-radius: 10px; background: var(--surface-2);
  border: 1px solid var(--border); color: var(--mute); font-size: 13px; cursor: pointer;
  transition: border-color .16s;
}
.searchbar:hover { border-color: var(--border-2); }
.kbd { margin-left: auto; font-size: 10.5px; padding: 2px 6px; border-radius: 5px; background: var(--surface-3); border: 1px solid var(--border-2); color: var(--dim); }
.icon-btn { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: var(--surface-2); border: 1px solid var(--border); color: var(--dim); cursor: pointer; transition: all .16s; position: relative; }
.icon-btn:hover { color: var(--text); border-color: var(--border-2); }
.avatar { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg,#7c7cf0,#f472b6); display: grid; place-items: center; font-weight: 700; font-size: 13px; color: #fff; cursor: pointer; }
.dot { position: absolute; top: 8px; right: 9px; width: 7px; height: 7px; border-radius: 50%; background: var(--emerald); box-shadow: 0 0 0 3px var(--surface-2); }

.content { padding: 26px; display: flex; flex-direction: column; gap: 22px; max-width: 1500px; width: 100%; }

/* ---------- Cards & primitives ---------- */
.card {
  background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent), var(--surface);
  border: 1px solid var(--border); border-radius: 16px; padding: 18px;
  box-shadow: var(--shadow);
}
.card.pad-lg { padding: 22px; }
.card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.card-title { font-size: 14px; font-weight: 650; letter-spacing: -0.01em; }
.card-sub { font-size: 11.5px; color: var(--mute); }

.grid { display: grid; gap: 16px; }
.section-label { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 650; color: var(--dim); }
.section-label .accent { color: var(--purple); }

.badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; }
.badge.up { background: rgba(52,211,153,0.13); color: var(--emerald); }
.badge.down { background: rgba(248,113,113,0.13); color: var(--red); }
.badge.warn { background: rgba(251,191,36,0.13); color: var(--amber); }
.badge.info { background: rgba(76,141,255,0.13); color: var(--blue); }
.badge.pri { background: rgba(124,124,240,0.16); color: var(--primary-2); }
.badge.neutral { background: var(--surface-3); color: var(--dim); }

.kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px,1fr)); gap: 14px; }
.kpi { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 15px 16px; transition: transform .18s, border-color .18s; cursor: default; }
.kpi:hover { transform: translateY(-3px); border-color: var(--border-2); }
.kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.kpi-ico { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; }
.kpi-label { font-size: 11.5px; color: var(--dim); font-weight: 500; }
.kpi-value { font-size: 25px; font-weight: 750; letter-spacing: -0.03em; margin-top: 2px; }

.insight-scroll { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px,1fr)); gap: 14px; }
.insight {
  position: relative; overflow: hidden; border-radius: 16px; padding: 16px;
  background: linear-gradient(150deg, rgba(124,124,240,0.10), rgba(20,20,30,0.4));
  border: 1px solid rgba(124,124,240,0.20);
}
.insight::after { content:""; position:absolute; inset:-40% -40% auto auto; width:150px; height:150px; border-radius:50%; filter: blur(38px); opacity:.5; }
.insight.g-emerald::after { background: var(--emerald); }
.insight.g-red::after { background: var(--red); }
.insight.g-blue::after { background: var(--blue); }
.insight.g-amber::after { background: var(--amber); }
.insight.g-purple::after { background: var(--purple); }
.insight-tag { display:flex; align-items:center; gap:7px; font-size:11px; font-weight:600; color: var(--dim); margin-bottom: 9px; position: relative; z-index: 1; }
.insight-title { font-size: 15px; font-weight: 700; letter-spacing:-0.02em; position: relative; z-index: 1; }
.insight-desc { font-size: 12px; color: var(--dim); margin-top: 5px; line-height: 1.45; position: relative; z-index: 1; }
.insight-cta { display:flex; align-items:center; gap:5px; margin-top: 12px; font-size:12px; font-weight:600; color:#fff; cursor:pointer; position:relative; z-index:1; }
.insight-cta:hover { gap: 8px; }

/* table */
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing:.06em; color: var(--mute); font-weight: 600; padding: 8px 12px; }
.tbl td { padding: 11px 12px; border-top: 1px solid var(--border); color: var(--dim); }
.tbl tr:hover td { background: var(--surface-2); color: var(--text); }
.tbl .name { color: var(--text); font-weight: 600; }

.bar-track { height: 6px; border-radius: 6px; background: var(--surface-3); overflow: hidden; }
.bar-fill { height: 100%; border-radius: 6px; }

.btn { display:inline-flex; align-items:center; gap:7px; font-size: 13px; font-weight: 600; padding: 9px 15px; border-radius: 10px; border: 1px solid var(--border-2); background: var(--surface-2); color: var(--text); cursor: pointer; transition: all .16s; }
.btn:hover { border-color: var(--primary); }
.btn.primary { background: linear-gradient(135deg, var(--primary), var(--primary-2)); border-color: transparent; box-shadow: 0 8px 22px -8px rgba(124,124,240,0.8); }
.btn.primary:hover { filter: brightness(1.08); }
.btn.ghost { background: transparent; border-color: var(--border); color: var(--dim); }

.chip { font-size: 12px; padding: 7px 13px; border-radius: 9px; background: var(--surface-2); border: 1px solid var(--border); color: var(--dim); cursor: pointer; transition: all .16s; }
.chip:hover { color: var(--text); }
.chip.active { background: rgba(91,91,214,0.18); color: #fff; border-color: rgba(124,124,240,0.4); }

/* progress ring */
.ring-wrap { display: grid; place-items: center; position: relative; }
.ring-label { position: absolute; text-align: center; }

/* ---------- AI assistant ---------- */
.chat { display: flex; flex-direction: column; gap: 18px; max-width: 900px; margin: 0 auto; width: 100%; }
.msg { display: flex; gap: 12px; }
.msg .bubble-ai { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; flex: 1; }
.msg .bubble-user { background: linear-gradient(135deg, rgba(91,91,214,0.22), rgba(91,91,214,0.08)); border:1px solid rgba(124,124,240,0.3); border-radius: 16px; padding: 12px 16px; margin-left: auto; max-width: 70%; font-size: 14px; }
.ai-av { width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0; background: linear-gradient(135deg, var(--primary), var(--purple)); display:grid; place-items:center; }
.ai-block { border-radius: 12px; padding: 12px 14px; margin-top: 12px; border: 1px solid var(--border); }
.ai-block-label { font-size: 10.5px; text-transform: uppercase; letter-spacing:.08em; font-weight: 700; margin-bottom: 6px; display:flex; align-items:center; gap:6px; }
.action-row { display:flex; align-items:center; gap: 10px; padding: 10px 12px; border-radius: 10px; background: var(--surface-2); border:1px solid var(--border); margin-top: 8px; }
.suggest-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px,1fr)); gap: 10px; }
.suggest {
  text-align: left; padding: 14px; border-radius: 12px; background: var(--surface); border: 1px solid var(--border);
  color: var(--text); cursor: pointer; font-size: 13px; transition: all .16s; display:flex; gap:10px; align-items:flex-start;
}
.suggest:hover { border-color: rgba(124,124,240,0.5); transform: translateY(-2px); }
.composer { position: sticky; bottom: 0; padding-top: 12px; }
.composer-inner { display:flex; align-items:center; gap: 10px; background: var(--surface); border: 1px solid var(--border-2); border-radius: 14px; padding: 8px 8px 8px 16px; box-shadow: var(--shadow); }
.composer-inner input { flex:1; background: transparent; border: none; outline: none; color: var(--text); font-size: 14px; font-family: inherit; }

/* floating assistant */
.fab { position: fixed; right: 24px; bottom: 24px; z-index: 60; width: 56px; height: 56px; border-radius: 18px; background: linear-gradient(135deg, var(--primary), var(--purple)); display:grid; place-items:center; cursor:pointer; box-shadow: 0 14px 40px -8px rgba(124,124,240,0.8); border:none; animation: floaty 4s ease-in-out infinite; }
@keyframes floaty { 0%,100%{ transform: translateY(0);} 50%{ transform: translateY(-6px);} }

/* command bar */
.cmd-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); display:flex; align-items:flex-start; justify-content:center; padding-top: 14vh; }
.cmd { width: 600px; max-width: 92vw; background: var(--surface); border: 1px solid var(--border-2); border-radius: 16px; overflow: hidden; box-shadow: 0 30px 80px -20px rgba(0,0,0,0.9); animation: pop .18s ease; }
@keyframes pop { from { transform: scale(.96); opacity:0;} to{ transform: scale(1); opacity:1;} }
.cmd-input { display:flex; align-items:center; gap:12px; padding: 16px 18px; border-bottom: 1px solid var(--border); }
.cmd-input input { flex:1; background:transparent; border:none; outline:none; color: var(--text); font-size: 16px; font-family: inherit; }
.cmd-list { max-height: 360px; overflow-y: auto; padding: 8px; }
.cmd-item { display:flex; align-items:center; gap: 12px; padding: 11px 12px; border-radius: 10px; cursor:pointer; color: var(--dim); font-size: 13.5px; }
.cmd-item:hover, .cmd-item.hl { background: var(--surface-2); color: var(--text); }

/* skeleton */
.skel { border-radius: 10px; background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%); background-size: 200% 100%; animation: shimmer 1.3s infinite; }
@keyframes shimmer { 0%{background-position: 200% 0;} 100%{background-position:-200% 0;} }

/* empty / error */
.state-box { text-align:center; padding: 48px 24px; display:flex; flex-direction:column; align-items:center; gap:12px; }
.state-ico { width: 64px; height: 64px; border-radius: 18px; display:grid; place-items:center; background: var(--surface-2); border:1px solid var(--border); }

/* workflow */
.wf { display:flex; flex-direction:column; align-items:center; gap: 0; }
.wf-node { width: 320px; max-width: 90%; border-radius: 14px; padding: 14px 16px; border:1px solid var(--border-2); display:flex; align-items:center; gap:12px; }
.wf-node.trigger { background: linear-gradient(135deg, rgba(52,211,153,0.14), var(--surface)); }
.wf-node.action { background: var(--surface); }
.wf-node.cond { background: linear-gradient(135deg, rgba(251,191,36,0.12), var(--surface)); }
.wf-conn { width: 2px; height: 26px; background: linear-gradient(var(--border-2), var(--primary)); }
.wf-node-ico { width: 34px; height: 34px; border-radius: 9px; display:grid; place-items:center; flex-shrink:0; }

.fade-up { animation: fadeUp .5s cubic-bezier(.2,.7,.3,1) both; }
@keyframes fadeUp { from { opacity:0; transform: translateY(10px);} to{opacity:1; transform:none;} }

.mobile-only { display: none; }
.overlay-bg { display:none; }

@media (max-width: 900px) {
  .sidebar { position: fixed; z-index: 90; transform: translateX(-100%); box-shadow: 0 0 60px rgba(0,0,0,0.6); }
  .sidebar.open { transform: translateX(0); }
  .overlay-bg.show { display:block; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:80; }
  .mobile-only { display: grid; }
  .searchbar { display:none; }
  .content { padding: 16px; }
  .topbar { padding: 12px 16px; }
}

::-webkit-scrollbar { width: 9px; height: 9px; }
::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 8px; }
::-webkit-scrollbar-track { background: transparent; }
`;

/* ---------------- mock data ---------------- */
const revenueData = [
  { d: "Mon", rev: 8200, prev: 7100 }, { d: "Tue", rev: 9100, prev: 8300 },
  { d: "Wed", rev: 7600, prev: 8000 }, { d: "Thu", rev: 11200, prev: 9200 },
  { d: "Fri", rev: 14800, prev: 10100 }, { d: "Sat", rev: 16900, prev: 12400 },
  { d: "Sun", rev: 13400, prev: 11800 },
];
const trafficData = [
  { name: "Organic", value: 38, color: "#34d399" },
  { name: "Paid Ads", value: 29, color: "#5b5bd6" },
  { name: "Email", value: 17, color: "#a78bfa" },
  { name: "Social", value: 11, color: "#4c8dff" },
  { name: "Direct", value: 5, color: "#62626e" },
];
const custGrowth = [
  { m: "Jan", c: 1200 }, { m: "Feb", c: 1480 }, { m: "Mar", c: 1710 },
  { m: "Apr", c: 2050 }, { m: "May", c: 2390 }, { m: "Jun", c: 2880 },
];
const topProducts = [
  { name: "Aurora Wireless Buds", rev: "$48.2k", orders: 812, cr: 4.8, trend: "up", stock: 340 },
  { name: "Nimbus Hoodie", rev: "$31.7k", orders: 640, cr: 3.9, trend: "up", stock: 88 },
  { name: "Flux Smart Bottle", rev: "$22.4k", orders: 511, cr: 3.1, trend: "down", stock: 12 },
  { name: "Lumen Desk Lamp", rev: "$18.9k", orders: 402, cr: 2.7, trend: "up", stock: 205 },
  { name: "Terra Yoga Mat", rev: "$14.1k", orders: 388, cr: 2.2, trend: "flat", stock: 61 },
];
// deterministic pseudo-heatmap (avoids hydration mismatch from Math.random)
const heat = Array.from({ length: 7 }, (_, di) =>
  Array.from({ length: 12 }, (_, hi) => {
    const s = Math.sin((di * 12 + hi) * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  })
);
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type NavItem = { id: string; label: string; icon: React.ElementType; group: string; badge?: string };
const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "main" },
  { id: "assistant", label: "AI Growth Assistant", icon: Sparkles, group: "main", badge: "AI" },
  { id: "revenue", label: "Revenue", icon: DollarSign, group: "intel" },
  { id: "products", label: "Products", icon: Package, group: "intel" },
  { id: "customers", label: "Customers", icon: Users, group: "intel" },
  { id: "marketing", label: "Marketing", icon: Megaphone, group: "intel" },
  { id: "seo", label: "SEO", icon: Search, group: "intel" },
  { id: "email", label: "Email Marketing", icon: Mail, group: "intel" },
  { id: "inventory", label: "Inventory", icon: Boxes, group: "intel" },
  { id: "forecasting", label: "Forecasting", icon: Activity, group: "intel" },
  { id: "reports", label: "Reports", icon: FileText, group: "ops" },
  { id: "automations", label: "Automations", icon: Workflow, group: "ops" },
  { id: "integrations", label: "Integrations", icon: Plug, group: "ops" },
  { id: "settings", label: "Settings", icon: Settings, group: "ops" },
];

/* ---------------- small components ---------------- */
const Badge = ({ kind = "up", children }: { kind?: string; children: React.ReactNode }) => (
  <span className={`badge ${kind}`}>{children}</span>
);

function ProgressRing({ value, size = 78, stroke = 8, color = "var(--primary-2)", label, sub }: {
  value: number; size?: number; stroke?: number; color?: string; label?: React.ReactNode; sub?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="ring-label">
        <div style={{ fontSize: 18, fontWeight: 750 }} className="mono">{label}</div>
        {sub && <div style={{ fontSize: 10, color: "var(--mute)" }}>{sub}</div>}
      </div>
    </div>
  );
}

const chartTooltip = {
  contentStyle: { background: "#16161f", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, fontSize: 12, color: "#ededf2" },
  labelStyle: { color: "#9a9aa8" }, itemStyle: { color: "#ededf2" },
};

function KPI({ icon: Icon, label, value, delta, kind, color }: {
  icon: React.ElementType; label: string; value: string; delta: string; kind: string; color: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <div className="kpi-ico" style={{ background: `${color}22`, color }}><Icon size={16} /></div>
        <Badge kind={kind}>{kind === "up" ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{delta}</Badge>
      </div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value mono">{value}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="content">
      <div className="skel" style={{ height: 22, width: 240 }} />
      <div className="insight-scroll">{[1, 2, 3, 4].map(i => <div key={i} className="skel" style={{ height: 128 }} />)}</div>
      <div className="kpi-grid">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skel" style={{ height: 108 }} />)}</div>
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="skel" style={{ height: 300 }} /><div className="skel" style={{ height: 300 }} />
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
// Presentation metadata kept on the client; the API returns only data (keys/types), and we merge
// icons/colors/gradients here. This keeps the API free of UI concerns.
const KPI_PRESENTATION: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  revenue: { icon: DollarSign, label: "Revenue", color: "var(--emerald)" },
  orders: { icon: ShoppingCart, label: "Orders", color: "var(--primary-2)" },
  profit: { icon: Wallet, label: "Profit", color: "var(--emerald)" },
  roas: { icon: Target, label: "ROAS", color: "var(--red)" },
  aov: { icon: DollarSign, label: "Avg Order Value", color: "var(--blue)" },
  cr: { icon: Percent, label: "Conversion Rate", color: "var(--purple)" },
  ltv: { icon: Star, label: "Customer LTV", color: "var(--amber)" },
  returning: { icon: Repeat, label: "Returning", color: "var(--pink)" },
};
const INSIGHT_PRESENTATION: Record<string, { g: string; icon: React.ElementType }> = {
  revenue: { g: "g-emerald", icon: TrendingUp },
  ads: { g: "g-red", icon: TrendingDown },
  product: { g: "g-blue", icon: Flame },
  inventory: { g: "g-amber", icon: AlertTriangle },
  churn: { g: "g-purple", icon: Users },
};
const TRAFFIC_COLORS: Record<string, string> = {
  Organic: "#34d399", "Paid Ads": "#5b5bd6", Email: "#a78bfa", Social: "#4c8dff", Direct: "#62626e",
};

// Fallback KPIs (used if the API is unreachable) — mirror the API contract shape.
const FALLBACK_KPIS = [
  { key: "revenue", label: "Revenue", value: "$81.2k", delta: "18%", kind: "up" },
  { key: "orders", label: "Orders", value: "1,942", delta: "9%", kind: "up" },
  { key: "profit", label: "Profit", value: "$29.4k", delta: "14%", kind: "up" },
  { key: "roas", label: "ROAS", value: "3.8x", delta: "12%", kind: "down" },
  { key: "aov", label: "Avg Order Value", value: "$41.8", delta: "3%", kind: "up" },
  { key: "cr", label: "Conversion Rate", value: "3.4%", delta: "6%", kind: "up" },
  { key: "ltv", label: "Customer LTV", value: "$186", delta: "8%", kind: "up" },
  { key: "returning", label: "Returning", value: "42%", delta: "2%", kind: "up" },
];
const FALLBACK_INSIGHTS = [
  { type: "revenue", tag: "Revenue", title: "Revenue up 18% this week", body: "Weekend campaigns drove $12.4k in incremental sales vs. last week.", cta: "See breakdown" },
  { type: "ads", tag: "Ads · Meta", title: "ROAS dropped 12%", body: "Meta 'Retargeting-Q3' is fatiguing. Refresh creative to recover ~$3.1k.", cta: "Fix campaign" },
  { type: "product", tag: "Product", title: "Aurora Buds is trending", body: "Sessions +64% in 48h. Consider raising ad budget while momentum lasts.", cta: "Scale product" },
  { type: "inventory", tag: "Inventory", title: "Restock Flux Smart Bottle", body: "Only 12 units left. Projected stockout in 3 days at current velocity.", cta: "Create PO" },
];

function Dashboard({ go }: { go: (id: string) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let mounted = true;
    fetchOverview().then(o => {
      if (mounted && o) { setData(o); setLive(true); }
    });
    return () => { mounted = false; };
  }, []);

  const kpiData = data?.kpis ?? FALLBACK_KPIS;
  const insightData = data?.insights ?? FALLBACK_INSIGHTS;
  const revData = data?.revenueSeries ?? revenueData;
  const traffic = (data?.trafficSources ?? trafficData).map(t => ({
    ...t, color: ("color" in t && t.color) || TRAFFIC_COLORS[t.name] || "#62626e",
  }));
  const products = data?.topProducts ?? topProducts;

  return (
    <div className="content fade-up">
      <div>
        <div className="section-label" style={{ marginBottom: 12 }}>
          <Sparkles size={15} className="accent" /> What should you do today?
          <span className="badge pri" style={{ marginLeft: 4 }}>{insightData.length} AI insights</span>
          <span className={`badge ${live ? "up" : "neutral"}`} style={{ marginLeft: "auto" }}>
            {live ? "● Live data" : "○ Demo data"}
          </span>
        </div>
        <div className="insight-scroll">
          {insightData.map((it, i) => {
            const p = INSIGHT_PRESENTATION[it.type] ?? INSIGHT_PRESENTATION.revenue;
            const Icon = p.icon;
            return (
              <div key={i} className={`insight ${p.g}`}>
                <div className="insight-tag"><Icon size={13} /> {it.tag}</div>
                <div className="insight-title">{it.title}</div>
                <div className="insight-desc">{it.body}</div>
                <div className="insight-cta" onClick={() => go("assistant")}>{it.cta} <ArrowRight size={13} /></div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="kpi-grid">{kpiData.map((k, i) => {
        const p = KPI_PRESENTATION[k.key] ?? { icon: DollarSign, label: k.label, color: "var(--primary-2)" };
        return <KPI key={i} icon={p.icon} label={p.label} value={k.value} delta={k.delta} kind={k.kind} color={p.color} />;
      })}</div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)" }}>
        <div className="card pad-lg">
          <div className="card-head">
            <div><div className="card-title">Revenue</div><div className="card-sub">This week vs. last week</div></div>
            <div style={{ display: "flex", gap: 8 }}>{["7D", "30D", "90D"].map((t, i) => <span key={t} className={`chip ${i === 0 ? "active" : ""}`}>{t}</span>)}</div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <AreaChart data={revData} margin={{ left: -18, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b5bd6" stopOpacity={0.5} /><stop offset="100%" stopColor="#5b5bd6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="d" stroke="#62626e" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#62626e" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `$${v / 1000}k`} />
                <Tooltip {...chartTooltip} />
                <Area type="monotone" dataKey="prev" stroke="#3a3a48" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
                <Area type="monotone" dataKey="rev" stroke="#7c7cf0" strokeWidth={2.5} fill="url(#gRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card pad-lg">
          <div className="card-head"><div className="card-title">Traffic Sources</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 150, height: 170 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={traffic} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3} stroke="none">
                    {traffic.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip {...chartTooltip} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9 }}>
              {traffic.map(t => (
                <div key={t.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: t.color }} />
                  <span style={{ color: "var(--dim)" }}>{t.name}</span>
                  <span className="mono" style={{ marginLeft: "auto", fontWeight: 600 }}>{t.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)" }}>
        <div className="card pad-lg">
          <div className="card-head"><div className="card-title">Top Products</div><span className="chip">View all</span></div>
          <table className="tbl">
            <thead><tr><th>Product</th><th>Revenue</th><th>Orders</th><th>CR</th><th>Trend</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.name}>
                  <td className="name">{p.name}</td>
                  <td className="mono">{p.rev}</td>
                  <td className="mono">{p.orders}</td>
                  <td className="mono">{p.cr}%</td>
                  <td>{p.trend === "up" ? <Badge kind="up"><ArrowUpRight size={11} /></Badge> : p.trend === "down" ? <Badge kind="down"><ArrowDownRight size={11} /></Badge> : <Badge kind="neutral">flat</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card pad-lg">
          <div className="card-head"><div className="card-title">Customer Growth</div><Badge kind="up">+140% YTD</Badge></div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={custGrowth} margin={{ left: -20, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="m" stroke="#62626e" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#62626e" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="c" radius={[6, 6, 0, 0]} fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card pad-lg">
        <div className="card-head"><div><div className="card-title">Sales Heatmap</div><div className="card-sub">Order density by day &amp; hour</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mute)" }}>Less<span style={{ display: "flex", gap: 3 }}>{[0.15, 0.35, 0.6, 0.85].map(o => <span key={o} style={{ width: 12, height: 12, borderRadius: 3, background: `rgba(124,124,240,${o})` }} />)}</span>More</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "40px repeat(12,1fr)", gap: 5, minWidth: 560 }}>
            <div />
            {Array.from({ length: 12 }).map((_, h) => <div key={h} style={{ fontSize: 9.5, color: "var(--mute)", textAlign: "center" }} className="mono">{h * 2}h</div>)}
            {heat.map((row, di) => (
              <React.Fragment key={di}>
                <div style={{ fontSize: 10.5, color: "var(--mute)", display: "flex", alignItems: "center" }}>{days[di]}</div>
                {row.map((v, hi) => <div key={hi} title={`${Math.round(v * 40)} orders`} style={{ height: 20, borderRadius: 4, background: `rgba(124,124,240,${0.12 + v * 0.78})` }} />)}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- AI Assistant ---------------- */
type AIAnswer = { analysis: string; reason: string; confidence: number; actions: string[]; impact: string };
const AI_ANSWERS: Record<string, AIAnswer> = {
  "Why did sales drop yesterday?": {
    analysis: "Yesterday's revenue was $9,100 — down 14% from the prior day ($10,580). The decline is concentrated in paid-traffic conversions, not organic.",
    reason: "Meta 'Retargeting-Q3' CPMs rose 22% overnight and its ROAS fell below 2.0x, so fewer paid sessions converted. Organic and email held steady.",
    confidence: 86,
    actions: ["Pause the underperforming Meta ad set 'Retargeting-Q3'", "Shift ~$400/day budget to Google Shopping (ROAS 4.6x)", "Launch a fresh creative variant to combat ad fatigue"],
    impact: "Recovering paid conversions should restore ~$1,400/day within 72 hours.",
  },
  "Which products should I advertise?": {
    analysis: "Two products show strong organic momentum with healthy margins and enough stock to scale profitably.",
    reason: "Aurora Wireless Buds: sessions +64% in 48h, 4.8% CR, 58% margin, 340 units in stock. Nimbus Hoodie: repeat-purchase rate 31%, strong AOV lift when bundled.",
    confidence: 91,
    actions: ["Create a Google Shopping campaign for Aurora Buds at $600/day", "Retarget Nimbus Hoodie viewers with a bundle offer", "Cap spend on Flux Bottle (low stock)"],
    impact: "Estimated +$8.2k revenue over 14 days at a blended 3.9x ROAS.",
  },
  "Which customers are likely to churn?": {
    analysis: "184 customers moved into the 'Churn Risk' segment this month — a 12% increase.",
    reason: "These are prior repeat buyers whose days-since-last-order crossed 2x their historical cadence, with declining email engagement.",
    confidence: 79,
    actions: ["Trigger a win-back flow with a 15% returning-customer offer", "Prioritize the 38 high-LTV accounts for a personal email", "Suppress from prospecting ads to protect margin"],
    impact: "A 20% reactivation rate would retain ~$6.8k in at-risk LTV.",
  },
  "What should I do this week?": {
    analysis: "Your highest-leverage moves this week are one defensive fix and two growth plays.",
    reason: "ROAS is slipping on Meta while Aurora Buds is trending and inventory risk is building on Flux Bottle.",
    confidence: 88,
    actions: ["Refresh Meta retargeting creative (defensive, ~$3.1k recovery)", "Scale Aurora Buds ad budget (growth, ~$8.2k)", "Raise a PO for Flux Bottle before stockout"],
    impact: "Executing all three targets roughly +$11k net revenue with low effort.",
  },
};
const SUGGESTIONS = Object.keys(AI_ANSWERS);

function AIStructured({ a }: { a: AIAnswer }) {
  return (
    <>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--text)" }}>{a.analysis}</p>
      <div className="ai-block" style={{ background: "var(--surface-2)" }}>
        <div className="ai-block-label" style={{ color: "var(--blue)" }}><Lightbulb size={13} /> Reason</div>
        <div style={{ fontSize: 13, color: "var(--dim)", lineHeight: 1.5 }}>{a.reason}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 2px 4px" }}>
        <ProgressRing value={a.confidence} size={58} stroke={6} color="var(--emerald)" label={`${a.confidence}`} />
        <div><div style={{ fontSize: 11, color: "var(--mute)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>Confidence</div>
          <div style={{ fontSize: 13, color: "var(--dim)" }}>Based on 90 days of connected store data</div></div>
      </div>
      <div className="ai-block-label" style={{ color: "var(--primary-2)", marginTop: 14 }}><Zap size={13} /> Recommended actions</div>
      {a.actions.map((act, i) => (
        <div className="action-row" key={i}>
          <span style={{ width: 22, height: 22, borderRadius: 7, background: "rgba(124,124,240,0.2)", color: "var(--primary-2)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }} className="mono">{i + 1}</span>
          <span style={{ fontSize: 13, flex: 1 }}>{act}</span>
          <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Apply</button>
        </div>
      ))}
      <div className="ai-block" style={{ background: "rgba(52,211,153,0.08)", borderColor: "rgba(52,211,153,0.25)", marginTop: 12 }}>
        <div className="ai-block-label" style={{ color: "var(--emerald)" }}><TrendingUp size={13} /> Expected impact</div>
        <div style={{ fontSize: 13, color: "var(--text)" }}>{a.impact}</div>
      </div>
    </>
  );
}

type ChatMsg = { role: "user"; text: string } | { role: "ai"; a: AIAnswer };
function AIAssistant() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, thinking]);

  const localFallback = (q: string): AIAnswer =>
    AI_ANSWERS[q] || {
      analysis: `Here's what I found on: "${q}".`,
      reason: "I cross-referenced your Shopify, GA4, Meta and Klaviyo data for the last 90 days.",
      confidence: 74,
      actions: ["Review the flagged metric in its dashboard", "Set an alert threshold to catch recurrence early"],
      impact: "Acting early typically preserves 5–9% of at-risk revenue.",
    };

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setMsgs(m => [...m, { role: "user", text: q }]);
    setInput(""); setThinking(true);
    // Ask the backend (grounded on real store data); fall back to local answers if it's down.
    const fromApi = await askAssistant(q);
    const a = fromApi ?? localFallback(q);
    setThinking(false);
    setMsgs(m => [...m, { role: "ai", a }]);
  };

  return (
    <div className="content" style={{ height: "calc(100vh - 65px)", justifyContent: "space-between" }}>
      <div className="chat" style={{ overflowY: "auto", flex: 1, paddingBottom: 10 }}>
        {msgs.length === 0 && !thinking && (
          <div className="fade-up">
            <div style={{ textAlign: "center", padding: "18px 0 26px" }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, margin: "0 auto 14px", background: "linear-gradient(135deg,var(--primary),var(--purple))", display: "grid", placeItems: "center" }}><Sparkles size={26} color="#fff" /></div>
              <h2 style={{ fontSize: 22, fontWeight: 750, letterSpacing: "-0.02em" }}>Ask your Growth Assistant</h2>
              <p style={{ color: "var(--dim)", fontSize: 14, marginTop: 6 }}>Answers grounded in your connected store data — with confidence and next steps.</p>
            </div>
            <div className="suggest-grid">
              {SUGGESTIONS.map(s => (
                <button key={s} className="suggest" onClick={() => ask(s)}>
                  <Sparkles size={16} style={{ color: "var(--purple)", flexShrink: 0, marginTop: 1 }} />{s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => m.role === "user" ? (
          <div className="msg" key={i}><div className="bubble-user">{m.text}</div></div>
        ) : (
          <div className="msg fade-up" key={i}>
            <div className="ai-av"><Sparkles size={17} color="#fff" /></div>
            <div className="bubble-ai"><AIStructured a={m.a} /></div>
          </div>
        ))}
        {thinking && (
          <div className="msg"><div className="ai-av"><Sparkles size={17} color="#fff" /></div>
            <div className="bubble-ai" style={{ display: "flex", gap: 6, alignItems: "center", color: "var(--dim)", fontSize: 13 }}>
              <span className="skel" style={{ width: 8, height: 8, borderRadius: 8 }} /> Analyzing your store data…
            </div></div>
        )}
        <div ref={endRef} />
      </div>
      <div className="composer">
        <div className="chat" style={{ padding: 0 }}>
          <div className="composer-inner">
            <Sparkles size={17} style={{ color: "var(--purple)" }} />
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && ask(input)} placeholder="Ask anything about your store…" />
            <button className="btn primary" onClick={() => ask(input)}><Send size={14} /> Ask</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Products ---------------- */
function Products() {
  const [products, setProducts] = useState(topProducts);
  useEffect(() => { fetchProducts().then(p => { if (p?.length) setProducts(p as typeof topProducts); }); }, []);
  const detail = products[0];
  return (
    <div className="content fade-up">
      <div className="card pad-lg">
        <div className="card-head"><div><div className="card-title">Product Intelligence</div><div className="card-sub">{products.length} products · AI-scored for revenue potential</div></div>
          <div style={{ display: "flex", gap: 8 }}><span className="chip active">All</span><span className="chip">Trending</span><span className="chip">Low stock</span></div></div>
        <table className="tbl">
          <thead><tr><th>Product</th><th>Revenue</th><th>Profit</th><th>CR</th><th>Stock</th><th>Suggested price</th><th>AI</th></tr></thead>
          <tbody>
            {products.map((p, i) => (
              <tr key={p.name}>
                <td className="name">{p.name}</td>
                <td className="mono">{p.rev}</td>
                <td className="mono" style={{ color: "var(--emerald)" }}>${(parseFloat(p.rev.replace(/[$k]/g, "")) * 0.36).toFixed(1)}k</td>
                <td className="mono">{p.cr}%</td>
                <td><span className="mono" style={{ color: p.stock < 20 ? "var(--red)" : "var(--dim)" }}>{p.stock}</span></td>
                <td className="mono">${(41 + i * 3.4).toFixed(2)}</td>
                <td>{i === 0 ? <Badge kind="up">Scale ads</Badge> : i === 2 ? <Badge kind="warn">Restock</Badge> : <Badge kind="info">Bundle</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)" }}>
        <div className="card pad-lg">
          <div className="card-head"><div className="card-title">{detail.name}</div><Badge kind="up">Trending</Badge></div>
          <div style={{ display: "flex", justifyContent: "space-around", padding: "6px 0 2px" }}>
            <ProgressRing value={84} label="84" sub="Health" color="var(--emerald)" />
            <ProgressRing value={Math.min(100, (detail.cr || 0) * 10)} label={`${detail.cr}%`} sub="CR" color="var(--primary-2)" />
          </div>
        </div>
        <div className="card pad-lg">
          <div className="card-title" style={{ marginBottom: 12 }}>Competitors</div>
          {[["MarketRival", "$54.99", "up"], ["BudsCo", "$49.00", "flat"], ["You", "$48.20", "up"]].map(([n, pr], i) => (
            <div key={n} style={{ display: "flex", alignItems: "center", padding: "9px 0", borderTop: i ? "1px solid var(--border)" : "none", fontSize: 13 }}>
              <span style={{ color: i === 2 ? "var(--primary-2)" : "var(--dim)", fontWeight: i === 2 ? 700 : 500 }}>{n}</span>
              <span className="mono" style={{ marginLeft: "auto" }}>{pr}</span>
            </div>
          ))}
        </div>
        <div className="card pad-lg" style={{ background: "linear-gradient(150deg, rgba(124,124,240,0.1), var(--surface))" }}>
          <div className="ai-block-label" style={{ color: "var(--primary-2)" }}><Sparkles size={13} /> AI recommendation</div>
          <p style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, marginTop: 4 }}>Raise price to <b>$52.99</b> (still under rivals) and bundle with the charging case. Projected margin lift of <b>+9%</b> with negligible CR impact.</p>
          <button className="btn primary" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}>Apply recommendation</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Customers ---------------- */
function Customers() {
  const segs = [
    { name: "VIP", n: 214, val: "$182k", color: "var(--amber)", ai: "Offer early access" },
    { name: "Loyal", n: 892, val: "$310k", color: "var(--emerald)", ai: "Referral program" },
    { name: "Repeat Buyers", n: 1340, val: "$228k", color: "var(--primary-2)", ai: "Cross-sell bundles" },
    { name: "One-Time", n: 3120, val: "$96k", color: "var(--blue)", ai: "Welcome flow #2" },
    { name: "Dormant", n: 980, val: "$41k", color: "var(--mute)", ai: "Win-back 15%" },
    { name: "Churn Risk", n: 184, val: "$68k", color: "var(--red)", ai: "Personal outreach" },
  ];
  return (
    <div className="content fade-up">
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))" }}>
        {segs.map(s => (
          <div key={s.name} className="card" style={{ borderLeft: `3px solid ${s.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color }} />
              <span style={{ fontSize: 13.5, fontWeight: 650 }}>{s.name}</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--dim)" }}>{s.n}</span>
            </div>
            <div className="kpi-value mono" style={{ fontSize: 22, marginTop: 10 }}>{s.val}</div>
            <div style={{ fontSize: 11, color: "var(--mute)" }}>segment LTV</div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--purple)" }}>
              <Sparkles size={13} /> {s.ai} <ChevronRight size={13} style={{ marginLeft: "auto" }} />
            </div>
          </div>
        ))}
      </div>
      <div className="card pad-lg" style={{ background: "linear-gradient(150deg, rgba(248,113,113,0.08), var(--surface))" }}>
        <div className="ai-block-label" style={{ color: "var(--red)" }}><AlertTriangle size={13} /> Retention priority</div>
        <p style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.55, marginTop: 4 }}>184 previously loyal customers are drifting toward churn. A targeted win-back with a 15% returning-customer offer to the 38 highest-LTV accounts could retain <b>~$6.8k</b> in lifetime value.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn primary"><Mail size={14} /> Launch win-back flow</button>
          <button className="btn ghost">Export segment</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Marketing ---------------- */
function Marketing() {
  const ch = [
    { name: "Google Ads", spend: "$8.2k", rev: "$34.1k", roas: "4.2x", cpa: "$12", ctr: "3.1%", conv: 812, kind: "up", rec: "Scale Shopping" },
    { name: "Meta Ads", spend: "$6.9k", rev: "$19.8k", roas: "2.9x", cpa: "$18", ctr: "1.8%", conv: 540, kind: "down", rec: "Refresh creative" },
    { name: "TikTok Ads", spend: "$3.1k", rev: "$11.4k", roas: "3.7x", cpa: "$14", ctr: "2.4%", conv: 288, kind: "up", rec: "Test UGC" },
    { name: "Pinterest", spend: "$1.2k", rev: "$3.9k", roas: "3.3x", cpa: "$16", ctr: "1.5%", conv: 96, kind: "up", rec: "Hold" },
    { name: "Email", spend: "$0.4k", rev: "$22.6k", roas: "56x", cpa: "$1", ctr: "6.2%", conv: 1120, kind: "up", rec: "Add flow" },
  ];
  return (
    <div className="content fade-up">
      <div className="kpi-grid">
        <KPI icon={Wallet} label="Total Spend" value="$19.8k" delta="4%" kind="up" color="var(--blue)" />
        <KPI icon={DollarSign} label="Attributed Revenue" value="$91.8k" delta="16%" kind="up" color="var(--emerald)" />
        <KPI icon={Target} label="Blended ROAS" value="4.6x" delta="8%" kind="up" color="var(--primary-2)" />
        <KPI icon={Users} label="New Customers" value="1,204" delta="11%" kind="up" color="var(--purple)" />
      </div>
      <div className="card pad-lg">
        <div className="card-head"><div className="card-title">Channel Performance</div><span className="chip">Last 30 days</span></div>
        <table className="tbl">
          <thead><tr><th>Channel</th><th>Spend</th><th>Revenue</th><th>ROAS</th><th>CPA</th><th>CTR</th><th>Conv.</th><th>AI recommendation</th></tr></thead>
          <tbody>
            {ch.map(c => (
              <tr key={c.name}>
                <td className="name">{c.name}</td>
                <td className="mono">{c.spend}</td>
                <td className="mono" style={{ color: "var(--emerald)" }}>{c.rev}</td>
                <td className="mono">{c.roas}</td>
                <td className="mono">{c.cpa}</td>
                <td className="mono">{c.ctr}</td>
                <td className="mono">{c.conv}</td>
                <td><span style={{ display: "flex", alignItems: "center", gap: 6, color: c.kind === "down" ? "var(--red)" : "var(--purple)", fontSize: 12 }}><Sparkles size={12} /> {c.rec}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- generic metric screens ---------------- */
type KpiDef = { icon: React.ElementType; label: string; value: string; delta: string; kind: string; color: string };
function MetricScreen({ title, sub, kpis, tableHead, rows, chart, aiNote }: {
  title: string; sub?: string; kpis?: KpiDef[]; tableHead?: string[];
  rows?: React.ReactNode[][]; chart?: { k: string; v: number }[]; aiNote?: string;
}) {
  return (
    <div className="content fade-up">
      {kpis && <div className="kpi-grid">{kpis.map((k, i) => <KPI key={i} {...k} />)}</div>}
      {chart && (
        <div className="card pad-lg">
          <div className="card-head"><div><div className="card-title">{title}</div><div className="card-sub">{sub}</div></div></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ left: -18, right: 6, top: 6 }}>
                <defs><linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a78bfa" stopOpacity={0.45} /><stop offset="100%" stopColor="#a78bfa" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="k" stroke="#62626e" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#62626e" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip {...chartTooltip} />
                <Area type="monotone" dataKey="v" stroke="#a78bfa" strokeWidth={2.5} fill="url(#gA)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {rows && (
        <div className="card pad-lg">
          <div className="card-head"><div className="card-title">{title}</div></div>
          <table className="tbl"><thead><tr>{tableHead?.map(h => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j === 0 ? "name" : "mono"}>{c}</td>)}</tr>)}</tbody></table>
        </div>
      )}
      {aiNote && (
        <div className="card pad-lg" style={{ background: "linear-gradient(150deg, rgba(124,124,240,0.09), var(--surface))" }}>
          <div className="ai-block-label" style={{ color: "var(--primary-2)" }}><Sparkles size={13} /> AI recommendation</div>
          <p style={{ fontSize: 13.5, color: "var(--text)", lineHeight: 1.5, marginTop: 4 }}>{aiNote}</p>
        </div>
      )}
    </div>
  );
}

const seoChart = [{ k: "W1", v: 4100 }, { k: "W2", v: 4600 }, { k: "W3", v: 5200 }, { k: "W4", v: 6100 }, { k: "W5", v: 6800 }, { k: "W6", v: 7900 }];
const fcChart = [{ k: "Jul", v: 82 }, { k: "Aug", v: 91 }, { k: "Sep", v: 104 }, { k: "Oct", v: 121 }, { k: "Nov", v: 168 }, { k: "Dec", v: 210 }];

/* ---------------- Automations (workflow) ---------------- */
function Automations() {
  const nodes = [
    { type: "trigger", ico: ShoppingCart, c: "var(--emerald)", t: "Customer places order", s: "Trigger" },
    { type: "action", ico: Clock, c: "var(--blue)", t: "Wait 7 days", s: "Delay" },
    { type: "action", ico: Mail, c: "var(--primary-2)", t: "Send review request email", s: "Email · Klaviyo" },
    { type: "cond", ico: AlertTriangle, c: "var(--amber)", t: "If no review submitted", s: "Condition" },
    { type: "action", ico: Mail, c: "var(--primary-2)", t: "Send reminder email", s: "Email · Klaviyo" },
    { type: "cond", ico: Users, c: "var(--amber)", t: "If customer inactive 30 days", s: "Condition" },
    { type: "action", ico: Zap, c: "var(--pink)", t: "Send 10% loyalty coupon", s: "Offer" },
  ];
  return (
    <div className="content fade-up">
      <div className="card pad-lg">
        <div className="card-head"><div><div className="card-title">Post-Purchase Review &amp; Retention</div><div className="card-sub">Active · 2,140 customers in flow · 31% review rate</div></div>
          <div style={{ display: "flex", gap: 8 }}><Badge kind="up">Active</Badge><button className="btn ghost"><Plus size={14} /> Add step</button></div></div>
        <div className="wf" style={{ paddingTop: 12 }}>
          {nodes.map((n, i) => (
            <React.Fragment key={i}>
              <div className={`wf-node ${n.type}`}>
                <div className="wf-node-ico" style={{ background: `${n.c}22`, color: n.c }}><n.ico size={17} /></div>
                <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{n.t}</div><div style={{ fontSize: 11, color: "var(--mute)" }}>{n.s}</div></div>
                {n.type === "trigger" && <span className="badge up" style={{ marginLeft: "auto" }}>Start</span>}
              </div>
              {i < nodes.length - 1 && <div className="wf-conn" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Integrations ---------------- */
const FALLBACK_INTEGRATIONS: Integration[] = [
  { provider: "SHOPIFY", name: "Shopify", desc: "Store · orders · products", status: "CONNECTED", lastSyncedAt: null, hasDataConnector: true },
  { provider: "GA4", name: "Google Analytics 4", desc: "Traffic · behavior", status: "CONNECTED", lastSyncedAt: null, hasDataConnector: false },
  { provider: "META_ADS", name: "Meta Ads", desc: "Campaigns · spend", status: "AVAILABLE", lastSyncedAt: null, hasDataConnector: false },
  { provider: "GOOGLE_ADS", name: "Google Ads", desc: "Campaigns · spend", status: "AVAILABLE", lastSyncedAt: null, hasDataConnector: false },
  { provider: "KLAVIYO", name: "Klaviyo", desc: "Email · flows", status: "AVAILABLE", lastSyncedAt: null, hasDataConnector: false },
];

function Integrations() {
  const [items, setItems] = useState<Integration[]>(FALLBACK_INTEGRATIONS);
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => fetchIntegrations().then(list => { if (list) { setItems(list); setLive(true); } });
  useEffect(() => { load(); }, []);

  const act = async (provider: string, kind: "connect" | "sync") => {
    setBusy(provider);
    setItems(prev => prev.map(i => i.provider === provider ? { ...i, status: "SYNCING" } : i));
    await (kind === "connect" ? connectIntegration(provider) : syncIntegration(provider));
    await load();
    setBusy(null);
  };

  return (
    <div className="content fade-up">
      <div className="section-label" style={{ marginBottom: -6 }}>
        <Plug size={15} className="accent" /> Data sources
        <span className={`badge ${live ? "up" : "neutral"}`} style={{ marginLeft: "auto" }}>{live ? "● Live" : "○ Demo"}</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))" }}>
        {items.map(it => {
          const color = it.status === "CONNECTED" ? "var(--emerald)" : it.status === "SYNCING" ? "var(--amber)" : it.status === "ERROR" ? "var(--red)" : "var(--mute)";
          const isBusy = busy === it.provider || it.status === "SYNCING";
          return (
            <div key={it.provider} className="card" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", display: "grid", placeItems: "center", color }}><Globe size={20} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 650 }}>{it.name}</div>
                <div style={{ fontSize: 11.5, color: "var(--mute)" }}>
                  {it.status === "CONNECTED" ? (it.hasDataConnector ? "Connected · syncing data" : "Connected") : it.desc}
                </div>
              </div>
              {isBusy && <RefreshCw size={15} style={{ color: "var(--amber)", animation: "spin 1.4s linear infinite" }} />}
              {!isBusy && it.status === "CONNECTED" && (
                <button className="btn ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => act(it.provider, "sync")}>Sync</button>
              )}
              {!isBusy && it.status === "AVAILABLE" && (
                <button className="btn" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => act(it.provider, "connect")}>Connect</button>
              )}
              {!isBusy && it.status === "ERROR" && (
                <button className="btn" style={{ padding: "5px 10px", fontSize: 12, borderColor: "var(--red)", color: "var(--red)" }} onClick={() => act(it.provider, "connect")}>Reconnect</button>
              )}
            </div>
          );
        })}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

/* ---------------- Reports ---------------- */
function Reports() {
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const r = await fetchReportSummary();
    setReport(
      r ?? {
        store: "Northwind Goods", period: "Last 30 days", generatedAt: new Date().toISOString(),
        headlineKpis: [
          { label: "Revenue", value: "$81.2k", delta: "18%", kind: "up" },
          { label: "Profit", value: "$29.4k", delta: "14%", kind: "up" },
          { label: "ROAS", value: "3.8x", delta: "12%", kind: "down" },
        ],
        narrative: "Revenue reached $81.2k (+18%) driven by strong weekend paid and email performance. Blended ROAS held at 4.6x despite a Meta dip. Aurora Buds emerged as the breakout product; Flux Bottle inventory needs attention.",
        insights: [], source: "demo",
      }
    );
    setLoading(false);
  };

  return (
    <div className="content fade-up">
      <div className="card pad-lg">
        {!report ? (
          <div className="state-box">
            <div className="state-ico"><FileText size={26} style={{ color: "var(--dim)" }} /></div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>No reports yet</div>
            <div style={{ fontSize: 13, color: "var(--dim)", maxWidth: 360 }}>Generate an executive summary of your store's performance as a PDF — written from your connected store data.</div>
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button className="btn primary" onClick={generate} disabled={loading}>
                {loading ? <RefreshCw size={14} style={{ animation: "spin 1.4s linear infinite" }} /> : <Sparkles size={14} />} {loading ? "Generating…" : "Generate report"}
              </button>
            </div>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            <div className="card-head">
              <div>
                <div className="card-title">Executive Summary — {report.period}</div>
                <div className="card-sub">Auto-generated · {report.source === "live" ? "live data" : "demo data"} · {new Date(report.generatedAt).toLocaleString()}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a className="btn primary" style={{ padding: "6px 12px", fontSize: 12 }} href={reportPdfUrl()} target="_blank" rel="noreferrer"><Download size={13} /> PDF</a>
                <button className="btn ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={generate}><RefreshCw size={13} /> Refresh</button>
              </div>
            </div>
            <div className="kpi-grid" style={{ marginBottom: 16 }}>
              {report.headlineKpis.map((k, i) => (
                <div key={i} className="kpi">
                  <div className="kpi-label">{k.label}</div>
                  <div className="kpi-value mono" style={{ fontSize: 22 }}>{k.value}</div>
                  <Badge kind={k.kind}>{k.kind === "up" ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{k.delta}</Badge>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--dim)" }}>{report.narrative}</p>
            {report.insights.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="ai-block-label" style={{ color: "var(--primary-2)" }}><Sparkles size={13} /> AI recommendations</div>
                {report.insights.map((ins, i) => (
                  <div key={i} className="action-row">
                    <span style={{ fontSize: 13, flex: 1 }}><b>{ins.title}</b> — {ins.body}</span>
                    {ins.confidence > 0 && <span className="badge pri">{ins.confidence}%</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Settings ---------------- */
function SettingsPage() {
  const [dark, setDark] = useState(true);
  return (
    <div className="content fade-up" style={{ maxWidth: 720 }}>
      {[
        { t: "Workspace", rows: [["Store name", "Northwind Goods"], ["Plan", "Growth · $199/mo"], ["Members", "6 seats"]] },
        { t: "Preferences", rows: [["Currency", "USD ($)"], ["Timezone", "America/New_York"], ["Morning briefing", "8:00 AM daily"]] },
      ].map(sec => (
        <div className="card pad-lg" key={sec.t}>
          <div className="card-title" style={{ marginBottom: 6 }}>{sec.t}</div>
          {sec.rows.map(([k, v], i) => (
            <div key={k} style={{ display: "flex", alignItems: "center", padding: "13px 0", borderTop: i ? "1px solid var(--border)" : "none" }}>
              <span style={{ fontSize: 13.5, color: "var(--dim)" }}>{k}</span>
              <span className="mono" style={{ marginLeft: "auto", fontSize: 13 }}>{v}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="card pad-lg">
        <div className="card-title" style={{ marginBottom: 6 }}>Appearance</div>
        <div style={{ display: "flex", alignItems: "center", padding: "13px 0" }}>
          <span style={{ fontSize: 13.5, color: "var(--dim)" }}>Dark mode</span>
          <button onClick={() => setDark(!dark)} style={{ marginLeft: "auto", width: 44, height: 24, borderRadius: 20, border: "none", cursor: "pointer", background: dark ? "var(--primary)" : "var(--surface-3)", position: "relative", transition: "background .2s" }}>
            <span style={{ position: "absolute", top: 3, left: dark ? 23 : 3, width: 18, height: 18, borderRadius: 18, background: "#fff", transition: "left .2s" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Inventory (live) ---------------- */
function Inventory() {
  const [products, setProducts] = useState<typeof topProducts>([]);
  useEffect(() => { fetchProducts().then(p => setProducts((p as typeof topProducts) ?? [])); }, []);
  const list = products.length ? products : topProducts;
  const inStock = list.filter(p => p.stock > 0).length;
  const lowStock = list.filter(p => p.stock > 0 && p.stock < 20).length;
  const outStock = list.filter(p => p.stock === 0).length;
  const status = (s: number) => (s === 0 ? { t: "Out of stock", k: "down" } : s < 20 ? { t: "Low — restock", k: "warn" } : { t: "OK", k: "up" });
  const stats = [
    { label: "Products", value: list.length, color: "var(--blue)", icon: Boxes },
    { label: "In Stock", value: inStock, color: "var(--emerald)", icon: Flame },
    { label: "Low Stock", value: lowStock, color: "var(--amber)", icon: AlertTriangle },
    { label: "Out of Stock", value: outStock, color: "var(--red)", icon: Package },
  ];
  return (
    <div className="content fade-up">
      <div className="kpi-grid">
        {stats.map((k, i) => (
          <div key={i} className="kpi">
            <div className="kpi-top"><div className="kpi-ico" style={{ background: `${k.color}22`, color: k.color }}><k.icon size={16} /></div></div>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value mono">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="card pad-lg">
        <div className="card-head"><div><div className="card-title">Inventory Health</div><div className="card-sub">Stock levels from your connected store</div></div></div>
        <table className="tbl">
          <thead><tr><th>Product</th><th>Stock</th><th>Units sold</th><th>Revenue</th><th>Status</th></tr></thead>
          <tbody>
            {list.map(p => {
              const st = status(p.stock);
              return (
                <tr key={p.name}>
                  <td className="name">{p.name}</td>
                  <td className="mono" style={{ color: p.stock < 20 ? "var(--red)" : "var(--dim)" }}>{p.stock}</td>
                  <td className="mono">{p.orders}</td>
                  <td className="mono">{p.rev}</td>
                  <td><Badge kind={st.k}>{st.t}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Command bar ---------------- */
function CommandBar({ open, setOpen, go }: { open: boolean; setOpen: (v: boolean) => void; go: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [hl, setHl] = useState(0);
  const items = useMemo(() => NAV.filter(n => n.label.toLowerCase().includes(q.toLowerCase())), [q]);
  useEffect(() => { setHl(0); }, [q]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setHl(i => Math.min(i + 1, items.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setHl(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && items[hl]) { go(items[hl].id); setOpen(false); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [open, items, hl, go, setOpen]);
  if (!open) return null;
  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)}>
      <div className="cmd" onClick={e => e.stopPropagation()}>
        <div className="cmd-input"><Command size={18} style={{ color: "var(--mute)" }} />
          <input autoFocus placeholder="Search or jump to…" value={q} onChange={e => setQ(e.target.value)} />
          <span className="kbd">ESC</span></div>
        <div className="cmd-list">
          {items.map((it, i) => (
            <div key={it.id} className={`cmd-item ${i === hl ? "hl" : ""}`} onClick={() => { go(it.id); setOpen(false); }} onMouseEnter={() => setHl(i)}>
              <it.icon size={16} /> {it.label} <ChevronRight size={14} style={{ marginLeft: "auto", opacity: .5 }} />
            </div>
          ))}
          {items.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--mute)", fontSize: 13 }}>No matches</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Root ---------------- */
export default function GrowthOS() {
  const [active, setActive] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [cmd, setCmd] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [today, setToday] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [wsId, setWsId] = useState("demo-workspace");
  const [wsOpen, setWsOpen] = useState(false);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }));
    fetchMe().then(m => { if (m) { setMe(m); setWsId(m.currentWorkspaceId); setWorkspace(m.currentWorkspaceId); } });
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  const switchWs = (id: string) => {
    setWorkspace(id); setWsId(id); setWsOpen(false);
    go(active); // reload the active screen against the new workspace
  };
  const currentWsName = me?.workspaces.find(w => w.id === wsId)?.name ?? "Northwind Goods";
  const wsInitials = currentWsName.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setCmd(v => !v); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  const go = (id: string) => { setLoading(true); setActive(id); setSideOpen(false); setTimeout(() => setLoading(false), id === "dashboard" ? 700 : 350); };

  const cur = NAV.find(n => n.id === active);
  const groups = [["main", "Overview"], ["intel", "Intelligence"], ["ops", "Operations"]];

  const screen = () => {
    if (loading) return <Skeleton />;
    switch (active) {
      case "dashboard": return <Dashboard go={go} />;
      case "assistant": return <AIAssistant />;
      case "products": return <Products />;
      case "customers": return <Customers />;
      case "marketing": return <Marketing />;
      case "automations": return <Automations />;
      case "integrations": return <Integrations />;
      case "reports": return <Reports />;
      case "settings": return <SettingsPage />;
      case "revenue": return <MetricScreen title="Revenue" sub="Daily net revenue trend"
        kpis={[{ icon: DollarSign, label: "MRR-equiv", value: "$81.2k", delta: "18%", kind: "up", color: "var(--emerald)" }, { icon: Wallet, label: "Net Profit", value: "$29.4k", delta: "14%", kind: "up", color: "var(--emerald)" }, { icon: Percent, label: "Net Margin", value: "36%", delta: "2%", kind: "up", color: "var(--primary-2)" }, { icon: DollarSign, label: "AOV", value: "$41.8", delta: "3%", kind: "up", color: "var(--blue)" }]}
        chart={revenueData.map(r => ({ k: r.d, v: r.rev }))}
        aiNote="Weekend accounts for 58% of weekly revenue. Concentrate ad budget Thu–Sun and schedule the abandoned-cart flow for Friday evenings to capture peak intent." />;
      case "seo": return <MetricScreen title="Organic Clicks" sub="Search Console · trending up"
        kpis={[{ icon: SearchIcon, label: "Clicks", value: "7.9k", delta: "22%", kind: "up", color: "var(--emerald)" }, { icon: Percent, label: "CTR", value: "3.8%", delta: "5%", kind: "up", color: "var(--primary-2)" }, { icon: Activity, label: "Impressions", value: "208k", delta: "17%", kind: "up", color: "var(--blue)" }, { icon: TrendingUp, label: "Avg Position", value: "8.4", delta: "1.2", kind: "up", color: "var(--purple)" }]}
        chart={seoChart} tableHead={["Keyword", "Clicks", "CTR", "Position", "Change"]}
        rows={[["wireless earbuds", "1,240", "4.1%", "3.2", "▲ 2"], ["running hoodie", "890", "3.6%", "5.8", "▲ 4"], ["smart water bottle", "610", "2.9%", "9.1", "▼ 1"], ["desk lamp led", "540", "3.3%", "6.4", "▲ 3"]]}
        aiNote="You rank #9 for 'smart water bottle' (lost 1 position). A comparison guide targeting this term could recover ~640 clicks/mo — competitor RivalCo added long-form content here last week." />;
      case "email": return <MetricScreen title="Email Revenue" sub="Klaviyo · campaigns + flows"
        kpis={[{ icon: DollarSign, label: "Email Revenue", value: "$22.6k", delta: "16%", kind: "up", color: "var(--emerald)" }, { icon: Mail, label: "Open Rate", value: "38%", delta: "3%", kind: "up", color: "var(--primary-2)" }, { icon: Target, label: "Click Rate", value: "6.2%", delta: "1%", kind: "up", color: "var(--blue)" }, { icon: TrendingDown, label: "Unsub Rate", value: "0.3%", delta: "0.1%", kind: "down", color: "var(--red)" }]}
        tableHead={["Flow", "Revenue", "Open", "Click", "Status"]}
        rows={[["Abandoned Cart", "$8,400", "44%", "9.1%", "Active"], ["Welcome Flow", "$6,100", "52%", "8.4%", "Active"], ["Win-back", "$3,200", "31%", "4.2%", "Active"], ["Post-Purchase", "$4,900", "48%", "7.0%", "Active"]]}
        aiNote="Your abandoned-cart flow drives $8.4k but stops after one email. Adding a second reminder at 24h with a small incentive typically lifts flow revenue 20–30%." />;
      case "inventory": return <Inventory />;
      case "forecasting": return <MetricScreen title="Revenue Forecast" sub="AI projection · next 6 months (95% interval)"
        kpis={[{ icon: TrendingUp, label: "Q4 Revenue (proj)", value: "$483k", delta: "31%", kind: "up", color: "var(--emerald)" }, { icon: ShoppingCart, label: "Orders (proj)", value: "11.4k", delta: "24%", kind: "up", color: "var(--primary-2)" }, { icon: Users, label: "New Customers", value: "4.2k", delta: "19%", kind: "up", color: "var(--purple)" }, { icon: Wallet, label: "Ad Budget (rec)", value: "$78k", delta: "12%", kind: "up", color: "var(--blue)" }]}
        chart={fcChart}
        aiNote="Model projects a Nov–Dec surge (+68% MoM) driven by seasonality. To hit the forecast, pre-commit inventory for your top 5 SKUs by mid-October and stage holiday creative now." />;
      default: return <Dashboard go={go} />;
    }
  };

  return (
    <div className="gos">
      <style>{STYLES}</style>
      <div className="app">
        <div className={`overlay-bg ${sideOpen ? "show" : ""}`} onClick={() => setSideOpen(false)} />
        <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
          <div className="brand">
            <div className="brand-logo"><Cpu size={19} color="#fff" /></div>
            <div><div className="brand-name">Growlytics AI</div><div className="brand-tag">AI Growth Manager</div></div>
          </div>
          {groups.map(([g, lbl]) => (
            <div key={g}>
              <div className="nav-group-label">{lbl}</div>
              {NAV.filter(n => n.group === g).map(n => (
                <div key={n.id} className={`nav-item ${active === n.id ? "active" : ""}`} onClick={() => go(n.id)}>
                  <n.icon size={17} /> {n.label}
                  {n.badge && <span className="nav-badge">{n.badge}</span>}
                </div>
              ))}
            </div>
          ))}
          <div style={{ marginTop: "auto", padding: 10 }}>
            <div className="card" style={{ padding: 14, background: "linear-gradient(150deg, rgba(124,124,240,0.14), var(--surface))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 650 }}><Sparkles size={14} style={{ color: "var(--purple)" }} /> Growth plan</div>
              <div style={{ fontSize: 11.5, color: "var(--dim)", marginTop: 5, lineHeight: 1.4 }}>3 high-impact actions ready for this week.</div>
              <button className="btn primary" style={{ marginTop: 10, width: "100%", justifyContent: "center", fontSize: 12, padding: "7px" }} onClick={() => go("assistant")}>Review plan</button>
            </div>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <button className="icon-btn mobile-only" onClick={() => setSideOpen(true)}><Menu size={18} /></button>
            <div>
              <div className="page-title">{cur?.label}</div>
              <div className="page-sub">{currentWsName} · {today}</div>
            </div>
            <div className="searchbar" onClick={() => setCmd(true)}>
              <SearchIcon size={15} /> Search or ask… <span className="kbd">⌘K</span>
            </div>
            {me && me.workspaces.length > 0 && (
              <div style={{ position: "relative" }}>
                <button className="btn ghost" style={{ padding: "8px 12px", fontSize: 13 }} onClick={() => setWsOpen(o => !o)}>
                  <Boxes size={15} /> {currentWsName}
                  <ChevronRight size={13} style={{ transform: "rotate(90deg)", opacity: 0.6 }} />
                </button>
                {wsOpen && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setWsOpen(false)} />
                    <div style={{ position: "absolute", right: 0, top: "116%", zIndex: 50, minWidth: 210, background: "var(--surface)", border: "1px solid var(--border-2)", borderRadius: 10, boxShadow: "var(--shadow)", overflow: "hidden" }}>
                      <div style={{ padding: "8px 12px", fontSize: 10, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--mute)", fontWeight: 700 }}>Workspaces</div>
                      {me.workspaces.map(w => (
                        <div key={w.id} onClick={() => switchWs(w.id)} style={{ padding: "10px 12px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: w.id === wsId ? "var(--surface-2)" : "transparent", color: w.id === wsId ? "#fff" : "var(--dim)" }}>
                          <span style={{ width: 7, height: 7, borderRadius: 7, background: w.id === wsId ? "var(--emerald)" : "var(--mute)" }} />
                          {w.name}
                          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--mute)" }}>{w.role}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <button className="icon-btn"><Bell size={18} /><span className="dot" /></button>
            <div className="avatar" title={me?.user.email}>{wsInitials}</div>
          </div>
          <div key={wsId} style={{ display: "contents" }}>{screen()}</div>
        </div>
      </div>

      <button className="fab" onClick={() => go("assistant")} title="Ask Growth Assistant"><Sparkles size={24} color="#fff" /></button>
      <CommandBar open={cmd} setOpen={setCmd} go={go} />
    </div>
  );
}
