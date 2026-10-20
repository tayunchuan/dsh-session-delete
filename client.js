/**
 * Client half of the `dsh-session-delete` bundle.
 *
 * Registers two entries:
 *   1. `sidebar.workspaces.session.menu.item` – the red "删除 / Delete" row
 *      rendered with the same trash-outline + label language as the DeepSeek
 *      web sidebar menu.
 *   2. `shell.overlay` – one confirmation dialog above every column, so the
 *      destructive step is explicit and the row menu can close first.
 *
 * The actual removal uses the host's public `uiWorkspace.archiveSession`
 * operation: the session leaves the sidebar immediately and can be restored
 * from the "All conversations (show archived)" filter.
 */
window.__ModuleLoader__.load({
  id: 'dsh-session-delete',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    const NS = 'session-delete';
    const MENU_SLOT = 'sidebar.workspaces.session.menu.item';
    const OVERLAY_SLOT = 'shell.overlay';
    const MENU_ORDER = 500; // after the shipped rows: pin 100, rename 200, fork 300, archive 400, session-id 450

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

      '.dsd-overlay{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;',
      'padding:24px;background:rgba(15,15,18,.42);pointer-events:auto;animation:dsd-fade-in .12s ease-out}',
      '.dsd-dialog{width:min(420px,100%);box-sizing:border-box;padding:20px;border-radius:12px;',
      'background:var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-1, #fff));color:var(--dsw-alias-label-primary, #1f2329);',
      'border:1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.08));',
      'box-shadow:0 24px 64px rgba(0,0,0,.24);animation:dsd-pop-in .14s ease-out}',
      '.dsd-dialog-title{margin:0;font-size:16px;font-weight:600;line-height:24px}',
      '.dsd-dialog-desc{margin:8px 0 0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary, #6b7280);',
      'white-space:pre-wrap;overflow-wrap:anywhere}',
      '.dsd-dialog-error{margin:12px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary, #e5484d)}',
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

    /** A tiny observable for the pending delete request; the dialog is mounted from it. */
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
          'data-dsh-session-delete': '',
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

    /**
     * Overlay entry: carries the stylesheet for the whole plugin and mounts one
     * dialog per pending request. The style element lives here (not inside the
     * menu button) so it is valid markup and present before the menu opens.
     */
    function DeleteSessionDialog({ usePending, deleteSession, settleDelete, t }) {
      const request = usePending((current) => current);
      return h(
        React.Fragment,
        null,
        h('style', { key: 'style' }, CSS),
        request === null
          ? null
          : h(DeleteSessionConfirm, {
              key: String(request.seq),
              request,
              deleteSession,
              settleDelete,
              t,
            }),
      );
    }

    /** One request's dialog: busy and error state die with its key. */
    function DeleteSessionConfirm({ request, deleteSession, settleDelete, t }) {
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState(null);
      const busyRef = React.useRef(false);
      const confirmRef = React.useRef(null);
      const dialogRef = React.useRef(null);
      const previousFocus = React.useRef(null);
      const settleRef = React.useRef(settleDelete);
      const deleteRef = React.useRef(deleteSession);
      busyRef.current = busy;
      settleRef.current = settleDelete;
      deleteRef.current = deleteSession;

      const close = React.useCallback(() => {
        if (busyRef.current) return;
        settleRef.current();
      }, []);

      React.useEffect(() => {
        previousFocus.current = document.activeElement;
        const confirm = confirmRef.current;
        if (confirm !== null && typeof confirm.focus === 'function') confirm.focus();

        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            if (busyRef.current) return;
            event.preventDefault();
            event.stopPropagation();
            settleRef.current();
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

      const confirm = () => {
        if (busyRef.current) return;
        setBusy(true);
        setError(null);
        Promise.resolve()
          .then(() => deleteRef.current(request.sessionId))
          .then(() => {
            settleRef.current();
          })
          .catch((reason) => {
            setBusy(false);
            setError(reason instanceof Error ? reason.message : String(reason));
          });
      };

      const titleId = 'dsh-session-delete-title';
      const descId = 'dsh-session-delete-desc';

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
            key: 'dialog',
            ref: dialogRef,
            className: 'dsd-dialog',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': titleId,
            'aria-describedby': descId,
          },
          h('h2', { key: 'title', id: titleId, className: 'dsd-dialog-title' }, t('dialog.title')),
          h('p', { key: 'desc', id: descId, className: 'dsd-dialog-desc' }, t('dialog.description', { title: request.title })),
          error === null
            ? null
            : h('p', { key: 'error', className: 'dsd-dialog-error', role: 'alert' }, error),
          h(
            'div',
            { key: 'actions', className: 'dsd-dialog-actions' },
            h(
              'button',
              {
                key: 'cancel',
                type: 'button',
                className: 'dsd-btn dsd-btn-outline',
                disabled: busy,
                onClick: close,
              },
              t('dialog.cancel'),
            ),
            h(
              'button',
              {
                key: 'confirm',
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

        const openDeleteDialog = (request) => {
          seq += 1;
          pending.set({ ...request, seq });
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
