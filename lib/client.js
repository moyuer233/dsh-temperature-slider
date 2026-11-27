/**
 * dsh-temperature-slider — 客户端半边
 *
 * 在输入栏右侧（conversation.input.right）加一个「采样」按钮，点开是温度滑杆。
 * 值通过 ctx.remote.settings 落到宿主插件条目的 config，宿主再用 agent/request 钩子生效。
 *
 * 三条纪律：
 *   1. 注册失败只意味着这块控件不出现，绝不连累输入区。
 *   2. 读写设置任何一步失败都 fail-open：面板照常能拖，只是状态栏提示没存上。
 *   3. 不碰官方 DOM、不注入消息、不改会话事件。
 */
window.__ModuleLoader__.load({
  id: "dsh-temperature-slider",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");
    var ReactDOM = require("react-dom");

    /** 设置命名空间 = cordis 条目 id（cordis.patch.yml 里的 id） */
    var NS = "temperature-slider";
    var SLOT_NAME = "conversation.input.right";
    var ENTRY_ID = "temperature-slider";
    var ENTRY_ORDER = 30;

    var MIN = 0;
    var MAX = 2;
    var STEP = 0.05;
    var SAVE_DEBOUNCE_MS = 220;

    var CSS = [
      ".tsamp-btn{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#e3e7ee);background:transparent;color:var(--dsw-alias-label-primary,#101828);font-size:12px;line-height:1;cursor:pointer;font-family:inherit}",
      ".tsamp-btn:hover{background:var(--dsw-alias-bg-hover,rgba(16,24,40,.04))}",
      ".tsamp-btn[data-on='1']{border-color:var(--dsw-alias-brand,#3370ff);color:var(--dsw-alias-brand,#3370ff)}",
      ".tsamp-dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.35}",
      ".tsamp-btn[data-on='1'] .tsamp-dot{opacity:1}",
      ".tsamp-panel{position:fixed;z-index:80;width:264px;padding:12px 14px;border-radius:14px;border:1px solid var(--dsw-alias-border-l1,#e3e7ee);background:var(--dsw-alias-bg-base,#fff);box-shadow:0 14px 36px rgba(16,24,40,.18);font-size:12px;line-height:18px;color:var(--dsw-alias-label-primary,#101828);font-family:inherit}",
      ".tsamp-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px}",
      ".tsamp-title{font-weight:600}",
      ".tsamp-val{font-variant-numeric:tabular-nums;font-weight:600;color:var(--dsw-alias-brand,#3370ff)}",
      ".tsamp-range{width:100%;margin:10px 0 4px;accent-color:var(--dsw-alias-brand,#3370ff)}",
      ".tsamp-scale{display:flex;justify-content:space-between;color:var(--dsw-alias-label-secondary,#667085);font-size:11px}",
      ".tsamp-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l1,#e3e7ee)}",
      ".tsamp-toggle{display:inline-flex;align-items:center;gap:6px;cursor:pointer;user-select:none}",
      ".tsamp-hint{color:var(--dsw-alias-label-secondary,#667085);margin-top:8px}",
      ".tsamp-err{color:#b42318;margin-top:6px}"
    ].join("\n");

    function installStyles() {
      try {
        if (typeof document === "undefined") return;
        if (document.getElementById("dsh-temperature-slider-style")) return;
        var el = document.createElement("style");
        el.id = "dsh-temperature-slider-style";
        el.textContent = CSS;
        (document.head || document.documentElement).appendChild(el);
      } catch (e) { /* 样式失败不影响功能 */ }
    }

    /** 把 describe 的各种可能形状统一成数组。 */
    function toRows(response) {
      if (response === undefined || response === null) return null;
      if (Array.isArray(response)) return response;
      if (Array.isArray(response.value)) return response.value;
      if (Array.isArray(response.namespaces)) return response.namespaces;
      if (response.value && Array.isArray(response.value.namespaces)) return response.value.namespaces;
      // 不带信封的直接对象：{ temperature-slider: {...} }
      if (typeof response === "object") {
        var direct = response[NS];
        if (direct !== undefined) return [{ ns: NS, value: direct }];
      }
      return null;
    }

    function rowOf(rows) {
      if (!rows) return null;
      var ns = NS;
      for (var i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        if (row && row.ns === ns) return row;
      }
      return null;
    }

    function valuesOf(row) {
      if (!row) return null;
      var v = row.value !== undefined ? row.value : (row.user !== undefined ? row.user : row.base);
      if (v === undefined || v === null || typeof v !== "object") return null;
      var out = {
        enabled: v.enabled === true,
        temperature: typeof v.temperature === "number" ? v.temperature : 1
      };
      return out;
    }

    function readValues(ctx) {
      return Promise.resolve()
        .then(function () { return ctx.remote.settings.describe(); })
        .then(function (response) { return valuesOf(rowOf(toRows(response))); })
        .catch(function () { return null; });
    }

    function writeValues(ctx, patch) {
      return Promise.resolve()
        .then(function () { return ctx.remote.settings.update(NS, patch, void 0); })
        .then(function (response) {
          if (response && response.ok === false) {
            var e = response.error;
            return (e && e.message) || "保存失败";
          }
          return "";
        })
        .catch(function (error) { return String(error && error.message ? error.message : error); });
    }

    function Sampler(props) {
      var ctx = props.__ctx;

      var stateHook = React.useState({ enabled: false, temperature: 1 });
      var state = stateHook[0];
      var setState = stateHook[1];

      var openHook = React.useState(false);
      var open = openHook[0];
      var setOpen = openHook[1];

      var errHook = React.useState("");
      var err = errHook[0];
      var setErr = errHook[1];

      var btnRef = React.useRef(null);
      var timerRef = React.useRef(null);
      var boxHook = React.useState(null);
      var box = boxHook[0];
      var setBox = boxHook[1];

      React.useEffect(function () {
        var alive = true;
        readValues(ctx).then(function (values) {
          if (alive && values) setState(values);
        });
        return function () { alive = false; };
      }, []);

      React.useEffect(function () {
        return function () {
          if (timerRef.current !== null) clearTimeout(timerRef.current);
        };
      }, []);

      function save(patch) {
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(function () {
          writeValues(ctx, patch).then(function (message) { setErr(message || ""); });
        }, SAVE_DEBOUNCE_MS);
      }

      function place() {
        try {
          var el = btnRef.current;
          if (!el || typeof window === "undefined") return;
          var r = el.getBoundingClientRect();
          var width = 264;
          var left = Math.min(Math.max(8, r.left - width + r.width), window.innerWidth - width - 8);
          var top = r.top - 12;
          setBox({ left: left, bottom: window.innerHeight - top });
        } catch (e) { /* 定位失败就按默认位置 */ }
      }

      function togglePanel() {
        if (!open) place();
        setOpen(!open);
      }

      function onToggleEnabled() {
        var next = !state.enabled;
        setState({ enabled: next, temperature: state.temperature });
        save({ enabled: next });
      }

      function onSlide(event) {
        var value = Number(event.target.value);
        if (!isFinite(value)) return;
        setState({ enabled: state.enabled, temperature: value });
        save({ temperature: value });
      }

      var panel = null;
      if (open) {
        panel = ReactDOM.createPortal(
          React.createElement("div", {
            className: "tsamp-panel",
            style: box ? { left: box.left + "px", bottom: box.bottom + "px" } : { right: "16px", bottom: "96px" }
          },
            React.createElement("div", { className: "tsamp-head" },
              React.createElement("span", { className: "tsamp-title" }, "采样温度"),
              React.createElement("span", { className: "tsamp-val" }, state.temperature.toFixed(2))
            ),
            React.createElement("input", {
              className: "tsamp-range",
              type: "range",
              min: MIN,
              max: MAX,
              step: STEP,
              value: state.temperature,
              disabled: !state.enabled,
              onChange: onSlide
            }),
            React.createElement("div", { className: "tsamp-scale" },
              React.createElement("span", null, "0 精确"),
              React.createElement("span", null, "2 发散")
            ),
            React.createElement("div", { className: "tsamp-foot" },
              React.createElement("label", { className: "tsamp-toggle" },
                React.createElement("input", { type: "checkbox", checked: state.enabled, onChange: onToggleEnabled }),
                React.createElement("span", null, "覆盖模型默认")
              ),
              React.createElement("span", { className: "tsamp-hint" }, state.enabled ? "生效中" : "跟随默认")
            ),
            React.createElement("div", { className: "tsamp-hint" }, "思考模式开着时，温度会被上游忽略。"),
            err ? React.createElement("div", { className: "tsamp-err" }, err) : null
          ),
          document.body
        );
      }

      return React.createElement("span", { style: { display: "inline-flex", alignItems: "center" } },
        React.createElement("button", {
          ref: btnRef,
          type: "button",
          className: "tsamp-btn",
          "data-on": state.enabled ? "1" : "0",
          title: "模型采样温度",
          onClick: togglePanel
        },
          React.createElement("span", { className: "tsamp-dot" }),
          "采样"
        ),
        panel
      );
    }

    var inject = ["slots", "remote", "remote.settings"];

    function apply(ctx) {
      installStyles();
      try {
        ctx.slots.inject(SLOT_NAME, function () {
          return ctx.slots.register(
            {
              name: SLOT_NAME,
              id: ENTRY_ID,
              order: ENTRY_ORDER,
              label: function () { return "Temperature"; }
            },
            function SlotComponent(props) {
              return React.createElement(Sampler, Object.assign({}, props, { __ctx: ctx }));
            }
          );
        });
      } catch (error) {
        try { console.error("[temperature-slider] 插槽注册失败，控件不会出现：", error); } catch (e) { /* 忽略 */ }
      }
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.__internals = {
      NS: NS,
      SLOT_NAME: SLOT_NAME,
      toRows: toRows,
      rowOf: rowOf,
      valuesOf: valuesOf,
      Sampler: Sampler
    };

    return module.exports;
  }
});
