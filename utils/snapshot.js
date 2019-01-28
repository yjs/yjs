
/**
 *
 * @param {Item} item
 * @param {import("../protocols/history").HistorySnapshot} [snapshot]
 */
export const isVisible = (item, snapshot) => snapshot === undefined ? !item._deleted : (snapshot.sm.has(item._id.user) && snapshot.sm.get(item._id.user) > item._id.clock && !snapshot.ds.isDeleted(item._id))
