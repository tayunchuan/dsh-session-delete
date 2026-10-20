/**
 * Host half of the session-delete bundle.
 *
 * The whole feature is Client UI: a red "删除 / Delete" row in each sidebar
 * session menu plus its confirmation dialog. The Host exports an empty apply so
 * the bundle row activates and the Client half can be served.
 */
export function apply() {}
