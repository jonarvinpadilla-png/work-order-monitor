:root{
  --bg:#1E2226; --shell-bg:#1E2226; --surface:#262B30; --surface-raised:#2E343A; --border:#383F45;
  --text:#ECEFF1; --text-dim:#8B96A0; --text-mute:#5C656C;
  --teal:#4FB8AE; --teal-dim:rgba(79,184,174,.16);
  --rust:#C97A4A; --rust-dim:rgba(201,122,74,.16);
  --violet:#8D7FD6; --violet-dim:rgba(141,127,214,.16);
  --amber:#E8A33D; --amber-dim:rgba(232,163,61,.16);
  --orange:#E2793D; --orange-dim:rgba(226,121,61,.16);
  --red:#E2543D; --red-dim:rgba(226,84,61,.18);
  --green:#6FBF73; --green-dim:rgba(111,191,115,.16);
  --slate:#7C8894; --slate-dim:rgba(124,136,148,.16);
  --muted:#5A6167; --muted-dim:rgba(90,97,103,.28);
  --font-display:'Oswald',sans-serif; --font-body:'IBM Plex Sans',sans-serif; --font-mono:'IBM Plex Mono',monospace;
}
*{ box-sizing:border-box; }
html,body,#root{ height:100%; }
body{ margin:0; background:var(--bg); color:var(--text); font-family:var(--font-body); -webkit-font-smoothing:antialiased; }

.app-shell{ max-width:1280px; margin:0 auto; padding:24px 28px 40px; }

/* Auth screen */
.auth-screen{ min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
.auth-card{ background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:32px; width:100%; max-width:380px; }
.auth-brand{ display:flex; align-items:center; gap:10px; margin-bottom:22px; }
.auth-brand .mark{ width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:var(--teal-dim); color:var(--teal); border-radius:8px; }
.auth-brand .mark svg{ width:20px; height:20px; }
.auth-brand h1{ font-family:var(--font-display); font-size:19px; margin:0; text-transform:uppercase; letter-spacing:.02em; }
.auth-card label{ display:flex; flex-direction:column; gap:5px; font-size:12.5px; color:var(--text-dim); font-weight:600; margin-bottom:14px; }
.auth-card input{ background:var(--bg); border:1px solid var(--border); border-radius:6px; padding:9px 11px; color:var(--text); font-size:13.5px; }
.auth-toggle{ text-align:center; margin-top:14px; font-size:12.5px; color:var(--text-dim); }
.auth-toggle button{ background:none; border:none; color:var(--teal); cursor:pointer; font-weight:600; padding:0; text-decoration:underline; }
.auth-error{ background:var(--red-dim); color:var(--red); border-radius:6px; padding:8px 10px; font-size:12.5px; margin-bottom:14px; }
.auth-note{ background:var(--teal-dim); color:var(--teal); border-radius:6px; padding:8px 10px; font-size:12.5px; margin-bottom:14px; }

/* Header */
.app-header{ display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; margin-bottom:6px; }
.app-brand{ display:flex; gap:12px; align-items:center; }
.app-mark{ width:38px; height:38px; flex:none; display:flex; align-items:center; justify-content:center; background:var(--teal-dim); color:var(--teal); border-radius:8px; }
.app-mark svg{ width:22px; height:22px; }
.app-header h1{ font-family:var(--font-display); font-size:21px; margin:0; letter-spacing:.02em; text-transform:uppercase; }
.app-tagline{ margin:3px 0 0; font-size:11.5px; color:var(--text-dim); font-family:var(--font-mono); letter-spacing:.03em; }
.app-header-actions{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.session-pill{ font-size:11.5px; color:var(--text-dim); font-family:var(--font-mono); margin-right:4px; }

/* Buttons */
.btn{ display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:6px; border:1px solid transparent; font-family:var(--font-body); font-weight:600; font-size:13px; cursor:pointer; transition:background .15s,border-color .15s; }
.btn svg{ width:14px; height:14px; }
.btn-primary{ background:var(--teal); border-color:var(--teal); color:#0F1315; }
.btn-primary:hover{ background:#5fc7bd; }
.btn-ghost{ background:transparent; border-color:var(--border); color:var(--text); }
.btn-ghost:hover{ background:var(--surface-raised); }
.btn-text{ background:none; border:none; color:var(--text-dim); text-decoration:underline; padding:6px 4px; font-weight:500; cursor:pointer; }
.ibtn{ width:28px; height:28px; display:inline-flex; align-items:center; justify-content:center; border-radius:6px; background:transparent; border:1px solid var(--border); color:var(--text-dim); cursor:pointer; transition:background .15s,color .15s,border-color .15s; }
.ibtn svg{ width:14px; height:14px; }
.ibtn:hover{ background:var(--surface-raised); color:var(--text); }
.ibtn-danger:hover{ background:var(--red-dim); color:var(--red); border-color:var(--red); }
button:disabled{ opacity:.55; cursor:not-allowed; }

/* KPIs */
.kpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:20px 0; }
.kpi{ background:var(--surface); border:1px solid var(--border); border-left:3px solid var(--kc); border-radius:8px; padding:12px 16px; display:flex; flex-direction:column; gap:3px; }
.kpi-teal{ --kc:var(--teal); } .kpi-red{ --kc:var(--red); } .kpi-green{ --kc:var(--green); } .kpi-slate{ --kc:var(--slate); }
.kpi-label{ font-family:var(--font-mono); font-size:10.5px; text-transform:uppercase; letter-spacing:.06em; color:var(--text-dim); }
.kpi-value{ font-family:var(--font-display); font-size:27px; font-weight:600; color:var(--kc); }
@media (max-width:720px){ .kpis{ grid-template-columns:repeat(2,1fr); } }

/* Controls */
.controls{ display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
.tabs{ display:flex; gap:3px; background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:3px; }
.tab{ padding:7px 14px; border-radius:6px; border:none; background:transparent; color:var(--text-dim); font-family:var(--font-body); font-weight:600; font-size:13px; cursor:pointer; }
.tab.active{ background:var(--teal-dim); color:var(--teal); }
.filters{ display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.filters input, .filters select{ background:var(--surface); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:7px 10px; font-family:var(--font-body); font-size:12.5px; }
.filters input{ width:190px; }
.filters input::placeholder{ color:var(--text-mute); }

/* Board */
.board{ display:flex; gap:14px; overflow-x:auto; padding-bottom:6px; }
.board-col{ flex:1 1 240px; min-width:236px; }
.board-col-head{ display:flex; justify-content:space-between; align-items:center; padding:9px 11px; border-radius:7px 7px 0 0; font-family:var(--font-display); text-transform:uppercase; letter-spacing:.04em; font-size:12px; font-weight:600; background:var(--surface); border:1px solid var(--border); border-bottom:none; color:var(--sc); }
.status-amber{ --sc:var(--amber); } .status-teal{ --sc:var(--teal); } .status-slate{ --sc:var(--slate); } .status-green{ --sc:var(--green); } .status-muted{ --sc:var(--muted); }
.board-col-head .count{ background:rgba(255,255,255,.08); color:var(--text-dim); padding:1px 8px; border-radius:999px; font-family:var(--font-mono); font-size:10.5px; }
.board-col-body{ background:var(--bg); border:1px solid var(--border); border-top:none; border-radius:0 0 8px 8px; padding:14px 10px 16px; display:flex; flex-direction:column; gap:14px; min-height:70px; }
.empty-mini{ font-size:12px; color:var(--text-mute); font-style:italic; padding:6px 2px; }

/* Work order card */
.wo-card{ position:relative; margin-top:9px; background:var(--surface); border:1px solid var(--border); border-left:4px solid var(--tc); border-radius:8px; transition:transform .15s ease,border-color .15s ease; }
.wo-card:hover{ transform:translateY(-2px); border-color:var(--text-mute); }
.type-teal{ --tc:var(--teal); } .type-rust{ --tc:var(--rust); } .type-violet{ --tc:var(--violet); }
.wo-hole{ position:absolute; top:-7px; left:15px; width:13px; height:13px; border-radius:50%; background:var(--bg); border:2px solid var(--border); }
.wo-card-head{ display:flex; justify-content:space-between; align-items:center; padding:9px 11px; border-bottom:1px dashed var(--border); }
.wo-id{ font-family:var(--font-mono); font-size:11px; color:var(--text-dim); letter-spacing:.02em; }
.wo-card-body{ padding:10px 11px 11px; display:flex; flex-direction:column; gap:7px; }
.wo-title{ font-family:var(--font-display); font-size:14.5px; font-weight:600; margin:0; line-height:1.28; color:var(--text); }
.wo-meta{ font-size:11.5px; color:var(--text-dim); display:flex; gap:4px; flex-wrap:wrap; }
.wo-tags{ display:flex; gap:6px; flex-wrap:wrap; }
.wo-foot{ display:flex; justify-content:space-between; align-items:center; font-size:11.5px; color:var(--text-dim); margin-top:1px; }
.wo-due.overdue{ color:var(--red); font-weight:600; }
.wo-actions{ display:flex; gap:6px; padding-top:7px; border-top:1px solid var(--border); margin-top:2px; }

/* Chips */
.chip{ display:inline-flex; align-items:center; padding:3px 9px; border-radius:999px; font-size:11px; font-weight:600; letter-spacing:.02em; white-space:nowrap; background:var(--cd); color:var(--cc); }
.chip-sm{ padding:2px 7px; font-size:10px; }
.chip-teal{ --cd:var(--teal-dim); --cc:var(--teal); } .chip-rust{ --cd:var(--rust-dim); --cc:var(--rust); } .chip-violet{ --cd:var(--violet-dim); --cc:var(--violet); }
.chip-amber{ --cd:var(--amber-dim); --cc:var(--amber); } .chip-orange{ --cd:var(--orange-dim); --cc:var(--orange); } .chip-red{ --cd:var(--red-dim); --cc:var(--red); }
.chip-green{ --cd:var(--green-dim); --cc:var(--green); } .chip-slate{ --cd:var(--slate-dim); --cc:var(--slate); } .chip-muted{ --cd:var(--muted-dim); --cc:var(--text-dim); }

/* Table */
.table-wrap{ overflow-x:auto; border:1px solid var(--border); border-radius:8px; }
.wo-table{ width:100%; border-collapse:collapse; font-size:12.5px; min-width:860px; }
.wo-table thead th{ text-align:left; padding:10px 12px; background:var(--surface); font-family:var(--font-mono); font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-dim); cursor:pointer; user-select:none; border-bottom:1px solid var(--border); white-space:nowrap; }
.wo-table thead th.sorted{ color:var(--teal); }
.sort-arrow{ display:inline-block; width:8px; }
.wo-table tbody td{ padding:9px 12px; border-bottom:1px solid var(--border); color:var(--text); vertical-align:middle; }
.wo-table tbody tr:last-child td{ border-bottom:none; }
.wo-table tbody tr:hover{ background:var(--surface); }
.wo-table td.mono{ font-family:var(--font-mono); color:var(--text-dim); font-size:11.5px; }
.row-actions{ display:flex; gap:4px; justify-content:flex-end; }

/* Dashboard */
.dash-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.dash-wide{ grid-column:1 / -1; }
@media (max-width:800px){ .dash-grid{ grid-template-columns:1fr; } }
.dash-card{ background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:16px; }
.dash-card h3{ margin:0 0 13px; font-family:var(--font-display); font-size:13px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-dim); font-weight:600; }
.bar-row{ display:grid; grid-template-columns:118px 1fr 26px; align-items:center; gap:8px; margin-bottom:9px; font-size:12px; }
.bar-row:last-child{ margin-bottom:0; }
.bar-label{ color:var(--text-dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.bar-track{ height:8px; background:var(--bg); border-radius:999px; overflow:hidden; }
.bar-fill{ height:100%; border-radius:999px; }
.fill-teal{background:var(--teal);} .fill-rust{background:var(--rust);} .fill-violet{background:var(--violet);}
.fill-amber{background:var(--amber);} .fill-orange{background:var(--orange);} .fill-red{background:var(--red);}
.fill-green{background:var(--green);} .fill-slate{background:var(--slate);} .fill-muted{background:var(--muted);}
.bar-count{ text-align:right; font-family:var(--font-mono); color:var(--text-dim); }
.load-meter{ display:flex; height:14px; border-radius:999px; overflow:hidden; background:var(--bg); margin-bottom:12px; }
.load-legend{ display:flex; gap:14px; flex-wrap:wrap; font-size:11.5px; color:var(--text-dim); }
.legend-item{ display:inline-flex; align-items:center; gap:5px; }
.dot{ width:8px; height:8px; border-radius:50%; display:inline-block; }
.dot-teal{background:var(--teal);} .dot-rust{background:var(--rust);} .dot-violet{background:var(--violet);}
.dot-amber{background:var(--amber);} .dot-orange{background:var(--orange);} .dot-red{background:var(--red);}
.dot-green{background:var(--green);} .dot-slate{background:var(--slate);} .dot-muted{background:var(--muted);}
.upcoming-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
.upcoming-list li{ display:flex; align-items:center; gap:10px; font-size:12.5px; padding:8px 10px; background:var(--bg); border:1px solid var(--border); border-radius:6px; }
.upcoming-code{ font-family:var(--font-mono); color:var(--text-dim); font-size:11px; }
.upcoming-title{ flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.muted-note{ color:var(--text-mute); font-size:12.5px; margin:0; }

/* Modal */
.modal-backdrop{ position:fixed; inset:0; background:rgba(8,10,12,.62); display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px; }
.modal{ background:var(--shell-bg); border:1px solid var(--border); border-radius:10px; width:100%; max-width:560px; max-height:88vh; overflow-y:auto; padding:20px 22px 22px; }
.modal-head{ display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.modal-head h2{ font-family:var(--font-display); font-size:17px; margin:0; text-transform:uppercase; letter-spacing:.02em; }
.form-row{ margin-bottom:12px; display:flex; flex-direction:column; }
.form-row label, .form-grid label{ display:flex; flex-direction:column; gap:5px; font-size:12px; color:var(--text-dim); font-weight:600; }
.form-row input, .form-row textarea, .form-grid input, .form-grid select{ margin-top:1px; background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text); font-family:var(--font-body); font-size:13px; }
.form-row textarea{ resize:vertical; font-family:var(--font-body); }
.form-grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }
@media (max-width:520px){ .form-grid{ grid-template-columns:1fr; } }
.req{ color:var(--red); }
.form-actions{ display:flex; justify-content:flex-end; gap:10px; margin-top:14px; padding-top:14px; border-top:1px solid var(--border); }

/* Toast */
.toast{ position:fixed; bottom:20px; right:20px; background:var(--surface-raised); border:1px solid var(--border); color:var(--text); padding:10px 16px; border-radius:8px; font-size:12.5px; box-shadow:0 8px 24px rgba(0,0,0,.35); z-index:1100; }
.toast-error{ border-color:var(--red); color:var(--red); }

/* Empty / loading */
.empty-state{ text-align:center; padding:52px 20px; color:var(--text-dim); }
.empty-title{ font-family:var(--font-display); font-size:17px; color:var(--text); margin:0 0 6px; text-transform:uppercase; letter-spacing:.02em; }
.empty-sub{ font-size:12.5px; margin:0 0 16px; }
.loading-state{ padding:52px; text-align:center; color:var(--text-dim); font-size:12.5px; font-family:var(--font-mono); }

/* Footer */
.app-footer{ margin-top:22px; padding-top:14px; border-top:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:11px; color:var(--text-mute); font-family:var(--font-mono); }

button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible{ outline:2px solid var(--teal); outline-offset:2px; }

@media (max-width:640px){
  .app-shell{ padding:18px 16px; }
  .app-header-actions{ width:100%; }
  .controls{ flex-direction:column; align-items:stretch; }
  .filters input{ width:auto; flex:1; }
}
