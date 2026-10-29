/**
 * dsh-copy-file —— 浏览器半边
 *
 * 在右侧文档预览头部的 `sidebar.right.tab.document.actions` 列表插槽里加一个按钮：
 * 点击后把当前预览文件的绝对路径 POST 给宿主，由宿主动作把它放进 Windows 剪贴板文件列表，
 * 之后可以直接在资源管理器里 Ctrl+V 粘贴该文件。
 */
window.__ModuleLoader__.load({
  id: "dsh-copy-file",
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");

    var SLOT_NAME = "sidebar.right.tab.document.actions";
    var ENTRY_ID = "copy-file";
    var ENTRY_ORDER = 10;
    var ROUTE = "/dsh-copy-file";
    var STYLE_MARKER = "dsh-copy-file";

    var CSS = [
      ".dcf-btn{width:24px;height:24px;border-radius:9px;border:0;background:transparent;padding:0;",
      "display:inline-flex;align-items:center;justify-content:center;flex:none;cursor:pointer;",
      "color:var(--dsw-alias-label-tertiary);transition:background .12s,color .12s}",
      ".dcf-btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
      ".dcf-btn:disabled{cursor:default;opacity:.55}",
      ".dcf-btn[data-state=done]{color:var(--dsw-alias-state-success-primary,#3fb950)}",
      ".dcf-btn[data-state=error]{color:var(--dsw-alias-state-warning-primary,#d29922)}",
      ".dcf-btn svg{width:16px;height:16px;flex:none}",
    ].join("");

    function installStyles() {
      try {
        if (typeof document === "undefined") return;
        if (document.querySelector('style[data-plugin-css="' + STYLE_MARKER + '"]') !== null) return;
        var tag = document.createElement("style");
        tag.dataset.plugin = STYLE_MARKER;
        tag.dataset.pluginCss = STYLE_MARKER;
        tag.textContent = CSS;
        (document.head || document.documentElement).appendChild(tag);
      } catch (error) {
        /* 样式失败只影响观感 */
      }
    }

    function CopyIcon() {
      return React.createElement(
        "svg",
        { viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
        React.createElement("rect", {
          x: "5", y: "4.5", width: "8", height: "10", rx: "1.4",
          stroke: "currentColor", strokeWidth: "1.2",
        }),
        React.createElement("path", {
          d: "M10 4.5V3.2A1.2 1.2 0 0 0 8.8 2H3.2A1.2 1.2 0 0 0 2 3.2v7.6A1.2 1.2 0 0 0 3.2 12H5",
          stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round",
        }),
      );
    }

    function CheckIcon() {
      return React.createElement(
        "svg",
        { viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
        React.createElement("path", {
          d: "M3.2 8.4 6.4 11.6 12.8 5.2",
          stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round",
        }),
      );
    }

    function WarnIcon() {
      return React.createElement(
        "svg",
        { viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
        React.createElement("path", {
          d: "M8 2.6 14 13H2L8 2.6Z",
          stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round",
        }),
        React.createElement("path", { d: "M8 6.4v3.2", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" }),
        React.createElement("circle", { cx: "8", cy: "11.4", r: "0.7", fill: "currentColor" }),
      );
    }

    var LABELS = {
      idle: "复制文件（可直接粘贴到文件夹）",
      busy: "正在复制…",
      done: "已复制到剪贴板",
      error: "复制失败",
    };

    function CopyFileAction(props) {
      var absolutePath = props && props.absolutePath;
      var [state, setState] = React.useState("idle");
      var [error, setError] = React.useState("");
      var timerRef = React.useRef(0);

      React.useEffect(function () {
        return function () {
          if (timerRef.current) clearTimeout(timerRef.current);
        };
      }, []);

      if (typeof absolutePath !== "string" || absolutePath === "") return null;

      function resetLater() {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(function () {
          timerRef.current = 0;
          setState("idle");
          setError("");
        }, 1800);
      }

      function onClick() {
        if (state === "busy") return;
        setState("busy");
        setError("");
        fetch(ROUTE, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: absolutePath }),
        })
          .then(function (response) {
            return response.json().catch(function () { return null; });
          })
          .then(function (payload) {
            if (payload && payload.ok === true) {
              setState("done");
            } else {
              setState("error");
              setError(String((payload && payload.error) || "unknown error"));
            }
            resetLater();
          })
          .catch(function (failure) {
            setState("error");
            setError(String((failure && failure.message) || failure));
            resetLater();
          });
      }

      var title = LABELS[state] || LABELS.idle;
      if (state === "error" && error) title += "：" + error;
      var icon = state === "done"
        ? React.createElement(CheckIcon)
        : state === "error"
          ? React.createElement(WarnIcon)
          : React.createElement(CopyIcon);

      return React.createElement(
        "button",
        {
          type: "button",
          className: "dcf-btn",
          "data-state": state,
          title: title,
          "aria-label": LABELS.idle,
          disabled: state === "busy",
          onClick: onClick,
        },
        icon,
      );
    }

    function apply(ctx) {
      installStyles();
      try {
        if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") return;
        ctx.slots.inject(SLOT_NAME, function () {
          return ctx.slots.register(
            {
              name: SLOT_NAME,
              id: ENTRY_ID,
              order: ENTRY_ORDER,
            },
            CopyFileAction,
          );
        });
      } catch (error) {
        try {
          console.error("[dsh-copy-file] 插槽注册失败，复制按钮不会出现：", error);
        } catch (ignored) {
          /* ignore */
        }
      }
    }

    exports.apply = apply;
    exports.inject = ["slots"];
    exports.__internals = {
      SLOT_NAME: SLOT_NAME,
      ENTRY_ID: ENTRY_ID,
      ROUTE: ROUTE,
      CopyFileAction: CopyFileAction,
    };
    return module.exports;
  },
});
