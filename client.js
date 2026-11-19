/**
 * Client half of the `dsh-session-delete` bundle.
 *
 * Registers three entries:
 *   1. `sidebar.workspaces.session.menu.item` – the red "删除 / Delete" row
 *      rendered with the same trash-outline + label language as the DeepSeek
 *      web sidebar menu.
 *   2. `sidebar.footer.action` – a trash button at the sidebar foot that opens
 *      the "清空归档 / Purge archived" confirmation.
 *   3. `shell.overlay` – the confirmation dialogs above every column.
 *
 * Single-session removal uses the host's public `uiWorkspace.archiveSession`
 * operation. Purging archived sessions permanently deletes their logs through
 * this package's Host half (the Client cannot touch files itself).
 */
window.__ModuleLoader__.load({
  id: 'dsh-session-delete',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'session-delete';
    const MENU_SLOT = 'sidebar.workspaces.session.menu.item';
    const FOOTER_SLOT = 'sidebar.footer.action';
    const OVERLAY_SLOT = 'shell.overlay';
    const MENU_ORDER = 500; // after the shipped rows: pin 100, rename 200, fork 300, archive 400, session-id 450
    const FOOTER_ORDER = 100;
    const PURGE_ENDPOINT = 'api/session-delete.purge';

    const DICTS = {
      zh: {
        'menu.delete': '删除',
        'menu.aria': '删除会话“{title}”',
        'dialog.title': '删除会话',
        'dialog.description':
          '“{title}”将从侧边栏移除，正在进行的工作会先停止。之后可在“全部对话（显示已归档）”中恢复。',
        'dialog.cancel': '取消',
        'dialog.confirm': '删除',
        'dialog.busy': '正在删除…',
        'purge.label': '清空归档',
        'purge.aria': '清空已归档会话',
        'purge.title': '清空已归档会话',
        'purge.description':
          '将永久删除 {n} 个已归档会话，共 {size}。日志和投影缓存会从磁盘删除，不可恢复；附件可能残留。',
        'purge.empty': '当前没有已归档会话。',
        'purge.listLabel': '将被删除的会话',
        'purge.confirm': '永久删除',
        'purge.busy': '正在删除…',
        'purge.done': '已删除 {n} 个会话，释放 {size}。',
        'purge.failed': '{n} 个会话删除失败：{ids}',
        'purge.refresh': '刷新页面',
        'purge.close': '关闭',
        'purge.error': '无法读取归档信息：{message}',
        'purge.unavailable': '无法连接 Host，请刷新页面后重试。',
        'purge.note': '刷新页面后侧边栏才会更新。',
      },
      en: {
        'menu.delete': 'Delete',
        'menu.aria': 'Delete session “{title}”',
        'dialog.title': 'Delete session',
        'dialog.description':
          '“{title}” will be removed from the sidebar and any running work will be stopped first. You can restore it later from “All conversations (show archived)”.',
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'Delete',
        'dialog.busy': 'Deleting…',
        'purge.label': 'Purge archived',
        'purge.aria': 'Purge archived sessions',
        'purge.title': 'Purge archived sessions',
        'purge.description':
          'Permanently delete {n} archived session(s), {size} in total. Logs and projection caches are removed from disk and cannot be restored; attachments may remain.',
        'purge.empty': 'There are no archived sessions.',
        'purge.listLabel': 'Sessions to delete',
        'purge.confirm': 'Delete permanently',
        'purge.busy': 'Deleting…',
        'purge.done': 'Deleted {n} session(s), freed {size}.',
        'purge.failed': '{n} session(s) failed to delete: {ids}',
        'purge.refresh': 'Refresh page',
        'purge.close': 'Close',
        'purge.error': 'Could not read archived sessions: {message}',
        'purge.unavailable': 'Could not reach the Host. Refresh the page and try again.',
        'purge.note': 'The sidebar updates after a page refresh.',
      },
    };

    const CSS = [
      '.dsd-menu-item{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;box-sizing:border-box;',
      'margin:4px 0 0;padding:0 8px;border:0;border-top:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      'border-radius:6px;background:transparent;color:var(--dsw-alias-state-error-primary, #e5484d);',
      'font:inherit;font-size:14px;line-height:20px;text-align:left;cursor:pointer;',
      'user-select:none;-webkit-user-select:none;outline:none}',
      '.dsd-menu-item:hover{background:color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5484d) 10%, transparent)}',
      '.dsd-menu-item:active{background:color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5484d) 18%, transparent)}',
      '.dsd-menu-item:focus-visible{outline:2px solid var(--dsw-alias-state-error-primary, #e5484d);outline-offset:-2px}',
      '.dsd-menu-item[disabled]{opacity:.5;cursor:default}',
      '.dsd-menu-icon{display:inline-flex;flex:none;align-items:center;justify-content:center;width:16px;height:16px}',
      '.dsd-menu-icon svg{display:block}',
      '.dsd-menu-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',

      '.dsd-footer{width:28px;height:28px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;',
      'padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary, #6b7280);',
      'cursor:pointer;outline:none;flex:none}',
      '.dsd-footer:hover{background:var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06));',
      'color:var(--dsw-alias-state-error-primary, #e5484d)}',
      '.dsd-footer:focus-visible{outline:2px solid var(--dsw-alias-brand-primary, #4d6bfe);outline-offset:-2px}',
      '.dsd-footer[disabled]{opacity:.5;cursor:default}',
      '.dsd-footer svg{display:block}',

      '.dsd-overlay{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;',
      'padding:24px;background:rgba(15,15,18,.42);pointer-events:auto;animation:dsd-fade-in .12s ease-out}',
      '.dsd-dialog{width:min(460px,100%);box-sizing:border-box;padding:20px;border-radius:12px;',
      'background:var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, #fff));color:var(--dsw-alias-label-primary, #1f2329);',
      'border:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      'box-shadow:0 24px 64px rgba(0,0,0,.24);animation:dsd-pop-in .14s ease-out}',
      '.dsd-dialog-title{margin:0;font-size:16px;font-weight:600;line-height:24px}',
      '.dsd-dialog-desc{margin:8px 0 0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary, #6b7280);',
      'white-space:pre-wrap;overflow-wrap:anywhere}',
      '.dsd-dialog-error{margin:12px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary, #e5484d)}',
      '.dsd-dialog-note{margin:10px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary, #6b7280)}',
      '.dsd-dialog-list{list-style:none;margin:12px 0 0;padding:0;max-height:180px;overflow:auto;',
      'border:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));border-radius:8px}',
      '.dsd-dialog-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;',
      'padding:6px 10px;font-size:13px;line-height:20px}',
      '.dsd-dialog-list li+li{border-top:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08))}',
      '.dsd-dialog-list-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsd-dialog-list-size{flex:none;color:var(--dsw-alias-label-secondary, #6b7280);font-variant-numeric:tabular-nums}',
      '.dsd-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}',
      '.dsd-btn{height:32px;box-sizing:border-box;padding:0 14px;border-radius:8px;font:inherit;font-size:14px;',
      'line-height:20px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
      '.dsd-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary, #4d6bfe);outline-offset:2px}',
      '.dsd-btn[disabled]{opacity:.55;cursor:default}',
      '.dsd-btn-outline{background:transparent;border:1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.16));',
      'color:var(--dsw-alias-label-primary, #1f2329)}',
      '.dsd-btn-outline:hover:not([disabled]){background:var(--dsw-alias-bg-layer-2, rgba(0,0,0,.04))}',
      '.dsd-btn-danger{background:var(--dsw-alias-state-error-primary, #e5484d);border:1px solid transparent;color:#fff}',
      '.dsd-btn-danger:hover:not([disabled]){filter:brightness(1.06)}',

      '@keyframes dsd-fade-in{from{opacity:0}to{opacity:1}}',
      '@keyframes dsd-pop-in{from{opacity:0;transform:translateY(4px) scale(.985)}to{opacity:1;transform:none}}',
      '@media (prefers-reduced-motion: reduce){.dsd-overlay,.dsd-dialog{animation:none}}',
    ].join('');

    /** Trash outline with the three inner bars used by the DeepSeek web menu. */
    function TrashIcon({ size = 16 }) {
      return h(
        'svg',
        {
          viewBox: '0 0 24 24',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('path', { d: 'M4 7h16' }),
        h('path', { d: 'M9.5 7V5.3c0-.75.55-1.3 1.3-1.3h2.4c.75 0 1.3.55 1.3 1.3V7' }),
        h('path', { d: 'M6.6 7l.72 11.2A1.95 1.95 0 0 0 9.27 20h5.46a1.95 1.95 0 0 0 1.95-1.8L17.4 7' }),
        h('path', { d: 'M10 11v5' }),
        h('path', { d: 'M12 11v5' }),
        h('path', { d: 'M14 11v5' }),
      );
    }

    /** A tiny observable for the pending dialog request. */
    function createSnapshotStore(initial) {
      let value = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => value,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        set(next) {
          value = next;
          for (const listener of [...listeners]) listener();
        },
      };
    }

    /** Project one observable snapshot into a Set without rebuilding it on every read. */
    function deriveSet(source, pick) {
      let seen;
      let value = new Set();
      return {
        getSnapshot() {
          const snapshot = source.getSnapshot();
          if (snapshot !== seen) {
            seen = snapshot;
            value = new Set(pick(snapshot) ?? []);
          }
          return value;
        },
        subscribe: (listener) => source.subscribe(listener),
      };
    }

    function formatSize(bytes) {
      const value = Number(bytes);
      if (!Number.isFinite(value) || value <= 0) return '0 B';
      const units = ['B', 'KB', 'MB', 'GB'];
      let amount = value;
      let index = 0;
      while (amount >= 1024 && index < units.length - 1) {
        amount /= 1024;
        index += 1;
      }
      const text = index === 0 || amount >= 10 ? String(Math.round(amount)) : amount.toFixed(1);
      return `${text} ${units[index]}`;
    }

    function purgeFetch() {
      const transport = globalThis.__DSH_TRANSPORT__;
      if (transport !== undefined && typeof transport.fetch === 'function') {
        return transport.fetch.bind(transport);
      }
      if (typeof fetch === 'function') return fetch;
      throw new Error('purge-unavailable');
    }

    async function callPurge(body) {
      const send = purgeFetch();
      const response = await send(PURGE_ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      let data = {};
      try {
        data = await response.json();
      } catch {
        /* a non-JSON failure keeps the status text below */
      }
      if (!response.ok) {
        throw new Error(data && data.error ? data.error : `HTTP ${response.status}`);
      }
      return data;
    }

    function messageOf(error, t) {
      if (error instanceof Error && error.message === 'purge-unavailable') return t('purge.unavailable');
      return error instanceof Error ? error.message : String(error);
    }

    /** Shared modal focus, Escape, and Tab cycle for both dialogs. */
    function useModalFocus(initialFocusRef, onClose, busyRef) {
      const dialogRef = React.useRef(null);
      const previousFocus = React.useRef(null);
      const closeRef = React.useRef(onClose);
      closeRef.current = onClose;
      React.useEffect(() => {
        previousFocus.current = document.activeElement;
        const target = initialFocusRef.current;
        if (target !== null && typeof target.focus === 'function') target.focus();
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            if (busyRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            closeRef.current();
            return;
          }
          if (event.key !== 'Tab') return;
          const dialog = dialogRef.current;
          if (dialog === null) return;
          const focusable = Array.from(dialog.querySelectorAll('button:not([disabled])'));
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          const active = document.activeElement;
          if (event.shiftKey && (active === first || !dialog.contains(active))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
            event.preventDefault();
            first.focus();
          }
        };
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('keydown', onKeyDown, true);
          const previous = previousFocus.current;
          if (previous !== null && typeof previous.focus === 'function') previous.focus();
        };
      }, []);
      return dialogRef;
    }

    /** The menu row: one red button with the trash icon and the label. */
    function DeleteSessionMenuItem({ sessionId, displayTitle, useMenuOpenState, useArchived, openDeleteDialog, t }) {
      const [, setMenuOpen] = useMenuOpenState();
      const archived = useArchived((set) => set.has(sessionId));
      if (archived) return null;
      const title = displayTitle || sessionId;
      return h(
        'button',
        {
          type: 'button',
          role: 'menuitem',
          className: 'dsd-menu-item',
          'data-dsh-session-delete': 'menu',
          'aria-label': t('menu.aria', { title }),
          onClick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            setMenuOpen(false);
            openDeleteDialog({ sessionId, title });
          },
        },
        h('span', { key: 'icon', className: 'dsd-menu-icon', 'aria-hidden': 'true' }, h(TrashIcon, { size: 16 })),
        h('span', { key: 'label', className: 'dsd-menu-label' }, t('menu.delete')),
      );
    }

    /** Sidebar-foot action: asks the Host for the archive plan, then opens the dialog. */
    function PurgeFooterAction({ openPurgeDialog, t }) {
      const [busy, setBusy] = React.useState(false);
      const click = () => {
        if (busy) return;
        setBusy(true);
        callPurge({ dryRun: true })
          .then((plan) => openPurgeDialog({ plan }))
          .catch((error) => openPurgeDialog({ error }))
          .finally(() => setBusy(false));
      };
      return h(
        'button',
        {
          type: 'button',
          className: 'dsd-footer',
          title: t('purge.aria'),
          'aria-label': t('purge.aria'),
          'data-dsh-session-delete': 'purge',
          disabled: busy,
          onClick: click,
        },
        h(TrashIcon, { size: 16 }),
      );
    }

    /** Overlay entry: carries the stylesheet and dispatches one dialog per request. */
    function DeleteSessionDialog({ usePending, deleteSession, settleDelete, t }) {
      const request = usePending((current) => current);
      let content = null;
      if (request !== null) {
        content =
          request.mode === 'purge'
            ? h(PurgeConfirm, { key: `p${request.seq}`, request, settleDelete, t })
            : h(DeleteSessionConfirm, { key: `s${request.seq}`, request, deleteSession, settleDelete, t });
      }
      return h(React.Fragment, null, h('style', { key: 'style' }, CSS), content);
    }

    /** One session's delete confirmation. */
    function DeleteSessionConfirm({ request, deleteSession, settleDelete, t }) {
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const busyRef = React.useRef(false);
      const confirmRef = React.useRef(null);
      const settleRef = React.useRef(settleDelete);
      const deleteRef = React.useRef(deleteSession);
      busyRef.current = busy;
      settleRef.current = settleDelete;
      deleteRef.current = deleteSession;

      const close = React.useCallback(() => {
        if (busyRef.current) return;
        settleRef.current();
      }, []);
      const dialogRef = useModalFocus(confirmRef, close, busyRef);

      const confirm = () => {
        if (busyRef.current) return;
        setBusy(true);
        setError(null);
        Promise.resolve()
          .then(() => deleteRef.current(request.sessionId))
          .then(() => settleRef.current())
          .catch((reason) => {
            setBusy(false);
            setError(reason instanceof Error ? reason.message : String(reason));
          });
      };

      return h(
        'div',
        {
          className: 'dsd-overlay',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) close();
          },
        },
        h(
          'div',
          {
            ref: dialogRef,
            className: 'dsd-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'dsd-session-title',
            'aria-describedby': 'dsd-session-desc',
          },
          h('h2', { id: 'dsd-session-title', className: 'dsd-dialog-title' }, t('dialog.title')),
          h('p', { id: 'dsd-session-desc', className: 'dsd-dialog-desc' }, t('dialog.description', { title: request.title })),
          error === null ? null : h('p', { className: 'dsd-dialog-error', role: 'alert' }, error),
          h(
            'div',
            { className: 'dsd-dialog-actions' },
            h(
              'button',
              { type: 'button', className: 'dsd-btn dsd-btn-outline', disabled: busy, onClick: close },
              t('dialog.cancel'),
            ),
            h(
              'button',
              {
                ref: confirmRef,
                type: 'button',
                className: 'dsd-btn dsd-btn-danger',
                disabled: busy,
                onClick: confirm,
              },
              busy ? t('dialog.busy') : t('dialog.confirm'),
            ),
          ),
        ),
      );
    }

    /** Purge confirmation: plan first, then the irreversible apply. */
    function PurgeConfirm({ request, settleDelete, t }) {
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(request.error === null || request.error === undefined ? null : messageOf(request.error, t));
      const [result, setResult] = React.useState(null);
      const busyRef = React.useRef(false);
      const settleRef = React.useRef(settleDelete);
      const actionRef = React.useRef(null);
      busyRef.current = busy;
      settleRef.current = settleDelete;

      const close = React.useCallback(() => {
        if (busyRef.current) return;
        settleRef.current();
      }, []);
      const dialogRef = useModalFocus(actionRef, close, busyRef);

      const plan = request.plan;
      const count = plan === null || plan === undefined ? 0 : Number(plan.count) || 0;
      const bytes = plan === null || plan === undefined ? 0 : Number(plan.bytes) || 0;
      const failed = result !== null && Array.isArray(result.failed) ? result.failed : [];
      const deleted = result !== null && Array.isArray(result.deleted) ? result.deleted : [];
      const canDelete = error === null && result === null && plan !== null && plan !== undefined && count > 0;

      const confirm = () => {
        if (busyRef.current || !canDelete) return;
        setBusy(true);
        setError(null);
        callPurge({ apply: true })
          .then((data) => {
            setBusy(false);
            setResult(data);
          })
          .catch((reason) => {
            setBusy(false);
            setError(messageOf(reason, t));
          });
      };

      let description;
      if (result !== null) {
        description = t('purge.done', { n: deleted.length, size: formatSize(result.freedBytes) });
      } else if (error !== null) {
        description = t('purge.error', { message: error });
      } else if (count === 0) {
        description = t('purge.empty');
      } else {
        description = t('purge.description', { n: count, size: formatSize(bytes) });
      }

      const actions = [];
      if (result !== null) {
        actions.push(
          h(
            'button',
            {
              key: 'refresh',
              ref: actionRef,
              type: 'button',
              className: 'dsd-btn dsd-btn-danger',
              onClick: () => window.location.reload(),
            },
            t('purge.refresh'),
          ),
          h('button', { key: 'close', type: 'button', className: 'dsd-btn dsd-btn-outline', onClick: close }, t('purge.close')),
        );
      } else if (count > 0 && error === null) {
        actions.push(
          h('button', { key: 'cancel', type: 'button', className: 'dsd-btn dsd-btn-outline', disabled: busy, onClick: close }, t('dialog.cancel')),
          h(
            'button',
            {
              key: 'confirm',
              ref: actionRef,
              type: 'button',
              className: 'dsd-btn dsd-btn-danger',
              disabled: busy,
              onClick: confirm,
            },
            busy ? t('purge.busy') : t('purge.confirm'),
          ),
        );
      } else {
        actions.push(
          h(
            'button',
            { key: 'close', ref: actionRef, type: 'button', className: 'dsd-btn dsd-btn-outline', onClick: close },
            t('purge.close'),
          ),
        );
      }

      return h(
        'div',
        {
          className: 'dsd-overlay',
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) close();
          },
        },
        h(
          'div',
          {
            ref: dialogRef,
            className: 'dsd-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': 'dsd-purge-title',
            'aria-describedby': 'dsd-purge-desc',
          },
          h('h2', { id: 'dsd-purge-title', className: 'dsd-dialog-title' }, t('purge.title')),
          h('p', { id: 'dsd-purge-desc', className: 'dsd-dialog-desc' }, description),
          count > 0 && result === null && error === null
            ? h(
                'ul',
                { className: 'dsd-dialog-list', 'aria-label': t('purge.listLabel') },
                (plan.items || []).map((item) =>
                  h(
                    'li',
                    { key: item.id },
                    h('span', { className: 'dsd-dialog-list-title' }, item.title || item.id),
                    h('span', { className: 'dsd-dialog-list-size' }, formatSize(item.bytes)),
                  ),
                ),
              )
            : null,
          result !== null && failed.length > 0
            ? h(
                'p',
                { className: 'dsd-dialog-error', role: 'alert' },
                t('purge.failed', { n: failed.length, ids: failed.map((item) => item.id).join(', ') }),
              )
            : null,
          result !== null ? h('p', { className: 'dsd-dialog-note' }, t('purge.note')) : null,
          h('div', { className: 'dsd-dialog-actions' }, actions),
        ),
      );
    }

    return {
      inject: ['slots', 'locale', 'workspaces', 'uiWorkspace'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'zh', DICTS.zh), 'session-delete: Chinese dictionary');
        ctx.effect(() => ctx.locale.register(NS, 'en', DICTS.en), 'session-delete: English dictionary');

        const workspaces = ctx.get('workspaces');
        const uiWorkspace = ctx.get('uiWorkspace');
        if (workspaces === undefined || uiWorkspace === undefined) return;

        const archivedSet = deriveSet(workspaces.list, (snapshot) => snapshot.archivedSessionIds);
        const pending = createSnapshotStore(null);
        let seq = 0;

        const openDeleteDialog = ({ sessionId, title }) => {
          seq += 1;
          pending.set({ mode: 'session', sessionId, title, seq });
        };
        const openPurgeDialog = ({ plan, error }) => {
          seq += 1;
          pending.set({ mode: 'purge', plan: plan ?? null, error: error ?? null, seq });
        };
        const settleDelete = () => {
          pending.set(null);
        };
        const deleteSession = (sessionId) => uiWorkspace.archiveSession(sessionId, { stopActivity: true });

        ctx.slots.inject(MENU_SLOT, () =>
          ctx.slots.register(
            {
              name: MENU_SLOT,
              id: 'session-delete',
              order: MENU_ORDER,
              locale: NS,
              inject: () => ({
                hooks: { archived: archivedSet },
                openDeleteDialog,
              }),
            },
            DeleteSessionMenuItem,
          ),
        );

        ctx.slots.inject(FOOTER_SLOT, () =>
          ctx.slots.register(
            {
              name: FOOTER_SLOT,
              id: 'session-delete.purge',
              order: FOOTER_ORDER,
              locale: NS,
              inject: () => ({ openPurgeDialog }),
            },
            PurgeFooterAction,
          ),
        );

        ctx.slots.inject(OVERLAY_SLOT, () =>
          ctx.slots.register(
            {
              name: OVERLAY_SLOT,
              id: 'session-delete.confirm',
              order: 50,
              locale: NS,
              inject: () => ({
                hooks: { pending },
                deleteSession,
                settleDelete,
              }),
            },
            DeleteSessionDialog,
          ),
        );
      },
    };
  },
});
