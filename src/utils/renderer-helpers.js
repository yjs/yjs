import * as s from 'lib0/schema'
import * as error from 'lib0/error'
import { ObservableV2 } from 'lib0/observable'

import { createIdSet } from './ids.js'

export const attributionJsonSchema = s.$object({
  insert: s.$array(s.$string).optional,
  insertAt: s.$number.optional,
  delete: s.$array(s.$string).optional,
  deleteAt: s.$number.optional,
  format: s.$record(s.$string, s.$array(s.$string)).optional,
  formatAt: s.$number.optional
})

/**
 * @todo rename this to `insertBy`, `insertAt`, ..
 *
 * @typedef {s.Unwrap<typeof attributionJsonSchema>} Attribution
 */

/**
 * @template T
 */
export class AttributedContent {
  /**
   * @param {AbstractContent} content
   * @param {number} clock
   * @param {boolean} deleted
   * @param {Array<ContentAttribute<T>> | null} attrs
   * @param {0|1|2|3} renderBehavior
   */
  constructor (content, clock, deleted, attrs, renderBehavior) {
    this.content = content
    this.clock = clock
    this.deleted = deleted
    this.attrs = attrs
    this.render = renderBehavior === 0 ? false : (renderBehavior === 1 ? (!deleted || attrs != null) : true)
    /**
     * Fresh content that was deleted in the same transaction (mode `3`): even in a
     * `retainDeletes` render it must produce an *insert* — the consuming state (e.g. the
     * maintained `delta` cache) has never seen this content, so there is nothing to retain.
     */
    this.fresh = renderBehavior === 3
  }
}

/**
 * Abstract base class for renderers. A renderer renders Content (with Attributions) to a delta.
 *
 * Should fire an event when the attributions changed _after_ the original change happens. This
 * Event will be used to update the attribution on the current content.
 *
 * Only items claimed via {@link AbstractRenderer#hasItem} reach the renderer — everything else is
 * rendered by the generic fast path (as-is, without attributions, deleted content invisible) or,
 * when `hasItem` returns `2`, ignored.
 *
 * A write (a piece of content) has one of three outcomes in the rendered state:
 * - it **renders**: alive, or deleted under an attribution;
 * - it is a **tombstone**: deleted and unattributed — it was visible while it was alive, so a change
 *   render that deletes it emits a `delete` (lists) or `deleteAttr` (a map key whose newest write it
 *   is), and a map key whose newest write is a tombstone is absent;
 * - it is **ignored**: not part of the rendered state at all, alive or deleted (e.g. content written
 *   after a captured past state). It emits nothing in any render, a map key steps over it to the
 *   value it overwrote, and a delete through the renderer steps over it too (it addresses the
 *   rendered state), so it stays untouched. A whole item is ignored via `hasItem() === 2`; the
 *   ignored parts of a claimed item yield no piece from `readContent`.
 *
 * Rendering garbage-collected content is unspecified — renderers that restore deleted content (e.g.
 * a past-state view) require `gc: false`.
 *
 * @extends {ObservableV2<{change:(idset:IdSet,origin:any,local:boolean)=>void}>}
 */
export class AbstractRenderer extends ObservableV2 {
  constructor () {
    super()
    /**
     * Ids of the content this renderer attributes. May over-approximate —
     * {@link AbstractRenderer#readContent} remains authoritative for what is actually rendered.
     * The default {@link AbstractRenderer#hasItem} claims exactly this set and leaves everything
     * else to the generic fast path; a renderer that also restores or ignores content outside it
     * (e.g. an `AttributionsRenderer` with `renderedContent`) overrides `hasItem`.
     *
     * @type {IdSet}
     */
    this.attributed = createIdSet()
  }

  /**
   * How `item` renders:
   * - `0` — generic fast path: as-is, without attributions, deleted content is a tombstone;
   * - `1` — through this renderer ({@link AbstractRenderer#readContent},
   *   {@link AbstractRenderer#contentLength}); any part of the item may render non-normally;
   * - `2` — ignored: the whole item is not part of the rendered state, whether alive or deleted. It
   *   contributes no ops in any render (full or change), has length `0`, never reaches the format
   *   state machine, a map key steps over it to the value it overwrote, and a delete through this
   *   renderer leaves it untouched.
   *
   * `false` and `true` are accepted as `0` and `1`.
   *
   * @param {Item} item
   * @return {0|1|2|boolean}
   */
  hasItem (item) {
    return this.attributed.intersects(item.id.client, item.id.clock, item.length) ? 1 : 0
  }

  /**
   * @param {Array<AttributedContent<any>>} _contents - where to write the result
   * @param {number} _client
   * @param {number} _clock
   * @param {boolean} _deleted
   * @param {AbstractContent} _content
   * @param {0|1|2|3} _shouldRender - 0: if undeleted or attributed, render as a retain operation. 1: render only if undeleted or attributed. 2: render as insert operation (if unattributed and deleted, render as delete). 3: fresh content deleted in the same transaction, marked {@link AttributedContent#fresh} — render as insert where attributed (it must insert even in a `retainDeletes` render: the consuming state has never seen it), as *nothing* where unattributed (invisible; a delete op would misapply).
   */
  readContent (_contents, _client, _clock, _deleted, _content, _shouldRender) {
    error.methodUnimplemented()
  }

  /**
   * Calculate the length of the attributed content. This is used by iterators that walk through the
   * content.
   *
   * If the content is not countable, it should return 0.
   *
   * @param {Item} _item
   * @return {number}
   */
  contentLength (_item) {
    error.methodUnimplemented()
  }
}

export const $renderer = AbstractRenderer.prototype.$type = s.$type('y:renderer', AbstractRenderer)

/**
 * Rendered length of `item` under `renderer`: the generic rule — alive countable content renders
 * at full length, everything else at length `0` — unless the renderer claims the item (or ignores
 * it: length `0`).
 *
 * @param {AbstractRenderer?} renderer
 * @param {Item} item
 * @return {number}
 */
export const rendererContentLength = (renderer, item) => {
  const mode = rendererMode(renderer, item)
  return mode === 2
    ? 0
    : (mode === 1
        ? /** @type {AbstractRenderer} */ (renderer).contentLength(item)
        : ((item.deleted || !item.content.isCountable()) ? 0 : item.length))
}

/**
 * {@link AbstractRenderer#hasItem} normalized to `0|1|2` (`false`/`true` → `0`/`1`); `0` without a
 * renderer.
 *
 * @param {AbstractRenderer?} renderer
 * @param {Item} item
 * @return {0|1|2}
 */
export const rendererMode = (renderer, item) => renderer === null ? 0 : /** @type {0|1|2} */ (+renderer.hasItem(item))
